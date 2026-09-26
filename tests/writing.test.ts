import { describe, it, expect } from 'vitest';
import { searchText, replaceMatches } from '../src/core/search';
import { documentInfo, textMetrics } from '../src/core/document-info';
import { SourceDocument } from '../src/core/markdown';
import { fromSource } from '../src/core/schema';

const insensitive = { caseSensitive: false, wholeWord: false };
describe('source search and replacement', () => {
  it('consumes adjacent matches without overlap or omissions', () => {
    const hits = searchText('aaaaaa', 'aa', insensitive);
    expect(hits).toEqual([{ from: 0, to: 2 }, { from: 2, to: 4 }, { from: 4, to: 6 }]);
    expect(replaceMatches('aaaaaa', hits, 'x')).toBe('xxx');
  });
  it('keeps offsets after Unicode characters whose lowercase form expands', () => {
    const text = 'İ x X\r\n';
    expect(replaceMatches(text, searchText(text, 'x', insensitive), 'Y')).toBe('İ Y Y\r\n');
  });
  it('treats search and replacement syntax as literal text', () => {
    const text = '[x].* + $ [x].*';
    expect(replaceMatches(text, searchText(text, '[x].*', insensitive), '$&')).toBe('$& + $ $&');
  });
  it('can match case', () => expect(searchText('Hello hello HELLO', 'hello', { ...insensitive, caseSensitive: true })).toEqual([{ from: 6, to: 11 }]));
  it('uses Unicode word boundaries including astral letters and combining marks', () => {
    const text = 'cat scatter cat_ cat2 écat caté 𐐀cat cat\u0301 (cat)';
    const hits = searchText(text, 'cat', { ...insensitive, wholeWord: true });
    expect(hits.map(h => h.from)).toEqual([0, text.lastIndexOf('cat')]);
  });
  it('retains emoji and CRLF around replacements', () => {
    const text = '😀 hi\r\n😺 hi\r\n';
    expect(replaceMatches(text, searchText(text, 'hi', insensitive), '你好')).toBe('😀 你好\r\n😺 你好\r\n');
  });
  it('accepts empty queries and deletions', () => {
    expect(searchText('abc', '', insensitive)).toEqual([]);
    expect(replaceMatches('abc abc', searchText('abc abc', 'abc', insensitive), '')).toBe(' ');
  });
});

describe('writing metrics and navigation', () => {
  it('counts CJK characters, western words and Unicode characters', () => {
    expect(textMetrics('你好 hello world 😀')).toEqual({ words: 4, characters: 13, minutes: 1 });
    expect(textMetrics(' \n')).toEqual({ words: 0, characters: 0, minutes: 0 });
  });
  it('counts task progress and excludes code and frontmatter from reading estimates', () => {
    const doc = fromSource(new SourceDocument('---\nsecret: metadata\n---\n\n# 标题\n\n- [x] done\n- [ ] pending\n\n```js\nignored code\n```\n'));
    const info = documentInfo(doc);
    expect(info).toMatchObject({ words: 4, tasks: 2, completed: 1, minutes: 1 });
    expect(info.headings).toMatchObject([{ text: '标题', level: 1, pos: expect.any(Number), slug: '标题' }]);
  });
  it('generates distinct anchors for repeated and punctuated headings', () => {
    const info = documentInfo(fromSource(new SourceDocument('# Hello, World!\n\n## Hello, World!\n\n## Hello World-1\n\n## Hello, World!\n')));
    expect(info.headings.map(h => h.slug)).toEqual(['hello-world', 'hello-world-1', 'hello-world-1-1', 'hello-world-2']);
  });
  it('reuses immutable document metrics across selection-only updates', () => {
    const doc = fromSource(new SourceDocument('# Cached\n\nparagraph\n'));
    expect(documentInfo(doc)).toBe(documentInfo(doc));
  });
  it('sums reading estimates without rounding errors at minute boundaries', () => {
    const doc = fromSource(new SourceDocument(Array(200).fill('word').join('\n\n')));
    expect(documentInfo(doc).minutes).toBe(1);
  });
});
