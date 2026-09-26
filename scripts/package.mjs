import { readFile } from 'node:fs/promises';
import { createVSIX } from '@vscode/vsce';

const manifest = JSON.parse(await readFile('package.json', 'utf8'));
await createVSIX({
  packagePath: `artifacts/${manifest.name}-${manifest.version}.vsix`,
  dependencies: false,
  // Documentation screenshots are bundled and must remain relative.
  rewriteRelativeLinks: false,
});
