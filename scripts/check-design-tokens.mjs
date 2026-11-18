#!/usr/bin/env node
/**
 * Design-token check.
 *
 * Flags hardcoded colours, fonts, radii, shadows and inline styles that should
 * use the tokens in src/globals.css.
 *
 * Usage:  node scripts/check-design-tokens.mjs [--strict]
 *   (default) print findings, exit 0
 *   --strict  exit 1 if any finding (what `npm run lint` uses)
 *
 * Comments are ignored (CSS and TS/TSX). Hex colours are only matched in CSS
 * declaration values and in TS/TSX string literals, so `#id` selectors, URL
 * fragments and `Bill #123` text are not findings. Declarations are parsed
 * across lines, so multi-line box-shadow / font-family values are checked.
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWLIST = new Set(['src/components/ui/GoogleIcon.tsx']);

export const isExcluded = file =>
  file === 'src/globals.css' ||
  file.startsWith('src/test/') ||
  /\.test\.tsx?$/.test(file) ||
  ALLOWLIST.has(file);

/** Replace every non-newline char in [from, to) so line numbers survive. */
const blank = (text, from, to) =>
  text.slice(0, from) + text.slice(from, to).replace(/[^\n]/g, ' ') + text.slice(to);

const stripCssComments = text =>
  text.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, m => m.replace(/[^\n]/g, ' '));

/**
 * Walk TS/TSX source. Returns the text with comments blanked, plus the spans
 * of string / template literals (start, end exclusive of quotes).
 */
export const scanTsLexically = text => {
  let code = text;
  const strings = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '/') {
      let end = text.indexOf('\n', i);
      if (end === -1) end = text.length;
      code = blank(code, i, end);
      i = end;
    } else if (c === '/' && next === '*') {
      let end = text.indexOf('*/', i + 2);
      end = end === -1 ? text.length : end + 2;
      code = blank(code, i, end);
      i = end;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== c) {
        if (text[j] === '\\') j++;
        else if (text[j] === '\n' && c !== '`') break; // unterminated: JSX text apostrophe
        j++;
      }
      strings.push({ start: i + 1, end: Math.min(j, text.length) });
      i = j + 1;
    } else {
      i++;
    }
  }
  return { code, strings };
};

// A hex colour starts after whitespace, a quote, or ( , : / not after a word
// char or `/` (URL fragment, `a#b`). 3/4/6/8 digits, not followed by a word char.
const HEX_RE = /(?<![\w/&.#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/;
const FUNC_COLOUR_RE = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;
const NAMED_COLOURS = [
  'white',
  'black',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'gray',
  'grey',
  'silver',
  'gold',
  'navy',
  'teal',
  'cyan',
  'magenta',
  'maroon',
  'olive',
  'lime',
  'aqua',
  'fuchsia',
  'brown',
  'beige',
  'ivory',
  'coral',
  'salmon',
  'crimson',
  'indigo',
  'violet',
  'tomato',
  'khaki',
  'lavender',
];
const NAMED_COLOUR_RE = new RegExp(`(?<![\\w-])(?:${NAMED_COLOURS.join('|')})(?![\\w-])`, 'i');
const COLOUR_PROP_RE =
  /^(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-color)?|-color)?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration(?:-color)?|column-rule(?:-color)?)$/i;

/** Drop url(...), strings and `--name` references so only literal values remain. */
const literalValue = value =>
  value
    .replace(/url\([^)]*\)/gi, 'url()')
    .replace(/"[^"]*"|'[^']*'/g, '""')
    .replace(/var\(\s*--[\w-]+/g, 'var(');

const GLOBAL_KEYWORDS = /^(?:none|inherit|initial|unset|revert)$/i;

const checkDeclaration = (prop, rawValue) => {
  const out = [];
  const value = literalValue(rawValue);
  const p = prop.toLowerCase();
  if (HEX_RE.test(value)) out.push('hex colour');
  if (FUNC_COLOUR_RE.test(value)) out.push('rgb/hsl colour');
  if (COLOUR_PROP_RE.test(p) && NAMED_COLOUR_RE.test(value.replace(/var\([^)]*\)/g, ''))) {
    out.push('named colour');
  }
  if (p === 'font-family') {
    // A font token on its own is fine; raw font names are not.
    if (
      !/^var\(--font-(?:sans|display|mono)\)$/.test(rawValue.trim()) &&
      !GLOBAL_KEYWORDS.test(value.trim())
    ) {
      out.push('font-family');
    }
  }
  if (p === 'font') {
    // Shorthand must take its family from a token.
    if (
      !GLOBAL_KEYWORDS.test(value.trim()) &&
      !/^[^,]*var\(--font-(?:sans|display|mono)\)\s*$/.test(rawValue.trim())
    ) {
      out.push('font shorthand');
    }
  }
  if (p === 'box-shadow' || p === 'text-shadow' || p === 'filter' || p === 'backdrop-filter') {
    // filter/backdrop-filter only matter for their drop-shadow(...) arguments.
    let shadow = value;
    if (p.endsWith('filter')) {
      const args = [...value.matchAll(/drop-shadow\(((?:[^()]|\([^()]*\))*)\)/gi)].map(m => m[1]);
      if (args.length === 0) return out;
      shadow = args.join(',');
    }
    // Everything must be a var(--…) or `inset`; any literal length/colour is a finding.
    const residue = shadow
      .replace(/var\((?:[^()]|\([^()]*\))*\)/g, '')
      .replace(/\binset\b/gi, '')
      .replace(/(?<![\w.])0(?![\w.])/g, '')
      .replace(/[,\s]/g, '');
    if (residue !== '' && !GLOBAL_KEYWORDS.test(residue)) out.push('box-shadow without token');
  }
  if (/^(?:border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius)$/.test(p)) {
    // calc() containing a token (e.g. calc(var(--radius-md) - 2px)) derives from a token.
    const derived = /calc\(.*var\(/.test(value);
    const residue = value.replace(/var\((?:[^()]|\([^()]*\))*\)/g, '').trim();
    // 0, percentages (50% circles), keywords are fine; raw px/rem/em radii are not.
    if (
      !derived &&
      /\d(?:px|r?em)\b/.test(residue) &&
      !/^0(?:px|r?em)?(?:\s+0(?:px|r?em)?)*$/.test(residue)
    ) {
      out.push('border-radius without token');
    }
  }
  return out;
};

const lineStarts = text => {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return starts;
};
const lineOf = (starts, index) => {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
};

export const scanCss = text => {
  const stripped = stripCssComments(text);
  const starts = lineStarts(stripped);
  const findings = [];
  const declRe = /(?<=^|[;{}\s])(-{0,2}[a-zA-Z][\w-]*)\s*:\s*([^;{}]*)/g;
  let m;
  while ((m = declRe.exec(stripped))) {
    const line = lineOf(starts, m.index);
    for (const rule of checkDeclaration(m[1], m[2])) findings.push({ line, rule });
  }
  return findings;
};

export const scanTs = (text, { tsx = true } = {}) => {
  const { code, strings } = scanTsLexically(text);
  const starts = lineStarts(code);
  const findings = [];
  for (const { start, end } of strings) {
    const body = text.slice(start, end);
    if (HEX_RE.test(body)) {
      const idx = start + body.search(/#/);
      findings.push({ line: lineOf(starts, idx), rule: 'hex colour' });
    }
    if (FUNC_COLOUR_RE.test(body)) {
      findings.push({ line: lineOf(starts, start), rule: 'rgb/hsl colour' });
    }
  }
  if (tsx) {
    const re = /\bstyle\s*=\s*\{/g;
    let m;
    while ((m = re.exec(code)))
      findings.push({ line: lineOf(starts, m.index), rule: 'inline style={}' });
  }
  return findings;
};

/** Scan one file's source. `file` is a repo-relative posix path. */
export const scanSource = (file, text) => {
  if (isExcluded(file)) return [];
  const ext = path.extname(file);
  if (ext === '.css') return scanCss(text);
  if (ext === '.tsx') return scanTs(text, { tsx: true });
  if (ext === '.ts') return scanTs(text, { tsx: false });
  return [];
};

const walk = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

/** Scan `<cwd>/src`. Returns [{ file, line, rule }]. */
export const scanProject = (cwd = process.cwd()) => {
  const srcDir = path.resolve(cwd, 'src');
  const files = existsSync(srcDir) ? walk(srcDir) : [];
  const findings = [];
  for (const abs of files.sort()) {
    const file = path.relative(cwd, abs).split(path.sep).join('/');
    for (const f of scanSource(file, readFileSync(abs, 'utf8'))) findings.push({ file, ...f });
  }
  return findings;
};

export const main = (argv = process.argv, cwd = process.cwd()) => {
  const strict = argv.includes('--strict');
  const findings = scanProject(cwd);
  for (const f of findings) console.log(`${f.file}:${f.line} ${f.rule}`);
  const fileCount = new Set(findings.map(f => f.file)).size;
  console.log(`\n${findings.length} design-token finding(s) in ${fileCount} file(s).`);
  return strict && findings.length > 0 ? 1 : 0;
};

const isCli = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) process.exit(main());
