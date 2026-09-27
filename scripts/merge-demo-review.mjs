// Join the approved-order review scenes from their original PNG frames.
// This avoids decoding/requantizing GIFs and preserves the existing pacing.
import { readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const directory = path.resolve(process.env.DEMO_OUTPUT || 'artifacts/demos/review-v4');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const order = ['writing', 'math-diagram', 'source'];
const titles = ['打开与写作', '大纲、公式与图表', '局部源码'];
const concat = ['ffconcat version 1.0'];
const sections = []; let seconds = 0; let last;
for (const [index, name] of order.entries()) {
  const scene = JSON.parse(await readFile(path.join(directory, `${name}.json`), 'utf8'));
  if (scene.width !== 1920 || scene.height !== 1284 || !scene.outlineVisible) throw new Error(`Unexpected scene metadata: ${name}`);
  const start = seconds;
  for (const frame of scene.frames) {
    if (!(await stat(path.join(directory, frame.file))).size) throw new Error(`Empty source frame: ${frame.file}`);
    concat.push(`file '${frame.file}'`, 'option framerate 100', `duration ${frame.duration}`);
    seconds += frame.duration; last = frame.file;
  }
  sections.push({ name, title: titles[index], originalNumber: [1, 3, 2][index], startSeconds: Math.round(start * 20) / 20, endSeconds: Math.round(seconds * 20) / 20, sourceFrames: scene.frames.length });
}
concat.push(`file '${last}'`, 'option framerate 100');
await writeFile(path.join(directory, 'overview.ffconcat'), concat.join('\n') + '\n');
const run = args => {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'overview.ffconcat', ...args], { cwd: directory, stdio: 'inherit' });
  if (result.status !== 0) throw result.error || new Error('FFmpeg failed');
};
run(['-filter_complex', 'fps=20,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', 'overview.gif']);
run(['-vf', 'fps=20', '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'overview.mp4']);
const probe = spawnSync(ffprobe, ['-v', 'error', '-count_frames', '-show_entries', 'stream=width,height,nb_read_frames:format=duration', '-of', 'json', 'overview.gif'], { cwd: directory, encoding: 'utf8' });
if (probe.status !== 0) throw new Error(probe.stderr);
const data = JSON.parse(probe.stdout);
const bytes = await readFile(path.join(directory, 'overview.gif'));
const manifest = {
  createdAt: new Date().toISOString(), status: 'awaiting-user-review', published: false, extensionVersion: '0.2.6',
  capture: 'Real browser development editor with a user-requested simulated VS Code source opening; original high-DPI PNG frames, standard-size presentation cursor, existing timings retained.',
  file: 'overview.gif', video: 'overview.mp4', width: data.streams[0].width, height: data.streams[0].height, fps: 20,
  seconds: Number(data.format.duration), encodedFrames: Number(data.streams[0].nb_read_frames), bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'), order: [1, 3, 2], sections,
};
await writeFile(path.join(directory, 'overview-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await copyFile(path.join(directory, 'overview.gif'), 'docs/demo/overview.gif');
await writeFile('docs/demo/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
