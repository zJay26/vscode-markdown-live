// Encode real editor screenshots; no editor content is painted by this script.
// See docs/demo/README.md for the capture workflow and pacing.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const raw = path.join(root, 'artifacts/demos');
const output = path.join(root, 'docs/demo');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || (process.env.FFMPEG_PATH ? path.join(path.dirname(ffmpeg), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe') : 'ffprobe');
const frame = (name, duration, caption) => ({ file: `v3/${name}.jpg`, duration, caption });
const width = 1026, height = 826;
const clips = [
  { name: 'writing', title: '从 VS Code 打开 Markdown Live，直接写作', frames: [
    frame('writing-00-source', 1.4, '在 VS Code 打开 Markdown，点击右上角 Markdown Live'),
    frame('writing-01-open', 1.1, '进入可视化编辑，大纲保持展开'),
    frame('writing-02-caret', 0.35, '直接在排版后的正文中输入'),
    frame('writing-03-newline', 0.2, '直接在排版后的正文中输入'),
    frame('writing-04-type', 0.28, '直接在排版后的正文中输入'),
    frame('writing-05-type', 0.28, '直接在排版后的正文中输入'),
    frame('writing-06-type', 0.28, '直接在排版后的正文中输入'),
    frame('writing-07-type', 0.6, '直接在排版后的正文中输入'),
    frame('writing-08-select', 0.65, '选中文字，点击加粗'),
    frame('writing-09-bold', 0.65, '选中文字，点击加粗'),
    frame('writing-10-result', 0.8, '所见即所得，保存为普通 Markdown'),
    frame('writing-11-saved', 1.4, '所见即所得，保存为普通 Markdown'),
  ]},
  { name: 'source', title: '只展开需要修改的那一段', frames: [
    frame('source-10-start', 1.1, '保留表格与大纲，只展开当前段落'),
    frame('source-11-open', 0.9, '点击段落旁的源码按钮'),
    frame('source-12-end', 0.3, '直接修改 Markdown 标记'),
    frame('source-13-mark', 0.35, '直接修改 Markdown 标记'),
    frame('source-14-type', 0.28, '直接修改 Markdown 标记'),
    frame('source-15-type', 0.28, '直接修改 Markdown 标记'),
    frame('source-16-type', 0.2, '直接修改 Markdown 标记'),
    frame('source-17-mark', 0.85, '直接修改 Markdown 标记'),
    frame('source-18-result', 0.8, '点击完成，立即返回排版'),
    frame('source-19-saved', 1.5, '上下文始终可见，思路保持连贯'),
  ]},
  { name: 'math-diagram', title: '大纲导航，公式与图表模板', frames: [
    frame('math-10-start', 1.1, '从文末点击大纲，直达公式章节'),
    frame('math-11-navigate', 1.1, '从文末点击大纲，直达公式章节'),
    frame('math-12-open', 0.8, '点击公式，就地打开 LaTeX'),
    frame('math-13-menu', 0.8, '选择求和模板，即时查看排版'),
    frame('math-14-template', 1.2, '选择求和模板，即时查看排版'),
    frame('math-15-result', 0.7, '公式写进笔记，继续整理流程'),
    frame('math-16-outline-flow', 0.45, '点击图表，展开 Mermaid 源码'),
    frame('math-17-diagram-open', 0.35, '点击图表，展开 Mermaid 源码'),
    frame('math-18-diagram-source', 0.85, '选择图表模板，快速表达思路'),
    frame('math-19-diagram-menu', 0.75, '选择图表模板，快速表达思路'),
    frame('math-20-sequence', 1.2, '切换时序图，清晰呈现消息与回复'),
    frame('math-21-result', 0.7, '切换时序图，清晰呈现消息与回复'),
    frame('math-22-saved', 1.6, '大纲、公式、图表，都在同一篇 Markdown 中'),
  ]},
];
await mkdir(output, { recursive: true });
const assTime = seconds => {
  const centiseconds = Math.round(seconds * 100);
  return `${Math.floor(centiseconds / 360000)}:${String(Math.floor(centiseconds / 6000) % 60).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
};
const manifest = [];
for (const clip of clips) {
  let duration = 0;
  const events = [];
  const concat = ['ffconcat version 1.0'];
  for (const item of clip.frames) {
    const filename = item.file;
    if (!(await stat(path.join(raw, filename))).size) throw new Error(`Empty capture: ${filename}`);
    concat.push(`file '${filename}'`, `duration ${item.duration}`);
    // The repeated final image carries the last hold; keep its caption visible too.
    const captionEnd = duration + item.duration + (item === clip.frames.at(-1) ? 0.1 : 0);
    events.push(`Dialogue: 0,${assTime(duration)},${assTime(captionEnd)},Default,,0,0,0,,${item.caption}`);
    duration += item.duration;
  }
  const finalFrame = clip.frames.at(-1);
  concat.push(`file '${finalFrame.file}'`);
  const stem = path.join(raw, clip.name);
  await writeFile(`${stem}.ffconcat`, concat.join('\n') + '\n');
  await writeFile(`${stem}.ass`, `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Microsoft YaHei,22,&H00FFFFFF,&H00FFFFFF,&H00412814,&H00412814,0,0,0,0,100,100,0,0,1,0,0,8,24,24,12,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join('\n')}\n`);
  const filter = `pad=${width}:${height}:0:56:color=0x142841,ass=artifacts/demos/${clip.name}.ass,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`;
  const result = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${stem}.ffconcat`, '-filter_complex', filter, '-fps_mode', 'vfr', '-loop', '0', path.join(output, `${clip.name}.gif`)], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw result.error || new Error(`FFmpeg failed for ${clip.name}`);
  const size = (await stat(path.join(output, `${clip.name}.gif`))).size;
  const probe = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', path.join(output, `${clip.name}.gif`)], { encoding: 'utf8' });
  if (probe.status !== 0) throw probe.error || new Error(`FFprobe failed for ${clip.name}`);
  const seconds = Number(JSON.parse(probe.stdout).format.duration);
  manifest.push({ name: clip.name, title: clip.title, file: `${clip.name}.gif`, width, height, seconds, plannedSeconds: Math.round(duration * 100) / 100, sourceFrames: clip.frames.length, bytes: size, frames: clip.frames });
  console.log(`${clip.name}: ${seconds.toFixed(2)} s, ${(size / 1024).toFixed(0)} KiB`);
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ capturedAt: '2026-09-27', extensionVersion: '0.2.5', capture: 'Real Windows VS Code window with the Marketplace extension, an isolated profile and docs/demo/sample.md; outline open in every editor scene; screenshots retimed with faster input and readable result holds.', clips: manifest }, null, 2) + '\n');
