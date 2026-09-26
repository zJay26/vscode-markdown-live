import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
async function setDocument(page: Page, text: string) { await page.evaluate(text => window.markdownLiveTest.setDocument(text), text); await expect.poll(()=>page.evaluate(()=>window.markdownLiveTest.getText())).toBe(text); }
async function text(page: Page) { return page.evaluate(()=>window.markdownLiveTest.getText()); }
test.beforeEach(async ({page})=>{await page.goto('/'); await expect(page.getByRole('textbox',{name:'Markdown 可视化编辑区'})).toBeVisible();});
test('edits rendered text, preserves source, undo/redo',async({page})=>{
  await setDocument(page,'# 标题\n\n__原有格式__\n\n<!-- preserved -->\n');
  await page.locator('.markdown-content p').click(); await page.keyboard.press('End'); await page.keyboard.type(' hello');
  await expect.poll(()=>text(page)).toBe('# 标题\n\n__原有格式 hello__\n\n<!-- preserved -->\n');
  await page.keyboard.press('Control+z'); await expect.poll(()=>text(page)).not.toContain('hello');
  await page.keyboard.press('Control+Shift+z'); await expect.poll(()=>text(page)).toContain('hello');
});
test('local source opens without change and writes exact source',async({page})=>{
  const original='# 标题\n\nparagraph\n\n<!-- keep -->\n'; await setDocument(page,original);
  await page.locator('.markdown-content p').click(); await page.getByRole('button',{name:'段落源码',exact:true}).click();
  await expect(page.locator('.source-panel')).toBeVisible(); expect(await text(page)).toBe(original);
  const code=page.locator('.source-panel .cm-content'); await code.click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('changed **bold**');
  await page.getByRole('button',{name:'完成',exact:true}).click();
  await expect(page.locator('.markdown-content strong')).toHaveText('bold'); expect(await text(page)).toBe(original.replace('paragraph','changed **bold**'));
});
test('headings, slash insertion, outline, and find replacement',async({page})=>{
  await setDocument(page,'hello\n'); await page.locator('.markdown-content p').click(); await page.keyboard.press('Home'); await page.keyboard.type('# ');
  await expect(page.locator('.markdown-content h1')).toHaveText('hello');
  await page.getByRole('button',{name:'大纲',exact:true}).click(); await expect(page.locator('#headings')).toContainText('hello');
  await page.getByRole('button',{name:'查找',exact:true}).click(); await page.getByRole('textbox',{name:'查找全文'}).fill('hello'); await page.getByRole('textbox',{name:'替换为',exact:true}).fill('你好'); await page.getByRole('button',{name:'全部替换',exact:true}).click();
  await expect.poll(()=>text(page)).toBe('# 你好\n');
});
test('formula editor previews invalid and valid input without losing surrounding text',async({page})=>{
  await setDocument(page,'before\n\n$$\nx^2\n$$\n\nafter\n');
  await page.getByRole('button',{name:'编辑公式',exact:true}).click(); const code=page.locator('.special-editor .cm-content'); await code.click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('\\frac{'); await expect(page.locator('.render-error')).toBeVisible();
  await page.keyboard.press('Control+a'); await page.keyboard.insertText('y^3'); await expect(page.locator('.katex')).toBeVisible(); await page.getByRole('button',{name:'完成',exact:true}).click();
  expect(await text(page)).toContain('before\n\n'); expect(await text(page)).toContain('\n\nafter\n'); expect(await text(page)).toContain('y^3');
});
test('table edits and row insertion',async({page})=>{
  await setDocument(page,'| A | B |\n| - | - |\n| one | two |\n'); await page.locator('td').first().click(); await page.keyboard.press('End'); await page.keyboard.type('!');
  await expect.poll(()=>text(page)).toContain('one!'); await page.getByRole('button',{name:'＋ 行',exact:true}).click(); await expect(page.locator('.markdown-content tr')).toHaveCount(3);
});
test('external update is reflected and page has no errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message)); await setDocument(page,'first\n\nsecond\n'); await page.evaluate(()=>window.markdownLiveTest.external('first\n\nupdated\n')); await expect(page.locator('.markdown-content')).toContainText('updated'); expect(errors).toEqual([]);
});
test('two thousand lines open and typing performance',async({page})=>{
  const doc=Array.from({length:500},(_,i)=>`## 章节 ${i}\n\n正文 ${i} with **bold** and $x_i$.\n`).join('\n');
  const start=Date.now();await setDocument(page,doc);const openMs=Date.now()-start;
  await page.locator('.markdown-content p').first().click();await page.keyboard.press('End');
  const latencies:number[]=[];for(let i=0;i<20;i++){const ms=await page.evaluate(async()=>{const start=performance.now();const v=window.markdownLiveTest.view;v.dispatch(v.state.tr.insertText('x'));await new Promise(requestAnimationFrame);return performance.now()-start;});latencies.push(ms);}
  latencies.sort((a,b)=>a-b);const p95=latencies[Math.floor(latencies.length*.95)-1];
  const performanceReport = JSON.stringify({ measuredAt: new Date().toISOString(), lines:doc.split('\n').length,openMs,inputP95Ms:p95,latencies },null,2);
  await writeFile('artifacts/performance.json', performanceReport);
  await test.info().attach('performance.json',{body:performanceReport,contentType:'application/json'});
  expect(openMs).toBeLessThan(2000);expect(p95).toBeLessThan(50);await page.screenshot({path:'artifacts/editor-long-document.png'});
});
test('slash menu inserts a table and aligns a complete column',async({page})=>{
  await setDocument(page,'start\n');await page.locator('.markdown-content p').click();await page.keyboard.press('End');await page.keyboard.press('Enter');await page.keyboard.type('/');
  await expect(page.locator('#insert-menu')).toBeVisible();await page.getByRole('menuitem',{name:'表格',exact:true}).click();await expect(page.locator('table')).toBeVisible();
  await page.locator('td').first().click();await page.getByRole('button',{name:'居中',exact:true}).click();await expect(page.locator('th').first()).toHaveCSS('text-align','center');expect(await text(page)).toMatch(/:?-+:.*\|/);
});
test('footnote navigation returns to its reference',async({page})=>{
  await setDocument(page,'正文[^note]\n\n[^note]: 注释内容\n');await page.locator('[data-footnote]').click();await expect(page.locator('.footnote-definition')).toBeVisible();await page.getByRole('button',{name:'返回引用 ↑'}).click();await expect(page.locator('[data-footnote]')).toBeFocused();
});
test('composition input waits for composition end before syncing',async({page})=>{
  await setDocument(page,'正文\n');await page.locator('.markdown-content p').click();await page.keyboard.press('End');
  await page.evaluate(()=>{const v=window.markdownLiveTest.view;v.dom.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));v.dispatch(v.state.tr.insertText('中文输入'));});
  expect(await page.evaluate(()=>window.markdownLiveTest.getConfirmed())).toBe('正文\n');
  await page.evaluate(()=>window.markdownLiveTest.view.dom.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中文输入'})));
  await expect.poll(()=>page.evaluate(()=>window.markdownLiveTest.getConfirmed())).toBe('正文中文输入\n');
});
test('cross paragraph selection and split/merge preserve neighbors',async({page})=>{
  await setDocument(page,'first\n\nsecond\n\n<!-- keep -->\n');await page.locator('.markdown-content p').first().click();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  expect(await text(page)).toBe('fi\n\nrst\n\nsecond\n\n<!-- keep -->\n');await page.keyboard.press('Backspace');expect(await text(page)).toBe('first\n\nsecond\n\n<!-- keep -->\n');
  await page.keyboard.press('Home');await page.keyboard.down('Shift');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.up('Shift');await page.keyboard.insertText('replacement');expect(await text(page)).toContain('<!-- keep -->');
});
test('Mermaid renders offline and can be edited',async({page})=>{
  await setDocument(page,'```mermaid\nflowchart LR\n A --> B\n```\n');await expect(page.locator('.formula-preview svg')).toBeVisible();await page.getByRole('button',{name:'编辑 Mermaid 图表'}).click();await page.locator('.special-editor .cm-content').click();await page.keyboard.press('Control+a');await page.keyboard.insertText('flowchart LR\n A --> C');await expect.poll(()=>text(page)).toContain('A --> C');await expect(page.locator('.formula-preview svg')).toContainText('C');await page.getByRole('button',{name:'完成',exact:true}).click();await page.screenshot({path:'artifacts/editor-mermaid.png'});
});
test('light, dark, narrow layout and no startup errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setDocument(page,'# 研究记录\n\n编辑 **正文**、$E=mc^2$ 与脚注[^1]。\n\n| 实验 | 得分 |\n| --- | ---: |\n| A | 0.92 |\n\n[^1]: 可点击返回引用。\n');await page.getByRole('button',{name:'大纲',exact:true}).click();await page.screenshot({path:'artifacts/editor-light.png'});
  await page.evaluate(()=>{document.body.classList.add('vscode-dark');document.documentElement.style.cssText+=';--vscode-editor-background:#1e1e1e;--vscode-editor-foreground:#d4d4d4;--vscode-panel-border:#454545;--vscode-editorWidget-background:#252526;--vscode-list-hoverBackground:#2a2d2e;--vscode-descriptionForeground:#aaa;--vscode-textLink-foreground:#75beff;';});
  await expect(page.locator('#headings button.active')).toHaveCSS('background-color','rgb(42, 45, 46)');
  await page.screenshot({path:'artifacts/editor-dark.png'});await page.setViewportSize({width:720,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(720);expect(errors).toEqual([]);
});

test('replace all consumes adjacent matches exactly once', async ({ page }) => {
  await setDocument(page, 'aaaaaa\n');
  await page.getByRole('button', { name: '查找', exact: true }).click();
  await page.getByRole('textbox', { name: '查找全文' }).fill('aa');
  await page.getByRole('textbox', { name: '替换为', exact: true }).fill('x');
  await page.getByRole('button', { name: '全部替换', exact: true }).click();
  await expect.poll(() => text(page)).toBe('xxx\n');
});

test('case insensitive replacement keeps Unicode source offsets', async ({ page }) => {
  await setDocument(page, 'İ x x\n');
  await page.getByRole('button', { name: '查找', exact: true }).click();
  await page.getByRole('textbox', { name: '查找全文' }).fill('x');
  await page.getByRole('textbox', { name: '替换为', exact: true }).fill('Y');
  await page.getByRole('button', { name: '全部替换', exact: true }).click();
  await expect.poll(() => text(page)).toBe('İ Y Y\n');
});
