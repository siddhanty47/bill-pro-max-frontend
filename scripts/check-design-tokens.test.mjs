import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { isExcluded, scanCss, scanProject, scanSource, scanTs } from './check-design-tokens.mjs';

const rules = findings => findings.map(f => f.rule);
const script = path.resolve(__dirname, 'check-design-tokens.mjs');

describe('scanCss', () => {
  it('flags a hex colour in a value', () => {
    expect(scanCss('.a {\n  color: #fff;\n}')).toEqual([{ line: 2, rule: 'hex colour' }]);
    expect(rules(scanCss('.a { --x: #00cc88aa; }'))).toEqual(['hex colour']);
  });
  it('ignores #id selectors and url fragments', () => {
    expect(scanCss('#root .a:hover { margin: 0; }\n#abc { margin: 0; }')).toEqual([]);
    expect(scanCss('.a { background: url(#fade); }')).toEqual([]);
  });
  it('ignores hex in comments', () => {
    expect(
      scanCss('/* color: #fff;\n   box-shadow: 0 0 1px rgba(0,0,0,.5) */\n.a { margin: 0; }')
    ).toEqual([]);
  });
  it('flags a multi-line box-shadow with rgba', () => {
    const css =
      '.a {\n  box-shadow:\n    0 1px 2px var(--shadow-sm),\n    0 8px 24px rgba(0, 0, 0, 0.4);\n}';
    expect(rules(scanCss(css))).toEqual(['rgb/hsl colour', 'box-shadow without token']);
    expect(rules(scanCss('.a { box-shadow: 0 2px 4px #000; }'))).toContain(
      'box-shadow without token'
    );
  });
  it('does not flag var() values', () => {
    const css =
      '.a { color: var(--text-primary); box-shadow: var(--shadow-pop); box-shadow: none;\n box-shadow: inset 0 0 0 var(--space-1) var(--accent);\n font-family: var(--font-mono); border-radius: var(--radius-md); border-radius: 50%; background: var(--x, transparent); }';
    expect(scanCss(css)).toEqual([]);
  });
  it('flags raw fonts, radii and named colours', () => {
    expect(rules(scanCss('.a { font-family: Inter, sans-serif; }'))).toEqual(['font-family']);
    expect(rules(scanCss('.a { font: 12px monospace; }'))).toEqual(['font shorthand']);
    expect(rules(scanCss('.a { border-radius: 4px; }'))).toEqual(['border-radius without token']);
    expect(rules(scanCss('.a { color: white; border: 1px solid red; }'))).toEqual([
      'named colour',
      'named colour',
    ]);
    expect(scanCss('.a { font: inherit; border-radius: 0; color: currentColor; }')).toEqual([]);
  });
});

describe('scanTs', () => {
  it('flags hex and rgb strings', () => {
    expect(rules(scanTs("const c = '#ff0000';\nconst d = `rgba(0,0,0,.5)`;"))).toEqual([
      'hex colour',
      'rgb/hsl colour',
    ]);
  });
  it('ignores comments, URL fragments, ids and JSX text', () => {
    const src = [
      '// color: #fff',
      '/* "#abcdef" */',
      "const u = 'http://x.com/#abc';",
      "const s = '/page#fade';",
      "const n = <p>Bill #123 isn't here</p>;",
    ].join('\n');
    expect(scanTs(src)).toEqual([]);
  });
  it('flags inline style only in tsx code', () => {
    expect(rules(scanTs('<div style={{ a: 1 }} />'))).toEqual(['inline style={}']);
    expect(scanTs('<div style={{ a: 1 }} />', { tsx: false })).toEqual([]);
    expect(scanTs('// style={x}')).toEqual([]);
  });
});

describe('scanSource / allowlist', () => {
  it('skips the GoogleIcon allowlist and excluded paths', () => {
    expect(isExcluded('src/components/ui/GoogleIcon.tsx')).toBe(true);
    expect(scanSource('src/components/ui/GoogleIcon.tsx', "const c = '#4285F4';")).toEqual([]);
    expect(scanSource('src/globals.css', ':root { --a: #fff; }')).toEqual([]);
    expect(scanSource('src/pages/X.css', '.a { color: #fff; }')).toHaveLength(1);
    expect(scanSource('src/pages/X.tsx', "const c = '#fff';")).toHaveLength(1);
    expect(scanSource('src/pages/X.test.tsx', "const c = '#fff';")).toEqual([]);
    expect(scanSource('src/pages/x.json', '#fff')).toEqual([]);
  });
});

describe('CLI --strict', () => {
  const dirs = [];
  const project = files => {
    const dir = mkdtempSync(path.join(tmpdir(), 'tokens-'));
    dirs.push(dir);
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), body);
    }
    return dir;
  };
  const run = (cwd, ...args) =>
    spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  afterAll(() => dirs.forEach(d => rmSync(d, { recursive: true, force: true })));

  it('exits 1 with findings under --strict, 0 without', () => {
    const dir = project({ 'src/a.module.css': '.a { color: #fff; }' });
    expect(scanProject(dir)).toEqual([{ file: 'src/a.module.css', line: 1, rule: 'hex colour' }]);
    const strict = run(dir, '--strict');
    expect(strict.status).toBe(1);
    expect(strict.stdout).toContain('src/a.module.css:1 hex colour');
    expect(run(dir).status).toBe(0);
  });
  it('exits 0 under --strict when clean (GoogleIcon allowlisted)', () => {
    const dir = project({
      'src/a.module.css': '.a { color: var(--text-primary); }',
      'src/components/ui/GoogleIcon.tsx': "export const c = '#4285F4';",
    });
    expect(run(dir, '--strict').status).toBe(0);
  });
  it('handles a missing src dir', () => {
    expect(run(project({ 'x.txt': '' }), '--strict').status).toBe(0);
  });
});
