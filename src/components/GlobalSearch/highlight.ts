export interface HighlightPart {
  text: string;
  match: boolean;
}

/** Split `text` into runs, marking case-insensitive occurrences of any query token. */
export function highlightParts(text: string, query: string): HighlightPart[] {
  if (!text) return [];
  const tokens = [
    ...new Set(
      query
        .toLowerCase()
        .split(/[\s\-/_]+/)
        .filter(Boolean)
    ),
  ];
  const lower = text.toLowerCase();
  // Lowercasing can change length for some scripts; skip highlighting rather than mis-slice.
  if (tokens.length === 0 || lower.length !== text.length) return [{ text, match: false }];

  const mask = new Array<boolean>(text.length).fill(false);
  for (const tok of tokens) {
    let from = lower.indexOf(tok);
    while (from !== -1) {
      for (let i = from; i < from + tok.length; i++) mask[i] = true;
      from = lower.indexOf(tok, from + 1);
    }
  }

  const parts: HighlightPart[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || mask[i] !== mask[start]) {
      parts.push({ text: text.slice(start, i), match: mask[start] });
      start = i;
    }
  }
  return parts;
}
