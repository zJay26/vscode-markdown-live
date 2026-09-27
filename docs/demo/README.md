# 功能演示素材

三段 GIF 录自真实 Windows VS Code 窗口，使用从 Marketplace 安装的 Markdown Live 0.2.5、独立配置与 [sample.md](sample.md) 公开示例，不含个人文件。

| 文件 | 演示内容 | 时长 |
| --- | --- | --- |
| `writing.gif` | 原生 Markdown 文件 → 点击标题栏 Markdown Live → 输入正文、选择并加粗、保存 | 8.04 秒 |
| `source.gif` | 保留表格和大纲，展开一个段落的源码、输入加粗标记、返回排版 | 6.60 秒 |
| `math-diagram.gif` | 从文末点击大纲跳到公式，选择求和模板，再切换 Mermaid 时序图 | 11.64 秒 |

## 示例与取景

示例包含 9 个多级标题、引用、任务清单、表格、LaTeX、Mermaid、有序列表和 Python 代码块。三段中的编辑器大纲始终展开；第一段开始于原生 Markdown 文本编辑器，此时尚未进入 Markdown Live。

录制窗口为 1026 × 770。正文演示使用 22px 字号、VS Code 默认缩放；源码与公式演示使用 18px 正文字号、VS Code 120% 界面缩放，以放大大纲和源码控件。所有调整仅作用于独立录制配置。没有改动扩展样式或运行时代码。

通过实际鼠标和键盘操作保存截图，再合成为 1026 × 826 GIF；顶部 56px 为说明字幕。输入按约 0.1–0.14 秒/字符安排，点击后保留 0.35–0.9 秒，主要结果停顿 1.1–1.6 秒。比上一版更紧凑，仍保留人类阅读节奏。这是经过剪辑的功能演示，不是性能计时。

## 复现

原始帧位于本地 `artifacts/demos/v3/`，不纳入 Git。最终帧序、字幕、播放时间及实际 GIF 时长见 `manifest.json`。保留原始帧时，运行：

```powershell
$env:FFMPEG_PATH = 'D:/FFmpeg/bin/ffmpeg.exe'
node scripts/encode-demos.mjs
```

更新时应在独立 VS Code 配置中重新录制真实操作，检查源码、光标、导航和最终结果。避免录入个人文档或后台弹窗。仓库 README 与 Marketplace 共用这些文件；`scripts/demo.html` 是早期浏览器预览素材，不是本版 GIF 的录制来源。
