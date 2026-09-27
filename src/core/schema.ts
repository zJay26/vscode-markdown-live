import { Schema, type Node as PMNode, type Mark, type NodeSpec } from '@milkdown/kit/prose/model';
import { tableNodes } from 'prosemirror-tables';
import { type Ast, SourceDocument, semantic } from './markdown';
import { divStyle } from './pandoc-div';

const sid = { sid: { default: null } };
const tables = tableNodes({ tableGroup: 'block', cellContent: 'paragraph', cellAttributes: { align: { default: null, getFromDOM: el => el.style.textAlign || null, setDOMAttr: (value, attrs) => { if (value) attrs.style = `text-align:${value}`; } } } });
for (const spec of Object.values(tables)) spec.attrs = { ...spec.attrs, ...sid };
export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { attrs: sid, content: 'inline*', group: 'block', parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
    heading: { attrs: { ...sid, level: { default: 1 } }, content: 'inline*', group: 'block', defining: true, parseDOM: [1,2,3,4,5,6].map(level => ({ tag: `h${level}`, attrs: { level } })), toDOM: n => [`h${n.attrs.level}`, 0] },
    blockquote: { attrs: sid, content: 'block+', group: 'block', defining: true, parseDOM: [{ tag: 'blockquote' }], toDOM: () => ['blockquote', 0] },
    pandoc_div: {
      attrs: { ...sid, attributes: { default: '{}' }, opening: { default: '::: {}' }, closing: { default: ':::' } },
      content: 'block*', group: 'block', defining: true,
      parseDOM: [{ tag: 'div[data-pandoc-div]', getAttrs: el => {
        const attributes = el.getAttribute('data-pandoc-div') || '{}';
        return { attributes, opening: el.getAttribute('data-pandoc-opening') || `::: ${attributes}`, closing: el.getAttribute('data-pandoc-closing') || ':::' };
      } }],
      toDOM: n => ['div', { class: 'pandoc-div', 'data-pandoc-div': n.attrs.attributes, 'data-pandoc-opening': n.attrs.opening, 'data-pandoc-closing': n.attrs.closing, 'data-custom-style': divStyle(n.attrs.attributes) }, 0],
    },
    bullet_list: { attrs: { ...sid, spread: { default: false } }, content: 'list_item+', group: 'block', parseDOM: [{ tag: 'ul' }], toDOM: () => ['ul', 0] },
    ordered_list: { attrs: { ...sid, order: { default: 1 }, spread: { default: false } }, content: 'list_item+', group: 'block', parseDOM: [{ tag: 'ol', getAttrs: e => ({ order: +(e as HTMLElement).getAttribute('start')! || 1 }) }], toDOM: n => ['ol', { start: n.attrs.order }, 0] },
    list_item: { attrs: { ...sid, checked: { default: null }, spread: { default: false } }, content: 'paragraph block*', defining: true, parseDOM: [{ tag: 'li' }], toDOM: n => ['li', n.attrs.checked === null ? {} : { 'data-checked': String(n.attrs.checked), class: 'task-item' }, 0] },
    code_block: { attrs: { ...sid, language: { default: '' }, meta: { default: null } }, content: 'text*', marks: '', group: 'block', code: true, defining: true, parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }], toDOM: n => ['pre', { 'data-language': n.attrs.language }, ['code', 0]] },
    horizontal_rule: { attrs: sid, group: 'block', parseDOM: [{ tag: 'hr' }], toDOM: () => ['hr'] },
    math_block: { attrs: { ...sid, value: { default: '' }, meta: { default: null } }, group: 'block', atom: true, toDOM: n => ['div', { class: 'math-block' }, n.attrs.value] },
    footnote_definition: { attrs: { ...sid, identifier: {}, label: { default: null } }, content: 'block+', group: 'block', defining: true, toDOM: n => ['aside', { class: 'footnote-definition', id: `fn-${n.attrs.identifier}`, 'data-label': `[^${n.attrs.label ?? n.attrs.identifier}]` }, ['div', { contenteditable:'false', class:'footnote-tools' }, ['button', { 'data-footnote-back': n.attrs.identifier, type:'button' }, '返回引用 ↑']], ['div', 0]] },
    opaque: { attrs: { ...sid, raw: { default: '' }, ast: { default: '' }, label: { default: '源码' } }, group: 'block', atom: true, toDOM: n => ['pre', { class: 'opaque', 'data-label': n.attrs.label }, n.attrs.raw] },
    ...tables,
    text: { group: 'inline' },
    hard_break: { inline: true, group: 'inline', selectable: false, parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
    image: { inline: true, group: 'inline', atom: true, attrs: { ...sid, src: {}, alt: { default: '' }, title: { default: null }, reference: { default: null } }, parseDOM: [{ tag: 'img[src]', getAttrs: e => ({ src: (e as HTMLImageElement).getAttribute('src'), alt: (e as HTMLImageElement).alt, title: (e as HTMLImageElement).title || null }) }], toDOM: n => ['img', { src: n.attrs.src, alt: n.attrs.alt, title: n.attrs.title }] },
    inline_math: { inline: true, group: 'inline', atom: true, attrs: { ...sid, value: { default: '' } }, toDOM: n => ['span', { class: 'inline-math' }, n.attrs.value] },
    footnote_ref: { inline: true, group: 'inline', atom: true, attrs: { ...sid, identifier: {}, label: { default: null } }, toDOM: n => ['sup', { class: 'footnote-ref', 'data-footnote': n.attrs.identifier, tabindex: '0' }, `[${n.attrs.label ?? n.attrs.identifier}]`] },
    opaque_inline: { inline: true, group: 'inline', atom: true, attrs: { ...sid, raw: {}, ast: {} }, toDOM: n => ['code', { class: 'opaque-inline' }, n.attrs.raw] },
  } as Record<string, NodeSpec>,
  marks: {
    strong: { parseDOM: [{ tag: 'strong' }, { tag: 'b' }], toDOM: () => ['strong', 0] },
    em: { parseDOM: [{ tag: 'em' }, { tag: 'i' }], toDOM: () => ['em', 0] },
    strike: { parseDOM: [{ tag: 's' }, { tag: 'del' }], toDOM: () => ['del', 0] },
    code: { code: true, excludes: '_', parseDOM: [{ tag: 'code' }], toDOM: () => ['code', 0] },
    link: { attrs: { href: { default: '' }, title: { default: null }, reference: { default: null } }, inclusive: false, parseDOM: [{ tag: 'a[href]', getAttrs: e => ({ href: (e as HTMLAnchorElement).getAttribute('href'), title: (e as HTMLAnchorElement).title || null }) }], toDOM: m => ['a', { href: m.attrs.href, title: m.attrs.title }, 0] },
  },
});

export function fromSource(source: SourceDocument): PMNode {
  const definitions = new Map<string, Ast>();
  const collectDefinitions = (n: Ast) => { if (n.type === 'definition' && !definitions.has(n.identifier)) definitions.set(n.identifier, n); n.children?.forEach(collectDefinitions); };
  collectDefinitions(source.ast);
  const inline = (n: Ast, marks: Mark[] = []): PMNode[] => {
    const id = { sid: n._id };
    if (n.type === 'text') return n.value ? [schema.text(n.value, marks)] : [];
    if (['strong','emphasis','delete','link','linkReference'].includes(n.type)) {
      let mark: Mark;
      if (n.type === 'link' || n.type === 'linkReference') {
        const d = n.type === 'linkReference' ? definitions.get(n.identifier) : n;
        mark = schema.marks.link.create({ href: d?.url ?? '', title: d?.title ?? null, reference: n.type === 'linkReference' ? { identifier: n.identifier, label: n.label, referenceType: n.referenceType } : null });
      } else mark = schema.marks[{ strong:'strong', emphasis:'em', delete:'strike' }[n.type]!].create();
      return (n.children ?? []).flatMap(c => inline(c, [...marks, mark]));
    }
    if (n.type === 'inlineCode') return n.value ? [schema.text(n.value, [...marks, schema.marks.code.create()])] : [];
    if (n.type === 'break') return [schema.nodes.hard_break.create(null, null, marks)];
    if (n.type === 'inlineMath') return [schema.nodes.inline_math.create({ ...id, value: n.value }, null, marks)];
    if (n.type === 'footnoteReference') return [schema.nodes.footnote_ref.create({ ...id, identifier: n.identifier, label: n.label }, null, marks)];
    if (n.type === 'image' || n.type === 'imageReference') {
      const d = n.type === 'imageReference' ? definitions.get(n.identifier) : n;
      return [schema.nodes.image.create({ ...id, src: d?.url ?? '', title: d?.title ?? null, alt: n.alt ?? '', reference: n.type === 'imageReference' ? { identifier: n.identifier, label: n.label, referenceType: n.referenceType } : null }, null, marks)];
    }
    return [schema.nodes.opaque_inline.create({ ...id, raw: source.raw(n), ast: JSON.stringify(n) }, null, marks)];
  };
  const block = (n: Ast): PMNode => {
    const id = { sid: n._id }, children = () => (n.children ?? []).map(block);
    switch (n.type) {
      case 'paragraph': return schema.nodes.paragraph.create(id, n.children?.flatMap(c => inline(c)));
      case 'heading': return schema.nodes.heading.create({ ...id, level: n.depth }, n.children?.flatMap(c => inline(c)));
      case 'blockquote': return schema.nodes.blockquote.create(id, children());
      case 'pandocDiv': return schema.nodes.pandoc_div.create({ ...id, attributes: n.attributes, opening: n.opening, closing: n.closing }, children());
      case 'list': return schema.nodes[n.ordered ? 'ordered_list' : 'bullet_list'].create({ ...id, order: n.start ?? 1, spread: n.spread }, children());
      case 'listItem': {
        const content = children(); if (content[0]?.type !== schema.nodes.paragraph) content.unshift(schema.nodes.paragraph.create());
        return schema.nodes.list_item.create({ ...id, checked: n.checked ?? null, spread: n.spread }, content);
      }
      case 'code': return schema.nodes.code_block.create({ ...id, language: n.lang ?? '', meta: n.meta ?? null }, n.value ? schema.text(n.value) : null);
      case 'math': return schema.nodes.math_block.create({ ...id, value: n.value, meta: n.meta ?? null });
      case 'thematicBreak': return schema.nodes.horizontal_rule.create(id);
      case 'footnoteDefinition': return schema.nodes.footnote_definition.create({ ...id, identifier: n.identifier, label: n.label }, children());
      case 'table': return schema.nodes.table.create(id, n.children?.map((row, r) => schema.nodes.table_row.create({ sid: row._id }, row.children?.map((cell, c) => schema.nodes[r === 0 ? 'table_header' : 'table_cell'].create({ sid: cell._id, align: n.align?.[c] ?? null }, schema.nodes.paragraph.create(null, cell.children?.flatMap(v => inline(v))))))));
      default: return schema.nodes.opaque.create({ ...id, raw: source.raw(n), ast: JSON.stringify(n), label: ({ yaml: 'YAML 属性', toml: 'TOML 属性', html: 'HTML 源码', definition: '链接定义' } as Record<string,string>)[n.type] ?? n.type });
    }
  };
  const doc = schema.nodes.doc.create(null, source.ast.children?.length ? source.ast.children.map(block) : schema.nodes.paragraph.create());
  source.setBaseline(toAst(doc)); return doc;
}
function wrapMark(n: Ast, mark: Mark): Ast {
  if (mark.type.name === 'code') return { type: 'inlineCode', value: n.value ?? '' };
  if (mark.type.name === 'link') return mark.attrs.reference
    ? { type: 'linkReference', ...mark.attrs.reference, children: [n] }
    : { type: 'link', url: mark.attrs.href, title: mark.attrs.title, children: [n] };
  return { type: ({ strong:'strong', em:'emphasis', strike:'delete' } as Record<string,string>)[mark.type.name], children: [n] };
}
function mergeInline(nodes: Ast[]): Ast[] {
  const result: Ast[] = [];
  for (const node of nodes) {
    const last = result.at(-1);
    if (last?.type === 'text' && node.type === 'text') last.value += node.value!;
    else if (last && last.children && node.children && semantic({ ...last, children: [] }) === semantic({ ...node, children: [] })) last.children = mergeInline([...last.children, ...node.children]);
    else result.push(node);
  }
  return result;
}
const astCache = new WeakMap<PMNode, Ast>();
export function toAst(n: PMNode): Ast {
  const cached = astCache.get(n); if (cached) return cached;
  const ast = convertAst(n); astCache.set(n, ast); return ast;
}
function convertAst(n: PMNode): Ast {
  const id = n.attrs.sid ? { _id: n.attrs.sid } : {};
  const children = (): Ast[] => { const arr: Ast[] = []; n.forEach(c => arr.push(toAst(c))); return arr; };
  const inlines = () => mergeInline(children().map(n => structuredClone(n)));
  let ast: Ast;
  switch (n.type.name) {
    case 'doc': return { type: 'root', children: children() };
    case 'text': ast = { type: 'text', value: n.text! }; break;
    case 'paragraph': return { type: 'paragraph', ...id, children: inlines() };
    case 'heading': return { type: 'heading', ...id, depth: n.attrs.level, children: inlines() };
    case 'blockquote': return { type: 'blockquote', ...id, children: children() };
    case 'pandoc_div': return { type: 'pandocDiv', ...id, attributes: n.attrs.attributes, opening: n.attrs.opening, closing: n.attrs.closing, children: children() };
    case 'bullet_list': case 'ordered_list': return { type: 'list', ...id, ordered: n.type.name === 'ordered_list', start: n.type.name === 'ordered_list' ? n.attrs.order : null, spread: n.attrs.spread, children: children() };
    case 'list_item': return { type: 'listItem', ...id, checked: n.attrs.checked, spread: n.attrs.spread, children: children() };
    case 'code_block': return { type: 'code', ...id, lang: n.attrs.language || null, meta: n.attrs.meta, value: n.textContent };
    case 'math_block': return { type: 'math', ...id, value: n.attrs.value, meta: n.attrs.meta };
    case 'horizontal_rule': return { type: 'thematicBreak', ...id };
    case 'footnote_definition': return { type: 'footnoteDefinition', ...id, identifier: n.attrs.identifier, label: n.attrs.label, children: children() };
    case 'opaque': case 'opaque_inline': return { ...JSON.parse(n.attrs.ast), ...id };
    case 'table': return { type: 'table', ...id, align: Array.from({ length: n.firstChild!.childCount }, (_, i) => n.firstChild!.child(i).attrs.align), children: children() };
    case 'table_row': return { type: 'tableRow', ...id, children: children() };
    case 'table_cell': case 'table_header': { const cells: Ast[] = []; n.forEach(p => p.forEach(c => cells.push(structuredClone(toAst(c))))); return { type: 'tableCell', ...id, children: mergeInline(cells) }; }
    case 'hard_break': ast = { type: 'break' }; break;
    case 'inline_math': ast = { type: 'inlineMath', ...id, value: n.attrs.value }; break;
    case 'footnote_ref': ast = { type: 'footnoteReference', ...id, identifier: n.attrs.identifier, label: n.attrs.label }; break;
    case 'image': ast = n.attrs.reference
      ? { type: 'imageReference', ...id, ...n.attrs.reference, alt: n.attrs.alt }
      : { type: 'image', ...id, url: n.attrs.src, alt: n.attrs.alt, title: n.attrs.title }; break;
    default: throw new Error(`Unsupported node ${n.type.name}`);
  }
  return [...n.marks].reverse().reduce(wrapMark, ast);
}
