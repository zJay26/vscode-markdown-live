import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const figure = `data:image/png;base64,${readFileSync('media/markdown-live-icon.png').toString('base64')}`;

async function text(page: Page) { return page.evaluate(() => window.markdownLiveTest.getText()); }
async function setDocument(page: Page, source: string) {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Markdown 可视化编辑区' })).toBeVisible();
  await page.evaluate(source => window.markdownLiveTest.setDocument(source), source);
  await expect.poll(() => text(page)).toBe(source);
}

test('Pandoc figure and caption render, edit, undo and reopen without losing markers', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const original = `# Pandoc 图文\n\n::: {custom-style="Figure"}\n![示例图](${figure})\n:::\n\n::: {custom-style="Caption"}\n图 34 | 示例图注\n:::\n\n<!-- 保留原文 -->\n`;
  await setDocument(page, original);
  const editor = page.locator('.markdown-content');
  const caption = editor.locator('[data-custom-style="Caption"]');
  await expect(editor.getByRole('img', { name: '示例图' })).toBeVisible();
  await expect.poll(() => editor.getByRole('img', { name: '示例图' }).evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(caption).toHaveText('图 34 | 示例图注');
  await expect(editor).not.toContainText(':::');
  await expect(editor).not.toContainText('custom-style');
  await caption.locator('p').click();
  await page.keyboard.press('End');
  await page.keyboard.insertText('，已修改');
  const changed = original.replace('示例图注', '示例图注，已修改');
  await expect.poll(() => text(page)).toBe(changed);
  await page.keyboard.press('Control+z');
  await expect.poll(() => text(page)).toBe(original);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => text(page)).toBe(changed);
  await page.evaluate(source => window.markdownLiveTest.setDocument(source), changed);
  await expect(caption).toHaveText('图 34 | 示例图注，已修改');
  await page.screenshot({ path: 'artifacts/pandoc-div-rendering.png' });
  expect(errors).toEqual([]);
});

test('local source includes full Div and round-trips edits back to its rendered content', async ({ page }) => {
  const original = 'before\n\n::: {custom-style="Caption"}\n图注\n:::\n\nafter\n';
  await setDocument(page, original);
  await page.locator('[data-custom-style="Caption"] p').click();
  await page.getByRole('button', { name: '段落源码', exact: true }).click();
  const code = page.locator('.source-panel .cm-content');
  await expect(code).toContainText('::: {custom-style="Caption"}');
  expect(await text(page)).toBe(original);
  await code.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('::: {custom-style="Caption"}\n**新图注**\n:::');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('[data-custom-style="Caption"] strong')).toHaveText('新图注');
  await expect.poll(() => text(page)).toBe(original.replace('图注', '**新图注**'));
});

test('split and merge caption paragraphs retain both fences and neighboring content', async ({ page }) => {
  await setDocument(page, 'before\n\n::: {custom-style="Caption"}\nhelloworld\n:::\n\nafter\n');
  const caption = page.locator('[data-custom-style="Caption"]');
  await caption.locator('p').click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(caption.locator('p')).toHaveCount(2);
  await expect.poll(() => text(page)).toBe('before\n\n::: {custom-style="Caption"}\nhello\n\nworld\n:::\n\nafter\n');
  await page.keyboard.press('Backspace');
  await expect(caption.locator('p')).toHaveCount(1);
  await expect.poll(() => text(page)).toContain('::: {custom-style="Caption"}\n');
  await expect.poll(() => text(page)).toContain('\n:::\n\nafter\n');
});

test('code samples remain visible and unknown style attributes never become active HTML', async ({ page }) => {
  const original = '::: {custom-style="Unknown" onclick="alert(1)" style="display:none"}\nvisible\n:::\n\n```md\n::: {custom-style="Caption"}\nsample\n:::\n```\n';
  await setDocument(page, original);
  const container = page.locator('[data-custom-style="Unknown"]');
  await expect(container).toHaveText('visible');
  await expect(container).not.toHaveAttribute('onclick');
  await expect(container).not.toHaveAttribute('style');
  await expect(page.locator('.code-block')).toContainText('::: {custom-style="Caption"}');
  expect(await text(page)).toBe(original);
});
