# 02 — URL coord encoding

**Question.** Compare base62 (prime-moments precedent) against alternatives for the share-link state codec.

**Decision.** Keep base62. Mirror the prime-moments codec verbatim.

## Method

1000 random viewport states, sampled from the explorer's plausible reach:

- `cx, cy ~ uniform in [-1e6, 1e6]`
- `zoom ~ log-uniform in [1, 1000]`
- `level ~ uniform int in [-2, 3]`

State packs four nonneg int32s: cx, cy at 1e-3 precision (sub-pixel at every plausible zoom; fits int32 via `+2^31` offset); zoom at 1e-2; level offset `+10`. Four encodings tested:

- `base62` — each int base62-encoded, dot-joined.
- `b64url` — packed little-endian into a 16-byte buffer, base64url-encoded.
- `hex` — each int hex-encoded, dot-joined.
- `json` — `encodeURIComponent(JSON.stringify({cx, cy, z, l}))`.

[`02-url-encoding.ts`](./02-url-encoding.ts).

## Numbers

```
encoding  min   mean   p95   max   example
base62    18    18.5   19    19    2lkFOa.2lhjl2.16y.b
b64url    22    22.0   22    22    OjAAgOz183-aEAAACwAAAA
hex       22    23.4   25    25    8000303a.7ff3f5ec.109a.b
json      77    83.7   86    87    %7B%22cx%22%3A12.346…
```

Example state: `cx=12.346, cy=-789.012, zoom=42.5, level=1`.

## Interpretation

- base62 wins by 3-4 chars over b64url at p95. The gap widens at the small-state end of the distribution because base62 is variable-width.
- b64url's 16-byte fixed buffer pays alignment overhead on small ints.
- hex is uniformly longer; json is 4× longer once urlencoded.

## Citation

The shipped `lib/encoding.ts` mirrors `src/app/x/prime-moments/lib/encoding.ts` — four nonneg int32s (cx, cy via `+2^31` offset; level via `+10` offset), base62-encoded, dot-joined.

Final URL form:

```
/x/penrose/explore?s=<seed>&v=<cx62>.<cy62>.<zoom62>&l=<lvl62>
```

Decode failures fall back to defaults silently.
