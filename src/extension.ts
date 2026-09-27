import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { applyEdits, minimalEdit, rebaseEdits, type ClientMessage, type HostMessage, type Settings } from './shared/protocol';

interface Session { document: vscode.TextDocument; panels: Set<vscode.WebviewPanel>; history: Map<number, string>; queue: Promise<unknown>; origin?: vscode.WebviewPanel }
export class MarkdownLiveProvider implements vscode.CustomTextEditorProvider, vscode.Disposable {
  static readonly viewType = 'markdownLive.editor';
  private sessions = new Map<string, Session>();
  private subscriptions: vscode.Disposable[] = [];
  private active?: { panel: vscode.WebviewPanel; document: vscode.TextDocument };
  constructor(private context: vscode.ExtensionContext) {
    this.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
      const session = this.sessions.get(e.document.uri.toString());
      if (!session) return;
      this.remember(session);
      for (const panel of session.panels) if (panel !== session.origin) this.sendDocument(panel, session.document);
    }), vscode.workspace.onDidSaveTextDocument(document => {
      const session = this.sessions.get(document.uri.toString());
      if (session) for (const panel of session.panels) this.sendDocument(panel, document);
    }), vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('markdownLive')) for (const session of this.sessions.values()) for (const p of session.panels) this.sendDocument(p, session.document);
    }));
  }
  dispose() { this.subscriptions.forEach(d => d.dispose()); }
  private settings(uri: vscode.Uri): Settings {
    const config = vscode.workspace.getConfiguration('markdownLive', uri);
    return { fontSize: config.get('fontSize', 16), lineHeight: config.get('lineHeight', 1.7), contentWidth: config.get('contentWidth', 900), assetsDirectory: config.get('assetsDirectory', 'assets/${documentName}') };
  }
  private remember(s: Session) {
    s.history.set(s.document.version, s.document.getText());
    while (s.history.size > 128) s.history.delete(s.history.keys().next().value!);
  }
  private post(panel: vscode.WebviewPanel, message: HostMessage) { void panel.webview.postMessage(message); }
  private sendDocument(panel: vscode.WebviewPanel, document: vscode.TextDocument) {
    this.post(panel, { type: 'document', text: document.getText(), version: document.version, settings: this.settings(document.uri), name: posix.basename(document.uri.path), dirty: document.isDirty });
  }
  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel) {
    const key = document.uri.toString();
    let session = this.sessions.get(key);
    if (!session) { session = { document, panels: new Set(), history: new Map(), queue: Promise.resolve() }; this.sessions.set(key, session); }
    session.panels.add(panel); this.remember(session);
    this.active = { panel, document };
    const parent = vscode.Uri.joinPath(document.uri, '..');
    panel.webview.options = { enableScripts: true, localResourceRoots: [this.context.extensionUri, parent, ...(vscode.workspace.workspaceFolders?.map(f => f.uri) ?? [])] };
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(this.context.extensionUri, 'dist/webview/index.html'));
    const nonce = randomUUID().replace(/-/g, '');
    const base = panel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist/webview')).toString();
    panel.webview.html = new TextDecoder().decode(bytes)
      .replaceAll('./assets/', `${base}/assets/`).replaceAll('./main.js', `${base}/main.js`)
      .replace(/<script /g, `<script nonce="${nonce}" `)
      .replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${panel.webview.cspSource} https: http: data:; script-src 'nonce-${nonce}' ${panel.webview.cspSource}; style-src ${panel.webview.cspSource} 'unsafe-inline'; font-src ${panel.webview.cspSource}; worker-src blob:; connect-src ${panel.webview.cspSource};">`);
    const messageSubscription = panel.webview.onDidReceiveMessage((message: ClientMessage) => {
      const s = session!;
      s.queue = s.queue.then(() => this.handleMessage(s, panel, message)).catch(error => this.post(panel, { type: 'error', message: String(error.message ?? error) }));
    });
    const viewSubscription = panel.onDidChangeViewState(() => { if (panel.active) this.active = { panel, document }; });
    panel.onDidDispose(() => {
      messageSubscription.dispose(); viewSubscription.dispose(); session!.panels.delete(panel);
      if (!session!.panels.size) this.sessions.delete(key);
      if (this.active?.panel === panel) this.active = undefined;
    });
  }
  async source(document = this.active?.document, offset = 0) {
    if (!document) return;
    const editor = await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });
    const p = document.positionAt(offset); editor.selection = new vscode.Selection(p, p); editor.revealRange(new vscode.Range(p, p), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }
  private async saveDocument(document: vscode.TextDocument): Promise<boolean> {
    const clean = () => !document.isDirty && !document.isUntitled;
    if (clean()) return true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let savedByHost!: (saved: boolean) => void;
    const nativeSave = new Promise<boolean>(resolve => { savedByHost = resolve; });
    const subscription = vscode.workspace.onDidSaveTextDocument(saved => {
      if (saved.uri.toString() === document.uri.toString()) savedByHost(true);
    });
    try {
      const saved = await document.save();
      if (saved || clean()) return true;
      // Native Ctrl+S and the webview request can race. VS Code rejects the
      // duplicate while its original save is still in progress; observe that
      // operation's completion before reporting failure.
      return await Promise.race([nativeSave, new Promise<boolean>(resolve => {
        timeout = setTimeout(() => resolve(clean()), 2000);
      })]);
    } finally { subscription.dispose(); if (timeout) clearTimeout(timeout); }
  }
  async handleMessage(session: Session, panel: vscode.WebviewPanel, message: ClientMessage) {
    const document = session.document;
    switch (message.type) {
      case 'ready': this.sendDocument(panel, document); break;
      case 'source': await this.source(document, message.offset); break;
      case 'save': {
        try {
          const success = await this.saveDocument(document);
          this.post(panel, { type: 'saved', success, dirty: document.isDirty });
        }
        catch { this.post(panel, { type: 'saved', success: false, dirty: document.isDirty }); }
        break;
      }
      case 'copy': {
        try { await vscode.env.clipboard.writeText(message.text); this.post(panel, { type: 'notice', message: '已复制到剪贴板。' }); }
        catch { this.post(panel, { type: 'notice', message: '无法访问剪贴板，请重试。' }); }
        break;
      }
      case 'undo': case 'redo': await vscode.commands.executeCommand(message.type); break;
      case 'edit': {
        const base = session.history.get(message.version), current = document.getText();
        let edits = message.edits;
        if (base === undefined) { this.post(panel, { type: 'conflict', id: message.id, text: current, version: document.version, reason: '原始版本已过期，请比较后恢复编辑。' }); break; }
        applyEdits(base, edits); // Validate before rebasing.
        if (base !== current) {
          const rebased = rebaseEdits(edits, minimalEdit(base, current));
          if (!rebased) { this.post(panel, { type: 'conflict', id: message.id, text: current, version: document.version, reason: '文件在同一位置发生了其他修改，待提交内容已保留。' }); break; }
          edits = rebased;
        }
        applyEdits(current, edits);
        const workspaceEdit = new vscode.WorkspaceEdit();
        for (const e of edits) workspaceEdit.replace(document.uri, new vscode.Range(document.positionAt(e.from), document.positionAt(e.to)), e.text);
        session.origin = panel;
        let ok = false;
        try { ok = await vscode.workspace.applyEdit(workspaceEdit); } finally { session.origin = undefined; }
        this.remember(session);
        if (ok) this.post(panel, { type: 'ack', id: message.id, text: document.getText(), version: document.version, dirty: document.isDirty });
        else this.post(panel, { type: 'conflict', id: message.id, text: document.getText(), version: document.version, reason: 'VS Code 未接受修改，内容已保留，可比较并恢复。' });
        break;
      }
      case 'resolveImages': {
        const urls: Record<string, string> = {};
        for (const path of message.paths.slice(0, 1000)) {
          try { const uri = this.resource(document.uri, path); urls[path] = /^https?:$/.test(uri.scheme + ':') ? uri.toString() : panel.webview.asWebviewUri(uri).toString(); } catch { /* Invalid image stays visible as alt text. */ }
        }
        this.post(panel, { type: 'images', urls }); break;
      }
      case 'image': {
        try {
          if (document.isUntitled) { if (!(await document.save())) throw new Error('请先保存文档，再插入图片。'); }
          if (!Array.isArray(message.bytes) || !message.bytes.length || message.bytes.length > 25 * 1024 * 1024 || message.bytes.some(b => !Number.isInteger(b) || b < 0 || b > 255)) throw new Error('图片为空、无效或大于 25 MB。');
          const name = posix.basename(document.uri.path).replace(/\.[^.]+$/, '');
          const directory = this.settings(document.uri).assetsDirectory.replaceAll('${documentName}', name).replaceAll('\\', '/');
          if (!directory || directory.startsWith('/') || directory.split('/').includes('..') || directory.includes(':')) throw new Error('图片目录必须是文档目录内的相对路径。');
          const ext = /\.(png|jpe?g|gif|webp|svg|avif)$/i.exec(message.name)?.[1]?.toLowerCase();
          if (!ext) throw new Error('支持 PNG、JPEG、GIF、WebP、SVG 和 AVIF 图片。');
          const filename = `${message.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 50) || 'image'}-${randomUUID().slice(0, 8)}.${ext}`;
          const folder = vscode.Uri.joinPath(document.uri, '..', directory);
          await vscode.workspace.fs.createDirectory(folder);
          await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(folder, filename), Uint8Array.from(message.bytes));
          this.post(panel, { type: 'image', id: message.id, path: `${directory}/${filename}` });
        } catch (error: any) { this.post(panel, { type: 'image', id: message.id, error: error.message }); }
        break;
      }
      case 'openLink': {
        const uri = this.resource(document.uri, message.href);
        if (['http', 'https', 'mailto'].includes(uri.scheme)) await vscode.env.openExternal(uri);
        else if (uri.scheme === document.uri.scheme) await vscode.commands.executeCommand('vscode.open', uri);
        break;
      }
      case 'recover': {
        const draft = await vscode.workspace.openTextDocument({ content: message.text, language: 'markdown' });
        await vscode.commands.executeCommand('vscode.diff', document.uri, draft.uri, 'Markdown Live · by zJay：当前文件 ↔ 待恢复编辑'); break;
      }
    }
  }
  private resource(document: vscode.Uri, path: string) {
    if (/^https?:\/\//i.test(path) || /^mailto:/i.test(path)) return vscode.Uri.parse(path);
    if (/^[a-z][\w+.-]*:/i.test(path)) {
      if (/^[a-z]:[\\/]/i.test(path) && document.scheme === 'file') return vscode.Uri.file(path);
      throw new Error('不支持此链接协议。');
    }
    const hash = path.indexOf('#'); const fragment = hash >= 0 ? path.slice(hash + 1) : '';
    const clean = decodeURIComponent(hash >= 0 ? path.slice(0, hash) : path).replaceAll('\\', '/');
    return (clean.startsWith('/') ? document.with({ path: clean }) : vscode.Uri.joinPath(document, '..', clean)).with({ fragment });
  }
}
export function activate(context: vscode.ExtensionContext) {
  const provider = new MarkdownLiveProvider(context);
  context.subscriptions.push(provider, vscode.window.registerCustomEditorProvider(MarkdownLiveProvider.viewType, provider, { supportsMultipleEditorsPerDocument: true, webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('markdownLive.open', async (uri?: vscode.Uri) => {
      uri ??= vscode.window.activeTextEditor?.document.uri;
      if (!uri) { const d = await vscode.workspace.openTextDocument({ language: 'markdown', content: '' }); await vscode.window.showTextDocument(d); if (!(await d.save())) return; uri = vscode.window.activeTextEditor?.document.uri; }
      if (uri) await vscode.commands.executeCommand('vscode.openWith', uri, MarkdownLiveProvider.viewType);
    }), vscode.commands.registerCommand('markdownLive.source', () => provider.source()));
  return provider;
}
