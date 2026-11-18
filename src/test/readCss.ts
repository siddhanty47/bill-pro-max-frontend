/**
 * Reads a source file (usually a `.module.css`) for tests that assert on CSS
 * rules jsdom cannot compute. `path` is relative to the repo root (vitest's cwd).
 * `node:fs` is imported dynamically so the app's browser tsconfig never sees it.
 */
export async function readCss(path: string): Promise<string> {
  const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
    readFileSync(path: string, encoding: 'utf8'): string;
  };
  return fs.readFileSync(path, 'utf8');
}
