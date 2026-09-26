import { spawn } from 'node:child_process';
import { cp, mkdir, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
await mkdir('.local-test/wsl-workspace',{recursive:true});
await mkdir('.local-test/wsl-extensions',{recursive:true});
await cp(process.env.WSL_EXTENSION_PATH??join(homedir(),'.vscode/extensions/ms-vscode-remote.remote-wsl-0.88.5'),'.local-test/wsl-extensions/ms-vscode-remote.remote-wsl-0.88.5',{recursive:true});
try {
  const args=['--no-sandbox','--disable-gpu-sandbox','--folder-uri=vscode-remote://wsl+Ubuntu/mnt/d/vscode-markdown-preview/.local-test/wsl-workspace','--remote=wsl+Ubuntu',`--user-data-dir=${resolve('.local-test/wsl-profile')}`,`--extensions-dir=${resolve('.local-test/wsl-extensions')}`,'--extensionDevelopmentPath=vscode-remote://wsl+Ubuntu/mnt/d/vscode-markdown-preview','--extensionTestsPath=vscode-remote://wsl+Ubuntu/mnt/d/vscode-markdown-preview/dist/host-tests.cjs','--disable-workspace-trust','--skip-welcome','--skip-release-notes','--disable-updates','--disable-telemetry'];
  await new Promise((resolve,reject)=>{const child=spawn(process.env.VSCODE_EXECUTABLE??'D:/VSCode/Microsoft VS Code/Code.exe',args,{windowsHide:true,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`WSL host exited ${code}`)));});
} finally {try{await copyFile('.local-test/wsl-workspace/host-report.json','artifacts/host-wsl-report.json');}catch{}}
