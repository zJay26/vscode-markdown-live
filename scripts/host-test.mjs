import { build } from 'esbuild';
import { runTests } from '@vscode/test-electron';
import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
await mkdir('.local-test/workspace',{recursive:true});
await build({entryPoints:['tests/host/suite.ts'],bundle:true,platform:'node',format:'cjs',target:'node20',external:['vscode'],outfile:'dist/host-tests.cjs'});
try {
  await runTests({vscodeExecutablePath:process.env.VSCODE_EXECUTABLE??'D:/VSCode/Microsoft VS Code/Code.exe',extensionDevelopmentPath:resolve('.'),extensionTestsPath:resolve('dist/host-tests.cjs'),launchArgs:[resolve('.local-test/workspace'),'--user-data-dir',resolve('.local-test/profile'),'--extensions-dir',resolve('.local-test/extensions'),'--disable-workspace-trust','--skip-welcome','--skip-release-notes','--disable-updates','--disable-telemetry'],extensionTestsEnv:{MARKDOWN_LIVE_TEST:'1'}});
} finally { try { await copyFile('.local-test/workspace/host-report.json','artifacts/host-report.json'); } catch {} }
