import { describe, expect, it } from 'vitest';
import { EditorState } from '@milkdown/kit/prose/state';
import { SourceDocument, parse, stringify } from '../src/core/markdown';
import { fromSource, schema, toAst } from '../src/core/schema';

function model(text: string) {
  const source = new SourceDocument(text), doc = fromSource(source);
  return { source, doc, state: EditorState.create({ schema, doc }) };
}
const sample = 'before\n\n::: {custom-style="Figure"}\n![图](assets/figure.png)\n:::\n\n::: {custom-style="Caption"}\n图 34 | __原有格式__ 和 $x^2$\n:::\n\nafter\n';

describe('Pandoc fenced Divs', () => {
  it('renders Figure and Caption as editable containers without literal fences', () => {
    const { source, doc } = model(sample);
    expect(doc.child(1).type.name).toBe('pandoc_div');
    expect(doc.child(1).firstChild!.firstChild!.type.name).toBe('image');
    expect(doc.child(2).attrs.attributes).toBe('{custom-style="Caption"}');
    expect(doc.textContent).not.toContain(':::');
    expect(source.serialize(toAst(doc))).toBe(sample);
  });

  for (const eol of ['\n', '\r\n']) it(`preserves source, attributes and fences when editing with ${JSON.stringify(eol)}`, () => {
    const text = sample.replace(/\n/g, eol);
    const { source, state } = model(text);
    let position = -1;
    state.doc.descendants((n, p) => { if (n.isText && n.text === '原有格式') position = p; });
    const tr = state.tr.replaceWith(position, position + 4, schema.text('新原有格式', [schema.marks.strong.create()]));
    expect(source.serialize(toAst(tr.doc))).toBe(text.replace('原有格式', '新原有格式'));
  });

  it('handles nested fences of different lengths and quoted attributes', () => {
    const text = '::::: {#outer .wide custom-style="My Caption"} :::\n\n::: {.inner custom-style=\'Caption\'}\nhello\n::::::::\n\nworld\n:::\n';
    const { source, doc, state } = model(text);
    expect(doc.childCount).toBe(1);
    expect(doc.firstChild!.firstChild!.type.name).toBe('pandoc_div');
    expect(source.serialize(toAst(doc))).toBe(text);
    let position = -1;
    doc.descendants((n, p) => { if (n.isText && n.text === 'hello') position = p; });
    expect(source.serialize(toAst(state.tr.insertText('!', position + 5).doc))).toBe(text.replace('hello', 'hello!'));
  });

  it('supports lists, tables, blockquotes and reference links inside containers', () => {
    const text = '::: note\n\n* one\n* two\n\n> quote\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n[link][ref]\n\n[ref]: /target\n:::\n';
    const { source, doc } = model(text);
    expect(doc.childCount).toBe(1);
    const div = doc.firstChild!;
    expect(Array.from({ length: div.childCount }, (_, i) => div.child(i).type.name)).toEqual(['bullet_list', 'blockquote', 'table', 'paragraph', 'opaque']);
    expect(div.child(3).firstChild!.marks[0].attrs.href).toBe('/target');
    expect(source.serialize(toAst(doc))).toBe(text);
  });

  for (const text of [
    '> ::: {custom-style="Caption"}\n> hello\n> :::\n',
    '- item\n\n  ::: {custom-style="Caption"}\n  hello\n  :::\n',
  ]) it(`supports Divs within Markdown parents: ${text[0]}`, () => {
    const { source, doc, state } = model(text);
    let count = 0, pos = -1;
    doc.descendants((n, p) => { if (n.type.name === 'pandoc_div') count++; if (n.isText && n.text === 'hello') pos = p; });
    expect(count).toBe(1);
    expect(source.serialize(toAst(doc))).toBe(text);
    expect(source.serialize(toAst(state.tr.insertText('!', pos + 5).doc))).toBe(text.replace('hello', 'hello!'));
  });

  it('keeps code, HTML, frontmatter, escaped and inline examples literal', () => {
    for (const text of [
      '```md\n::: {custom-style="Caption"}\nhello\n:::\n```\n',
      '    ::: {custom-style="Caption"}\n    hello\n    :::\n',
      '<pre>\n::: {custom-style="Caption"}\nhello\n:::\n</pre>\n',
      '---\nexample: |\n  ::: {custom-style="Caption"}\n  hello\n  :::\n---\n',
      '\\::: {custom-style="Caption"}\nhello\n:::\n',
      '`::: {custom-style="Caption"}`\n\ntext ::: {.note}\n',
    ]) {
      const { source, doc } = model(text);
      doc.descendants(n => { expect(n.type.name).not.toBe('pandoc_div'); });
      expect(source.serialize(toAst(doc))).toBe(text);
    }
  });

  it('does not close an outer Div on a fence inside code', () => {
    const text = '::: note\n\n```md\n::: {custom-style="Caption"}\nhello\n:::\n```\n\nend\n:::\n';
    const { source, doc } = model(text);
    expect(doc.childCount).toBe(1);
    expect(doc.firstChild!.child(0).type.name).toBe('code_block');
    expect(doc.firstChild!.child(1).textContent).toBe('end');
    expect(source.serialize(toAst(doc))).toBe(text);
  });

  it('preserves malformed and unclosed input as visible text', () => {
    for (const text of ['::: {.note}\nhello\n', '::: {custom-style="Caption}\nhello\n:::\n', ':::\n', '::: arbitrary words\nhello\n:::\n']) {
      const { source, doc } = model(text);
      doc.descendants(n => { expect(n.type.name).not.toBe('pandoc_div'); });
      expect(doc.textContent).toContain(':::');
      expect(source.serialize(toAst(doc))).toBe(text);
    }
  });

  it('retains containers on paragraph split, insertion, deletion and serialization', () => {
    const text = 'before\n\n:::: {custom-style="Caption"} :::\nhello\n::::::\n\nafter\n';
    const { source, doc, state } = model(text);
    let position = -1;
    doc.descendants((n, p) => { if (n.isText && n.text === 'hello') position = p; });
    const split = source.serialize(toAst(state.tr.split(position + 2).doc));
    expect(split).toContain(':::: {custom-style="Caption"} :::\nhe\n\nllo\n::::::');
    expect(parse(split).children!.map(n => n.type)).toEqual(['paragraph', 'pandocDiv', 'paragraph']);
    const roundTrip = stringify(toAst(doc));
    expect(parse(roundTrip).children![1].type).toBe('pandocDiv');
    const added = source.serialize(toAst(state.tr.insert(position + 6, schema.nodes.paragraph.create(null, schema.text('new'))).doc));
    expect(parse(added).children![1].children).toHaveLength(2);
    const emptied = source.serialize(toAst(state.tr.delete(position - 1, position + 6).doc));
    expect(parse(emptied).children![1].type).toBe('pandocDiv');
    expect(emptied).toContain(':::: {custom-style="Caption"} :::\n::::::');
  });
});
