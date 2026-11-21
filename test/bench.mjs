// Benchmark: SwiftCSV (entry solve.js) vs the baseline csv-reader (kit solve.js).
// Same driver, same practice set, Node on this machine. Reports CPU time (in-process,
// process.cpuUsage) and end-to-end driver wall time (spawned node main.ts).
// Usage: node test/bench.mjs

import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { run as fastRun } from '../solve.js';
import { run as baseRun } from '../../csv-reader-speed-01-run-20261121-kit/baselines/csv-reader/solve.js';

const here = dirname(fileURLToPath(import.meta.url));
const entryDir = join(here, '..');
const kitDir = join(here, '..', '..', 'csv-reader-speed-01-run-20261121-kit');
const baseDir = join(kitDir, 'baselines', 'csv-reader');

const practiceCases = JSON.parse(readFileSync(join(kitDir, 'practice', 'input', 'cases.json'), 'utf8'));
const inputs = practiceCases.map((c) => c.input);
const totalChars = inputs.reduce((n, i) => n + String(i.text).length, 0);
console.log(`practice set: ${inputs.length} cases, ${(totalChars / 1e6).toFixed(2)} MB total`);

// Sanity: both implementations must agree on the practice set before timing.
for (let i = 0; i < inputs.length; i += 1) {
  if (JSON.stringify(fastRun(inputs[i])) !== JSON.stringify(baseRun(inputs[i]))) {
    console.log(`MISMATCH on case ${practiceCases[i].id} — refusing to benchmark`);
    process.exit(1);
  }
}
console.log('sanity: fast and baseline agree on all practice cases');

// 1. In-process CPU time: run all 6 cases, N iterations, process.cpuUsage delta.
function cpuMs(fn, iterations) {
  // Warm up once (JIT, caches).
  for (const input of inputs) fn(input);
  const before = process.cpuUsage();
  const t0 = performance.now();
  for (let k = 0; k < iterations; k += 1) {
    for (const input of inputs) fn(input);
  }
  const t1 = performance.now();
  const used = process.cpuUsage(before);
  return { cpuMs: (used.user + used.system) / 1000, wallMs: t1 - t0 };
}

const ITER = 5;
const fastCpu = cpuMs(fastRun, ITER);
const baseCpu = cpuMs(baseRun, ITER);
console.log(`\nin-process CPU time, ${ITER} iterations over the practice set (per iteration):`);
console.log(`  SwiftCSV : ${(fastCpu.cpuMs / ITER).toFixed(0)} ms CPU (${(fastCpu.wallMs / ITER).toFixed(0)} ms wall)`);
console.log(`  baseline : ${(baseCpu.cpuMs / ITER).toFixed(0)} ms CPU (${(baseCpu.wallMs / ITER).toFixed(0)} ms wall)`);
console.log(`  speedup  : ${(baseCpu.cpuMs / fastCpu.cpuMs).toFixed(2)}x`);

// 2. End-to-end driver wall time: node main.ts, 5 runs each, same input/output dirs.
function driverMs(dir, runs) {
  const out = mkdtempSync(join(tmpdir(), 'swiftcsv-bench-'));
  const env = { ...process.env, MAKEFUN_INPUT_DIR: join(kitDir, 'practice', 'input'), MAKEFUN_OUTPUT_DIR: out };
  const times = [];
  for (let k = 0; k < runs; k += 1) {
    const t0 = performance.now();
    execFileSync(process.execPath, ['main.ts'], { cwd: dir, env, stdio: 'pipe' });
    times.push(performance.now() - t0);
  }
  rmSync(out, { recursive: true, force: true });
  times.sort((a, b) => a - b);
  return times;
}

const RUNS = 5;
const fastTimes = driverMs(entryDir, RUNS);
const baseTimes = driverMs(baseDir, RUNS);
const median = (a) => a[Math.floor(a.length / 2)];
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
console.log(`\nend-to-end driver wall time, ${RUNS} runs each (ms):`);
console.log(`  SwiftCSV : ${fastTimes.map((t) => t.toFixed(0)).join(', ')} (median ${median(fastTimes).toFixed(0)}, mean ${mean(fastTimes).toFixed(0)})`);
console.log(`  baseline : ${baseTimes.map((t) => t.toFixed(0)).join(', ')} (median ${median(baseTimes).toFixed(0)}, mean ${mean(baseTimes).toFixed(0)})`);
console.log(`  speedup  : ${(mean(baseTimes) / mean(fastTimes)).toFixed(2)}x (mean)`);
