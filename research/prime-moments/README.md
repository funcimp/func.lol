# Prime Moments — Research

A mathematical exploration of prime number patterns in family ages: the
calendar windows when every member of a family simultaneously has a prime
age, and the offset patterns that make those windows recur over a lifetime.

This folder is the research that backs the
[Prime Moments lab](../../src/app/labs/prime-moments/) on
[func.lol](https://func.lol). The lab is the interactive finder; this
folder is the math, the prose, and the Go code that originally enumerated
the patterns.

## Origin

The observation that started it:

> Sarah just turned 41. Before she turns 42, Lyra and I will be turning
> 11 and 43. Sarah and I will be a prime pair (41, 43), and Lyra will be
> a prime (11).

That moment — three ages, all prime, all at once — turned out to be an
instance of a repeatable pattern. The same offset shape `[0, 30, 32]`
also occurs at `(29, 59, 61)`, `(41, 71, 73)`, and `(71, 101, 103)`.
Within one human lifetime, this family hits the same prime-age
configuration four separate times.

That pattern is named **Toups Primes** here, after the family whose ages
inspired the search.

## Key concepts

### Prime constellation

A set of offsets from a base prime. `[0, 30, 32]` describes three primes
where the gaps from the smallest are 30 and 32. The constellation is the
shape; an instance is the actual numbers.

### Prime moment

The calendar window during which every member of a real family
simultaneously has a prime age. A prime moment is one instance of an
underlying constellation, anchored to specific birthdays.

### Toups Primes

The constellation `[0, 30, 32]`. Instances under 10,000 begin:

```text
(11, 41, 43)
(29, 59, 61)
(41, 71, 73)
(71, 101, 103)
(107, 137, 139)
(149, 179, 181)
...  (88 total under 10,000)
```

### Admissible constellation

A pattern that can occur infinitely often (per the Hardy–Littlewood
conjecture on prime k-tuples). Not every offset pattern is admissible —
some are forced to hit a composite for every base. Admissibility is a
necessary but not sufficient condition for a constellation to repeat at
all, let alone repeat within a lifetime.

### Prime family constellation

A constellation that represents a biologically plausible family — one
where the offsets can be realized as ages of real parents and children
under reasonable demographic constraints.

## Why we exclude 2

2 is the only even prime. Any constellation containing it has odd offsets
to every other member, so the pattern can occur at most once — at base 2
— and never repeats. For repeatable constellations we use only odd primes
`[3, 5, 7, 11, ...]`.

## The biological constraints

Documented extremes, applied as inclusive bounds:

| Constraint            | Value | Source                                |
| --------------------- | ----- | ------------------------------------- |
| Min parent age at birth | 18  | age of consent floor                  |
| Max mother age at birth | 67  | oldest documented mother (IVF)        |
| Max father age at birth | 90  | oldest documented father              |
| Max lifespan            | 122 | Jeanne Calment                        |

These are not biological law — they're hard caps on the search space.
The Go enumerator (see below) bakes them in as constants, but they are
parameters, not invariants.

## Counting

Under the constraints above:

- **2,795,840** unique biologically valid constellations
- **50,986** with at least 2 lifetime occurrences
- significantly fewer with 4+ occurrences (the cutoff used in
  [`cmd/constellations`](go/cmd/constellations/main.go))

## Largest repeatable family

Under the same constraints, with at least 2 lifetime occurrences, the
largest repeatable family has 13 members (2 parents + 11 children):

```text
offsets: [0 4 6 10 16 22 24 30 34 36 46 64 66]

instance 1: [ 7 11 13 17 23 29 31 37 41 43 53 71 73]
instance 2: [37 41 43 47 53 59 61 67 71 73 83 101 103]
```

Two complete prime constellations of 13 ages, achievable by the same
family within one (very long) lifetime.

## Algorithms

### Primality

Memoized Miller–Rabin via `math/big.ProbablyPrime(20)`. Fast enough for
the search ranges here, and correct with overwhelming probability.

### Constellation enumeration ([`cmd/constellations`](go/cmd/constellations/main.go))

For every pair of parents drawn from the odd primes `[3..113]`:

1. Find all valid children (primes younger than the youngest parent that
   satisfy both parent age constraints).
2. Enumerate every non-empty subset of those children.
3. Convert the resulting age set to offset form (relative to the
   youngest member). This is the constellation key.
4. Deduplicate by offset key.
5. For each unique constellation, scan base primes `p` and record every
   `p` for which all `p + offset` are prime and the largest fits inside
   `MaxLifespan`. These are the lifetime instances.
6. Filter to constellations with `MinInstances` or more occurrences.

### Prime moment search (interactive lab)

The runtime side — the bit that runs in your browser on the lab page —
takes a real family (names + birthdays) and walks the calendar:

1. From "today" forward, break each year into windows at every family
   member's birthday. Inside any one window, every age is constant.
2. At the start of each window, compute every member's age.
3. If every age is prime, record the window as a prime moment.
4. Group results by their offset pattern (sorted, relative to the
   youngest).

The pure-function logic lives in
[`src/app/labs/prime-moments/lib/`](../../src/app/labs/prime-moments/lib/),
covered by `bun test`.

## Running the Go code

```sh
cd research/prime-moments/go

go run ./cmd/toups_primes      # scans Toups Primes (p, p+30, p+32) up to 10,000
go run ./cmd/constellations    # full enumeration; minutes, lots of output
```

Each command lives in its own subpackage so the two `main` functions
don't collide.

## References

- [OEIS](https://oeis.org) — Online Encyclopedia of Integer Sequences
- [The Prime Pages](https://primes.utm.edu) — comprehensive prime-number resources
- Hardy–Littlewood conjecture on prime k-tuples
- Twin prime conjecture
