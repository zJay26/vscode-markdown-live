import brandIcon from '../../media/markdown-live-icon.png';

const icon = (path: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const outline = icon('<path d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01"/>');
const search = icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>');
const focus = icon('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>');

export const editorShell = `
  <header class="toolbar">
    <div class="identity" title="Markdown Live"><img class="brand-mark" src="${brandIcon}" width="44" height="44" alt="" aria-hidden="true" draggable="false"><div class="document-identity"><span id="document-name">Markdown Live</span><span class="identity-caption">Markdown Live</span></div></div>
    <nav aria-label="文档工具">
      <button data-action="outline" aria-expanded="false" aria-controls="outline" title="章节大纲 (Ctrl+Shift+O)">${outline}<span>大纲</span></button>
      <button data-action="insert" title="插入内容，也可在空段落输入 /" aria-haspopup="menu">＋ 插入</button>
      <button data-action="find" title="查找替换 (Ctrl+F)">${search}<span>查找</span></button>
      <span class="separator"></span><button data-action="source" title="编辑当前段落源码 (Ctrl+Shift+M)">段落源码</button>
      <button data-action="native" title="在 VS Code 中打开对应源码">打开源码 ↗</button>
    </nav>
    <div class="toolbar-end"><button data-action="focus" aria-pressed="false" title="专注模式 (Ctrl+Shift+F)">${focus}<span id="focus-label">专注</span></button><button data-action="help" class="help-button" aria-label="快捷键帮助" title="快捷键帮助">?</button><span id="sync-state" role="status">载入中</span></div>
  </header>
  <div id="format-bar" class="format-bar" role="toolbar" aria-label="文字排版">
    <select id="block-type" aria-label="段落样式"><option value="paragraph">正文</option>${[1,2,3,4,5,6].map(n => `<option value="h${n}">标题 ${n}</option>`).join('')}<option value="code_block" disabled>代码块</option></select>
    <span class="separator"></span>
    <button data-action="bold" aria-label="粗体" aria-pressed="false" title="粗体 (Ctrl+B)"><b>B</b></button><button data-action="italic" aria-label="斜体" aria-pressed="false" title="斜体 (Ctrl+I)"><i>I</i></button><button data-action="strike" aria-label="删除线" aria-pressed="false" title="删除线"><s>S</s></button><button data-action="code" aria-label="行内代码" aria-pressed="false" title="行内代码 (Ctrl+&#96;)">‹/›</button>
    <span class="separator"></span><button data-action="bullet" title="无序列表" aria-label="无序列表">☷</button><button data-action="ordered" title="有序列表" aria-label="有序列表">1.</button><button data-action="quote" title="引用" aria-label="引用">❞</button><button data-action="link" title="编辑链接 (Ctrl+K)">链接</button>
    <span class="separator"></span><button data-action="undo" aria-label="撤销" title="撤销 (Ctrl+Z)">↶</button><button data-action="redo" aria-label="重做" title="重做 (Ctrl+Shift+Z)">↷</button>
    <span class="format-spacer"></span><button data-action="copy-markdown" title="复制整篇 Markdown">复制 Markdown</button>
  </div>
  <div id="notice" role="status" hidden></div>
  <section id="conflict" hidden><div><strong>其他修改与当前编辑重叠</strong><p id="conflict-reason"></p></div><button id="recover">比较并保留草稿</button><button id="accept-remote">采用文件版本</button></section>
  <section id="find-bar" aria-label="查找替换" hidden><div class="find-inputs"><input id="search" placeholder="查找全文 Markdown" aria-label="查找全文"><input id="replacement" placeholder="替换为" aria-label="替换为"></div><div class="find-actions"><button data-action="match-case" aria-label="区分大小写" aria-pressed="false" title="区分大小写">Aa</button><button data-action="match-word" aria-label="全字匹配" aria-pressed="false" title="全字匹配"><u>ab</u></button><span id="match-count" role="status"></span><button data-action="find-prev" aria-label="上一个匹配" title="上一个匹配 (Shift+Enter)">↑</button><button data-action="find-next" aria-label="下一个匹配" title="下一个匹配 (Enter)">↓</button><button data-action="replace">替换</button><button data-action="replace-all">全部替换</button><button data-action="close-find" aria-label="关闭查找">×</button></div></section>
  <div class="workspace"><aside id="outline" aria-label="文档大纲" hidden><div class="outline-title"><span>文档大纲</span><span id="heading-count"></span></div><input id="outline-filter" type="search" placeholder="筛选章节…" aria-label="筛选章节"><div id="headings"></div><div class="outline-foot">点击章节，回到写作的位置</div></aside><main id="canvas"><div id="editor-viewport"><div id="editor"></div></div><p id="empty-hint" hidden>直接开始写作，或输入 <kbd>/</kbd> 插入内容</p></main></div>
  <div id="bubble" class="floating-tools" role="toolbar" aria-label="选中文字排版" hidden><button data-action="bold" title="粗体 (Ctrl+B)"><b>B</b></button><button data-action="italic" title="斜体 (Ctrl+I)"><i>I</i></button><button data-action="strike" title="删除线"><s>S</s></button><button data-action="code" title="行内代码">&lt;/&gt;</button><button data-action="link" title="编辑链接 (Ctrl+K)">链接</button></div>
  <button id="source-handle" title="编辑此段落源码" aria-label="编辑此段落源码" hidden>‹/›</button>
  <div id="insert-menu" class="popup-menu" role="menu" aria-label="插入内容" hidden></div>
  <div id="table-tools" class="table-tools" hidden><span>表格</span><button data-action="row-add">＋ 行</button><button data-action="col-add">＋ 列</button><button data-action="row-delete">删行</button><button data-action="col-delete">删列</button><button data-action="align-left">左对齐</button><button data-action="align-center">居中</button><button data-action="align-right">右对齐</button><button data-action="table-delete">删除表格</button></div>
  <dialog id="form-dialog" aria-labelledby="form-title"><form method="dialog"><h2 id="form-title"></h2><div id="form-fields"></div><div class="dialog-actions"><button value="cancel" formnovalidate>取消</button><button id="form-submit" value="ok" class="primary">确定</button></div></form></dialog>
  <dialog id="help-dialog" aria-labelledby="help-title"><form method="dialog"><h2 id="help-title">写作快捷键</h2><p class="help-description">在正文、公式与段落源码之间顺畅切换。</p><dl class="shortcut-list">${[
    ['保存文档', 'Ctrl / ⌘ + S'], ['撤销 / 重做', 'Ctrl / ⌘ + Z / Shift + Z'], ['缩放内容', 'Ctrl / ⌘ + 鼠标滚轮'], ['恢复 100% 缩放', '点击底部缩放比例'], ['粗体 / 斜体', 'Ctrl / ⌘ + B / I'], ['编辑链接', 'Ctrl / ⌘ + K'], ['查找 / 替换', 'Ctrl / ⌘ + F / H'], ['段落源码', 'Ctrl / ⌘ + Shift + M'], ['专注模式', 'Ctrl / ⌘ + Shift + F'], ['切换大纲', 'Ctrl / ⌘ + Shift + O'], ['标题 1–6', 'Ctrl / ⌘ + Alt + 1–6'], ['离开公式 / 源码', 'Esc / Ctrl / ⌘ + Enter'], ['插入内容', '空段落输入 /'], ['表格下一个单元格', 'Tab / Shift + Tab'],
  ].map(([label,key]) => `<div><dt>${label}</dt><dd><kbd>${key}</kbd></dd></div>`).join('')}</dl><div class="dialog-actions"><button class="primary">继续写作</button></div></form></dialog>
  <footer><span id="section-label">Markdown</span><span id="document-stats" title="字词与阅读时间统计不含代码块和源码块"></span><span id="selection-stats"></span><span id="mode-label">直接编辑 · Markdown</span><button id="content-zoom" data-action="reset-zoom" aria-label="内容缩放 100%，点击恢复 100%" title="Ctrl + 鼠标滚轮缩放内容（50%–200%）；点击恢复 100%">100%</button><span id="reading-progress" title="阅读进度">0%</span></footer>`;
