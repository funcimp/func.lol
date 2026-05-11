# Accept-Encoding and the cost of the bomb

Research only. No implementation lives in this folder.

## The discovery

On 2026-05-10 a Vercel alert reported Fast Data Transfer climbing to ~95 GB across 50 requests in one hour, all sourced from `/api/tripwire/bomb/[kind]`. Scanners from Hetzner cloud were probing `/setup.php`, `/configuration.php-dist`, `/.git/config`. The math: ~2 GB per request on the wire, not the few-MB compressed payload we precompute.

The bomb is built at deploy time with gzip -9 and stored as `public/.bomb.<kind>.gz`. The route streams the file with `Content-Encoding: gzip`. Intended path:

1. Scanner asks for the bait.
2. Vercel edge forwards the compressed bytes (a few MB).
3. Scanner's client decompresses to ~2 GB.

Actual path when the scanner does not send `Accept-Encoding: gzip`:

1. Scanner asks for the bait.
2. Vercel edge transparently decodes the response before egress because the client did not advertise gzip.
3. Scanner receives ~2 GB on the wire. We pay Fast Data Transfer for every byte.

The 95 GB figure implies effectively all 50 hits came from non-gzip clients. Common in low-effort scanners: raw masscan, naive curl wrappers, custom socket scrapers. `Vary: Accept-Encoding` does not help. Vary controls cache keying, not egress encoding.

## Design space

| Option | Wire cost / hit | Scanner pain | Notes |
| ------ | --------------- | ------------ | ----- |
| 404 or 406 fast refusal | ~0 | none | Scanner flags path dead and walks. Cheap, no engagement. |
| Reuse 2 MB demo bomb | ~2 MB | trivial | Smallest change. Equivalent to a giant 404. |
| New 100 MB medium bomb tier | ~100 MB | meaningful | ~5 GB/hr at current volume. Still ~20x cheaper than today. |
| 418 / 426 / 402 status | ~0 | none + joke | 4xx ends the engagement cleanly. Funny in logs. |
| 204 + tarpit | ~0 | medium | Empty success may encourage neighbor-path retries. |
| 200 + cliffhanger body + tarpit | ~100 bytes | high | Keeps the scanner on the line. Bandwidth nil, traded for function-time. |

The leading direction is **200 + cliffhanger + tarpit**. The cliffhanger body starts a juicy-looking response and stops mid-secret, matched to the bait kind:

- html: `<form action=/login method=POST><input name=u><input name=p>`
- json: `{"status":"ok","admin_token":"`
- yaml: `database:\n  password: `
- env: `DB_PASSWORD=`

Each looks like the opening bytes of an exploit-worthy response. The scanner's pattern matcher flags it as "this is the thing." The connection then idles before the function closes it.

Status code stays 200. Anything in the 4xx range tells the scanner to walk; a 2xx keeps them parsing and waiting.

## Implementation knobs (deferred)

- **Tarpit shape.** Dumb `await sleep(N)` versus an abort-aware loop that exits when `req.signal.aborted` fires. Same scanner pain, lower function-time cost when the scanner closes first.
- **Bytes shape.** Single delayed flush versus trickle bytes over the full hold. Trickle prevents read-timeout-driven early aborts. Trickle requires a `ReadableStream` that pushes on a timer.
- **`maxDuration` on the route.** Vercel Node functions default to 15s on Pro. A 25s tarpit needs `export const maxDuration = 30`. Runtime export — architectural change per [`CLAUDE.md`](../../CLAUDE.md), needs maintainer sign-off.
- **Routing.** Proxy detects no-gzip bait and rewrites to a dedicated `/api/tripwire/tarpit/[kind]` route. The bomb route keeps its own check for direct probes (since `/api/` is excluded from the proxy matcher).

## Observability

- New event disposition `tripwire.tarpit`, parallel to `tripwire.hit` and `tripwire.throttled`.
- Record `accept_encoding` raw (truncated, same convention as `ua_raw`) and `tarpit_held_ms`.
- Aggregator counts hits and tarpits separately; `byDay` splits accordingly.
- DB column for disposition can be nullable; old events default to `hit`.

## The compliance angle

If we capture `accept_encoding` per event, we can detect scanners that come back *with* gzip after being tarpitted. Per-IP cross-time walk: tarpit followed by a hit with gzip advertised, within some window. Surface as `compliedIps` and as a landing-page stat ("scanners who learned the etiquette").

This is the funniest measurable thing in the whole experiment. Reason to capture `accept_encoding` from day one even if the tarpit ships later.

## Open questions

- What fraction of scanners advertise gzip today? Sizes both the problem and the win.
- Does 200 + tarpit measurably engage scanners longer than 4xx, or do most still walk on idle? Telemetry.
- Is N × 25s of function-time genuinely cheaper than the bandwidth bill from the status quo? Cost model against current scanner volume.
- Should the tarpit Content-Type match the bait kind, or is `text/plain` sufficient? Cliffhangers per kind suggest matching.
- Does the proxy emit the tarpit event, or does the route emit it? Throttling is emitted from the proxy today, which argues for symmetry.

## Status

Recorded, not implemented. Tarpit is the leading direction. Decision deferred pending architectural sign-off on `maxDuration` and a call on whether function-time spend is worth the entertainment value.
