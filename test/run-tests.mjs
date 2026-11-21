// Test runner for SwiftCSV: unit edge cases + differential fuzz + practice set + determinism.
// Compares run(input) against the reference readCsv(input) with exact deep equality.
// The reference is imported only here (never in solve.js).
// Usage: node test/run-tests.mjs

import { deepStrictEqual } from 'node:assert';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { run } from '../solve.js';
import { readCsv } from '../../csv-reader-speed-01-run-20261121-kit/baselines/csv-reader/vendor/csv-reader/index.js';
import { cases } from './cases.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const entryDir = join(here, '..');
const kitDir = join(here, '..', '..', 'csv-reader-speed-01-run-20261121-kit');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, input) {
  let mine;
  let ref;
  try {
    mine = run(input);
  } catch (e) {
    failures.push(`${name}: run() threw ${e}`);
    failed += 1;
    return;
  }
  try {
    ref = readCsv(input);
  } catch (e) {
    failures.push(`${name}: readCsv() threw ${e}`);
    failed += 1;
    return;
  }
  try {
    deepStrictEqual(mine, ref);
    passed += 1;
  } catch (e) {
    failed += 1;
    failures.push(`${name}:\n  input: ${JSON.stringify(input)}\n  mine: ${JSON.stringify(mine)}\n  ref:  ${JSON.stringify(ref)}`);
  }
}

// 1. Unit edge cases.
for (const c of cases) check(`unit: ${c.name}`, c.input);
console.log(`unit edge cases: ${passed} passed, ${failed} failed`);

// 2. Differential fuzz: seeded, two generators.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const soupChars = ['a', 'b', ',', '\n', '\r', '"', ' ', '1', 'é', 'x', ',', '\n', '"', '\r'];
const words = ['a', 'bc', 'hello', '123', '', 'x y', 'café', '東京', 'n/a', "O'Brien", '#42', '1.5', '""', '"q"', 'a,b'];
function fuzzSoup(rng) {
  const n = Math.floor(rng() * 200);
  let s = '';
  for (let i = 0; i < n; i += 1) s += soupChars[Math.floor(rng() * soupChars.length)];
  return s;
}
function fuzzField(rng) {
  const r = rng();
  if (r < 0.55) return words[Math.floor(rng() * words.length)];
  if (r < 0.8) {
    // Quoted field, possibly broken.
    const inner = words[Math.floor(rng() * words.length)];
    const sep = rng() < 0.5 ? ',' : rng() < 0.5 ? '\n' : '\r\n';
    const extra = rng() < 0.3 ? `""${inner}` : inner;
    const close = rng() < 0.85;
    return `"${extra}${close ? '"' : ''}${rng() < 0.2 ? 'junk' : ''}${rng() < 0.1 ? '\r' : ''}`;
  }
  return rng() < 0.5 ? '' : ' ';
}
function fuzzStructured(rng) {
  const nrec = Math.floor(rng() * 8);
  const lines = [];
  for (let i = 0; i < nrec; i += 1) {
    const nf = Math.floor(rng() * 5);
    const fields = [];
    for (let j = 0; j < nf; j += 1) fields.push(fuzzField(rng));
    const end = rng() < 0.7 ? '\n' : rng() < 0.5 ? '\r\n' : rng() < 0.5 ? '\r' : '';
    lines.push(fields.join(',') + end);
    if (rng() < 0.15) lines.push(rng() < 0.5 ? '\n' : '\r\n');
  }
  return lines.join('');
}

const rng = mulberry32(20261121);
const fuzzBefore = passed;
for (let i = 0; i < 300; i += 1) {
  check(`fuzz-soup-${i}`, { text: fuzzSoup(rng), header: rng() < 0.5 });
}
for (let i = 0; i < 300; i += 1) {
  check(`fuzz-structured-${i}`, { text: fuzzStructured(rng), header: rng() < 0.5 });
}
console.log(`differential fuzz: ${passed - fuzzBefore} passed, ${failed} failed (total)`);

// 3. Practice set: all 6 cases identical to practice/reference/expected.json.
const practiceCases = JSON.parse(readFileSync(join(kitDir, 'practice', 'input', 'cases.json'), 'utf8'));
const expected = JSON.parse(readFileSync(join(kitDir, 'practice', 'reference', 'expected.json'), 'utf8'));
const expectedById = new Map(expected.cases.map((c) => [c.id, c.output]));
let practicePassed = 0;
for (const c of practiceCases) {
  try {
    deepStrictEqual(run(c.input), expectedById.get(c.id));
    practicePassed += 1;
  } catch (e) {
    failures.push(`practice ${c.id}: answer differs from expected.json`);
    failed += 1;
  }
}
console.log(`practice set: ${practicePassed}/${practiceCases.length} identical to expected.json`);

// 4. Determinism: the driver writes byte-identical answers.json on two runs.
const dir1 = mkdtempSync(join(tmpdir(), 'swiftcsv-a-'));
const dir2 = mkdtempSync(join(tmpdir(), 'swiftcsv-b-'));
const env = (out) => ({ ...process.env, MAKEFUN_INPUT_DIR: join(kitDir, 'practice', 'input'), MAKEFUN_OUTPUT_DIR: out });
execFileSync(process.execPath, ['main.ts'], { cwd: entryDir, env: env(dir1), stdio: 'pipe' });
execFileSync(process.execPath, ['main.ts'], { cwd: entryDir, env: env(dir2), stdio: 'pipe' });
const a1 = readFileSync(join(dir1, 'answers.json'));
const a2 = readFileSync(join(dir2, 'answers.json'));
if (a1.equals(a2)) {
  console.log(`determinism: two driver runs byte-identical (${a1.length} bytes)`);
  passed += 1;
} else {
  failures.push('determinism: two driver runs differ');
  failed += 1;
}
rmSync(dir1, { recursive: true, force: true });
rmSync(dir2, { recursive: true, force: true });

// Report.
if (failures.length > 0) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures.slice(0, 10)) console.log(`- ${f}`);
  if (failures.length > 10) console.log(`... and ${failures.length - 10} more`);
  process.exit(1);
}
console.log(`\nALL TESTS PASSED (${passed} checks)`);
