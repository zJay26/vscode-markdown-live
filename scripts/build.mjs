import { build as esbuild } from 'esbuild';
import { build as vite } from 'vite';
import { mkdir } from 'node:fs/promises';
import { writeNotices } from './notices.mjs';
await mkdir('artifacts', { recursive: true });
await esbuild({ entryPoints: ['src/extension.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode'], outfile: 'dist/extension.cjs', sourcemap: true });
await vite();
await writeNotices();
