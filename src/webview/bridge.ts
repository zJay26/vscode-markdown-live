import { applyEdits, type ClientMessage, type HostMessage } from '../shared/protocol';
declare global { interface Window { acquireVsCodeApi?: () => { postMessage(message: ClientMessage): void; getState(): any; setState(value: any): void }; markdownLiveTest?: any } }
const api = window.acquireVsCodeApi?.();
let listener: (message: HostMessage) => void;
let text = localStorageSafe('markdown-live-demo') ?? `# 在阅读中，完成修改\n\n直接点击这段文字开始编辑。选中文字设置 **粗体**，或在空段落输入 / 插入内容。\n\n## 研究笔记\n\n一个简单的关系式：$E = mc^2$。点击公式即可修改。\n\n- [x] 在渲染界面直接编辑\n- [ ] 粘贴截图，自动保存相对路径\n- [ ] 切换当前段落的源码\n\n| 实验 | 方法 | 结果 |\n| :--- | :--- | ---: |\n| A | 基线 | 0.82 |\n| B | 改进 | 0.91 |\n\n\`\`\`mermaid\nflowchart LR\n  A[阅读] --> B[修改]\n  B --> C[保存 Markdown]\n\`\`\`\n\n这里是一条脚注[^note]。\n\n[^note]: 脚注内容也可以直接编辑。\n`;
let version = 1, undo: string[] = [], redo: string[] = [];
let previewDirty = false;
let previewState: Record<string, unknown> = {};
function localStorageSafe(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function persistDemo() { try { localStorage.setItem('markdown-live-demo', text); previewDirty = false; } catch { previewDirty = true; listener({ type: 'notice', message: '浏览器存储不可用，关闭预览前请复制 Markdown。' }); } }
export const isStandalone = !api;
export function listen(fn: typeof listener) { listener = fn; window.addEventListener('message', e => fn(e.data)); }
function documentMessage(): HostMessage { return { type: 'document', text, version, name: '欢迎.md', dirty: previewDirty, settings: { fontSize: 16, lineHeight: 1.7, contentWidth: 900, assetsDirectory: 'assets/${documentName}' } }; }
export function send(message: ClientMessage) {
  if (api) { api.postMessage(message); return; }
  // Local preview uses the identical protocol; it never accesses workspace files.
  queueMicrotask(() => {
    switch (message.type) {
      case 'ready': listener(documentMessage()); break;
      case 'edit': {
        if (message.version !== version) { listener({ type: 'conflict', id: message.id, text, version, reason: '预览版本冲突' }); break; }
        undo.push(text); redo = []; text = applyEdits(text, message.edits); version++; persistDemo();
        listener({ type: 'ack', id: message.id, text, version, dirty: previewDirty }); break;
      }
      case 'undo': if (undo.length) { redo.push(text); text = undo.pop()!; version++; persistDemo(); listener(documentMessage()); } break;
      case 'redo': if (redo.length) { undo.push(text); text = redo.pop()!; version++; persistDemo(); listener(documentMessage()); } break;
      case 'save': persistDemo(); listener({ type: 'saved', success: !previewDirty, dirty: previewDirty }); break;
      case 'copy': void Promise.resolve().then(() => navigator.clipboard.writeText(message.text)).then(() => listener({ type: 'notice', message: '已复制到剪贴板。' }), () => listener({ type: 'notice', message: '无法访问剪贴板，请重试。' })); break;
      case 'resolveImages': listener({ type: 'images', urls: Object.fromEntries(message.paths.map(p => [p, /^(https?:|data:|blob:)/.test(p) ? p : ''])) }); break;
      case 'image': listener({ type: 'image', id: message.id, error: '浏览器预览不写入文件。请在 VS Code 中使用图片导入。' }); break;
      case 'recover': { const blob = new Blob([message.text], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'recovered.md'; a.click(); URL.revokeObjectURL(a.href); break; }
    }
  });
}
export function loadState(): any { return api ? api.getState() : previewState; }
export function saveState(value: any) {
  const next = { ...loadState(), ...value };
  if (api) api.setState(next); else previewState = next;
}
export function testDocument(value: string) { text = value; version++; undo = []; redo = []; listener(documentMessage()); }
export function testExternal(value: string) { text = value; version++; listener(documentMessage()); }
