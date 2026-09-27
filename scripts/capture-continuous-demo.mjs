// One page, one document, one uninterrupted sequence of actual editor actions.
// Only the presentation pointer, captions, eased scrolling and loop fade are staged.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.DEMO_URL || 'http://127.0.0.1:4192';
const output = path.resolve(process.env.DEMO_OUTPUT || 'artifacts/demos/review-v6');
await mkdir(path.join(output, 'frames'), { recursive: true });
const fps = 50, dt = 1 / fps;
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
const arrow = '<svg viewBox="0 0 18 24"><path d="M2 1.5v17l4.4-4 3.5 7 3-1.5-3.5-6.8 5.8-.4Z" fill="white" stroke="#222" stroke-width="1.15" stroke-linejoin="round"/></svg>';
const ibeam = '<svg viewBox="0 0 18 24"><path d="M5 3h8M9 3v18M5 21h8" fill="none" stroke="white" stroke-width="3"/><path d="M5 3h8M9 3v18M5 21h8" fill="none" stroke="#222" stroke-width="1.25"/></svg>';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let page;
const frames = [], checkpoints = [], errors = [];
let elapsed = 0, caption = '', stage = 'opening', pointer = { x: 1140, y: 660 };
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 856 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'zh-CN' });
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${url}/scripts/demo.html?scene=writing`);
  await expect(page.locator('#outline')).toBeVisible();
  await expect(page.locator('.formula-preview svg')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // Screenshot timing must not determine whether the insertion caret is visible.
  if (!await page.evaluate(() => CSS.supports('caret-animation', 'manual'))) {
    throw new Error('This recording requires a browser that supports a steady native caret');
  }
  await page.addStyleTag({ content: `
    #app{isolation:isolate;position:absolute;top:56px;left:0;width:100%;height:calc(100% - 56px)}
    .demo-vscode{top:56px}
    *{caret-animation:manual!important}
    .cm-cursorLayer,.cm-cursor{animation:none!important}
    #demo-pointer{position:fixed;left:0;top:0;width:18px;height:24px;z-index:2147483646;pointer-events:none;transform:translate(1140px,660px)}
    #demo-pointer svg{display:block;width:100%;height:100%}
    #demo-caption{position:fixed;inset:0 0 auto 0;height:56px;display:flex;align-items:center;justify-content:center;background:#142841;color:white;font:500 22px/1 'Microsoft YaHei','Segoe UI',sans-serif;z-index:2147483645;pointer-events:none}
    #demo-veil{position:fixed;inset:0;background:#f3f5f9;pointer-events:none;z-index:2147483647;opacity:1}
  ` });
  await page.evaluate(html => {
    for (const id of ['demo-caption', 'demo-pointer', 'demo-veil']) { const el = document.createElement('div'); el.id = id; document.body.append(el); }
    document.querySelector('#demo-pointer').innerHTML = html;
    // Count any document replacement after initial setup; the demo must never reset.
    window.demoDocumentResets = 0;
    const original = window.markdownLiveTest.setDocument;
    window.markdownLiveTest.setDocument = (...args) => { window.demoDocumentResets++; return original(...args); };
  }, arrow);
  const snap = async (duration = dt) => {
    const state = await page.evaluate(text => {
      document.querySelector('#demo-caption').textContent = text;
      return { scrollTop: document.querySelector('#canvas').scrollTop, outlineVisible: !document.querySelector('#outline').hidden };
    }, caption);
    const file = `frames/${String(frames.length).padStart(5, '0')}.png`;
    await page.screenshot({ path: path.join(output, file), type: 'png', caret: 'initial' });
    frames.push({ file, duration, at: Number(elapsed.toFixed(3)), caption, stage, pointer: { ...pointer }, ...state });
    elapsed += duration;
  };
  const hold = async seconds => { await page.waitForTimeout(70); await snap(Math.round(seconds * fps) / fps); };
  const move = async (target, seconds = .58, _kind = 'arrow', curve = true) => {
    const start = { ...pointer };
    const dx = target.x - start.x, dy = target.y - start.y, distance = Math.hypot(dx, dy);
    // Longer cross-panel moves get more time; the quintic curve peaks below 1600px/s.
    const n = Math.ceil(Math.max(seconds, distance / 850) * fps);
    for (let i = 1; i <= n; i++) {
      const t = ease(i / n), bend = curve ? Math.sin(Math.PI * t) * Math.min(9, distance * .02) : 0;
      pointer = { x: start.x + dx * t - (distance ? dy / distance * bend : 0), y: start.y + dy * t + (distance ? dx / distance * bend : 0) };
      await page.mouse.move(pointer.x, pointer.y);
      await page.locator('#demo-pointer').evaluate((el, { point, arrow, ibeam }) => {
        const target = document.elementFromPoint(point.x, point.y);
        const text = target?.isContentEditable || !!target?.closest('.cm-content');
        const kind = text ? 'text' : 'arrow';
        if (el.dataset.kind !== kind) { el.innerHTML = text ? ibeam : arrow; el.dataset.kind = kind; }
        el.style.transform = `translate(${point.x}px,${point.y}px)`;
      }, { point: pointer, arrow, ibeam });
      await snap();
    }
  };
  const center = async locator => { const b = await locator.boundingBox(); if (!b) throw new Error('Missing target'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const click = async (locator, seconds = .52, kind = 'arrow') => {
    await move(await center(locator), seconds, kind); await hold(.08);
    await page.mouse.down(); await snap(.06); await page.mouse.up(); await hold(.18);
  };
  const type = async text => {
    for (const [i, ch] of [...text].entries()) { await page.keyboard.insertText(ch); await snap(/[，。]/.test(ch) ? .16 : i % 3 === 0 ? .10 : .08); }
  };
  const checkpoint = async name => {
    const text = await page.evaluate(() => window.markdownLiveTest.getText());
    const resetCount = await page.evaluate(() => window.demoDocumentResets);
    if (resetCount) throw new Error('The continuous document was replaced');
    checkpoints.push({ name, at: Number(elapsed.toFixed(2)), frame: frames.length, text, resetCount });
    await writeFile(path.join(output, 'progress.json'), JSON.stringify({ name, seconds: elapsed, frames: frames.length }, null, 2));
    console.log(`${name}: ${frames.length} source frames, ${elapsed.toFixed(2)}s`);
  };
  const navigate = async (title, seconds = 1.1) => {
    const start = await page.locator('#canvas').evaluate(el => el.scrollTop);
    await move(await center(page.locator('#headings button').filter({ hasText: title })), .70);
    await hold(.08); await page.mouse.down(); await snap(.06); await page.mouse.up();
    const end = await page.getByRole('heading', { name: title, exact: true }).evaluate(el => {
      const canvas = document.querySelector('#canvas');
      return Math.max(0, Math.min(canvas.scrollHeight - canvas.clientHeight, canvas.scrollTop + el.getBoundingClientRect().top - canvas.getBoundingClientRect().top - 40));
    });
    // Retain the real click/selection, then present every position along the scroll.
    await page.locator('#canvas').evaluate((el, y) => el.scrollTop = y, start);
    for (let i = 1; i <= Math.round(seconds * fps); i++) {
      await page.locator('#canvas').evaluate((el, y) => el.scrollTop = y, start + (end - start) * ease(i / Math.round(seconds * fps)));
      await snap();
    }
    await hold(.28);
  };
  const fade = async (from, to, seconds) => {
    for (let i = 1; i <= Math.round(seconds * fps); i++) {
      await page.locator('#demo-veil').evaluate((el, opacity) => el.style.opacity = String(opacity), from + (to - from) * ease(i / Math.round(seconds * fps)));
      await snap();
    }
  };
  caption = '从 VS Code 源文件，打开 Markdown Live';
  await snap(.12); await fade(1, 0, .40); await hold(.65);
  await click(page.locator('#demo-open-live'), .68);
  await expect(page.locator('.demo-vscode')).toBeHidden();
  stage = 'writing'; caption = '直接在正文里写作，大纲始终可见'; await hold(.42);
  await click(page.locator('.markdown-content p').filter({ hasText: '用清晰的结构' }), .62, 'text');
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await hold(.18);
  await type('让灵感自然成文。'); await hold(.36);
  caption = '选中文字，让重点一眼可见';
  const selection = await page.locator('.markdown-content p').filter({ hasText: '让灵感自然成文' }).evaluate(el => {
    const range = document.createRange(); range.setStart(el.firstChild, 0); range.setEnd(el.firstChild, 3);
    const b = range.getBoundingClientRect(); return { start: { x: b.left + .2, y: b.top + b.height / 2 }, end: { x: b.right, y: b.top + b.height / 2 } };
  });
  await move(selection.start, .36, 'text'); await page.mouse.down(); await move(selection.end, .32, 'text', false); await page.mouse.up(); await hold(.20);
  await expect.poll(() => page.evaluate(() => window.getSelection().toString())).toBe('让灵感');
  await click(page.locator('#format-bar [data-action="bold"]'), .58);
  await expect(page.locator('.markdown-content strong').filter({ hasText: '让灵感' })).toBeVisible();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Control+s'); await hold(.50);
  await checkpoint('writing-complete');

  stage = 'math-diagram'; caption = '沿着大纲，继续整理公式与图表';
  await navigate('一个公式', 1.18);
  await click(page.getByRole('button', { name: '编辑公式', exact: true }), .56);
  const mathNode = page.locator('.special-node').filter({ has: page.getByRole('button', { name: '编辑公式', exact: true }) });
  const mathEditor = mathNode.locator('.special-editor');
  caption = '使用求和模板，即时查看公式';
  await move(await center(mathEditor.getByRole('combobox', { name: '插入模板' })), .44); await hold(.20);
  await mathEditor.getByRole('combobox', { name: '插入模板' }).selectOption({ label: '求和' });
  await expect(mathNode.locator('.katex')).toContainText('∑'); await hold(.75);
  await click(mathEditor.getByRole('button', { name: '完成', exact: true }), .60);
  caption = '继续向下，在同一篇笔记中编辑流程';
  await navigate('一个流程', .70);
  await click(page.getByRole('button', { name: '编辑 Mermaid 图表', exact: true }), .52);
  const diagramNode = page.locator('.special-node').filter({ has: page.getByRole('button', { name: '编辑 Mermaid 图表', exact: true }) });
  const diagramEditor = diagramNode.locator('.special-editor');
  caption = '切换时序图模板，清楚表达消息与回复';
  await move(await center(diagramEditor.getByRole('combobox', { name: '插入模板' })), .46); await hold(.20);
  await diagramEditor.getByRole('combobox', { name: '插入模板' }).selectOption({ label: '时序图' });
  await expect(diagramNode.locator('.formula-preview svg')).toContainText('Alice'); await hold(.85);
  await click(diagramEditor.getByRole('button', { name: '完成', exact: true }), .60);
  await page.keyboard.press('Control+s'); await hold(.40);
  await checkpoint('math-diagram-complete');

  stage = 'source'; caption = '回到阅读清单，细调当前段落';
  await navigate('02 · 整理资料', 1.08);
  const paragraph = page.locator('.markdown-content p').filter({ hasText: '需要精确排版时' });
  await click(paragraph, .58, 'text');
  await click(page.getByRole('button', { name: '编辑此段落源码', exact: true }), .32);
  await expect(page.locator('.source-panel')).toBeVisible();
  caption = '只展开这一段，周围内容保持可见';
  await click(page.locator('.source-panel .cm-content'), .46, 'text'); await page.keyboard.press('Control+End'); await hold(.16);
  await type(' **保留上下文**'); await hold(.50);
  await click(page.locator('.source-panel').getByRole('button', { name: '完成', exact: true }), .60);
  await expect(page.locator('.markdown-content strong').filter({ hasText: '保留上下文' })).toBeVisible();
  await page.keyboard.press('Control+s');
  caption = '写作、导航、源码修改，一气呵成';
  await move({ x: 1150, y: 696 }, .46); await hold(1.05);
  await checkpoint('source-complete');
  const finalText = checkpoints.at(-1).text;
  for (const expected of ['**让灵感**自然成文。', '\\sum_{i=1}^{n} x_i', 'sequenceDiagram', '**保留上下文**']) {
    if (!finalText.includes(expected)) throw new Error(`Lost earlier edit: ${expected}`);
  }
  stage = 'loop-fade'; await fade(0, 1, .46); await snap(.12);
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(path.join(output, 'capture.json'), JSON.stringify({ createdAt: new Date().toISOString(), continuous: true, pageLoads: 1, documentResets: 0, caret: 'steady-native', width: 1920, height: 1284, fps, seconds: Number(elapsed.toFixed(2)), order: [1, 3, 2], frames, checkpoints, finalText, errors }, null, 2) + '\n');
  console.log(`Complete: ${frames.length} PNG frames, ${elapsed.toFixed(2)}s, one continuous document.`);
} catch (error) {
  if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), stage, elapsed, frames: frames.length }, null, 2));
  throw error;
} finally { await browser.close(); }
