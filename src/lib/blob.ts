// src/lib/blob.ts
//
// Thin wrapper over @vercel/blob.put(). Production calls pass straight
// through. When BLOB_BASE_URL is set the call becomes an HTTP PUT to a
// local fake server, which is what e2e/fake-blob.ts uses so Playwright
// can exercise the write path without a real blob store.

import { put as vercelPut, type PutBlobResult } from "@vercel/blob"

type PutBlobBody = Parameters<typeof vercelPut>[1]
type PutBlobOptions = Parameters<typeof vercelPut>[2]

export async function putBlob(
  pathname: string,
  body: PutBlobBody,
  opts: PutBlobOptions,
): Promise<PutBlobResult> {
  const fakeBaseUrl = process.env.BLOB_BASE_URL
  if (fakeBaseUrl) return fakePut(fakeBaseUrl, pathname, body, opts)
  return vercelPut(pathname, body, opts)
}

async function fakePut(
  baseUrl: string,
  pathname: string,
  body: PutBlobBody,
  opts: PutBlobOptions,
): Promise<PutBlobResult> {
  const contentType =
    "contentType" in opts && typeof opts.contentType === "string"
      ? opts.contentType
      : undefined
  const headers: Record<string, string> = {}
  if (contentType) headers["content-type"] = contentType
  const res = await fetch(`${baseUrl}/${pathname}`, {
    method: "PUT",
    headers,
    body: body as BodyInit,
  })
  if (!res.ok) {
    throw new Error(`fake blob PUT failed: ${res.status} ${res.statusText}`)
  }
  const url = `${baseUrl}/${pathname}`
  return {
    url,
    pathname,
    contentType: contentType ?? "application/octet-stream",
    contentDisposition: `attachment; filename="${pathname.split("/").pop() ?? pathname}"`,
    downloadUrl: url,
    etag: "fake-etag",
  }
}
