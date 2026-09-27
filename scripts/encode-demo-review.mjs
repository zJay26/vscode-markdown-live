import { readFile, writeFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const directory = path.resolve(process.env.DEMO_OUTPUT || 'artifacts/demos/review-v4');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const run = args => { const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: directory, stdio: 'inherit' }); if (result.status !== 0) throw result.error || new Error('FFmpeg failed'); };
const clips = [];
for (const name of ['writing', 'source', 'math-diagram']) {
  const scene = JSON.parse(await readFile(path.join(directory, `${name}.json`), 'utf8'));
  let seconds = 0; const events = []; const concat = ['ffconcat version 1.0'];
  for (const frame of scene.frames) {
    concat.push(`file '${frame.file}'`, 'option framerate 100', `duration ${frame.duration}`);
    const prior = events.at(-1);
    if (prior?.caption === frame.caption) prior.end = seconds + frame.duration;
    else events.push({ start: seconds, end: seconds + frame.duration, caption: frame.caption });
    seconds += frame.duration;
  }
  concat.push(`file '${scene.frames.at(-1).file}'`, 'option framerate 100');
  await writeFile(path.join(directory, `${name}.ffconcat`), concat.join('\n') + '\n');
  // Captions are rendered by the browser into each lossless, high-DPI frame.
  const base = 'fps=20';
  run(['-f', 'concat', '-safe', '0', '-i', `${name}.ffconcat`, '-filter_complex', `${base},split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`, '-loop', '0', `${name}.gif`]);
  run(['-f', 'concat', '-safe', '0', '-i', `${name}.ffconcat`, '-vf', base, '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${name}.mp4`]);
  const probe = spawnSync(ffprobe, ['-v', 'error', '-count_frames', '-show_entries', 'stream=width,height,nb_read_frames:format=duration', '-of', 'json', `${name}.gif`], { cwd: directory, encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(probe.stderr);
  const data = JSON.parse(probe.stdout);
  const clip = { name, width: scene.width, height: scene.height, gif: `${name}.gif`, video: `${name}.mp4`, fps: 20, seconds: Number(data.format.duration), encodedFrames: Number(data.streams[0].nb_read_frames), losslessSourceFrames: scene.frames.length, bytes: (await stat(path.join(directory, `${name}.gif`))).size, outlineVisible: scene.outlineVisible, captions: events };
  clips.push(clip); console.log(JSON.stringify(clip));
}
await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), status: 'awaiting-user-review', extensionVersion: '0.2.6', published: false, capture: 'Real browser development editor; explicitly simulated VS Code source introduction in writing clip; lossless PNG screenshots, standard-size presentation cursor, 20fps motion, no desktop capture or JPEG inputs.', clips }, null, 2) + '\n');
