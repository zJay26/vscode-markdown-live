<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=zJay.markdown-live-zjay">
    <img src="https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/media/markdown-live-icon.png" width="144" height="144" alt="Markdown Live：柔和的 Z、MD 与正文选区" />
  </a>
</p>

<h1 align="center">Markdown Live</h1>
<p align="center"><sub>by <a href="https://github.com/zJay26">zJay</a></sub></p>

<p align="center">
  <strong>看见文字的样子，也保有源码的自由。</strong><br />
  在 VS Code 中直接编辑排版后的 Markdown。
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=zJay.markdown-live-zjay"><img src="https://img.shields.io/badge/Marketplace-install-2767df?style=flat-square" alt="从 Marketplace 安装" /></a>
  <a href="https://github.com/zJay26/vscode-markdown-live/actions/workflows/ci.yml"><img src="https://github.com/zJay26/vscode-markdown-live/actions/workflows/ci.yml/badge.svg" alt="类型检查、核心测试与构建" /></a>
  <img src="https://img.shields.io/badge/VS_Code-1.96%2B-2767df?style=flat-square" alt="VS Code 1.96 或更高" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-23956f?style=flat-square" alt="MIT License" /></a>
</p>

<p align="center">
  <strong>简体中文</strong> · <a href="README.en.md">English</a><br />
  <a href="https://marketplace.visualstudio.com/items?itemName=zJay.markdown-live-zjay"><strong>安装扩展</strong></a> ·
  <a href="#功能演示">功能演示</a> ·
  <a href="docs/usage.md">使用指南</a> ·
  <a href="CHANGELOG.md">更新记录</a> ·
  <a href="https://github.com/zJay26/vscode-markdown-live/issues/new/choose">反馈问题</a>
</p>

## 功能演示

### 直接写在排版后的正文里

输入一句话，选中文字，再点击加粗。常用编辑直接发生在你正在阅读的位置。

![直接编辑正文、选中文字并应用粗体](https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/demo/writing.gif)

### 需要源码时，只展开这一段

打开段落源码，修改 Markdown 标记，再返回排版。周围的内容始终保留阅读状态。

![展开段落源码、修改 Markdown 并返回排版](https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/demo/source.gif)

### 公式与流程图，边改边看

点击公式或图表，就地调整 LaTeX / Mermaid。修改完成后回到正文，继续写作。

![就地编辑 LaTeX 公式与 Mermaid 流程图](https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/demo/math-diagram.gif)

<sub>动图录自真实编辑界面的独立浏览器预览，使用公开示例文档；文字放大显示，保留输入及阅读停顿。浏览器预览不写入工作区文件，VS Code 宿主验证范围见 [验证记录](VALIDATION.md)。</sub>

<details>
<summary>明暗主题静态预览</summary>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/images/editor-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/images/editor-light.png" />
  <img src="https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/images/editor-light.png" alt="Markdown Live 静态预览：正文选区、大纲、公式、表格与任务清单" />
</picture>

<sub>静态截图来自 0.2.4，图标和编辑功能一致；新版显示名称已简化为 Markdown Live。</sub>

</details>

## 三步开始写作

1. 在 [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=zJay.markdown-live-zjay) 安装，或在 VS Code 扩展面板搜索 `@id:zJay.markdown-live-zjay`。
2. 打开 `.md` / `.markdown` 文件，点击标题栏蓝色 **Z／MD** 图标，或在源码编辑器中按 **Ctrl+Shift+V**。
3. 点击正文开始编辑，用 **Ctrl+S** 保存。需要调整格式时，选中文字或使用顶部工具栏。

也可以在终端安装：

```sh
code --install-extension zJay.markdown-live-zjay
```

Windows 与 Remote WSL 均可使用；WSL 窗口需在对应环境安装扩展。插件不会自动修改默认编辑器关联，内置侧边预览仍可用 `Ctrl+K V` 打开。macOS 快捷键使用 `⌘` 代替 `Ctrl`，实际宿主验证范围以 [VALIDATION.md](VALIDATION.md) 为准。

> **从旧本地版迁移：** `markdown-live-local.markdown-live` 与商店版是不同扩展。安装新版后，请禁用或卸载旧版，避免入口重复。Markdown 文件、图片和 `markdownLive.*` 设置无需转换。详见[安装与使用](docs/usage.md)。

最新公开版本以 [Marketplace 页面](https://marketplace.visualstudio.com/items?itemName=zJay.markdown-live-zjay) 为准，源码版本见 [package.json](package.json)。[GitHub Releases](https://github.com/zJay26/vscode-markdown-live/releases/latest) 目前保留历史 **0.2.0**；获取当前版本请优先使用商店，或[从源码构建 VSIX](docs/development.md)。

## 常用写作能力

| 你想做的事 | Markdown Live 的方式 |
| --- | --- |
| **直接写、直接改** | 正文、标题、列表、引用、任务清单；选区工具栏与 `/` 插入菜单 |
| **按需查看源码** | 段落内展开 CodeMirror，或定位到原生 Markdown 编辑器 |
| **整理技术笔记** | KaTeX 公式、Mermaid 图表、GFM 表格、脚注，以及 Pandoc Figure / Caption 容器 |
| **放入图片** | 粘贴截图或拖入图片，自动写入文档旁的资源目录并插入相对路径 |
| **在长文中移动** | 章节大纲、全文查找替换、专注模式、字词统计与阅读进度 |
| **调整阅读尺寸** | `Ctrl` + 滚轮缩放正文至 50%–200%，工具栏保持原大小 |
| **继续原有工作流** | VS Code 原生保存与撤销；外部修改同步，重叠冲突保留待恢复草稿 |

完整操作、快捷键和四项配置见[使用指南](docs/usage.md)。

## 文件仍由你掌握

- **普通 Markdown**：不引入专有文档格式。局部文本补丁尽量保留未编辑部分的标记、空行、注释、引用定义和换行格式。
- **编辑可离线**：字体、脚本、公式与图表渲染库随扩展打包。文档引用的远程图片仍需要网络。
- **图片放在文档旁**：默认保存到 `assets/<文档名>/`；Remote WSL 中写入 WSL 文件系统。
- **冲突保留草稿**：非重叠修改尝试合并，重叠时停止提交，并提供比较与恢复入口。

## 当前边界

Markdown Live 面向笔记、技术文档和研究记录。表格遵循 Markdown 的结构，不支持合并单元格；不提供 PDF / Word 导出、BibTeX / Zotero 集成、图表拖拽设计。Pandoc 容器支持内容编辑及 Figure / Caption 排版，不读取 Word 模板样式。

自动化验证记录见 [VALIDATION.md](VALIDATION.md)。实体中文输入法验收仍待完成；Windows 与 Remote WSL 的已验证版本和范围分别记录。

## 开发与参与

需要 **Node.js 22+**、npm 与 **VS Code 1.96+**。

```sh
git clone https://github.com/zJay26/vscode-markdown-live.git
cd vscode-markdown-live
npm ci
npm run dev
```

`npm run dev` 打开独立浏览器预览；它使用浏览器本地存储，不写入工作区文件。完整构建、测试和 VSIX 打包方法见[开发指南](docs/development.md)。

**TypeScript · VS Code Custom Editor · Milkdown / ProseMirror · CodeMirror 6 · KaTeX · Mermaid**

| 文档 | 内容 |
| --- | --- |
| [使用指南](docs/usage.md) | 安装、迁移、快捷键、兼容范围与配置 |
| [开发指南](docs/development.md) | 本地开发、构建、测试和项目结构 |
| [发布与更新](docs/releasing.md) | 提交推送、发布商店版本与本地更新 |
| [贡献指南](CONTRIBUTING.md) | 提交问题、参与修改与验证要求 |
| [验证记录](VALIDATION.md) | 已执行的检查、环境和未验证部分 |
| [更新记录](CHANGELOG.md) | 每个版本的变化 |

欢迎通过 [Issues](https://github.com/zJay26/vscode-markdown-live/issues/new/choose) 提交可复现的问题和具体使用场景。

## 许可与致谢

采用 [MIT License](LICENSE)。第三方依赖遵循各自许可证，生产包保留许可声明。感谢上述开源组件提供编辑、源码控制与排版基础。

---

<p align="center">
  <strong>Made by <a href="https://github.com/zJay26">zJay</a></strong><br />
  也可以看看 <a href="https://github.com/zJay26/zMatrix">zMatrix · 内容工作台</a> 与 <a href="https://github.com/zJay26/zClip">zClip · 本地视频剪辑</a>。
</p>
