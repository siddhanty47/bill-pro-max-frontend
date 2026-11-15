#!/usr/bin/env node
/**
 * Changed-files coverage gate.
 *
 * Fails if any source file changed on this branch (vs the merge-base with
 * BASE, plus uncommitted and untracked files) has line coverage below the
 * threshold. A file counts as "source" if the coverage run reported it, so the
 * coverage include/exclude config is the single place eligibility is defined.
 *
 * Usage:  npm run test:coverage && npm run coverage:changed
 *   --base <ref>       compare against (default: origin/main, env COVERAGE_BASE)
 *   --threshold <n>    minimum line % per changed file (default: 80)
 *   --summary <path>   coverage json-summary (default: coverage/coverage-summary.json)
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const base = opt('base', process.env.COVERAGE_BASE || 'origin/main');
const threshold = Number(opt('threshold', '80'));
const summaryPath = path.resolve(opt('summary', 'coverage/coverage-summary.json'));

const sh = cmd => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const lines = out =>
  out
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

if (!existsSync(summaryPath)) {
  console.error(
    `✖ ${path.relative(process.cwd(), summaryPath)} not found — run \`npm run test:coverage\` first.`
  );
  process.exit(2);
}

let mergeBase;
try {
  mergeBase = sh(`git merge-base ${base} HEAD`);
} catch {
  console.error(
    `✖ Cannot find merge-base with "${base}". Fetch it (git fetch origin) or pass --base <ref>.`
  );
  process.exit(2);
}

const root = sh('git rev-parse --show-toplevel');
const changed = new Set([
  ...lines(sh(`git diff --name-only --diff-filter=AMR ${mergeBase}`)),
  ...lines(sh('git ls-files --others --exclude-standard')),
]);

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const rows = [];
for (const [file, metrics] of Object.entries(summary)) {
  if (file === 'total') continue;
  const rel = path.relative(root, path.resolve(file));
  if (!changed.has(rel)) continue;
  const { total, covered, pct } = metrics.lines;
  if (!total) continue; // type-only / empty modules
  rows.push({ file: rel, pct: Number(pct), covered, total });
}

if (rows.length === 0) {
  console.log(`✔ No changed source files to check (base ${base}).`);
  process.exit(0);
}

rows.sort((a, b) => a.pct - b.pct);
const failing = rows.filter(r => r.pct < threshold);
const width = Math.max(...rows.map(r => r.file.length));
console.log(`Changed-file line coverage (threshold ${threshold}%, base ${base}):\n`);
for (const r of rows) {
  const mark = r.pct < threshold ? '✖' : '✔';
  console.log(
    `  ${mark} ${r.file.padEnd(width)}  ${r.pct.toFixed(1).padStart(5)}%  (${r.covered}/${r.total})`
  );
}
console.log('');
if (failing.length) {
  console.error(
    `✖ ${failing.length} changed file(s) below ${threshold}% line coverage. Add tests (see TESTING.md).`
  );
  process.exit(1);
}
console.log(`✔ All ${rows.length} changed file(s) at or above ${threshold}%.`);
