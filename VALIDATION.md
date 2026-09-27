# 验证记录

## 0.2.5：名称简化与商店演示

测试日期：2026-09-27；Windows / VS Code 1.96.3、Node.js 24、Microsoft Edge。

- 命令标题和编辑器标识简化为 Markdown Live；商店拒绝已被占用的同名显示名称后，按用户选择使用 Markdown Live by zJay。保持 `zJay.markdown-live-zjay`、命令 ID、设置键和编辑行为。
- TypeScript、42 项核心测试、40 项浏览器测试、生产构建和 9 项 Windows 宿主测试全部通过。浏览器回归使用独立端口 4195。
- 三段动图为真实编辑界面逐帧截图，按逐字 0.16–0.24 秒与结果停顿合成；分别演示正文排版、局部源码、LaTeX 与 Mermaid。尺寸 1280 × 776，时长约 12.84 / 13.64 / 19.72 秒。已检查关键步骤画面和最终文档内容；原始帧及编码时间表记录在 `artifacts/demos/` 与 `docs/demo/manifest.json`。
- 演示使用独立公开示例；正文和源码均以 22px 录制。源码字号放大仅存在于不打包的 `scripts/demo.html`，不修改生产样式；演示不是性能测量。
- 此节记录发布前验证，最终 VSIX、商店校验与 Windows / WSL 安装结果另记于 `artifacts/marketplace/verification-0.2.5.json`，以实际完成状态为准。实体中文输入法未进行人工验收。

## 0.2.4：Marketplace 安装包验证

测试日期：2026-09-27。最终扩展 ID 为 `zJay.markdown-live-zjay`（`markdown-live` 被 Marketplace 提示已占用）。

- 在下方 42 项核心测试、40 项浏览器测试及生产构建通过的源码基础上打包；修复源码文件 SHA-256 与验证记录一致。
- 最终 ID 的 Windows / VS Code 1.96.3 宿主测试 9 项通过；最终 VSIX 在全新隔离配置中安装成功，12 项安装包界面检查通过，覆盖标题栏入口、快捷键、编辑保存、缩放、Mermaid、局部源码、大纲、专注模式与粘贴图片。
- 重用旧 UI 测试配置曾触发标题栏顺序断言失败；新增 `MARKDOWN_LIVE_UI_PROFILE` 支持后，在全新隔离配置中复测全部通过。未为此修改生产代码。
- 133 个已安装文件与最终 VSIX 逐项 SHA-256 一致；清单除了 VS Code 自动写入的 `__metadata` 外完全等价。文档图片的固定 HTTPS 地址可访问，下载内容与本地图片哈希一致。
- 包：`artifacts/markdown-live-zjay-0.2.4.vsix`；SHA-256：`68d81ead109d678036c0d0ef8e34533f21ed5370ca3e4d89217fba62bf6c6ec7`。
- 详细记录：`artifacts/marketplace/verification-0.2.4.json`、同目录宿主/界面报告与文件清单。此节在打包后补充，不包含在上述已提交 VSIX 中。
- 本次未重新执行 Remote WSL 安装包验证和实体中文输入法验收。

## 0.2.4：Pandoc fenced Div 渲染修复

测试日期：2026-09-27；Windows、Node.js、Microsoft Edge。此节只记录本次渲染修复的源码与浏览器验证，不代表 Marketplace 发布或已安装扩展升级完成。

- `npm run typecheck`、`npm test`（42 项）、完整 Playwright 浏览器回归（40 项）及 `npm run build` 全部通过；浏览器使用独立端口 4189。
- 新增 11 项核心测试与 4 项浏览器测试，覆盖 Figure / Caption 直接编辑、LF / CRLF 原文保留、嵌套与不同长度围栏、带引号属性、容器内列表/表格/引用/链接定义、引用与列表中的容器、代码/HTML/frontmatter/转义示例、未闭合围栏、段落拆分与删除、局部源码编辑、撤销重做和重新载入。
- 图片实际解码成功；已目视检查 `artifacts/pandoc-div-rendering.png`：围栏不显示为正文，图片与图注正常显示。未知属性仅保存在数据与源码中，不作为 HTML 事件或 CSS 执行。
- 2,000 行现有性能用例：打开 739 ms，输入 P95 约 24.2 ms，达到原测试阈值；原始数据为 `artifacts/performance.json`。
- 本次未升级用户已安装的扩展，未重新运行 Windows / Remote WSL 安装包宿主验证。完整成对容器得到支持；未闭合围栏保持可见，其他 Word 自定义样式只保留属性与内容，不还原 reference.docx 的格式。

## 0.2.3：C1 图标与个人署名

测试日期：2026-09-26；Windows / VS Code 1.96.3、Ubuntu Remote WSL、Node.js 24.18.0、Microsoft Edge。

- 名称统一为 Markdown Live · by zJay；保留 `markdown-live-local.markdown-live`、`markdownLive.editor`、命令 ID 与设置键。
- C1 原图与 `media/markdown-live-icon.png` 的 SHA-256 一致；VSIX 中包含扩展图标和 Vite 生成的 Webview 图片资源。常规工具栏按 44px 显示，专注模式按 34px 显示。
- TypeScript、生产构建、VSIX 打包通过；31 项核心测试通过。
- 浏览器执行 3 项相关回归：明暗主题及窄窗口、大纲与专注模式、360px 查找和大纲操作，全部通过。已目视检查明暗主题下的 C1 图标与署名，并更新 README 截图。
- Windows / WSL 安装包界面验证各 12 项通过：确认标题栏首项使用 C1 PNG 和新署名，Ctrl+Shift+V 打开编辑器；同时验证生产资源、150% 缩放、正文编辑与保存、图表、局部源码、缩放复位、大纲、专注模式和粘贴图片。

测试使用 `.local-test/branding-extensions/markdown-live-local.markdown-live-0.2.3` 中的 VSIX 安装副本。报告为 `artifacts/installed-ui-report.json` 与 `artifacts/installed-wsl-ui-report.json`，包含实际标签、图标 URI、安装路径与验证时间。

本轮未修改 Markdown 编辑实现、缩放或快捷键逻辑；未重复运行完整浏览器回归和独立宿主协议测试。已有工作区改动已保留。

## 0.2.2：独立图标与打开快捷键

测试日期：2026-09-26；Windows / VS Code 1.96.3 与 Ubuntu Remote WSL。

- TypeScript、生产构建、VSIX 打包通过；安装包包含明暗主题各一份蓝色 M＋闪电 SVG。
- Windows / WSL 安装包界面验证各 12 项通过：实际检查标题栏首项的标签与 SVG 资源地址，并在内置 Markdown 扩展和原有快捷键均启用的情况下，发送 Ctrl+Shift+V，确认打开的是 Markdown Live。
- 同一轮安装包测试也验证了 150% 缩放、光标定位、真实文件编辑保存、局部源码、图表、大纲、专注模式与图片写入。
- 入口排序使用 `navigation@-100`，本机 Codex 与内置侧边预览均为 `navigation` 默认顺序；快捷键仅在 Markdown 源码编辑器聚焦时生效。内置侧边预览的 Ctrl+K V 保留。

本轮只修改图标、菜单、快捷键与文档，没有更改编辑器内容实现；未重复运行下方记录的核心和浏览器全套测试。最新实际界面报告为 `artifacts/installed-ui-report.json`、`artifacts/installed-wsl-ui-report.json`，图标及排序截图为同前缀的 `-title-actions.png`。报告记录安装目录、时间、按钮标签及图标 URI，可与版本核对。

## 0.2.1：入口恢复与内容缩放

测试日期：2026-09-26；Windows / VS Code 1.96.3、Ubuntu Remote WSL、Node.js 24.18.0、Microsoft Edge。

- TypeScript、生产构建与 VSIX 打包通过；31 项核心测试通过，最终完整浏览器回归 36 项通过，无失败或重试。
- 新增缩放验证：正文、图片和公式等比缩放，工具栏尺寸不变；普通滚轮仍滚动；支持小滚轮增量、行 / 页单位、50%–200% 上下限、点击复位、指针位置保持、窄窗口与重载恢复（含顶部滚动位置为 0）。
- 缩放不产生编辑 / 保存请求，不改变原始 Markdown 或已保存状态；在缩放后继续选区排版、编辑局部源码、快速方向键与段落拆分 / 合并。
- Windows 与 WSL 的安装包界面验证分别覆盖 11 项检查：纯文本语言模式下的 `.md` 标题栏入口、生产 Webview、150% 缩放后的定位与真实文件编辑保存、源码面板、缩放复位、图表、大纲、专注模式与图片写入。报告为 `artifacts/installed-ui-report.json` 与 `artifacts/installed-wsl-ui-report.json`，核对版本及验证时间。
- 2000 行文档本轮打开 753 ms，输入 P95 为 18.7 ms；详见 `artifacts/performance.json`。这是当前环境的采样，不是受控性能对比。

本轮实际发现并修复了两类交互问题：VS Code 1.96.3 中 CSS zoom 的坐标与鼠标命中不一致，改为 transform 缩放并同步布局高度；快速方向键后异步选区事件可能恢复旧光标，增加导航键释放时的选区同步。后者的诊断对照在关闭缩放时也复现，修复后 9 次诊断通过，并保留 50% / 100% / 150% / 200% 的正式回归。旧版坐标行为的上游说明见 [VS Code #233692](https://github.com/microsoft/vscode/issues/233692)。

安装包测试使用隔离配置、安装目录和测试文件；日常环境安装的是本轮验证的生产文件。未重跑下方 0.2.0 的独立宿主协议测试和 npm 漏洞审计，不能将其历史结果视为本轮重新执行。实体鼠标和中文输入法仍未进行人工验收。

---

以下为 0.2.0 的历史验证记录。

版本：0.2.0。测试日期：2026-09-26。环境：Windows、VS Code 1.96.3、Node.js 24.18.0、Microsoft Edge；Remote WSL 使用 Ubuntu 和同版本 VS Code Server。

## 本轮结果

| 检查 | 结果 | 覆盖范围 |
| --- | --- | --- |
| TypeScript / 生产构建 | 通过 | 扩展宿主、Webview、动态 Mermaid 资源、离线字体与许可声明 |
| Vitest | 31 项通过 | 源码无损往返、CRLF/BOM、结构变化、事务合并、Unicode 查找、替换、阅读统计与章节锚点 |
| 浏览器交互 | 27 项通过，无失败或重试 | 原有编辑功能、排版选区、查找选项、专注模式、大纲筛选、复制、源码行号、恢复草稿、主题、360px 窄窗口 |
| Windows 扩展宿主 | 9 项通过 | 真实 TextDocument、原生撤销重做、外部修改合并与冲突、保存回执、重复/并发保存、图片写入 |
| Remote WSL 扩展宿主 | 9 项通过 | 同一套宿主测试；报告确认 remoteName 为 wsl、platform 为 linux |
| 安装包 Webview | Windows / WSL 各 8 项通过 | 打包文件加载、正文保存、未保存/已保存状态、Mermaid、局部源码、大纲筛选、专注模式、图片文件与资源 URI |
| 生产依赖审计 | 0 项已知漏洞 | npm audit --omit=dev，检查结果以当日 npm 数据为准 |

浏览器完整报告见 artifacts/playwright-report.json。明暗主题截图在颜色过渡完成后另复核一次通过。测试使用专用端口 4186，明确禁止复用已有服务，避免运行到其他项目的页面；可用 MARKDOWN_LIVE_TEST_PORT 更换端口。

安装包测试将 VSIX 安装到 .local-test/ 下的隔离扩展目录，Windows 和 WSL 分别从这个安装副本加载生产文件。WSL 的测试工作区位于 /mnt/d/vscode-markdown-preview/.local-test/，扩展宿主实际运行在 Linux。验收使用隔离用户配置和测试文档，没有覆盖日常扩展安装目录。

## 性能记录

2000 行混合 Markdown 文档，本机浏览器打开耗时 **616 ms**；20 次输入到下一帧的 P95 为 **14.1 ms**，达到原有 2 秒 / 50 ms 目标。最新时间戳与完整采样见 artifacts/performance.json。这是本次环境的测量值，不是与旧版本的受控对比。

本轮减少了同一文档的重复序列化，缓存不可变段落的阅读统计和查找装饰；滚动时按帧合并更新、通过二分查找定位章节，并延迟保存滚动位置。结构变化时用索引表替代反复遍历原始块。

## 已复现并修复的问题

- aaaaaa 中查找 aa 并全部替换成 x：旧版得到 xaaaa，现在得到 xxx。
- İ x x 中查找 x 并替换成 Y：旧版替换位置偏移，现在得到 İ Y Y，原换行保留。
- 快速用键盘选择文字后点击排版工具：先同步当前 DOM 选区，再应用格式。
- 等待宿主确认时继续编辑：所有新内容仍写入恢复草稿；视图偏好更新不会覆盖草稿。
- 删除全文得到空草稿后重载：能提示恢复，不再被空字符串判断遗漏。
- 已保存的文档重复收到保存请求：明确返回成功；原生保存还在进行时，等待其完成事件，避免重复请求先返回失败、随后实际保存成功而产生误报。
- 空链接提交、必填图片表单取消、浏览器撤销后刷新均加入回归覆盖。

## 验证边界

- 中文组合输入通过浏览器 composition 事件测试，尚未用实体键盘和真实 Windows / WSL 输入法进行手工验收。
- 图片写入与资源 URI 经真实宿主验证；剪贴板测试使用构造的事件或隔离浏览器中的桩，不读取或修改用户已有的系统剪贴板。
- 阅读时间是中西文混合估算，不计代码块、原始 HTML 和 frontmatter；不能代表实际阅读速度。
- 查找针对完整 Markdown 源码，匹配定位到相应段落；公式或标记源码不一定对应可见正文高亮。可见高亮最多 2000 处，匹配计数和全部替换不受此限制。
- 冲突合并仍采用保守文本范围判断；重叠时保留草稿并打开比较，不自动覆盖文件。
- 本轮没有更换依赖版本；锁文件只更新了应用自身版本号。

宿主报告：artifacts/host-report.json、artifacts/host-wsl-report.json。安装包界面报告：artifacts/installed-ui-report.json、artifacts/installed-wsl-ui-report.json。界面截图与生产依赖审计也在 artifacts/ 中。

GitHub Release 附带 verification-0.2.0.json 验证摘要和 SHA256SUMS.txt。源码压缩包从发布提交生成；VSIX 的 124 个生产文件与通过安装测试的副本逐项核对 SHA-256。
