// Documentation only: interact with the real editor and capture lossless PNGs.
// Frame durations describe the edited presentation, not editor performance.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.DEMO_URL || 'http://127.0.0.1:4192';
const output = path.resolve(process.env.DEMO_OUTPUT || 'artifacts/demos/review-v4');
const requested = process.argv.slice(2);
const scenes = requested.length ? requested : ['writing', 'source', 'math-diagram'];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const pointerCss = `#demo-pointer{position:fixed;left:0;top:0;width:18px;height:24px;z-index:2147483647;pointer-events:none;transform:translate(1150px,610px)}
  #demo-pointer svg{display:block;width:100%;height:100%}.cm-cursor{animation:none!important}
  #app{isolation:isolate;position:absolute;top:56px;left:0;width:100%;height:calc(100% - 56px)}
  .demo-vscode{top:56px}
  #demo-caption{position:fixed;inset:0 0 auto 0;height:56px;display:flex;align-items:center;justify-content:center;background:#142841;color:#fff;font:500 22px/1 'Microsoft YaHei','Segoe UI',sans-serif;z-index:2147483646;pointer-events:none}`;
const arrow = '<svg viewBox="0 0 18 24"><path d="M2 1.5v17l4.4-4 3.5 7 3-1.5-3.5-6.8 5.8-.4Z" fill="white" stroke="#222" stroke-width="1.15" stroke-linejoin="round"/></svg>';
const ibeam = '<svg viewBox="0 0 18 24"><path d="M5 3h8M9 3v18M5 21h8" fill="none" stroke="white" stroke-width="3"/><path d="M5 3h8M9 3v18M5 21h8" fill="none" stroke="#222" stroke-width="1.25"/></svg>';
const ease = t => t * t * (3 - 2 * t);
try {
  for (const name of scenes) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 856 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'zh-CN' });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${baseURL}/scripts/demo.html?scene=${name}`);
    await expect(page.locator('#outline')).toBeVisible();
    await expect(page.locator('.formula-preview svg')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: pointerCss });
    await page.evaluate(html => { const el = document.createElement('div'); el.id = 'demo-pointer'; el.innerHTML = html; document.body.append(el); const caption = document.createElement('div'); caption.id = 'demo-caption'; document.body.append(caption); }, arrow);
    const directory = path.join(output, name); await mkdir(directory, { recursive: true });
    const frames = []; let caption = ''; let pointer = { x: 1150, y: 610 };
    const capture = async (duration = 0.05) => {
      const file = `${name}/${String(frames.length).padStart(4, '0')}.png`;
      await page.locator('#demo-caption').evaluate((el, text) => el.textContent = text, caption);
      await page.screenshot({ path: path.join(output, file), type: 'png', caret: 'initial' });
      frames.push({ file, duration, caption });
    };
    const hold = async duration => { await page.waitForTimeout(60); await capture(duration); };
    const move = async (point, seconds = 0.4, kind = 'arrow') => {
      const start = { ...pointer }; const count = Math.max(2, Math.round(seconds * 20));
      await page.evaluate(html => document.querySelector('#demo-pointer').innerHTML = html, kind === 'text' ? ibeam : arrow);
      for (let i = 1; i <= count; i++) {
        const t = ease(i / count); pointer = { x: start.x + (point.x - start.x) * t, y: start.y + (point.y - start.y) * t };
        await page.mouse.move(pointer.x, pointer.y);
        await page.evaluate(({ x, y }) => document.querySelector('#demo-pointer').style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`, pointer);
        await capture();
      }
    };
    const center = async locator => { const b = await locator.boundingBox(); if (!b) throw new Error('Missing target'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const click = async (locator, seconds = 0.4, kind = 'arrow') => { await move(await center(locator), seconds, kind); await page.mouse.down(); await capture(0.1); await page.mouse.up(); await hold(0.25); };
    const type = async text => { for (const char of text) { await page.keyboard.insertText(char); await capture(/[，。]/.test(char) ? 0.18 : 0.1); } };
    const navigate = async title => {
      const start = await page.locator('#canvas').evaluate(el => el.scrollTop);
      await move(await center(page.locator('#headings button').filter({ hasText: title })), 0.45);
      await page.mouse.down(); await capture(0.1); await page.mouse.up();
      const end = await page.locator('.markdown-content').getByRole('heading', { name: title, exact: true }).evaluate(el => {
        const canvas = document.querySelector('#canvas');
        return canvas.scrollTop + el.getBoundingClientRect().top - canvas.getBoundingClientRect().top - 40;
      });
      for (let i = 0; i <= 12; i++) { await page.locator('#canvas').evaluate((el, top) => el.scrollTop = top, start + (end - start) * ease(i / 12)); await capture(); }
      await hold(0.6);
    };
    if (name === 'writing') {
      caption = '从 VS Code 源文件，点击 Markdown Live';
      await hold(1.2);
      await click(page.locator('#demo-open-live'), 0.6);
      await expect(page.locator('.demo-vscode')).toBeHidden();
      caption = '直接在正文里写作，大纲始终可见';
      await hold(1.0);
      const paragraph = page.locator('.markdown-content p').filter({ hasText: '用清晰的结构' });
      await click(paragraph, 0.45, 'text'); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await hold(0.25);
      await type('让灵感自然成文。'); await hold(0.55);
      caption = '选中文字，立即应用排版';
      await page.keyboard.press('Home'); await page.keyboard.down('Shift');
      for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await capture(0.1); }
      await page.keyboard.up('Shift'); await hold(0.35);
      await click(page.locator('#format-bar [data-action="bold"]'));
      await expect(page.locator('.markdown-content strong').filter({ hasText: '让灵感' })).toBeVisible();
      await move({ x: 1130, y: 680 }, 0.35); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Control+s');
      caption = '排版即时呈现，内容仍是 Markdown'; await hold(1.5);
    } else if (name === 'source') {
      const paragraph = page.locator('.markdown-content p').filter({ hasText: '需要精确排版时' });
      await paragraph.click();
      await page.getByRole('heading', { name: '02 · 整理资料', exact: true }).evaluate(el => {
        const canvas = document.querySelector('#canvas'); canvas.scrollTop += el.getBoundingClientRect().top - canvas.getBoundingClientRect().top - 36;
      });
      caption = '保留表格与大纲，只编辑当前段落'; await hold(1.0);
      await click(paragraph, 0.45, 'text');
      await click(page.getByRole('button', { name: '段落源码', exact: true }));
      await expect(page.locator('.source-panel')).toBeVisible();
      caption = '展开局部源码，补充 Markdown 标记';
      await click(page.locator('.source-panel .cm-content'), 0.4, 'text');
      await page.keyboard.press('Control+End'); await hold(0.3);
      await type(' **保留上下文**'); await hold(0.7);
      await click(page.locator('.source-panel').getByRole('button', { name: '完成', exact: true }));
      await expect(page.locator('.markdown-content strong').filter({ hasText: '保留上下文' })).toBeVisible();
      await move({ x: 1130, y: 680 }, 0.3); await page.keyboard.press('Control+s');
      caption = '回到排版视图，思路保持连贯'; await hold(1.5);
    } else {
      await page.locator('#headings button').filter({ hasText: '04 · 下一步' }).click();
      await page.getByRole('heading', { name: '04 · 下一步', exact: true }).evaluate(el => {
        const canvas = document.querySelector('#canvas'); canvas.scrollTop += el.getBoundingClientRect().top - canvas.getBoundingClientRect().top - 40;
      });
      caption = '点击大纲，在长文中直达目标章节'; await hold(1.0);
      await navigate('一个公式');
      await click(page.getByRole('button', { name: '编辑公式', exact: true }), 0.4);
      caption = '使用求和模板，即时预览 LaTeX';
      const mathNode = page.locator('.special-node').filter({ has: page.getByRole('button', { name: '编辑公式', exact: true }) });
      const math = mathNode.locator('.special-editor');
      await expect(math).toBeVisible();
      await move(await center(math.getByRole('combobox', { name: '插入模板' })), 0.35);
      await hold(0.35);
      await math.getByRole('combobox', { name: '插入模板' }).selectOption({ label: '求和' });
      await expect(mathNode.locator('.katex')).toContainText('∑'); await hold(1.0);
      await click(math.getByRole('button', { name: '完成', exact: true })); await hold(0.5);
      caption = '继续用大纲定位图表'; await navigate('一个流程');
      await click(page.getByRole('button', { name: '编辑 Mermaid 图表', exact: true }), 0.4);
      const diagramNode = page.locator('.special-node').filter({ has: page.getByRole('button', { name: '编辑 Mermaid 图表', exact: true }) });
      const diagram = diagramNode.locator('.special-editor');
      caption = '切换时序图模板，清晰呈现消息与回复';
      await move(await center(diagram.getByRole('combobox', { name: '插入模板' })), 0.35);
      await hold(0.35);
      await diagram.getByRole('combobox', { name: '插入模板' }).selectOption({ label: '时序图' });
      await expect(diagramNode.locator('.formula-preview svg')).toContainText('Alice');
      await hold(1.15);
      await click(diagram.getByRole('button', { name: '完成', exact: true }));
      await move({ x: 1130, y: 680 }, 0.35); await page.keyboard.press('Control+s');
      caption = '大纲、公式、图表，都在同一篇 Markdown'; await hold(1.65);
    }
    const finalText = await page.evaluate(() => window.markdownLiveTest.getText());
    if (errors.length) throw new Error(errors.join('\n'));
    await writeFile(path.join(output, `${name}.json`), JSON.stringify({ name, width: 1920, height: 1284, cssViewport: { width: 1280, height: 856 }, deviceScaleFactor: 1.5, frames, finalText, errors, outlineVisible: await page.locator('#outline').isVisible() }, null, 2) + '\n');
    console.log(`${name}: ${frames.length} lossless frames, ${frames.reduce((n, f) => n + f.duration, 0).toFixed(2)}s`);
    await context.close();
  }
} finally { await browser.close(); }
