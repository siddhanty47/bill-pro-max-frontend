#!/usr/bin/env node
/**
 * Design-token check.
 *
 * Flags hardcoded colours, fonts, shadows and inline styles that should use
 * the tokens in src/globals.css.
 *
 * Usage:  node scripts/check-design-tokens.mjs [--strict]
 *   (default) print findings, exit 0
 *   --strict  exit 1 if any finding
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const srcDir = path.resolve('src');
const rel = p => path.relative(process.cwd(), p).split(path.sep).join('/');

const ALLOWLIST = new Set(['src/components/ui/GoogleIcon.tsx']);
const isExcluded = file =>
  file === 'src/globals.css' ||
  file.startsWith('src/components/ui/') ||
  file.startsWith('src/test/') ||
  file.endsWith('.test.tsx') ||
  ALLOWLIST.has(file);

const walk = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const cssRules = [
  { rule: 'hex colour', test: line => /#[0-9a-fA-F]{3,8}\b/.test(line) },
  { rule: 'rgb/hsl colour', test: line => /\b(?:rgba?|hsla?)\(/.test(line) },
  { rule: 'font-family', test: line => /font-family\s*:/.test(line) },
  {
    rule: 'box-shadow without token',
    test: line => {
      const m = line.match(/box-shadow\s*:\s*([^;]*)/);
      if (!m) return false;
      const value = m[1].trim();
      return value !== 'none' && !/^var\(--/.test(value);
    },
  },
];
const tsxRules = [{ rule: 'inline style={}', test: line => /style=\{/.test(line) }];

const findings = [];
const files = existsSync(srcDir) ? walk(srcDir) : [];
for (const abs of files.sort()) {
  const file = rel(abs);
  const ext = path.extname(file);
  if ((ext !== '.css' && ext !== '.tsx') || isExcluded(file)) continue;
  const rules = ext === '.css' ? cssRules : tsxRules;
  readFileSync(abs, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const { rule, test } of rules) {
        if (test(line)) findings.push({ file, line: i + 1, rule });
      }
    });
}

for (const f of findings) console.log(`${f.file}:${f.line} ${f.rule}`);
const fileCount = new Set(findings.map(f => f.file)).size;
console.log(`\n${findings.length} design-token finding(s) in ${fileCount} file(s).`);

if (strict && findings.length > 0) process.exit(1);
