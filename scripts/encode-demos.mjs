// Encode real editor screenshots; no editor content is painted by this script.
// See docs/demo/README.md for the capture workflow and pacing.
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const raw = path.join(root, 'artifacts/demos');
const output = path.join(root, 'docs/demo');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const range = (from, to, duration, caption) => Array.from({ length: to - from + 1 }, (_, i) => ({ index: from + i, duration, caption }));
const frame = (index, duration, caption) => ({ index, duration, caption });
const clips = [
  { name: 'writing', title: '直接在排版后的正文里写作', frames: [
    frame(55, 1.8, '直接在正文中输入'),
    ...range(56, 67, 0.24, '直接在正文中输入'),
    frame(68, 1.2, '选中文字，应用排版'),
    ...range(69, 78, 0.16, '选中文字，应用排版'),
    frame(79, 0.9, '选中文字，应用排版'),
    frame(80, 1.8, '点击加粗，即时看到结果'),
    frame(81, 2.6, '点击加粗，即时看到结果'),
  ]},
  { name: 'source', title: '只展开需要修改的那一段', frames: JSON.parse(await readFile(path.join(raw, 'source-v2.json'), 'utf8')) },
  { name: 'math-diagram', title: '公式与流程图，边改边看', frames: JSON.parse(await readFile(path.join(raw, 'math-v2.json'), 'utf8')) },
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
    const filename = item.file || `writing-${String(item.index).padStart(3, '0')}.png`;
    if (!(await stat(path.join(raw, filename))).size) throw new Error(`Empty capture: ${filename}`);
    concat.push(`file '${filename}'`, `duration ${item.duration}`);
    events.push(`Dialogue: 0,${assTime(duration)},${assTime(duration + item.duration)},Default,,0,0,0,,${item.caption}`);
    duration += item.duration;
  }
  const finalFrame = clip.frames.at(-1);
  concat.push(`file '${finalFrame.file || `writing-${String(finalFrame.index).padStart(3, '0')}.png`}'`);
  const stem = path.join(raw, clip.name);
  await writeFile(`${stem}.ffconcat`, concat.join('\n') + '\n');
  await writeFile(`${stem}.ass`, `[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 776\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Microsoft YaHei,25,&H00FFFFFF,&H00FFFFFF,&H00412814,&H00412814,0,0,0,0,100,100,0,0,1,0,0,8,24,24,12,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join('\n')}\n`);
  const filter = `pad=1280:776:0:56:color=0x142841,ass=artifacts/demos/${clip.name}.ass,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`;
  const result = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${stem}.ffconcat`, '-filter_complex', filter, '-fps_mode', 'vfr', '-loop', '0', path.join(output, `${clip.name}.gif`)], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw result.error || new Error(`FFmpeg failed for ${clip.name}`);
  const size = (await stat(path.join(output, `${clip.name}.gif`))).size;
  manifest.push({ name: clip.name, title: clip.title, file: `${clip.name}.gif`, width: 1280, height: 776, seconds: Math.round(duration * 100) / 100, sourceFrames: clip.frames.length, bytes: size, frames: clip.frames });
  console.log(`${clip.name}: ${duration.toFixed(2)} s, ${(size / 1024).toFixed(0)} KiB`);
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ capturedAt: '2026-09-27', extensionVersion: '0.2.5', capture: 'Real editor in the browser development fixture; screenshots retimed for readable demonstrations.', clips: manifest }, null, 2) + '\n');
