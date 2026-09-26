import { EditorState, Plugin, PluginKey, TextSelection, NodeSelection, type Transaction } from '@milkdown/kit/prose/state';
import { EditorView, Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { Slice, Fragment } from '@milkdown/kit/prose/model';
import { keymap } from '@milkdown/kit/prose/keymap';
import { baseKeymap, toggleMark, setBlockType, wrapIn, chainCommands, exitCode } from '@milkdown/kit/prose/commands';
import { wrapInList, splitListItem, liftListItem, sinkListItem } from '@milkdown/kit/prose/schema-list';
import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from '@milkdown/kit/prose/inputrules';
import { gapCursor } from '@milkdown/kit/prose/gapcursor';
import { dropCursor } from '@milkdown/kit/prose/dropcursor';
import { tableEditing, goToNextCell, addRowAfter, addColumnAfter, deleteRow, deleteColumn, deleteTable, setCellAttr, isInTable } from 'prosemirror-tables';
import type { EditorView as CMView } from '@codemirror/view';
import { SourceDocument, parse, stringify } from '../core/markdown';
import { schema, fromSource, toAst } from '../core/schema';
import { searchText, replaceMatches, type SearchOptions, type SearchMatch } from '../core/search';
import { documentInfo, textMetrics } from '../core/document-info';
import { editorShell } from './shell';
import { minimalEdit, rebaseEdits, applyEdits, type HostMessage, type Settings } from '../shared/protocol';
import { send, listen, isStandalone, saveState, loadState, testDocument, testExternal } from './bridge';
import { FormulaView, CodeView, ImageView, sourceEditor, type ViewActions } from './nodeviews';
import 'katex/dist/katex.min.css';
import './style.css';
import './workspace.css';

document.querySelector('#app')!.innerHTML = editorShell;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let view: EditorView;
let source: SourceDocument;
let confirmed = '', version = 0;
let inFlight: { id: string; text: string; base: string } | undefined;
let pendingRemote: Extract<HostMessage, { type: 'document' }> | undefined;
let conflictDraft: string | undefined;
let composing = false;
let serial = 0;
let local: { panel: HTMLElement; cm: CMView; index: number; pos: number; size: number; prefix: string; suffix: string; text: string; selection: number } | undefined;
let requestSave = false;
let nextHistory: boolean | undefined;
let raf = 0, noticeTimer: ReturnType<typeof setTimeout>;
let settings: Settings;
const pendingImages = new Map<string, number>();
const imageElements = new Map<string, Set<HTMLImageElement>>();
const imageURLs = new Map<string, string>();
let imageTimer: ReturnType<typeof setTimeout>;
let currentMatch = -1;
let headingSignature = '';
let fileDirty = false;
let focusMode = false;
let activeHeading: HTMLElement | undefined;
let scrollFrame = 0;
let scrollSaveTimer: ReturnType<typeof setTimeout>;
let textCache: { source: SourceDocument; doc: typeof view.state.doc; text: string } | undefined;
let searchCache: { text: string; query: string; key: string; result: SearchMatch[] } | undefined;
const searchOptions: SearchOptions = { caseSensitive: false, wholeWord: false };
const localKey = new PluginKey('local-source');
const findKey = new PluginKey('find');

function currentText(): string {
  if (local) return local.prefix + local.text + local.suffix;
  if (textCache?.source === source && textCache.doc === view.state.doc) return textCache.text;
  const text = source.serialize(toAst(view.state.doc));
  textCache = { source, doc: view.state.doc, text }; return text;
}
function notify(message: string) { $('notice').textContent = message; $('notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').hidden = true, 6000); }
function status(value: string) { $('sync-state').textContent = value; $('sync-state').dataset.state = value === '未保存' ? 'dirty' : value.includes('冲突') ? 'conflict' : value.endsWith('中') ? 'busy' : 'saved'; }
function idleStatus() { status(isStandalone ? fileDirty ? '仅本次预览' : '预览已保存' : fileDirty ? '未保存' : '已保存'); }
function persistUI() { saveState({ ui: { outline: !$('outline').hidden, focus: focusMode }, scroll: $('canvas').scrollTop }); }
function setFocusMode(enabled: boolean) {
  focusMode = enabled; document.body.classList.toggle('focus-mode', enabled);
  document.querySelector('[data-action="focus"]')!.setAttribute('aria-pressed', String(enabled));
  $('focus-label').textContent = enabled ? '退出专注' : '专注'; persistUI(); scheduleUI();
}
function flush() {
  if (!view || composing || conflictDraft !== undefined) return;
  const text = currentText();
  saveState({ draft: text, base: confirmed, version, scroll: $('canvas').scrollTop });
  if (inFlight) return;
  const edits = minimalEdit(confirmed, text);
  if (!edits.length) {
    idleStatus();
    if (requestSave) { requestSave = false; status('保存中'); send({ type: 'save' }); }
    if (nextHistory !== undefined) { const redo = nextHistory; nextHistory = undefined; send({ type: redo ? 'redo' : 'undo' }); }
    return;
  }
  inFlight = { id: `${++serial}`, text, base: confirmed }; status('同步中');
  send({ type: 'edit', id: inFlight.id, version, edits });
}
function history(redo: boolean) { if (local) closeSource(); nextHistory = redo; flush(); }
function uniqueIds(tr: Transaction) {
  const seen = new Set<string>();
  tr.doc.descendants((n, pos) => { if (n.attrs.sid) { if (seen.has(n.attrs.sid)) tr.setNodeMarkup(pos, undefined, { ...n.attrs, sid: null }); else seen.add(n.attrs.sid); } });
}
function dispatch(tr: Transaction) {
  if (conflictDraft !== undefined && tr.docChanged) return;
  if (tr.docChanged) uniqueIds(tr);
  view.updateState(view.state.apply(tr));
  for (const [id, pos] of pendingImages) pendingImages.set(id, tr.mapping.map(pos));
  if (tr.docChanged) flush();
  scheduleUI();
  if (!composing && !local && view.state.selection.$from.parent.textContent === '/' && view.state.selection.$from.parent.type === schema.nodes.paragraph) showInsert(true);
}
function readDOMSelection() {
  if (!view || composing || local || !(view.state.selection instanceof TextSelection)) return;
  const selection = window.getSelection();
  if (selection?.anchorNode && selection.focusNode && view.dom.contains(selection.anchorNode) && view.dom.contains(selection.focusNode)) {
    try {
      const anchor = view.posAtDOM(selection.anchorNode, selection.anchorOffset), head = view.posAtDOM(selection.focusNode, selection.focusOffset);
      if (anchor !== view.state.selection.anchor || head !== view.state.selection.head) view.dispatch(view.state.tr.setSelection(TextSelection.between(view.state.doc.resolve(anchor), view.state.doc.resolve(head))));
    } catch { /* Separate node-view selections belong to their own editor. */ }
  }
}
function markdownRule(regexp: RegExp, mark: string) {
  return new InputRule(regexp, (state, match, start, end) => state.tr.replaceWith(start, end, schema.text(match[1], [schema.marks[mark].create()])));
}
function searchPlugin() {
  let cachedDoc: typeof view.state.doc | undefined, cachedKey = '', cached = DecorationSet.empty;
  return new Plugin({ key: findKey, props: { decorations: state => {
    const query = $<HTMLInputElement>('search').value;
    const key = JSON.stringify([query, searchOptions, $('find-bar').hidden]);
    if (cachedDoc === state.doc && key === cachedKey) return cached;
    cachedDoc = state.doc; cachedKey = key;
    if ($('find-bar').hidden || !query) return cached = DecorationSet.empty;
    const decorations: Decoration[] = [];
    state.doc.descendants((node, pos) => {
      if (!node.isTextblock || decorations.length >= 2000) return;
      const text = node.textBetween(0, node.content.size, '', '\uFFFC');
      for (const match of searchText(text, query, searchOptions)) {
        if (decorations.length >= 2000) break;
        decorations.push(Decoration.inline(pos + 1 + match.from, pos + 1 + match.to, { class: 'search-match' }));
      }
      return false;
    });
    return cached = DecorationSet.create(state.doc, decorations);
  } } });
}
function plugins() {
  return [
    new Plugin({ key: localKey, props: { decorations: state => local ? DecorationSet.create(state.doc, [Decoration.node(local.pos, local.pos + local.size, { class: 'source-hidden' }), Decoration.widget(local.pos, local.panel, { key: 'source-panel', side: -1, stopEvent: () => true, ignoreSelection: true })]) : DecorationSet.empty } }),
    searchPlugin(),
    keymap({
      'Mod-z': () => { history(false); return true; }, 'Mod-Shift-z': () => { history(true); return true; }, 'Mod-y': () => { history(true); return true; },
      'Mod-s': () => { requestSave = true; flush(); return true; },
      'Mod-b': toggleMark(schema.marks.strong), 'Mod-i': toggleMark(schema.marks.em), 'Mod-`': toggleMark(schema.marks.code),
      'Mod-k': () => { void editLink(); return true; }, 'Mod-f': () => { action('find'); return true; }, 'Mod-h': () => { action('find'); $<HTMLInputElement>('replacement').focus(); return true; },
      'Mod-Shift-f': () => { action('focus'); return true; }, 'Mod-Shift-o': () => { action('outline'); return true; },
      'Mod-Shift-m': () => { openSource(); return true; },
      'Enter': splitListItem(schema.nodes.list_item),
      'Shift-Enter': (state, dispatch) => { dispatch?.(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView()); return true; },
      'Tab': chainCommands(goToNextCell(1), sinkListItem(schema.nodes.list_item), (state, dispatch) => { if (state.selection.$from.parent.type === schema.nodes.code_block) { dispatch?.(state.tr.insertText('  ')); return true; } return false; }),
      'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(schema.nodes.list_item)),
      'Mod-Enter': chainCommands(exitCode, (state, dispatch) => { const end = state.selection.$from.depth ? state.selection.$from.end(1) + 1 : state.doc.content.size; const tr = state.tr.insert(end, schema.nodes.paragraph.create()); dispatch?.(tr.setSelection(TextSelection.create(tr.doc,end+1)).scrollIntoView()); return true; }),
      'Mod-Alt-1': setBlockType(schema.nodes.heading,{level:1}), 'Mod-Alt-2': setBlockType(schema.nodes.heading,{level:2}), 'Mod-Alt-3': setBlockType(schema.nodes.heading,{level:3}),
      'Mod-Alt-4': setBlockType(schema.nodes.heading,{level:4}), 'Mod-Alt-5': setBlockType(schema.nodes.heading,{level:5}), 'Mod-Alt-6': setBlockType(schema.nodes.heading,{level:6}),
      'Escape': () => { if (!$('insert-menu').hidden) $('insert-menu').hidden = true; else if (!$('find-bar').hidden) action('close-find'); else if (focusMode) setFocusMode(false); $('bubble').hidden = true; if (local) closeSource(); return true; },
    }),
    inputRules({ rules: [
      textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, match => ({ level: match[1].length })),
      wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
      wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
      wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, match => ({ order: +match[1] })),
      textblockTypeInputRule(/^```([\w-]*)\s$/, schema.nodes.code_block, match => ({ language: match[1] })),
      markdownRule(/\*\*([^*]+)\*\*$/, 'strong'), markdownRule(/(?<!\*)\*([^*]+)\*$/, 'em'), markdownRule(/`([^`]+)`$/, 'code'),
      markdownRule(/~~([^~]+)~~$/, 'strike'),
    ] }),
    keymap(baseKeymap), tableEditing(), gapCursor(), dropCursor(),
  ];
}
const actions: ViewActions = {
  source: pos => openSource(pos), image: pos => void editImage(pos), history,
  copy: text => send({ type: 'copy', text }),
  resolve: (path, image) => {
    if (imageURLs.has(path)) { image.src = imageURLs.get(path)!; return; }
    if (!imageElements.has(path)) imageElements.set(path, new Set()); imageElements.get(path)!.add(image);
    clearTimeout(imageTimer); imageTimer = setTimeout(() => send({ type: 'resolveImages', paths: [...imageElements.keys()] }), 20);
  }, error: notify,
};
function initialize(text: string) {
  source = new SourceDocument(text); const doc = fromSource(source);
  view = new EditorView($('editor'), {
    state: EditorState.create({ schema, doc, plugins: plugins() }), dispatchTransaction: dispatch,
    attributes: { class: 'markdown-content', spellcheck: 'false', 'aria-label': 'Markdown 可视化编辑区', role: 'textbox', 'aria-multiline': 'true' },
    editable: () => !local && conflictDraft === undefined,
    nodeViews: {
      math_block: (n, v, p) => new FormulaView(n, v, p, actions), inline_math: (n, v, p) => new FormulaView(n, v, p, actions),
      code_block: (n, v, p) => n.attrs.language === 'mermaid' ? new FormulaView(n, v, p, actions) : new CodeView(n, v, p, actions),
      image: (n, v, p) => new ImageView(n, v, p, actions),
    },
    handleDOMEvents: {
      compositionstart: () => { composing = true; return false; },
      compositionend: () => { composing = false; setTimeout(() => { flush(); if (pendingRemote && !inFlight) { const p = pendingRemote; pendingRemote = undefined; receive(p); } }, 0); return false; },
      keydown: (_view, e) => {
        // Native selectionchange is asynchronous in Chromium. Read the current
        // DOM selection before handling another rapid key to avoid using an old caret.
        readDOMSelection();
        if (!$('insert-menu').hidden && ['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
          const buttons = [...$('insert-menu').querySelectorAll('button')]; const idx = buttons.findIndex(b => b === document.activeElement);
          if (e.key === 'Enter') (buttons[Math.max(0, idx)])?.click(); else buttons[(idx + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
          e.preventDefault(); return true;
        }
        return false;
      },
    },
    handleClick: (_view, pos, event) => {
      const target = event.target as HTMLElement;
      const back = target.closest<HTMLElement>('[data-footnote-back]');
      if (back) { const reference = [...view.dom.querySelectorAll<HTMLElement>('[data-footnote]')].find(n => n.dataset.footnote === back.dataset.footnoteBack); reference?.scrollIntoView({block:'center',behavior:'smooth'}); reference?.focus(); return true; }
      const note = target.closest<HTMLElement>('[data-footnote]');
      if (note) { const definition = document.getElementById(`fn-${note.dataset.footnote}`); definition?.scrollIntoView({ block: 'center', behavior: 'smooth' }); definition?.classList.add('visited-note'); setTimeout(() => definition?.classList.remove('visited-note'), 1800); return true; }
      const link = target.closest('a'); if (link && (event.ctrlKey || event.metaKey)) { const href = link.getAttribute('href') ?? ''; if (href.startsWith('#')) navigateHeading(href.slice(1)); else send({ type: 'openLink', href }); return true; }
      const li = target.closest<HTMLElement>('li[data-checked]');
      if (li && event.clientX < li.getBoundingClientRect().left + 20) {
        const $pos = view.state.doc.resolve(pos); for (let d = $pos.depth; d > 0; d--) if ($pos.node(d).type === schema.nodes.list_item) { view.dispatch(view.state.tr.setNodeMarkup($pos.before(d), undefined, { ...$pos.node(d).attrs, checked: !$pos.node(d).attrs.checked })); return true; }
      }
      if (target.closest('.opaque,.opaque-inline')) { openSource(pos); return true; }
      return false;
    },
    handlePaste: (_view, event) => {
      const files = [...(event.clipboardData?.files ?? [])].filter(f => f.type.startsWith('image/'));
      if (files.length) { event.preventDefault(); void importImages(files); return true; }
      const plain = event.clipboardData?.getData('text/plain');
      if (plain && !event.clipboardData?.getData('text/html') && /(^#{1,6} |\n\n|^```|^[-*] )/m.test(plain)) {
        const parsed = fromSource(new SourceDocument(plain)); const content = clearIds(parsed);
        view.dispatch(view.state.tr.replaceSelection(new Slice(content.content, 0, 0)).scrollIntoView()); return true;
      }
      return false;
    },
    handleDrop: (_view, event) => {
      const files = [...(event.dataTransfer?.files ?? [])].filter(f => f.type.startsWith('image/'));
      if (!files.length) return false;
      const p = view.posAtCoords({ left: event.clientX, top: event.clientY }); if (p) view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(p.pos))));
      event.preventDefault(); void importImages(files); return true;
    },
  });
  if (import.meta.env.DEV) window.markdownLiveTest = { getText: currentText, getConfirmed: () => confirmed, setDocument: testDocument, external: testExternal, view, source: () => source, flush };
  scheduleUI();
}
function clearIds(node: import('@milkdown/kit/prose/model').Node): import('@milkdown/kit/prose/model').Node {
  if (node.isText) return node;
  const children: import('@milkdown/kit/prose/model').Node[] = []; node.forEach(c => children.push(clearIds(c)));
  return node.type.create({ ...node.attrs, ...(Object.hasOwn(node.attrs, 'sid') ? { sid: null } : {}) }, children, node.marks);
}
function updateDocument(text: string, selection?: number) {
  const scroll = $('canvas').scrollTop;
  const oldSelection = selection ?? view.state.selection.from;
  source = new SourceDocument(text); const doc = fromSource(source);
  const start = view.state.doc.content.findDiffStart(doc.content);
  let tr = view.state.tr;
  if (start !== null) {
    const ends = view.state.doc.content.findDiffEnd(doc.content)!;
    let a = ends.a, b = ends.b; const overlap = start - Math.min(a, b); if (overlap > 0) { a += overlap; b += overlap; }
    try { tr = tr.replace(start, a, doc.slice(start, b)); } catch { tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content); }
    const pos = Math.min(selection === undefined ? tr.mapping.map(oldSelection) : oldSelection, tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(0, pos))));
  }
  view.updateState(view.state.apply(tr)); $('canvas').scrollTop = scroll; scheduleUI();
}
function setConflict(draft: string, reason: string) {
  if (local) closeSource(false);
  conflictDraft = draft; $('conflict').hidden = false; $('conflict-reason').textContent = reason; status('待处理冲突');
  saveState({ draft, base: confirmed, version }); view.setProps({ editable: () => false });
}
function receive(message: HostMessage) {
  if (message.type === 'document') {
    fileDirty = message.dirty;
    settings = message.settings; document.documentElement.style.setProperty('--body-size', `${settings.fontSize}px`); document.documentElement.style.setProperty('--body-leading', `${settings.lineHeight}`); document.documentElement.style.setProperty('--content-width', `${settings.contentWidth}px`); $('document-name').textContent = message.name;
    if (!view) {
      confirmed = message.text; version = message.version; initialize(message.text); idleStatus();
      const recovered = loadState(); if (typeof recovered?.draft === 'string' && recovered.draft !== recovered.base && recovered.draft !== confirmed) setConflict(recovered.draft, '发现重载前未同步的编辑，可先比较并恢复。');
      $('outline').hidden = !recovered?.ui?.outline;
      document.querySelector('[data-action="outline"]')!.setAttribute('aria-expanded', String(!$('outline').hidden));
      if (recovered?.ui?.focus) setFocusMode(true);
      if (recovered?.scroll) $('canvas').scrollTop = recovered.scroll; return;
    }
    if (message.version <= version && message.text === confirmed) { if (!inFlight && conflictDraft === undefined) idleStatus(); return; }
    if (inFlight || composing) { pendingRemote = message; return; }
    const localText = currentText(), old = confirmed; confirmed = message.text; version = message.version;
    if (conflictDraft !== undefined) return;
    if (localText === old) { if (local) closeSource(false); updateDocument(confirmed); idleStatus(); }
    else {
      const rebased = rebaseEdits(minimalEdit(old, localText), minimalEdit(old, confirmed));
      if (!rebased) setConflict(localText, '文件的外部修改与当前编辑重叠，草稿已保留。');
      else { if (local) closeSource(false); updateDocument(applyEdits(confirmed, rebased)); flush(); }
    }
  } else if (message.type === 'ack') {
    if (!inFlight || message.id !== inFlight.id) return;
    fileDirty = message.dirty;
    const sent = inFlight, latest = currentText(); inFlight = undefined;
    confirmed = message.text; version = message.version;
    if (message.text !== sent.text) {
      const rebased = rebaseEdits(minimalEdit(sent.text, latest), minimalEdit(sent.text, message.text));
      if (!rebased) { setConflict(latest, '同步期间发生重叠修改，草稿已保留。'); return; }
      if (local) closeSource(false); updateDocument(applyEdits(message.text, rebased));
    }
    if (pendingRemote) { const pending = pendingRemote; pendingRemote = undefined; if (pending.version > version) receive(pending); }
    flush();
  } else if (message.type === 'conflict') {
    const draft = currentText(); inFlight = undefined; confirmed = message.text; version = message.version; setConflict(draft, message.reason);
  } else if (message.type === 'images') {
    for (const [path, url] of Object.entries(message.urls)) { imageURLs.set(path, url); for (const img of imageElements.get(path) ?? []) if (url) img.src = url; imageElements.delete(path); }
  } else if (message.type === 'image') {
    const pos = pendingImages.get(message.id); pendingImages.delete(message.id);
    if (message.error) { notify(message.error); if (!inFlight && conflictDraft === undefined) idleStatus(); }
    else if (message.path && pos !== undefined) { view.dispatch(view.state.tr.insert(Math.min(pos, view.state.doc.content.size), schema.nodes.image.create({ src: message.path, alt: '图片' }))); notify('图片已保存，并插入相对路径。'); }
  } else if (message.type === 'saved') {
    fileDirty = message.dirty;
    if (!inFlight && conflictDraft === undefined) idleStatus();
    if (!message.success) notify('文档尚未保存，请检查文件权限或重试。');
  } else if (message.type === 'notice') { notify(message.message); }
  else if (message.type === 'error') { notify(message.message); if (inFlight) { inFlight = undefined; setConflict(currentText(), message.message); } }
}

function topLevel(pos = view.state.selection.from) {
  const $pos = view.state.doc.resolve(Math.min(pos, view.state.doc.content.size));
  const index = $pos.index(0); let offset = 0; for (let i = 0; i < Math.min(index, view.state.doc.childCount); i++) offset += view.state.doc.child(i).nodeSize;
  return { index: Math.min(index, view.state.doc.childCount - 1), pos: Math.min(offset, view.state.doc.content.size), node: view.state.doc.child(Math.min(index, view.state.doc.childCount - 1)) };
}
function openSource(pos?: number) {
  if (local) { local.cm.focus(); return; }
  if (conflictDraft !== undefined) return;
  const block = topLevel(pos), text = currentText(), parsed = parse(text).children ?? [], ast = parsed[block.index];
  const from = ast?.position?.start.offset ?? 0, to = ast?.position?.end.offset ?? text.length;
  const panel = document.createElement('div'); panel.className = 'source-panel'; panel.contentEditable = 'false';
  const header = document.createElement('div'); header.className = 'source-heading'; header.textContent = '段落源码';
  const hint = document.createElement('span'); hint.textContent = 'Esc / Ctrl+Enter 返回排版'; const done = document.createElement('button'); done.textContent = '完成'; done.onclick = () => closeSource(); header.append(hint, done); panel.append(header);
  const cm = sourceEditor(panel, text.slice(from, to), value => { if (local) { local.text = value; flush(); scheduleUI(); } }, () => closeSource(), history);
  local = { panel, cm, index: block.index, pos: block.pos, size: block.node.nodeSize, prefix: text.slice(0, from), suffix: text.slice(to), text: text.slice(from, to), selection: view.state.selection.from };
  view.setProps({ editable: () => !local && conflictDraft === undefined }); view.updateState(view.state.apply(view.state.tr));
  $('source-handle').hidden = true; $('bubble').hidden = true; $('mode-label').textContent = '段落源码';
  cm.focus(); scheduleUI();
}
function closeSource(commit = true) {
  if (!local) return;
  const text = currentText(), selection = local.selection, cm = local.cm; local = undefined;
  cm.destroy(); view.updateState(view.state.apply(view.state.tr));
  if (commit) { updateDocument(text, selection); flush(); }
  $('mode-label').textContent = '直接编辑 · Markdown'; view.focus(); scheduleUI();
}
function sourceOffset(pos = view.state.selection.from) {
  const block = topLevel(pos); const ast = parse(currentText()).children?.[block.index]; return ast?.position?.start.offset ?? 0;
}
function scheduleUI() { cancelAnimationFrame(raf); raf = requestAnimationFrame(updateUI); }
function updateUI() {
  if (!view) return;
  const state = view.state, selection = state.selection;
  const info = documentInfo(state.doc), headings = $('headings');
  const filter = $<HTMLInputElement>('outline-filter').value.toLocaleLowerCase();
  const headingNodes = info.headings.filter(h => h.text.toLocaleLowerCase().includes(filter));
  const signature = JSON.stringify([headingNodes, filter]);
  if (signature !== headingSignature) {
    headingSignature = signature; headings.replaceChildren(); activeHeading = undefined;
    for (const {text,level,pos} of headingNodes) {
      const b = document.createElement('button'); b.style.paddingLeft = `${10 + (level - 1) * 12}px`; b.dataset.pos = `${pos}`; b.title = text || '未命名章节';
      const levelTag = document.createElement('span'); levelTag.className = 'heading-level'; levelTag.textContent = `H${level}`; levelTag.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.textContent = text || '未命名章节'; b.append(levelTag, label);
      b.onclick = () => {
        if (local) closeSource();
        const target = TextSelection.near(view.state.doc.resolve(Math.min(pos + 1, view.state.doc.content.size)));
        view.dispatch(view.state.tr.setSelection(target).scrollIntoView()); view.focus();
        if (window.innerWidth <= 760) action('outline');
      }; headings.append(b);
    }
    if (!headings.children.length) { const p = document.createElement('p'); p.className = 'empty-hint'; p.textContent = filter ? '没有匹配的章节' : '使用标题组织文档'; headings.append(p); }
  }
  $('heading-count').textContent = `${info.headings.length} 节`;
  updateActiveHeading();
  $('document-stats').textContent = `${info.words.toLocaleString()} 字/词 · ${info.characters.toLocaleString()} 字符 · 约 ${info.minutes} 分钟${info.tasks ? ` · ${info.completed}/${info.tasks} 任务` : ''}`;
  $('selection-stats').textContent = selection.empty || local ? '' : `已选 ${textMetrics(state.doc.textBetween(selection.from, selection.to, '\n')).characters} 字符`;
  $('empty-hint').hidden = !!local || !(state.doc.childCount === 1 && state.doc.firstChild?.type === schema.nodes.paragraph && !state.doc.firstChild.content.size);
  const selectedBlock = selection.$from.parent;
  $<HTMLSelectElement>('block-type').value = selectedBlock.type === schema.nodes.heading ? `h${selectedBlock.attrs.level}` : selectedBlock.type.name === 'code_block' ? 'code_block' : 'paragraph';
  $<HTMLSelectElement>('block-type').disabled = !!local || conflictDraft !== undefined;
  for (const [action, name] of [['bold', 'strong'], ['italic', 'em'], ['strike', 'strike'], ['code', 'code']]) {
    const mark = schema.marks[name];
    const pressed = selection.empty ? !!mark.isInSet(state.storedMarks ?? selection.$from.marks()) : state.doc.rangeHasMark(selection.from, selection.to, mark);
    document.querySelectorAll(`[data-action="${action}"]`).forEach(button => button.setAttribute('aria-pressed', String(pressed)));
  }
  if (!$('find-bar').hidden) matches();
  $('table-tools').hidden = !isInTable(state) || !!local;
  const bubble = $('bubble'); bubble.hidden = selection.empty || !!local || !view.hasFocus() || selection instanceof NodeSelection;
  if (!bubble.hidden) {
    const coords = view.coordsAtPos(selection.from); bubble.style.top = `${Math.max(52, coords.top - 43)}px`; bubble.style.left = `${Math.max(12, Math.min(window.innerWidth - 250, coords.left))}px`;
  }
  const handle = $('source-handle'); handle.hidden = !!local || !view.hasFocus();
  if (!handle.hidden) { const block = topLevel(); const dom = view.nodeDOM(block.pos) as HTMLElement; if (dom?.getBoundingClientRect) { const rect = dom.getBoundingClientRect(); handle.style.top = `${Math.max(64, rect.top)}px`; handle.style.left = `${Math.max(2, rect.left - 44)}px`; } }
}
function updateActiveHeading() {
  const canvas = $('canvas'), total = canvas.scrollHeight - canvas.clientHeight;
  $('reading-progress').textContent = `${total <= 0 ? 100 : Math.min(100, Math.round(canvas.scrollTop / total * 100))}%`;
  const headings = documentInfo(view.state.doc).headings;
  let low = 0, high = headings.length - 1, index = 0;
  const threshold = canvas.getBoundingClientRect().top + 70;
  while (low <= high) {
    const mid = (low + high) >> 1, dom = view.nodeDOM(headings[mid].pos) as HTMLElement | null;
    if (dom && dom.getBoundingClientRect().top <= threshold) { index = mid; low = mid + 1; } else high = mid - 1;
  }
  const heading = headings[index];
  $('section-label').textContent = heading?.text || 'Markdown';
  const next = heading ? $('headings').querySelector<HTMLElement>(`button[data-pos="${heading.pos}"]`) ?? undefined : undefined;
  if (next !== activeHeading) {
    activeHeading?.classList.remove('active'); activeHeading?.removeAttribute('aria-current');
    next?.classList.add('active'); next?.setAttribute('aria-current', 'location'); activeHeading = next;
  }
}
function navigateHeading(slug: string) {
  let decoded: string; try { decoded = decodeURIComponent(slug); } catch { notify('此章节链接的编码无效。'); return; }
  const heading = documentInfo(view.state.doc).headings.find(h => h.slug === decoded);
  if (heading) view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(heading.pos + 1))).scrollIntoView());
  else notify('文档中没有找到这个章节。');
}
async function form(title: string, fields: { name: string; label: string; value?: string; required?: boolean }[]): Promise<Record<string,string> | undefined> {
  const dialog = $<HTMLDialogElement>('form-dialog'); $('form-title').textContent = title; $('form-fields').replaceChildren();
  for (const field of fields) { const label = document.createElement('label'); label.textContent = field.label; const input = document.createElement('input'); input.name = field.name; input.value = field.value ?? ''; input.required = !!field.required; label.append(input); $('form-fields').append(label); }
  dialog.returnValue = ''; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => { const result = dialog.returnValue === 'ok' ? Object.fromEntries(new FormData(dialog.querySelector('form')!).entries()) as Record<string,string> : undefined; resolve(result); }, { once: true }));
}
async function editLink() {
  const { from, to, $from } = view.state.selection;
  const mark = $from.marks().find(m => m.type === schema.marks.link) ?? $from.nodeAfter?.marks.find(m => m.type === schema.marks.link);
  const values = await form('编辑链接', [{ name:'text', label:'显示文字', value: view.state.doc.textBetween(from, to) }, { name:'url', label:'链接地址（留空移除链接）', value: mark?.attrs.href }, { name:'title', label:'标题', value: mark?.attrs.title }]);
  if (!values) return;
  if (from === to && !mark && !values.text && !values.url) { view.focus(); return; }
  let tr = view.state.tr;
  if (from === to && mark) {
    const start = $from.start(), parent = $from.parent; let a = from, b = to;
    parent.forEach((n, offset) => { if (n.marks.some(m => m.eq(mark))) { const s = start + offset, e = s + n.nodeSize; if (s <= from && e >= from) { a = s; b = e; } } });
    tr.removeMark(a, b, schema.marks.link); if (values.url) tr.addMark(a, b, schema.marks.link.create({ href: values.url, title: values.title || null }));
  } else if (from === to) tr.replaceSelectionWith(schema.text(values.text || values.url, values.url ? [schema.marks.link.create({ href: values.url, title: values.title || null })] : []));
  else { tr.removeMark(from, to, schema.marks.link); if (values.url) tr.addMark(from, to, schema.marks.link.create({ href: values.url, title: values.title || null })); }
  view.dispatch(tr); view.focus();
}
async function editImage(pos?: number) {
  const node = pos === undefined ? undefined : view.state.doc.nodeAt(pos);
  const values = await form(node ? '编辑图片' : '插入图片', [{ name:'src', label:'路径或 URL', value: node?.attrs.src, required:true }, { name:'alt', label:'替代文字', value: node?.attrs.alt }, { name:'title', label:'标题', value: node?.attrs.title }]);
  if (!values) return;
  const attrs = { ...node?.attrs, src: values.src, alt: values.alt, title: values.title || null, reference: null };
  view.dispatch(pos === undefined ? view.state.tr.replaceSelectionWith(schema.nodes.image.create(attrs)) : view.state.tr.setNodeMarkup(pos, undefined, attrs)); view.focus();
}
async function importImages(files: File[]) {
  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) { notify('图片不能大于 25 MB。'); continue; }
    const id = `image-${++serial}`; pendingImages.set(id, view.state.selection.from); status('保存图片中');
    try { send({ type: 'image', id, name: file.name || 'image.png', bytes: Array.from(new Uint8Array(await file.arrayBuffer())) }); } catch (error: any) { pendingImages.delete(id); notify(error.message); }
  }
}
const insertions = [
  ['heading','标题','Ctrl+Alt+1'], ['paragraph','正文',''], ['bullet','无序列表','- 空格'], ['ordered','有序列表','1. 空格'], ['task','任务清单',''], ['quote','引用','> 空格'], ['codeblock','代码块','```'], ['table','表格',''], ['image','图片','粘贴 / 拖入'], ['math','块级公式','$$'], ['inline-math','行内公式','$'], ['mermaid','Mermaid 图表',''], ['footnote','脚注',''], ['rule','分隔线',''],
];
let slashInsert = false;
function showInsert(slash = false) {
  const menu = $('insert-menu'); slashInsert = slash; menu.replaceChildren();
  for (const [id, label, key] of insertions) { const button = document.createElement('button'); button.setAttribute('role','menuitem'); const text = document.createElement('span'); text.textContent = label; const hint = document.createElement('kbd'); hint.textContent = key; button.append(text,hint); button.onclick = () => { menu.hidden = true; if (slashInsert && view.state.selection.$from.parent.textContent === '/') view.dispatch(view.state.tr.delete(view.state.selection.from - 1, view.state.selection.from)); void insert(id); }; menu.append(button); }
  menu.hidden = false; let left = 160, top = 52;
  if (slash) { const c = view.coordsAtPos(view.state.selection.from); left = c.left; top = c.bottom + 6; }
  menu.style.left = `${Math.min(window.innerWidth - 240, Math.max(8, left))}px`; menu.style.top = `${Math.min(window.innerHeight - 350, Math.max(52, top))}px`;
  if (!slash) menu.querySelector('button')?.focus();
}
function run(command: import('@milkdown/kit/prose/state').Command) { const ok = command(view.state, view.dispatch, view); view.focus(); return ok; }
function insertBlock(node: import('@milkdown/kit/prose/model').Node) { view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView()); view.focus(); }
async function insert(id: string) {
  if (local) closeSource();
  switch (id) {
    case 'heading': run(setBlockType(schema.nodes.heading, { level: 1 })); break;
    case 'paragraph': run(setBlockType(schema.nodes.paragraph)); break;
    case 'bullet': run(wrapInList(schema.nodes.bullet_list)); break;
    case 'ordered': run(wrapInList(schema.nodes.ordered_list)); break;
    case 'task': insertBlock(schema.nodes.bullet_list.create(null, schema.nodes.list_item.create({ checked:false }, schema.nodes.paragraph.create()))); break;
    case 'quote': run(wrapIn(schema.nodes.blockquote)); break;
    case 'codeblock': run(setBlockType(schema.nodes.code_block, { language:'text' })); break;
    case 'table': { const row = (header: boolean) => schema.nodes.table_row.create(null, [0,1,2].map(() => schema.nodes[header ? 'table_header' : 'table_cell'].create(null, schema.nodes.paragraph.create()))); insertBlock(schema.nodes.table.create(null, [row(true),row(false)])); break; }
    case 'image': await editImage(); break;
    case 'math': insertBlock(schema.nodes.math_block.create({ value:'E = mc^2' })); break;
    case 'inline-math': insertBlock(schema.nodes.inline_math.create({ value:'x^2' })); break;
    case 'mermaid': insertBlock(schema.nodes.code_block.create({ language:'mermaid' }, schema.text('flowchart LR\n  A[开始] --> B[结束]'))); break;
    case 'rule': insertBlock(schema.nodes.horizontal_rule.create()); break;
    case 'footnote': {
      const existing = new Set<string>(); view.state.doc.descendants(n => { if (n.attrs.identifier) existing.add(n.attrs.identifier); });
      let i = 1; while (existing.has(`${i}`)) i++;
      let tr = view.state.tr.replaceSelectionWith(schema.nodes.footnote_ref.create({ identifier:`${i}`, label:`${i}` }));
      tr = tr.insert(tr.doc.content.size, schema.nodes.footnote_definition.create({ identifier:`${i}`, label:`${i}` }, schema.nodes.paragraph.create(null, schema.text('脚注内容')))); view.dispatch(tr); view.focus(); break;
    }
  }
}
function matches() {
  const query = $<HTMLInputElement>('search').value, text = currentText(), key = JSON.stringify(searchOptions);
  if (!searchCache || searchCache.text !== text || searchCache.query !== query || searchCache.key !== key) {
    searchCache = { text, query, key, result: searchText(text, query, searchOptions) };
  }
  const result = searchCache.result;
  currentMatch = Math.min(currentMatch, result.length - 1);
  $('match-count').textContent = !query ? '全文源码' : !result.length ? '无匹配' : currentMatch < 0 ? `${result.length} 处` : `${currentMatch + 1} / ${result.length}`;
  document.querySelectorAll<HTMLButtonElement>('#find-bar [data-action="replace"], #find-bar [data-action="replace-all"], #find-bar [data-action="find-prev"], #find-bar [data-action="find-next"]').forEach(b => b.disabled = !result.length);
  return result;
}
function findNext(direction: number) {
  if (local) closeSource();
  const all = matches(); if (!all.length) return;
  currentMatch = currentMatch < 0 ? direction < 0 ? all.length - 1 : 0 : (currentMatch + direction + all.length) % all.length;
  const offset = all[currentMatch].from;
  const parsed = parse(currentText()).children ?? []; const index = parsed.findIndex(n => n.position!.start.offset <= offset && n.position!.end.offset >= offset);
  if (index >= 0) { let pos = 0; for (let i=0; i<index; i++) pos += view.state.doc.child(i).nodeSize; view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos))).scrollIntoView()); }
  matches();
}
function replace(all: boolean) {
  if (local) closeSource();
  const points = matches(), replacement = $<HTMLInputElement>('replacement').value;
  if (!points.length) return;
  const targets = all ? points : [points[Math.max(0,currentMatch)]];
  const text = replaceMatches(currentText(), targets, replacement);
  updateDocument(text); flush();
  if (all) { currentMatch = -1; notify(`已替换 ${targets.length} 处。`); }
  matches();
}
function action(id: string) {
  if (conflictDraft !== undefined && !['outline','find','close-find','find-prev','find-next','match-case','match-word','native','focus','help','copy-markdown'].includes(id)) { notify('请先比较并处理文档冲突。'); return; }
  if (['bullet','ordered','quote'].includes(id)) { void insert(id); return; }
  if (id.startsWith('align-')) { run(alignColumn(id.slice(6))); return; }
  const commands: Record<string, import('@milkdown/kit/prose/state').Command> = { bold:toggleMark(schema.marks.strong), italic:toggleMark(schema.marks.em), strike:toggleMark(schema.marks.strike), code:toggleMark(schema.marks.code), 'row-add':addRowAfter, 'col-add':addColumnAfter, 'row-delete':deleteRow, 'col-delete':deleteColumn, 'table-delete':deleteTable, 'align-left':setCellAttr('align','left'), 'align-center':setCellAttr('align','center'), 'align-right':setCellAttr('align','right') };
  if (commands[id]) { if (local) closeSource(); run(commands[id]); return; }
  switch (id) {
    case 'outline': $('outline').hidden = !$('outline').hidden; document.querySelector('[data-action="outline"]')!.setAttribute('aria-expanded', String(!$('outline').hidden)); persistUI(); scheduleUI(); break;
    case 'focus': setFocusMode(!focusMode); view.focus(); break;
    case 'help': $<HTMLDialogElement>('help-dialog').showModal(); break;
    case 'copy-markdown': send({ type: 'copy', text: conflictDraft ?? currentText() }); break;
    case 'undo': history(false); break;
    case 'redo': history(true); break;
    case 'insert': showInsert(); break;
    case 'source': openSource(); break;
    case 'native': if (isStandalone) { notify('在 VS Code 插件中可打开对应源码；此处为浏览器预览。'); } else send({ type:'source', offset:sourceOffset() }); break;
    case 'find': $('find-bar').hidden = false; $<HTMLInputElement>('search').focus(); $<HTMLInputElement>('search').select(); matches(); view.dispatch(view.state.tr); break;
    case 'close-find': $('find-bar').hidden = true; view.dispatch(view.state.tr); view.focus(); break;
    case 'find-prev': findNext(-1); break;
    case 'find-next': findNext(1); break;
    case 'replace': replace(false); break;
    case 'replace-all': replace(true); break;
    case 'match-case': case 'match-word': {
      const key = id === 'match-case' ? 'caseSensitive' : 'wholeWord'; searchOptions[key] = !searchOptions[key];
      document.querySelector(`[data-action="${id}"]`)!.setAttribute('aria-pressed', String(searchOptions[key]));
      currentMatch = -1; matches(); view.dispatch(view.state.tr); break;
    }
    case 'link': void editLink(); break;
  }
}
function alignColumn(align: string): import('@milkdown/kit/prose/state').Command {
  return (state, dispatch) => {
    const $pos = state.selection.$from;
    let depth = $pos.depth; while (depth > 0 && $pos.node(depth).type !== schema.nodes.table_row) depth--;
    if (!depth) return false;
    const column = $pos.index(depth), tableDepth = depth - 1, table = $pos.node(tableDepth), start = $pos.start(tableDepth);
    const tr = state.tr;
    table.forEach((row, rowOffset) => { let cellOffset=0; for(let i=0;i<row.childCount;i++){const cell=row.child(i);if(i===column)tr.setNodeMarkup(start+rowOffset+1+cellOffset,undefined,{...cell.attrs,align});cellOffset+=cell.nodeSize;} });
    dispatch?.(tr); return true;
  };
}
document.addEventListener('mousedown', event => {
  const target = event.target as HTMLElement, button = target.closest('[data-action]');
  if ((button || target.closest('#block-type')) && view?.hasFocus()) readDOMSelection();
  if (button && button.getAttribute('data-action') !== 'find') event.preventDefault();
});
document.addEventListener('click', event => { const target = event.target as HTMLElement; const button = target.closest<HTMLElement>('[data-action]'); if (button && view) action(button.dataset.action!); if (!target.closest('#insert-menu') && !target.closest('[data-action="insert"]') && target !== view?.dom) $('insert-menu').hidden = true; });
$('source-handle').onmousedown = e => e.preventDefault(); $('source-handle').onclick = () => openSource();
$('canvas').addEventListener('scroll', () => {
  $('bubble').hidden = true; $('source-handle').hidden = true;
  if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; if (view) updateActiveHeading(); });
  clearTimeout(scrollSaveTimer); scrollSaveTimer = setTimeout(persistUI, 300);
}, { passive: true });
window.addEventListener('resize', scheduleUI);
$('outline-filter').addEventListener('input', scheduleUI);
$('block-type').addEventListener('change', () => {
  const value = $<HTMLSelectElement>('block-type').value;
  if (conflictDraft !== undefined || local) return;
  run(value === 'paragraph' ? setBlockType(schema.nodes.paragraph) : setBlockType(schema.nodes.heading, { level: +value.slice(1) }));
});
$('search').addEventListener('input', () => { currentMatch = -1; matches(); view.dispatch(view.state.tr); });
$('search').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findNext(e.shiftKey ? -1 : 1); } });
$('recover').onclick = () => { if (conflictDraft !== undefined) send({ type:'recover', text:conflictDraft }); };
$('accept-remote').onclick = async () => {
  if (conflictDraft !== undefined) send({ type:'recover', text:conflictDraft });
  conflictDraft = undefined; $('conflict').hidden = true; if (local) closeSource(false); updateDocument(confirmed); view.setProps({ editable: () => !local && conflictDraft === undefined }); saveState({ base:confirmed, draft:confirmed, version }); idleStatus();
};
document.addEventListener('keydown', e => {
  if (!view || e.defaultPrevented || e.isComposing || composing || document.querySelector('dialog[open]')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.shiftKey && ['f','o'].includes(e.key.toLowerCase())) { e.preventDefault(); action(e.key.toLowerCase() === 'f' ? 'focus' : 'outline'); return; }
  if (mod && !e.shiftKey && ['f','h'].includes(e.key.toLowerCase())) { e.preventDefault(); action('find'); if (e.key.toLowerCase() === 'h') $('replacement').focus(); return; }
  if (!$('insert-menu').hidden && (e.target as HTMLElement).closest('#insert-menu') && ['ArrowDown','ArrowUp'].includes(e.key)) {
    const buttons=[...$('insert-menu').querySelectorAll('button')], index=buttons.findIndex(b=>b===document.activeElement);
    buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();e.preventDefault();
  }
  if (e.key === 'Escape') {
    if (!$('insert-menu').hidden) { $('insert-menu').hidden = true; view.focus(); }
    else if (!$('find-bar').hidden) action('close-find');
    else if (focusMode) setFocusMode(false);
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); requestSave = true; flush(); }
});
listen(receive); send({ type:'ready' });
