# 功能演示素材

三段 GIF 均来自真实 Markdown Live 编辑界面，使用 `scripts/demo.html` 中的公开示例文档，不含个人文件。

| 文件 | 演示内容 |
| --- | --- |
| `writing.gif` | 在正文里逐字输入，选择文字，点击加粗 |
| `source.gif` | 打开当前段落源码，编辑 Markdown，再返回排版 |
| `math-diagram.gif` | 编辑 LaTeX 公式，修改 Mermaid 节点，查看渲染结果 |

## 录制方式

运行 `npm run dev -- --port 4194 --strictPort`，依次打开 `/scripts/demo.html?scene=writing`、`?scene=source`、`?scene=math`。示例页加载正式 Webview 编辑器代码，正文字号 22px、行距 1.8、内容宽度 940px；为了在 README 缩放显示时看清输入，录制页单独将源码字号也放大到 22px，不改变生产样式。开发示例页不进入 VSIX。

通过浏览器界面的点击和键盘输入操作，逐步保存 1280 × 720 的真实画面。GIF 使用这些截图合成，按每个字符 0.16–0.24 秒、关键结果 1.4–2.6 秒设置播放节奏，并添加独立的顶部字幕。它们是可阅读的操作演示，不是性能计时，也不是 VS Code 完整窗口录屏。

本次原始帧保存在本地 `artifacts/demos/`，最终帧序和时长见 `manifest.json`。原始截图不纳入 Git；保留原始帧时，可用 FFmpeg 和 `scripts/encode-demos.mjs` 重新编码：

```powershell
$env:FFMPEG_PATH = 'D:/FFmpeg/bin/ffmpeg.exe'
node scripts/encode-demos.mjs
```

更新演示时应重新录制真实操作、检查正文和源码是否清晰、避免成段瞬间粘贴，并保留读者理解结果的停顿。仓库 README 和 Marketplace 共用这些文件。
