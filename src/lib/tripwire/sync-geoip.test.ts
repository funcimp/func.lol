// src/lib/tripwire/sync-geoip.test.ts
import { describe, test, expect } from "bun:test"
import { gzipSync } from "node:zlib"
import { extractFileFromTarGz } from "./sync-geoip"

const BLOCK = 512

// Build a minimal POSIX ustar tarball containing a single file.
// Mirrors the shape MaxMind ships: "<dir>/<basename>" inside a tarball.
function makeTarGz(entries: Array<{ name: string; body: Buffer }>): Buffer {
  const blocks: Buffer[] = []
  for (const { name, body } of entries) {
    const header = Buffer.alloc(BLOCK, 0)
    header.write(name, 0, 100, "utf8")
    header.write("0000644\0", 100, 8, "ascii") // mode
    header.write("0000000\0", 108, 8, "ascii") // uid
    header.write("0000000\0", 116, 8, "ascii") // gid
    header.write(body.length.toString(8).padStart(11, "0") + "\0", 124, 12, "ascii")
    header.write("00000000000\0", 136, 12, "ascii") // mtime
    header.write("        ", 148, 8, "ascii") // chksum placeholder (spaces)
    header.write("0", 156, 1, "ascii") // typeflag: regular file
    header.write("ustar\0", 257, 6, "ascii")
    header.write("00", 263, 2, "ascii")

    let sum = 0
    for (let i = 0; i < BLOCK; i++) sum += header[i]
    header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii")

    blocks.push(header)
    const padded = Buffer.alloc(Math.ceil(body.length / BLOCK) * BLOCK, 0)
    body.copy(padded)
    blocks.push(padded)
  }
  blocks.push(Buffer.alloc(BLOCK, 0))
  blocks.push(Buffer.alloc(BLOCK, 0))
  return gzipSync(Buffer.concat(blocks))
}

describe("extractFileFromTarGz", () => {
  test("finds a file by basename inside a directory", () => {
    const body = Buffer.from("fake mmdb payload, not actually a database")
    const tar = makeTarGz([
      { name: "GeoLite2-ASN_20260503/COPYRIGHT.txt", body: Buffer.from("c") },
      { name: "GeoLite2-ASN_20260503/GeoLite2-ASN.mmdb", body },
    ])
    const out = extractFileFromTarGz(tar, "GeoLite2-ASN.mmdb")
    expect(out.equals(body)).toBe(true)
  })

  test("handles bodies that are not block-aligned", () => {
    const body = Buffer.alloc(1000, 7) // 1000 bytes, spans 2 blocks
    const tar = makeTarGz([{ name: "dir/file.bin", body }])
    expect(extractFileFromTarGz(tar, "file.bin").equals(body)).toBe(true)
  })

  test("throws when the file is missing", () => {
    const tar = makeTarGz([{ name: "dir/other.txt", body: Buffer.from("x") }])
    expect(() => extractFileFromTarGz(tar, "missing.mmdb")).toThrow(/not found/)
  })
})
