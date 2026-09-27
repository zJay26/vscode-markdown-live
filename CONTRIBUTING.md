# 参与 Markdown Live

感谢你帮助改进 Markdown Live · by zJay。中文和 English 的问题描述都欢迎。

## 提交问题或建议

- [Bug report](https://github.com/zJay26/vscode-markdown-preview/issues/new?template=bug_report.yml)：说明版本、环境、操作步骤、预期与实际结果，最好附一份最小 Markdown 示例。
- [Feature request](https://github.com/zJay26/vscode-markdown-preview/issues/new?template=feature_request.yml)：描述写作时遇到的具体问题，以及你希望完成的操作。

涉及文档时，请用可公开的最小示例替代私人内容。文件保存、外部修改和 Remote WSL 问题，请注明发生在浏览器预览、源码调试还是已安装的 VSIX 中。

## 本地开发

环境、目录和命令见[开发指南](docs/development.md)。基础检查：

```sh
npm ci
npm run typecheck
npm test
npm run build
```

根据修改范围补充验证：

| 修改内容 | 对应验证 |
| --- | --- |
| README、指南、截图 | 检查链接、图片、明暗主题和窄屏阅读 |
| Markdown 解析、序列化、源码范围或选区 | 核心测试与浏览器回归；包含未修改文本保留用例 |
| 编辑交互与样式 | `npm run test:e2e`，目视检查相关状态 |
| 宿主通信、保存、撤销、资源路径 | 构建后运行 `npm run test:host`，在相关 Windows / Remote WSL 环境验证 |
| 发布和安装包 | `npm run package`，检查 VSIX 内容并在隔离配置中安装验证 |

`test:e2e` 默认使用 Microsoft Edge；其他环境需准备相应浏览器。CI 只运行类型检查、核心测试和构建。通过这些检查并不表示真实宿主、中文输入法或安装包已经验证。

## 修改时保留的行为

- VS Code 的 `TextDocument` 是文档内容的权威来源。
- 打开、浏览、切换视图不改写文件。编辑通过局部源码补丁完成，尽量保留未修改内容。
- 重叠冲突保留待恢复草稿，不能静默覆盖文件或清空用户修改。
- 文档内容仍保存为 Markdown；WSL 资源写入对应的 WSL 文件系统。

提交 PR 时说明解决的问题、行为变化和实际执行的检查。截图使用示例文档；验证说明区分自动化结果、人工检查和未验证部分。现有记录见 [VALIDATION.md](VALIDATION.md)。
