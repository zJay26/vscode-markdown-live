export interface SearchOptions { caseSensitive: boolean; wholeWord: boolean }
export interface SearchMatch { from: number; to: number }

/** Search the original string so Unicode case folding never changes source offsets. */
export function searchText(text: string, query: string, options: SearchOptions): SearchMatch[] {
  if (!query) return [];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, options.caseSensitive ? 'gu' : 'giu');
  const word = /[\p{L}\p{N}\p{M}_]/u;
  const result: SearchMatch[] = [];
  for (const match of text.matchAll(pattern)) {
    const from = match.index!, to = from + match[0].length;
    if (options.wholeWord) {
      // Include the preceding surrogate when checking an astral Unicode letter.
      const before = text.slice(Math.max(0, from - 2), from);
      const after = text.slice(to, to + 2);
      if (word.test([...before].at(-1) ?? '') || word.test([...after][0] ?? '')) continue;
    }
    result.push({ from, to });
  }
  return result;
}

export function replaceMatches(text: string, matches: SearchMatch[], replacement: string): string {
  const parts: string[] = []; let cursor = 0;
  for (const match of matches) {
    parts.push(text.slice(cursor, match.from), replacement);
    cursor = match.to;
  }
  parts.push(text.slice(cursor));
  return parts.join('');
}
