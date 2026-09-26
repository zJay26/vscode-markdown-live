import type { Node as PMNode } from '@milkdown/kit/prose/model';
import type { EditorView as PMView, NodeView } from '@milkdown/kit/prose/view';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import katex from 'katex';
import { schema } from '../core/schema';

export function sourceEditor(parent: HTMLElement, value: string, change: (text: string) => void, close: () => void, history: (redo: boolean) => void): EditorView {
  return new EditorView({ parent, state: EditorState.create({ doc: value, extensions: [
    markdown(), EditorView.lineWrapping, lineNumbers(),
    EditorView.contentAttributes.of({ 'aria-label': '源码编辑区', spellcheck: 'false' }),
    keymap.of([{ key: 'Escape', run: () => { close(); return true; } }, { key: 'Mod-Enter', run: () => { close(); return true; } }, { key: 'Mod-z', run: () => { history(false); return true; } }, { key: 'Mod-Shift-z', run: () => { history(true); return true; } }, ...defaultKeymap]),
    EditorView.updateListener.of(update => { if (update.docChanged) change(update.state.doc.toString()); }),
  ] }) });
}
let diagramSequence = 0;
let mermaidPromise: Promise<typeof import('mermaid').default> | undefined;
const diagramCache = new Map<string, string>();
async function diagram(value: string) {
  if (diagramCache.has(value)) return diagramCache.get(value)!;
  mermaidPromise ??= import('mermaid').then(m => { m.default.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', suppressErrorRendering: true }); return m.default; });
  const mermaid = await mermaidPromise;
  const { svg } = await mermaid.render(`diagram-${++diagramSequence}`, value);
  diagramCache.set(value, svg); if (diagramCache.size > 100) diagramCache.delete(diagramCache.keys().next().value!);
  return svg;
}
export interface ViewActions { source(pos: number): void; image(pos: number): void; history(redo: boolean): void; copy(text: string): void; resolve(path: string, element: HTMLImageElement): void; error(message: string): void }
export class FormulaView implements NodeView {
  dom: HTMLElement;
  private preview: HTMLElement;
  private editor?: EditorView;
  private editArea?: HTMLElement;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private destroyed = false;
  private isDiagram: boolean;
  constructor(private node: PMNode, private view: PMView, private getPos: () => number | undefined, private actions: ViewActions) {
    this.isDiagram = node.type.name === 'code_block';
    this.dom = document.createElement(node.isInline ? 'span' : 'div');
    this.dom.className = `special-node ${node.isInline ? 'inline-math' : 'block-special'}`; this.dom.contentEditable = 'false';
    this.preview = document.createElement(node.isInline ? 'span' : 'div'); this.preview.className = 'formula-preview'; this.preview.tabIndex = 0;
    this.preview.setAttribute('role', 'button'); this.preview.setAttribute('aria-label', this.isDiagram ? '编辑 Mermaid 图表' : '编辑公式');
    this.preview.addEventListener('click', () => this.open()); this.preview.addEventListener('keydown', e => { if (e.key === 'Enter') this.open(); });
    this.dom.append(this.preview); void this.render();
  }
  private value() { return this.isDiagram ? this.node.textContent : this.node.attrs.value; }
  private async render() {
    const generation = ++this.generation;
    try {
      const html = this.isDiagram ? await diagram(this.value()) : katex.renderToString(this.value(), { displayMode: !this.node.isInline, throwOnError: true, trust: false, strict: 'warn' });
      if (generation !== this.generation || this.destroyed) return;
      this.preview.innerHTML = html; this.preview.classList.remove('render-error');
    } catch (error: any) {
      if (generation !== this.generation || this.destroyed) return;
      this.preview.textContent = `${this.isDiagram ? '图表' : '公式'}暂时无法渲染 · 点击修改\n${error.message?.split('\n')[0] ?? ''}`;
      this.preview.classList.add('render-error');
    }
  }
  private open() {
    if (this.editor) { this.editor.focus(); return; }
    this.editArea = document.createElement('span'); this.editArea.className = 'special-editor';
    const header = document.createElement('span'); header.className = 'source-heading';
    header.textContent = this.isDiagram ? 'Mermaid' : 'LaTeX';
    const templates = document.createElement('select'); templates.setAttribute('aria-label', '插入模板');
    const options = this.isDiagram ? [['', '插入模板'], ['flowchart LR\n  A[开始] --> B[结束]', '流程图'], ['sequenceDiagram\n  Alice->>Bob: 消息\n  Bob-->>Alice: 回复', '时序图']] : [['', '插入模板'], ['\\frac{a}{b}', '分式'], ['\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', '矩阵'], ['\\sum_{i=1}^{n} x_i', '求和']];
    for (const [value, label] of options) templates.add(new Option(label, value));
    templates.onchange = () => { if (templates.value) this.editor?.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: templates.value } }); templates.value = ''; };
    const done = document.createElement('button'); done.textContent = '完成'; done.onclick = () => this.close(); header.append(templates, done);
    this.editArea.append(header); this.dom.append(this.editArea);
    this.editor = sourceEditor(this.editArea, this.value(), value => {
      const pos = this.getPos(); if (pos === undefined) return;
      const tr = this.view.state.tr;
      if (this.isDiagram) tr.replaceWith(pos + 1, pos + this.node.nodeSize - 1, value ? schema.text(value) : []);
      else tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, value });
      this.view.dispatch(tr);
    }, () => this.close(), this.actions.history);
    this.editor.focus();
  }
  private close() { this.editor?.destroy(); this.editor = undefined; this.editArea?.remove(); this.view.focus(); }
  update(node: PMNode) {
    if (node.type !== this.node.type || (this.isDiagram && node.attrs.language !== 'mermaid')) return false;
    const before = this.value(); this.node = node;
    if (before !== this.value()) {
      clearTimeout(this.timer); this.timer = setTimeout(() => void this.render(), 200);
      if (this.editor && this.editor.state.doc.toString() !== this.value()) this.editor.dispatch({ changes: { from: 0, to: this.editor.state.doc.length, insert: this.value() } });
    }
    return true;
  }
  stopEvent() { return true; }
  ignoreMutation() { return true; }
  destroy() { this.destroyed = true; clearTimeout(this.timer); this.editor?.destroy(); }
}
export class CodeView implements NodeView {
  dom: HTMLElement; contentDOM: HTMLElement;
  private language: HTMLInputElement;
  constructor(private node: PMNode, view: PMView, getPos: () => number | undefined, actions: ViewActions) {
    this.dom = document.createElement('div'); this.dom.className = 'code-block';
    const bar = document.createElement('div'); bar.className = 'code-bar'; bar.contentEditable = 'false';
    this.language = document.createElement('input'); this.language.value = node.attrs.language; this.language.placeholder = '语言'; this.language.setAttribute('aria-label', '代码语言');
    this.language.onchange = () => { const pos = getPos(); if (pos !== undefined) view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, language: this.language.value })); };
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'code-copy'; copy.textContent = '复制'; copy.setAttribute('aria-label', '复制代码'); copy.onclick = () => actions.copy(this.node.textContent);
    bar.append(this.language, copy); const pre = document.createElement('pre'); this.contentDOM = document.createElement('code'); pre.append(this.contentDOM); this.dom.append(bar, pre);
  }
  update(node: PMNode) { if (node.type !== this.node.type || node.attrs.language === 'mermaid') return false; this.node = node; this.language.value = node.attrs.language; return true; }
  stopEvent(e: Event) { return e.target === this.language || !!(e.target as HTMLElement).closest?.('.code-copy'); }
}
export class ImageView implements NodeView {
  dom: HTMLElement; private image: HTMLImageElement;
  constructor(private node: PMNode, _view: PMView, getPos: () => number | undefined, actions: ViewActions) {
    this.dom = document.createElement('span'); this.dom.className = 'image-node'; this.dom.contentEditable = 'false';
    this.image = document.createElement('img'); this.image.alt = node.attrs.alt; this.image.title = node.attrs.title ?? ''; this.image.loading = 'lazy';
    this.image.addEventListener('dblclick', () => { const pos = getPos(); if (pos !== undefined) actions.image(pos); }); this.dom.append(this.image); actions.resolve(node.attrs.src, this.image);
  }
  update(node: PMNode) { if (!node.eq(this.node)) return false; return true; }
  ignoreMutation() { return true; }
}
