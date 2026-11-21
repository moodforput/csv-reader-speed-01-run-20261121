# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/moodforput/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/moodforput/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

SwiftCSV — a fast, dependency-free drop-in for csv-reader 1.0.0. It returns the exact same
`{columns, rows, errors}` for every input, including broken rows (stray CRs, unterminated
quotes, quote junk, short/long rows), but reads plain fields in bulk with `indexOf` + `slice`
instead of one character at a time. Pure and deterministic, Node 22, ES module, no dependencies.

Entered in the [make.fun bounty "Read broken CSV files faster, 21 November 2026"](https://make.fun/bounty/csv-reader-speed-01-run-20261121).

## Run it

```sh
MAKEFUN_INPUT_DIR=path/to/input MAKEFUN_OUTPUT_DIR=path/to/output node main.ts
```

It reads `cases.json` from the input directory and writes `answers.json` to the output directory.

## Test it

```sh
node test/run-tests.mjs   # unit edge cases + differential fuzz + practice set + determinism
node test/bench.mjs       # benchmark vs the baseline csv-reader on the practice set
```
