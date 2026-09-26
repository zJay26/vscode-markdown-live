import type { Node as PMNode } from '@milkdown/kit/prose/model';

export interface Heading { text: string; level: number; pos: number; slug: string }
function measureText(text: string) {
  const characters = [...text.replace(/\s/gu, '')].length;
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
  const eastern = (text.match(cjk) ?? []).length;
  const western = (text.replace(cjk, ' ').match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu) ?? []).length;
  return { characters, words: eastern + western, readingUnits: eastern * 4 + western * 7 };
}
export function textMetrics(text: string) {
  const { readingUnits, ...metrics } = measureText(text);
  return { ...metrics, minutes: Math.ceil(readingUnits / 1400) };
}

const infoCache = new WeakMap<PMNode, ReturnType<typeof collectInfo>>();
const blockMetrics = new WeakMap<PMNode, ReturnType<typeof measureText>>();
function collectInfo(doc: PMNode) {
  const headings: Heading[] = [], usedSlugs = new Set<string>();
  let tasks = 0, completed = 0, characters = 0, words = 0, readingUnits = 0;
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const base = node.textContent.trim().toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, '').replace(/\s/g, '-');
      let slug = base, suffix = 0;
      while (usedSlugs.has(slug)) slug = `${base}-${++suffix}`;
      usedSlugs.add(slug);
      headings.push({ text: node.textContent, level: node.attrs.level, pos, slug });
    }
    if (node.type.name === 'list_item' && node.attrs.checked !== null) { tasks++; if (node.attrs.checked) completed++; }
    if (node.isTextblock) {
      if (node.type.name !== 'code_block') {
        let metrics = blockMetrics.get(node);
        if (!metrics) { metrics = measureText(node.textContent); blockMetrics.set(node, metrics); }
        characters += metrics.characters; words += metrics.words; readingUnits += metrics.readingUnits;
      }
      return false;
    }
  });
  return { headings, tasks, completed, characters, words, minutes: Math.ceil(readingUnits / 1400) };
}

/** ProseMirror documents are immutable: moving a selection reuses the same result. */
export function documentInfo(doc: PMNode) {
  let result = infoCache.get(doc);
  if (!result) { result = collectInfo(doc); infoCache.set(doc, result); }
  return result;
}
