import { test, expect, type Page } from '@playwright/test';

async function setDocument(page: Page, text: string) {
  await page.evaluate(text => window.markdownLiveTest.setDocument(text), text);
  await expect.poll(() => page.evaluate(() => window.markdownLiveTest.getText())).toBe(text);
}
async function wheel(page: Page, deltaY: number, ctrl = true) {
  if (ctrl) await page.keyboard.down('Control');
  await page.mouse.wheel(0, deltaY);
  if (ctrl) await page.keyboard.up('Control');
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.markdown-content')).toBeVisible();
});

test('Ctrl+wheel scales content together, leaves tools and Markdown unchanged, and resets', async ({ page }) => {
  const text = '# Zoom\n\nA paragraph with $x^2$.\n\n![pixel](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6P6sAAAAASUVORK5CYII=)\n';
  await setDocument(page, text);
  await expect(page.locator('.katex')).toBeVisible();
  await page.locator('.image-node img').evaluate((image: HTMLImageElement) => image.decode());
  const sizes = () => page.evaluate(() => ['h1', '.katex', '.image-node img', '.toolbar', '#format-bar'].map(selector => document.querySelector(selector)!.getBoundingClientRect().height));
  const before = await sizes();
  await page.locator('.markdown-content h1').hover(); await wheel(page, -100);
  await expect(page.locator('#content-zoom')).toHaveText('110%');
  const after = await sizes();
  for (let index = 0; index < 3; index++) expect(after[index] / before[index]).toBeCloseTo(1.1, 1);
  expect(after.slice(3)).toEqual(before.slice(3));
  expect(await page.evaluate(() => window.markdownLiveTest.getText())).toBe(text);
  await wheel(page, 100); await expect(page.locator('#content-zoom')).toHaveText('100%');
  await wheel(page, -200); await expect(page.locator('#content-zoom')).toHaveText('120%');
  await page.getByRole('button', { name: '内容缩放 120%，点击恢复 100%', exact: true }).click();
  await expect(page.locator('#editor')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  expect(await page.evaluate(() => window.markdownLiveTest.getText())).toBe(text);
});

test('ordinary wheel scrolls, Ctrl+wheel stays anchored, bounds and delta modes work', async ({ page }) => {
  await setDocument(page, Array.from({ length: 80 }, (_, index) => `## Heading ${index}\n\nParagraph ${index}.\n`).join('\n'));
  await page.locator('.markdown-content p').first().hover(); await wheel(page, 300, false);
  await expect.poll(() => page.locator('#canvas').evaluate(element => element.scrollTop)).toBeGreaterThan(100);
  await expect(page.locator('#content-zoom')).toHaveText('100%');
  const paragraph = page.locator('.markdown-content p').nth(30);
  await paragraph.scrollIntoViewIfNeeded(); await paragraph.hover();
  const before = (await paragraph.boundingBox())!;
  await wheel(page, -100); await expect(page.locator('#content-zoom')).toHaveText('110%');
  const after = (await paragraph.boundingBox())!;
  expect(Math.abs(after.y + after.height / 2 - before.y - before.height / 2)).toBeLessThan(3);
  await page.locator('#canvas').dispatchEvent('wheel', { ctrlKey: true, deltaY: -10000 });
  await expect(page.locator('#content-zoom')).toHaveText('200%');
  await page.locator('#canvas').dispatchEvent('wheel', { ctrlKey: true, deltaY: 10000 });
  await expect(page.locator('#content-zoom')).toHaveText('50%');
  const layout = await page.locator('#canvas').evaluate(canvas => {
    const viewport = document.querySelector<HTMLElement>('#editor-viewport')!;
    return { scrollHeight: canvas.scrollHeight, contentEnd: viewport.offsetTop + viewport.offsetHeight + parseFloat(getComputedStyle(canvas).paddingBottom), scrollWidth: canvas.scrollWidth, width: canvas.clientWidth };
  });
  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.contentEnd + 2);
  expect(layout.scrollWidth).toBe(layout.width);
  await page.locator('#canvas').dispatchEvent('wheel', { ctrlKey: true, deltaY: -3, deltaMode: 1 });
  await expect(page.locator('#content-zoom')).toHaveText('60%');
  await page.locator('#canvas').dispatchEvent('wheel', { ctrlKey: true, deltaY: 1, deltaMode: 2 });
  await expect(page.locator('#content-zoom')).toHaveText('50%');
  // Small trackpad deltas accumulate; horizontal and unmodified gestures do not zoom.
  for (let index = 0; index < 4; index++) await page.locator('#canvas').dispatchEvent('wheel', { ctrlKey: true, deltaY: -25 });
  await expect(page.locator('#content-zoom')).toHaveText('60%');
  await page.locator('#canvas').dispatchEvent('wheel', { ctrlKey: true, deltaX: 100, deltaY: 0 });
  await page.locator('.toolbar').dispatchEvent('wheel', { ctrlKey: true, deltaY: -100 });
  await expect(page.locator('#content-zoom')).toHaveText('60%');
});

test('selection formatting and local source editing still hit the right text while zoomed', async ({ page }) => {
  await setDocument(page, 'hello\n\n<!-- keep -->\n');
  await page.locator('.markdown-content p').click(); await page.keyboard.press('Home'); await page.keyboard.press('Shift+End');
  await page.locator('.markdown-content p').hover(); await wheel(page, -500);
  await expect(page.locator('#content-zoom')).toHaveText('150%');
  await page.locator('#format-bar').getByRole('button', { name: '粗体', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.markdownLiveTest.getText())).toBe('**hello**\n\n<!-- keep -->\n');
  await page.getByRole('button', { name: '段落源码', exact: true }).click();
  const code = page.locator('.source-panel .cm-content');
  await code.click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('changed **source**');
  await code.hover(); await wheel(page, -100);
  await expect(page.locator('#content-zoom')).toHaveText('160%');
  await expect(code).toContainText('changed **source**');
  await page.keyboard.press('Escape');
  await expect(page.locator('.markdown-content strong')).toHaveText('source');
  expect(await page.evaluate(() => window.markdownLiveTest.getText())).toBe('changed **source**\n\n<!-- keep -->\n');
});

test('webview reload restores zoom with other preferences without edits or dirty state', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).sentMessages = [];
    window.acquireVsCodeApi = () => ({
      getState: () => JSON.parse(sessionStorage.getItem('view-state') ?? 'null'),
      setState: value => sessionStorage.setItem('view-state', JSON.stringify(value)),
      postMessage: message => {
        (window as any).sentMessages.push(message);
        if (message.type === 'ready') queueMicrotask(() => window.postMessage({ type: 'document', text: '# Saved\n\n' + 'text\n\n'.repeat(80), version: 1, dirty: false, name: 'zoom.md', settings: { fontSize: 16, lineHeight: 1.7, contentWidth: 900, assetsDirectory: 'assets' } }, '*'));
      },
    });
  });
  await page.reload(); await expect(page.locator('#sync-state')).toHaveText('已保存');
  await page.locator('.markdown-content p').first().hover(); await wheel(page, -500);
  await page.getByRole('button', { name: '大纲', exact: true }).click();
  await page.getByRole('button', { name: '专注', exact: true }).click();
  await expect(page.locator('#content-zoom')).toHaveText('150%');
  await page.reload();
  await expect(page.locator('#content-zoom')).toHaveText('150%');
  await expect(page.locator('#editor')).toHaveCSS('transform', 'matrix(1.5, 0, 0, 1.5, 0, 0)');
  await expect(page.locator('#format-bar')).toBeHidden();
  await expect(page.locator('#sync-state')).toHaveText('已保存');
  await page.getByRole('button', { name: '退出专注', exact: true }).click();
  await expect(page.locator('#outline')).toBeVisible();
  await page.locator('#canvas').evaluate(element => { element.scrollTop = 1200; });
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('view-state')!).scroll)).toBe(1200);
  await page.reload(); await expect(page.locator('#content-zoom')).toHaveText('150%');
  await expect.poll(() => page.locator('#canvas').evaluate(element => element.scrollTop)).toBe(1200);
  await page.locator('#canvas').evaluate(element => { element.scrollTop = 0; });
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('view-state')!).scroll)).toBe(0);
  await page.reload(); await expect(page.locator('#content-zoom')).toHaveText('150%');
  await expect.poll(() => page.locator('#canvas').evaluate(element => element.scrollTop)).toBe(0);
  expect(await page.evaluate(() => (window as any).sentMessages.filter((message: any) => ['edit', 'save'].includes(message.type)))).toEqual([]);
});

test('narrow windows keep the document and reset control reachable at maximum zoom', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await setDocument(page, '# Narrow\n\nReadable paragraph.\n');
  await page.locator('.markdown-content p').hover(); await wheel(page, -1000);
  await expect(page.locator('#content-zoom')).toHaveText('200%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await expect(page.locator('.markdown-content p')).toBeVisible();
  await page.locator('#content-zoom').click();
  await expect(page.locator('#content-zoom')).toHaveText('100%');
});

for (const zoom of [50, 100, 150, 200]) test(`rapid arrow keys and paragraph splitting use the current caret at ${zoom}%`, async ({ page }) => {
  const text = 'first\n\nsecond\n\n<!-- keep -->\n';
  await setDocument(page, text);
  await page.locator('.markdown-content p').first().hover();
  if (zoom !== 100) await wheel(page, (100 - zoom) * 10);
  await expect(page.locator('#content-zoom')).toHaveText(`${zoom}%`);
  await page.locator('.markdown-content p').first().click();
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.markdownLiveTest.getText())).toBe('fi\n\nrst\n\nsecond\n\n<!-- keep -->\n');
  await page.keyboard.press('Backspace');
  await expect.poll(() => page.evaluate(() => window.markdownLiveTest.getText())).toBe(text);
});
