import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
const remote=process.env.WSL_UI_TEST==='1';
const workspace=remote?'.local-test/wsl-ui-workspace':'.local-test/ui-workspace';
const prefix=remote?'installed-wsl-ui':'installed-ui';
const profile=process.env.MARKDOWN_LIVE_UI_PROFILE??(remote?'.local-test/wsl-ui-profile':'.local-test/ui-profile');
// Let Windows pick an available port; fixed ports can fall in WSL/Hyper-V exclusions.
const portProbe=createServer();
await new Promise((resolve,reject)=>{portProbe.once('error',reject);portProbe.listen(0,'127.0.0.1',resolve);});
const port=portProbe.address().port;
await new Promise((resolve,reject)=>portProbe.close(error=>error?reject(error):resolve()));
await mkdir(workspace,{recursive:true});
try{await unlink(`${workspace}/ui-finish.signal`);}catch{}
await build({entryPoints:['tests/host/ui-suite.ts'],bundle:true,platform:'node',format:'cjs',external:['vscode'],outfile:'dist/ui-tests.cjs'});
// Use the installed VSIX extension path as the development extension so the harness
// runs against exactly the packaged files and does not depend on source modules.
const extensionPath=process.env.INSTALLED_EXTENSION_PATH;
if(!extensionPath)throw new Error('Set INSTALLED_EXTENSION_PATH to the verified installed extension directory');
const args=[...(remote?['--remote=wsl+Ubuntu',`--folder-uri=vscode-remote://wsl+Ubuntu/mnt/d/vscode-markdown-preview/${workspace}`,`--extensions-dir=${resolve('.local-test/wsl-extensions')}`]:[resolve(workspace),'--disable-extensions']),'--no-sandbox','--disable-gpu-sandbox',`--remote-debugging-port=${port}`,`--user-data-dir=${resolve(profile)}`,'--disable-workspace-trust','--skip-welcome','--skip-release-notes',`--extensionDevelopmentPath=${extensionPath}`,`--extensionTestsPath=${remote?'vscode-remote://wsl+Ubuntu/mnt/d/vscode-markdown-preview/dist/ui-tests.cjs':resolve('dist/ui-tests.cjs')}`];
const child=spawn(process.env.VSCODE_EXECUTABLE??'D:/VSCode/Microsoft VS Code/Code.exe',args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
let browser;
try{
  for(let i=0;i<80;i++){try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);break;}catch{await new Promise(r=>setTimeout(r,500));}}
  if(!browser)throw new Error('Cannot connect to isolated VS Code renderer');
  let frame, page;
  let openedFromShortcut=false;
  let titleActions=[];
  for(let i=0;i<80;i++){
    for(const candidate of browser.contexts()[0].pages()){
      const action=candidate.getByRole('button',{name:/^Markdown Live · by zJay: 打开可视化编辑(?:\s|$)/});
      if(await action.isVisible().catch(()=>false)){
        const toolbar=action.locator('xpath=ancestor::ul[1]');
        titleActions=await toolbar.locator('[role="button"]').evaluateAll(buttons=>buttons.filter(button=>button.getClientRects().length).map(button=>({label:button.getAttribute('aria-label'),icon:getComputedStyle(button).backgroundImage})));
        if(!titleActions[0]?.label?.startsWith('Markdown Live · by zJay:'))throw new Error(`Markdown Live must be the first title action: ${JSON.stringify(titleActions)}`);
        if(!/markdown-live-icon\.png/.test(titleActions[0].icon))throw new Error('Packaged Markdown Live icon did not load');
        await toolbar.screenshot({path:`artifacts/${prefix}-title-actions.png`});
        await candidate.locator('.monaco-editor textarea.inputarea').first().focus();
        await candidate.keyboard.press('Control+Shift+v');openedFromShortcut=true;break;
      }
    }
    if(openedFromShortcut)break;await new Promise(r=>setTimeout(r,500));
  }
  if(!openedFromShortcut)throw new Error('Markdown Live title action is missing for a Markdown file');
  for(let i=0;i<100;i++){
    for(const p of browser.contexts()[0].pages())for(const f of p.frames())if(await f.locator('.markdown-content').count().catch(()=>0)){frame=f;page=p;break;}
    if(frame)break;await new Promise(r=>setTimeout(r,500));
  }
  if(!frame)throw new Error('Packaged webview did not render');
  await frame.locator('#content-zoom').click();
  await frame.evaluate(()=>{window.testHostEvents=[];window.addEventListener('message',event=>{const {type,dirty,success,version}=event.data??{};window.testHostEvents.push({time:performance.now(),type,dirty,success,version});});});
  const initial=await readFile(`${workspace}/界面验证.md`,'utf8');
  const toolbarHeight=(await frame.locator('.toolbar').boundingBox()).height;
  await frame.locator('.markdown-content p').first().hover();
  await page.keyboard.down('Control');await page.mouse.wheel(0,-500);await page.keyboard.up('Control');
  await expect(frame.locator('#content-zoom')).toHaveText('150%');
  await expect(frame.locator('#editor')).toHaveCSS('transform','matrix(1.5, 0, 0, 1.5, 0, 0)');
  await expect(frame.locator('#sync-state')).toHaveText('已保存');
  if((await frame.locator('.toolbar').boundingBox()).height!==toolbarHeight)throw new Error('Content zoom resized the toolbar');
  if(await readFile(`${workspace}/界面验证.md`,'utf8')!==initial)throw new Error('Content zoom changed the Markdown file');
  await page.screenshot({path:`artifacts/vscode-${remote?'wsl-':''}zoom.png`});
  await writeFile(`artifacts/${prefix}-zoom-geometry.json`,JSON.stringify(await frame.evaluate(()=>['#editor','.markdown-content h1','.markdown-content p'].map(selector=>{const element=document.querySelector(selector),rect=element.getBoundingClientRect();return {selector,rect:rect.toJSON(),offsetHeight:element.offsetHeight,hit:document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.outerHTML.slice(0,200)};})),null,2));
  await frame.locator('.markdown-content p').first().click();
  await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  await expect.poll(()=>frame.evaluate(()=>window.getSelection()?.anchorOffset)).toBe(2);
  await page.keyboard.press('End');await page.keyboard.insertText(' 已验证');
  await frame.locator('#sync-state').getByText('未保存',{exact:true}).waitFor();
  await page.keyboard.press('Control+s');
  await frame.locator('#sync-state').getByText('已保存',{exact:true}).waitFor();
  try { await expect(frame.locator('#notice')).not.toContainText('尚未保存'); }
  catch(error) { await writeFile(`artifacts/${prefix}-protocol.json`,JSON.stringify(await frame.evaluate(()=>window.testHostEvents),null,2)); throw error; }
  let saved='';for(let i=0;i<40;i++){saved=await readFile(`${workspace}/界面验证.md`,'utf8');if(saved.includes('已验证'))break;await new Promise(r=>setTimeout(r,100));}
  if(!saved.includes('已验证'))throw new Error('Rendered edit was not saved to the real Markdown file');
  await frame.locator('.formula-preview svg').waitFor({timeout:15000});
  await frame.getByRole('button',{name:'段落源码',exact:true}).click();await frame.locator('.source-panel').waitFor();await frame.getByRole('button',{name:'完成',exact:true}).click();
  await frame.locator('#content-zoom').click();await expect(frame.locator('#content-zoom')).toHaveText('100%');
  await frame.getByRole('button',{name:'大纲',exact:true}).click();
  await frame.getByRole('searchbox',{name:'筛选章节'}).fill('研究');
  await expect(frame.locator('#headings button')).toHaveCount(1);
  await frame.getByRole('button',{name:'专注',exact:true}).click();
  await expect(frame.locator('#format-bar')).toBeHidden();
  await frame.getByRole('button',{name:'退出专注',exact:true}).click();
  await frame.getByRole('searchbox',{name:'筛选章节'}).fill('');
  await frame.locator('#headings').getByRole('button',{name:'安装后验证',exact:true}).click();
  await frame.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=48;canvas.height=24;const context=canvas.getContext('2d');context.fillStyle='#366baf';context.fillRect(0,0,48,24);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const data=new DataTransfer();data.items.add(new File([blob],'截图测试.png',{type:'image/png'}));document.querySelector('.markdown-content').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
  await frame.locator('.image-node img').waitFor();await frame.waitForFunction(()=>document.querySelector('.image-node img')?.naturalWidth>0);await page.keyboard.press('Control+s');
  await frame.locator('#sync-state').getByText('已保存',{exact:true}).waitFor();
  await expect(frame.locator('#notice')).not.toContainText('尚未保存');
  await page.screenshot({path:`artifacts/vscode-${remote?'wsl-':''}installed.png`});
  await writeFile(`artifacts/${prefix}-protocol.json`,JSON.stringify(await frame.evaluate(()=>window.testHostEvents),null,2));
  await writeFile(`artifacts/${prefix}-report.json`,JSON.stringify({passed:true,remote,verifiedAt:new Date().toISOString(),installedExtension:extensionPath,titleActions,checks:['C1 PNG icon is first in the editor title actions','Ctrl+Shift+V opens Markdown Live with the built-in Markdown binding active','packaged webview loads','Ctrl+wheel zooms only content without edits or dirty state','rendered text edit persists at 150% zoom','dirty and saved status follow the real document','Mermaid lazy chunks render','local source opens and closes at 150% zoom','zoom control resets content to 100%','outline filters document headings','focus mode hides and restores tools','clipboard image event writes a PNG and loads it through webview URI'],sample:saved},null,2));
}finally{
  await writeFile(`${workspace}/ui-finish.signal`,'done');await browser?.close();await writeFile(`artifacts/${prefix}-log.txt`,logs);
}
