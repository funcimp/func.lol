# Prime Moments — Research

Prime constellations in family ages: the calendar windows when every member of a family has a prime age at once.

Backs the [Prime Moments lab](../../src/app/x/prime-moments/). The lab is the finder; this folder is the math and the Go enumerator.

## Origin

The observation that started it:

> Sarah just turned 41. Before she turns 42, Lyra and I will be turning 11 and 43. Sarah and I will be a prime pair (41, 43), and Lyra will be a prime (11).

Three ages, all prime, all at once — an instance of a pattern. The offset shape `[0, 30, 32]` also hits at `(29, 59, 61)`, `(41, 71, 73)`, and `(71, 101, 103)`. One family hits it four times in a lifetime.

## Key concepts

- **Prime constellation.** A set of offsets from a base prime. `[0, 30, 32]` = three primes where the gaps from the smallest are 30 and 32. The constellation is the shape; an instance is the actual numbers.
- **Prime moment.** The calendar window during which every member of a real family has a prime age at once. An instance of a constellation anchored to real birthdays.
- **Toups Primes.** The constellation `[0, 30, 32]`. Named after the family whose ages inspired the search. Instances under 10,000 begin:

  ```text
  (11, 41, 43)
  (29, 59, 61)
  (41, 71, 73)
  (71, 101, 103)
  (107, 137, 139)
  (149, 179, 181)
  ...  (88 total under 10,000)
  ```

- **Admissible constellation.** A pattern that can occur infinitely often (Hardy–Littlewood conjecture). Necessary but not sufficient for repetition.
- **Prime family constellation.** A constellation realizable as the ages of real parents and children under demographic constraints.

## Why we exclude 2

2 is the only even prime. Any constellation containing it has odd offsets to every other member, so the pattern can occur at most once — at base 2 — and never repeats. Repeatable constellations use only odd primes `[3, 5, 7, 11, ...]`.

## The biological constraints

| Constraint              | Value | Source                              |
| ----------------------- | ----- | ----------------------------------- |
| Min parent age at birth | 18    | age of consent floor                |
| Max mother age at birth | 67    | oldest documented mother (IVF)      |
| Max father age at birth | 90    | oldest documented father            |
| Max lifespan            | 120   | practical cap (113 is last prime)   |

Hard caps on the search space, not biological law. Parameters, not invariants.

## Counting

Under those constraints:

- **2,795,840** unique biologically valid constellations
- **50,986** with at least 2 lifetime occurrences
- Significantly fewer with 4+ occurrences — the cutoff used in [`cmd/constellations`](go/cmd/constellations/main.go)

## Largest repeatable family

13 members (2 parents + 11 children):

```text
offsets: [0 4 6 10 16 22 24 30 34 36 46 64 66]

instance 1: [ 7 11 13 17 23 29 31 37 41 43 53 71 73]
instance 2: [37 41 43 47 53 59 61 67 71 73 83 101 103]
```

Two complete prime configurations. One family. One lifetime.

## Algorithms

### Primality

Memoized Miller–Rabin via `math/big.ProbablyPrime(20)`.

### Constellation enumeration ([`cmd/constellations`](go/cmd/constellations/main.go))

For every pair of parents drawn from the odd primes `[3..113]`:

1. Find all valid children (primes younger than the youngest parent that satisfy both parent age constraints).
2. Enumerate every non-empty subset of those children.
3. Convert the age set to offset form, relative to the youngest member. This is the constellation key.
4. Deduplicate by offset key.
5. For each unique constellation, scan base primes `p` and record every `p` where all `p + offset` are prime and the largest fits inside `MaxLifespan`. These are the lifetime instances.
6. Filter to constellations with `MinInstances` or more occurrences.

### Prime moment search (lab runtime)

The finder that runs in your browser:

1. From "today" forward, break each year into windows at every family member's birthday. Every age is constant inside a window.
2. At the start of each window, compute every member's age.
3. If every age is prime, record the window.
4. Group results by offset pattern (sorted, relative to the youngest).

Pure-function logic in [`src/app/x/prime-moments/lib/`](../../src/app/x/prime-moments/lib/), covered by `bun test`.

## Running the Go code

```sh
cd research/prime-moments/go

go run ./cmd/toups_primes      # scans Toups Primes (p, p+30, p+32) up to 10,000
go run ./cmd/constellations    # full enumeration; minutes, lots of output
```

## References

- [OEIS](https://oeis.org) — Online Encyclopedia of Integer Sequences
- [The Prime Pages](https://primes.utm.edu) — comprehensive prime-number resources
- Hardy–Littlewood conjecture on prime k-tuples
- Twin prime conjecture
