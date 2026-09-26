export interface Edit { from: number; to: number; text: string }
export interface Settings { fontSize: number; lineHeight: number; contentWidth: number; assetsDirectory: string }
export type ClientMessage =
  | { type: 'ready' }
  | { type: 'edit'; id: string; version: number; edits: Edit[] }
  | { type: 'source'; offset: number }
  | { type: 'undo' | 'redo' | 'save' }
  | { type: 'image'; id: string; name: string; bytes: number[] }
  | { type: 'resolveImages'; paths: string[] }
  | { type: 'openLink'; href: string }
  | { type: 'copy'; text: string }
  | { type: 'recover'; text: string };
export type HostMessage =
  | { type: 'document'; text: string; version: number; settings: Settings; name: string; dirty: boolean }
  | { type: 'ack'; id: string; version: number; text: string; dirty: boolean }
  | { type: 'conflict'; id: string; text: string; version: number; reason: string }
  | { type: 'image'; id: string; path?: string; error?: string }
  | { type: 'images'; urls: Record<string, string> }
  | { type: 'saved'; success: boolean; dirty: boolean }
  | { type: 'notice'; message: string }
  | { type: 'error'; message: string };

export function applyEdits(source: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => a.from - b.from);
  let end = 0;
  for (const e of sorted) {
    if (!Number.isInteger(e.from) || !Number.isInteger(e.to) || e.from < end || e.to < e.from || e.to > source.length || typeof e.text !== 'string') throw new Error('无效或重叠的文本修改');
    end = e.to;
  }
  for (const e of sorted.reverse()) source = source.slice(0, e.from) + e.text + source.slice(e.to);
  return source;
}
export function minimalEdit(before: string, after: string): Edit[] {
  if (before === after) return [];
  let from = 0, a = before.length, b = after.length;
  while (from < a && from < b && before[from] === after[from]) from++;
  // Do not split a surrogate pair.
  if (from && /[\uD800-\uDBFF]/.test(before[from - 1])) from--;
  while (a > from && b > from && before[a - 1] === after[b - 1]) { a--; b--; }
  if (a < before.length && a > from && /[\uD800-\uDBFF]/.test(before[a - 1])) { a++; b++; }
  return [{ from, to: a, text: after.slice(from, b) }];
}
export function rebaseEdits(edits: Edit[], remote: Edit[]): Edit[] | null {
  const result = edits.map(e => ({ ...e }));
  for (const change of [...remote].sort((a,b) => b.from-a.from)) {
    for (const local of result) {
      if (change.to < local.from || (change.to === local.from && change.from !== change.to)) {
        const delta = change.text.length - (change.to - change.from); local.from += delta; local.to += delta;
      } else if (change.from > local.to || (change.from === local.to && local.from !== local.to)) {
        // Disjoint edit after the local range.
      } else return null;
    }
  }
  return result;
}
