# 开发指南

[← 返回首页](../README.md)

需要 Node.js 22+、npm，以及 VS Code 1.96 或更高版本（已验证的宿主版本为 1.96.3）。

```sh
git clone https://github.com/zJay26/vscode-markdown-preview.git
cd vscode-markdown-preview
npm ci
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run test:host
npm run package
```

- `npm run dev`：独立浏览器预览，使用浏览器本地存储保存演示文档和撤销结果。此模式不写入工作区，不代表 VS Code 宿主验证；存储不可用时提示“仅本次预览”。
- `test:e2e`：默认使用本机 Microsoft Edge 和专用端口 4186（可用 `MARKDOWN_LIVE_TEST_PORT` 覆盖），不复用已有服务，输出 `artifacts/playwright-report.json` 与界面截图。
- `test:host`：默认使用当前机器的 VS Code 安装路径；其他机器通过 `VSCODE_EXECUTABLE` 指定可执行文件，测试使用 `.local-test/` 下的隔离目录。
- 包内不携带 `node_modules`；生产依赖已打包到 `dist/`。

架构：VS Code `CustomTextEditorProvider` → 带版本号的事务通道 → Milkdown 提供的 ProseMirror 模块；remark 负责语法树与源码范围映射，CodeMirror 6 负责就地源码输入。文档内容只以 Markdown 储存。

实际验证结果与限制见 [VALIDATION.md](../VALIDATION.md)。

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/core` | Markdown 源码范围、语法树、事务与文档统计 |
| `src/webview` | 直接编辑、局部源码与界面 |
| `src/extension.ts` | VS Code 文档、保存、图片及宿主通信 |
| `tests` | 核心、浏览器和真实宿主回归 |
| `media` | C1 图标及品牌说明 |
| `docs` | 使用指南与真实界面截图 |

## 自动化与验证边界

GitHub Actions 在 Linux / Node.js 22 中运行依赖安装、类型检查、核心测试和生产构建。浏览器交互、Windows / Remote WSL 宿主及安装包验证需要相应环境，CI 成功不替代这些检查。

修改提交前请参考[贡献指南](../CONTRIBUTING.md)。独立浏览器预览和截图不会证明 VS Code 文件保存或 Remote WSL 行为。
