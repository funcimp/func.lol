# Penrose — Standalone libraries: survey and structure

Research note, 2026-07-04. Idea parked, not started. The question: extract the
engine under `src/app/x/penrose/explore/lib` into standalone libraries for
TypeScript, Python, and Go. This note records the ecosystem survey and the
structure we would use, so the decision is already made when we pick it up.

## What exists today (surveyed 2026-07-04)

Every implementation we found answers "give me polygons to draw." None treats
the tiling as an addressable mathematical object.

**TypeScript / JavaScript.** No serious published library.

- [patterncollider](https://github.com/aatishb/patterncollider) — the best of
  them, a real de Bruijn multigrid, but a Vue app, not a package.
- Demo repos: [apaleyes/penrose-tiling](https://github.com/apaleyes/penrose-tiling)
  (triangle subdivision), [guinetik/penrose-js](https://github.com/guinetik/penrose-js),
  [rictorlome/penrose](https://github.com/rictorlome/penrose) (p5.js),
  [penrose-ii](https://fanyangxyz.github.io/penrose-ii/) (pentagrid demo).
- Bare `penrose` on npm is the CMU diagramming language
  ([@penrose/core](https://www.npmjs.com/package/@penrose/core)); a tiling
  package must use a scope or another name.

**Python.** The most mature ecosystem, still generation-only.

- [pynrose](https://pypi.org/project/pynrose/) — published package, de Bruijn
  method, P3, SVG out. Closest prior art; no addressing.
- [xnx/penrose](https://github.com/xnx/penrose) — subdivision SVG generator.
- [joshcol9232/tiling](https://github.com/joshcol9232/tiling) (`dualgrid`) —
  de Bruijn in arbitrary dimensions, STL export.
- [pywonderland](https://github.com/neozhaoliang/pywonderland) — reference
  implementations, educational gallery, not a library.
- Adjacent: [gglouser/cut-and-project-tiling](https://github.com/gglouser/cut-and-project-tiling)
  (Rust/WASM, arbitrary cutting planes).

**Go.** Green field. Nothing library-shaped found; toys and an esolang
([Painrose](https://github.com/mousetail/Painrose)).

## The gap our engine fills

1. **Exact ℤ⁵ addressing.** Tile identity `[n; j, k]`, stable coordinates, a
   wire codec. Nobody ships coordinates as API.
2. **O(visible) viewport enumeration.** The fixed-gamma pentagrid enumerator,
   verified key-for-key against the cut-and-project oracle, so unbounded
   panning is a library feature.
3. **The matching rule as computed, tested data.** Arc decoration with
   shared-edge continuity tests; unique patch decoration by propagation.
4. **The substitution ↔ pentagrid bridge.** The fold (D'Andrea Thm 5.16, see
   `09-the-fold.md`) as working code. Not available anywhere as a library.

## Structure, decided in advance

One monorepo. **Go gets the repo root**, because Go is the only ecosystem
where identity = repository layout (a module in a subdirectory carries a
`go/vX.Y.Z` tag prefix forever; npm and PyPI publish from anywhere).

```
github.com/funcimp/penrose        (or n2p5/penrose; org undecided)
├── go.mod        module github.com/funcimp/penrose
├── *.go          the Go implementation
├── spec/         spec.md + golden test vectors (JSON)
├── ts/           npm: @funcimp/penrose (scope sidesteps the CMU collision)
└── python/       PyPI: needs a distinct name (pynrose is taken)
```

**The spec vectors are the real product of the monorepo.** Golden JSON
generated from the tested TS engine: viewport → expected face keys, codec
round-trips, arc crossing points, oracle patches. Each port's test suite
consumes the same files, so "port to Python" becomes make-the-vectors-pass,
not re-derive-the-math. Version the vectors; lockstep the packages' minor
versions to the vector version so parity is checkable.

**Org and import-path stability.** If the repo ever moves, Go consumers break.
Either pick the org to keep (funcimp leans right: the research and citations
live here), or decouple with a vanity import path (`func.lol/penrose` via a
`go-import` meta tag served from the site) at the cost of a little
infrastructure.

**API surface (instinct, to be designed twice).** Four seams and nothing else
exported: enumerate (viewport → faces), address (face ↔ `[n; j, k]` ↔ wire
codec), decorate (matching-rule arcs), deflate/inflate. The `explore/lib`
modules are already pure functions with zero runtime dependencies, so the TS
extraction is mostly moving files and writing the README.
