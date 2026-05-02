// src/lib/blob-stream.ts
//
// Drain a Web ReadableStream returned by @vercel/blob's get() into a
// Buffer / string.
//
// We had been doing `Buffer.from(await new Response(stream).arrayBuffer())`
// and the equivalent `.text()`. Both work in Bun and locally in `next dev`.
// In production on Vercel Fluid Compute (Node.js), wrapping the blob stream
// in a Web `Response` and reading it back hangs forever — the cron's
// 12 MB ASN db fetch never produced a `drain_done` log line, the function
// just sat at full elapsed_ms until the 300s platform timeout.
//
// Pulling chunks straight off the reader avoids whatever `Response`-wrap
// quirk is at play and is also less indirection.

export async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const buf = await streamToBuffer(stream)
  return buf.toString("utf8")
}
