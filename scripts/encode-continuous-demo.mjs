import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const directory = path.resolve(process.env.DEMO_OUTPUT || 'artifacts/demos/review-v6');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const scene = JSON.parse(await readFile(path.join(directory, 'capture.json'), 'utf8'));
if (!scene.continuous || scene.pageLoads !== 1 || scene.documentResets !== 0) throw new Error('Expected a single uninterrupted document capture');
const concat = ['ffconcat version 1.0'];
for (const frame of scene.frames) concat.push(`file '${frame.file}'`, 'option framerate 100', `duration ${frame.duration}`);
concat.push(`file '${scene.frames.at(-1).file}'`, 'option framerate 100');
await writeFile(path.join(directory, 'overview.ffconcat'), concat.join('\n') + '\n');
const run = args => {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: directory, stdio: 'inherit' });
  if (result.status !== 0) throw result.error || new Error('FFmpeg failed');
};
// Two passes avoid buffering the entire high-DPI animation while making a palette.
run(['-f', 'concat', '-safe', '0', '-i', 'overview.ffconcat', '-vf', `fps=${scene.fps},palettegen=stats_mode=diff`, '-frames:v', '1', 'palette.png']);
console.log('Palette generated');
run(['-f', 'concat', '-safe', '0', '-i', 'overview.ffconcat', '-i', 'palette.png', '-filter_complex', `[0:v]fps=${scene.fps}[v];[v][1:v]paletteuse=dither=none:diff_mode=rectangle`, '-loop', '0', 'overview.gif']);
console.log('GIF encoded');
run(['-f', 'concat', '-safe', '0', '-i', 'overview.ffconcat', '-vf', `fps=${scene.fps}`, '-c:v', 'libx264', '-crf', '15', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'overview.mp4']);
const probe = spawnSync(ffprobe, ['-v', 'error', '-count_frames', '-show_entries', 'stream=width,height,nb_read_frames:format=duration', '-of', 'json', 'overview.gif'], { cwd: directory, encoding: 'utf8' });
if (probe.status !== 0) throw new Error(probe.stderr);
const data = JSON.parse(probe.stdout), bytes = await readFile(path.join(directory, 'overview.gif'));
const manifest = {
  createdAt: new Date().toISOString(), status: 'awaiting-user-review', published: false, extensionVersion: '0.2.6',
  capture: 'A single browser page and document, simulated VS Code opening followed by actual editor actions. Prior edits persist through writing, outline navigation, math/diagram templates and local source editing. 50fps eased pointer/scroll motion; the loop fades through matching background frames.',
  continuous: true, pageLoads: scene.pageLoads, documentResets: scene.documentResets, caret: scene.caret,
  file: 'overview.gif', video: 'overview.mp4', width: data.streams[0].width, height: data.streams[0].height,
  fps: scene.fps, seconds: Number(data.format.duration), encodedFrames: Number(data.streams[0].nb_read_frames), sourceFrames: scene.frames.length,
  bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), order: [1, 3, 2],
  checkpoints: scene.checkpoints.map(({ name, at }) => ({ name, at })),
};
await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await copyFile(path.join(directory, 'overview.gif'), 'docs/demo/overview.gif');
await writeFile('docs/demo/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
