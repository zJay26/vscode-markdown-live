<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=zJay.markdown-live-zjay">
    <img src="https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/media/markdown-live-icon.png" width="144" height="144" alt="Markdown Live: a soft Z, MD and selected text" />
  </a>
</p>

<h1 align="center">Markdown Live</h1>
<p align="center"><sub>by <a href="https://github.com/zJay26">zJay</a></sub></p>

<p align="center">
  <strong>Write in the rendered page. Keep the freedom of Markdown.</strong><br />
  A source-preserving WYSIWYG Markdown editor for VS Code.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=zJay.markdown-live-zjay"><img src="https://img.shields.io/badge/Marketplace-install-2767df?style=flat-square" alt="Install from Marketplace" /></a>
  <a href="https://github.com/zJay26/vscode-markdown-live/actions/workflows/ci.yml"><img src="https://github.com/zJay26/vscode-markdown-live/actions/workflows/ci.yml/badge.svg" alt="Type checks, core tests and build" /></a>
  <img src="https://img.shields.io/badge/VS_Code-1.96%2B-2767df?style=flat-square" alt="VS Code 1.96 or later" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-23956f?style=flat-square" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <strong>English</strong><br />
  <a href="https://marketplace.visualstudio.com/items?itemName=zJay.markdown-live-zjay"><strong>Install extension</strong></a> ·
  <a href="#demos">Demos</a> ·
  <a href="docs/usage.md">User guide (中文)</a> ·
  <a href="CHANGELOG.md">Changelog (中文)</a> ·
  <a href="https://github.com/zJay26/vscode-markdown-live/issues/new/choose">Report an issue</a>
</p>

## Demos

### Write directly in the rendered page

Type a sentence, select text, and make it bold. Everyday editing happens right where you are reading.

![Direct text editing, text selection and bold formatting](https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/demo/writing.gif)

### Open just the source you need

Expand one block, edit its Markdown, then return to the rendered view. The surrounding document stays readable.

![Opening a block's source, editing Markdown and returning to the rendered page](https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/demo/source.gif)

### Edit math and diagrams in place

Click a formula or diagram to adjust its LaTeX / Mermaid. Return to the document when you are ready to continue writing.

![Editing a LaTeX formula and a Mermaid flowchart in place](https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/demo/math-diagram.gif)

<sub>Recorded from the actual editor in standalone browser preview mode with public sample documents, enlarged text and pauses for typing and reading. Browser preview does not write workspace files. See [validation records](VALIDATION.md) for extension-host checks. The editor UI is currently in Chinese.</sub>

<details>
<summary>Static light and dark theme preview</summary>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/images/editor-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/images/editor-light.png" />
  <img src="https://raw.githubusercontent.com/zJay26/vscode-markdown-live/main/docs/images/editor-light.png" alt="Markdown Live static preview: selected text, outline, math, a table and tasks" />
</picture>

<sub>Static screenshots show 0.2.4. The icon and editing features remain the same; the new display name is simply Markdown Live.</sub>

</details>

## Start writing in three steps

1. Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=zJay.markdown-live-zjay), or search for `@id:zJay.markdown-live-zjay` in VS Code's Extensions view.
2. Open a `.md` / `.markdown` file, then click the blue **Z / MD** title-bar icon or press **Ctrl+Shift+V** in the source editor.
3. Click the rendered text and write. Use **Ctrl+S** to save and select text to format it.

Or install from your terminal:

```sh
code --install-extension zJay.markdown-live-zjay
```

Windows and Remote WSL are supported. Install the extension in the WSL environment when using a WSL window. Default editor associations stay unchanged; VS Code's built-in side preview remains available with `Ctrl+K V`. On macOS, shortcuts use `⌘` instead of `Ctrl`; see [VALIDATION.md](VALIDATION.md) for the environments actually tested.

> **Migrating from the local build:** `markdown-live-local.markdown-live` and the Marketplace extension have different IDs. Disable or uninstall the old extension after installing the new one to avoid duplicate commands. Markdown files, images and `markdownLive.*` settings need no conversion.

See the [Marketplace page](https://marketplace.visualstudio.com/items?itemName=zJay.markdown-live-zjay) for the latest public version and [package.json](package.json) for the source version. [GitHub Releases](https://github.com/zJay26/vscode-markdown-live/releases/latest) currently contains the older **0.2.0** release. Use the Marketplace or [build a VSIX from source](docs/development.md) for the current version.

## What you can do

| Task | How it works |
| --- | --- |
| **Write and format directly** | Paragraphs, headings, lists, quotes and tasks; a selection toolbar and `/` insert menu |
| **Use source on demand** | Open a block in CodeMirror or jump to the native Markdown editor |
| **Write technical notes** | KaTeX math, Mermaid diagrams, GFM tables, footnotes and Pandoc Figure / Caption containers |
| **Add images** | Paste a screenshot or drop an image; save beside the document and insert a relative path |
| **Navigate longer documents** | A filterable outline, full-source find/replace, focus mode, word counts and reading progress |
| **Adjust the page** | `Ctrl` + mouse wheel scales content from 50% to 200% without resizing the toolbar |
| **Keep your workflow** | Native save and undo, external-edit synchronization and recovery drafts for overlapping changes |

## Your files stay yours

- **Plain Markdown:** local text patches preserve untouched markers, blank lines, comments, definitions and line endings. Edited structures may use standard Markdown formatting where needed.
- **Offline editing:** scripts, fonts, math and diagram renderers are bundled. Remote images referenced by your document still require a network connection.
- **Images beside the document:** the default location is `assets/<document-name>/`; Remote WSL writes to the WSL filesystem.
- **Recoverable conflicts:** non-overlapping edits are rebased where possible; overlapping edits stop submission and keep a draft for comparison and recovery.

## Current limits

Markdown Live is intended for notes, technical documentation and research writing. Tables follow Markdown's structure without merged cells. It does not provide PDF / Word export, BibTeX / Zotero integration or drag-and-drop diagram design. Pandoc containers preserve attributes and support Figure / Caption layout; they do not load Word template styles.

See [validation records (中文)](VALIDATION.md) for evidence and limits. Physical Chinese IME testing remains pending. Windows and Remote WSL checks are recorded separately for each tested version.

## Development and contributions

Requires **Node.js 22+**, npm and **VS Code 1.96+**.

```sh
git clone https://github.com/zJay26/vscode-markdown-live.git
cd vscode-markdown-live
npm ci
npm run dev
```

The standalone browser preview uses browser storage and does not write workspace files. See the [development guide (中文)](docs/development.md) for builds, tests and VSIX packaging. GitHub Actions runs type checks, core tests and a production build; it does not replace browser or extension-host validation.

**TypeScript · VS Code Custom Editor · Milkdown / ProseMirror · CodeMirror 6 · KaTeX · Mermaid**

- [User guide (中文)](docs/usage.md): installation, shortcuts, settings and supported syntax.
- [Contributing (中文)](CONTRIBUTING.md): reproducible issues, changes and validation.
- [Releasing and updating (中文)](docs/releasing.md): publishing to the Marketplace and receiving local updates.
- [Changelog (中文)](CHANGELOG.md) and [validation records (中文)](VALIDATION.md).
- [Issues](https://github.com/zJay26/vscode-markdown-live/issues/new/choose): bugs and concrete feature requests. Chinese and English reports are welcome.

## License and acknowledgements

[MIT License](LICENSE). Third-party dependencies retain their own licenses; production packages include their license notices. Thank you to the open-source projects that make editing and rendering possible.

---

<p align="center">
  <strong>Made by <a href="https://github.com/zJay26">zJay</a></strong><br />
  Also explore <a href="https://github.com/zJay26/zMatrix">zMatrix · creator workspace</a> and <a href="https://github.com/zJay26/zClip">zClip · local video editing</a>.
</p>
