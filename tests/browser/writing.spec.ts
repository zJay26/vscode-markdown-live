import { test, expect, type Page } from '@playwright/test';

async function setDocument(page: Page, text: string) {
  await page.evaluate(text => window.markdownLiveTest.setDocument(text), text);
  await expect.poll(() => page.evaluate(() => window.markdownLiveTest.getText())).toBe(text);
}
const currentText = (page: Page) => page.evaluate(() => window.markdownLiveTest.getText());
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Markdown 可视化编辑区' })).toBeVisible();
});

test('formatting toolbar preserves selection and supports six heading levels', async ({ page }) => {
  await setDocument(page, 'hello\n\n<!-- keep -->\n');
  await page.locator('.markdown-content p').click();
  await page.keyboard.press('Home'); await page.keyboard.press('Shift+End');
  await page.locator('#format-bar').getByRole('button', { name: '粗体', exact: true }).click();
  await expect.poll(() => currentText(page)).toBe('**hello**\n\n<!-- keep -->\n');
  await expect(page.locator('#format-bar [data-action="bold"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('段落样式', { exact: true }).selectOption('h4');
  await expect(page.locator('.markdown-content h4')).toHaveText('hello');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.locator('.markdown-content p')).toHaveText('hello');
  expect(await currentText(page)).toContain('<!-- keep -->');
});

test('case and whole word controls refresh counts and replacement targets', async ({ page }) => {
  await setDocument(page, 'cat Cat scatter cat_ cat\n');
  await page.getByRole('button', { name: '查找', exact: true }).click();
  await page.getByRole('textbox', { name: '查找全文' }).fill('cat');
  await expect(page.locator('#match-count')).toHaveText('5 处');
  await page.getByRole('button', { name: '全字匹配', exact: true }).click();
  await expect(page.locator('#match-count')).toHaveText('3 处');
  await page.getByRole('button', { name: '区分大小写', exact: true }).click();
  await expect(page.locator('#match-count')).toHaveText('2 处');
  await page.getByRole('button', { name: '上一个匹配', exact: true }).click();
  await expect(page.locator('#match-count')).toHaveText('2 / 2');
  await page.getByRole('textbox', { name: '替换为', exact: true }).fill('dog');
  await page.getByRole('button', { name: '全部替换', exact: true }).click();
  expect(await currentText(page)).toBe('dog Cat scatter cat_ dog\n');
  await expect(page.getByRole('button', { name: '替换', exact: true })).toBeDisabled();
});

test('match count stays current when the document changes', async ({ page }) => {
  await setDocument(page, 'same\n');
  await page.getByRole('button', { name: '查找', exact: true }).click();
  await page.getByRole('textbox', { name: '查找全文' }).fill('same');
  await page.locator('.markdown-content p').click(); await page.keyboard.press('End'); await page.keyboard.insertText(' same');
  await expect(page.locator('#match-count')).toHaveText('2 处');
  await page.keyboard.press('Escape'); await expect(page.locator('#find-bar')).toBeHidden();
});

test('outline filtering and focus mode do not change source', async ({ page }) => {
  const text = '# First\n\ntext\n\n## Second\n\n- [x] done\n- [ ] todo\n';
  await setDocument(page, text);
  await page.getByRole('button', { name: '大纲', exact: true }).click();
  await page.getByRole('searchbox', { name: '筛选章节' }).fill('second');
  await expect(page.locator('#headings button')).toHaveCount(1);
  await page.locator('#headings button').click();
  await expect(page.getByLabel('段落样式', { exact: true })).toHaveValue('h2');
  await page.keyboard.press('Control+Shift+f');
  await expect(page.locator('#format-bar')).toBeHidden(); await expect(page.locator('#outline')).toBeHidden();
  await expect(page.getByRole('button', { name: '退出专注', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#format-bar')).toBeVisible(); await expect(page.locator('#outline')).toBeVisible();
  await expect(page.locator('#document-stats')).toContainText('1/2 任务');
  expect(await currentText(page)).toBe(text);
});

test('source editing retains draft and view preferences together', async ({ page }) => {
  await setDocument(page, '# Section\n\nparagraph\n');
  await page.getByRole('button', { name: '大纲', exact: true }).click();
  await page.locator('.markdown-content p').click();
  await page.getByRole('button', { name: '段落源码', exact: true }).click();
  await expect(page.locator('.source-panel .cm-lineNumbers')).toBeVisible();
  await page.locator('.source-panel .cm-content').click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('**changed**');
  await page.keyboard.press('Escape');
  await expect(page.locator('.markdown-content strong')).toHaveText('changed');
  await expect(page.locator('#outline')).toBeVisible();
  expect(await currentText(page)).toBe('# Section\n\n**changed**\n');
});

test('copy code and Markdown use exact source without modifying the document', async ({ page }) => {
  const text = '# Code\n\n```js\nconst a = 1;\n```\n';
  await setDocument(page, text);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as any).copiedText = text; } } }));
  await page.getByRole('button', { name: '复制代码', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).copiedText)).toBe('const a = 1;');
  await page.getByRole('button', { name: '复制 Markdown', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).copiedText)).toBe(text);
  expect(await currentText(page)).toBe(text);
});

test('empty links and required image forms can be cancelled without errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await setDocument(page, 'text\n');
  await page.locator('.markdown-content p').click(); await page.keyboard.press('End'); await page.keyboard.press('Control+k');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('button', { name: '＋ 插入', exact: true }).click();
  await page.getByRole('menuitem', { name: '图片' }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('#form-dialog')).toBeHidden();
  expect(errors).toEqual([]); expect(await currentText(page)).toBe('text\n');
});

test('keyboard help and empty document affordance remain accessible', async ({ page }) => {
  await setDocument(page, ''); await expect(page.locator('#empty-hint')).toBeVisible();
  await page.getByRole('button', { name: '快捷键帮助', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '写作快捷键' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#help-dialog')).toBeHidden();
  await page.locator('.markdown-content p').click(); await page.keyboard.insertText('start');
  await expect(page.locator('#empty-hint')).toBeHidden();
});

test('preview undo remains persisted after reload', async ({ page }) => {
  await setDocument(page, 'original\n');
  await page.locator('.markdown-content p').click(); await page.keyboard.press('End'); await page.keyboard.insertText(' updated');
  await page.keyboard.press('Control+z'); await expect.poll(() => currentText(page)).toBe('original\n');
  await page.reload(); await expect(page.locator('.markdown-content')).toHaveText('original');
});

test('360px layout, find controls and outline navigation remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await setDocument(page, '# Compact\n\nA short document.\n\n## Details\n\nMore text.\n');
  await page.getByRole('button', { name: '大纲', exact: true }).click();
  await page.locator('#headings').getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.locator('#outline')).toBeHidden();
  await page.getByRole('button', { name: '查找', exact: true }).click();
  await page.getByRole('textbox', { name: '查找全文' }).fill('text');
  await expect(page.locator('#match-count')).toHaveText('1 处');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.screenshot({ path: 'artifacts/editor-narrow.png' });
});

async function delayedHost(page: Page, draft?: string) {
  await page.addInitScript(({ draft }) => {
    const initial = { draft: draft ?? 'first\n', base: 'first\n', version: 1, ui: { outline: false, focus: false } };
    (window as any).savedViewState = initial;
    window.acquireVsCodeApi = () => ({
      getState: () => (window as any).savedViewState,
      setState: value => { (window as any).savedViewState = structuredClone(value); },
      postMessage: message => {
        if (message.type === 'ready') queueMicrotask(() => window.postMessage({ type: 'document', text: 'first\n', version: 1, dirty: false, name: 'draft.md', settings: { fontSize: 16, lineHeight: 1.7, contentWidth: 900, assetsDirectory: 'assets' } }, '*'));
        // Deliberately leave edit requests pending to exercise reload recovery.
      },
    });
  }, { draft });
  await page.reload(); await expect(page.locator('.markdown-content')).toContainText('first');
}

test('edits made while awaiting the host are persisted with view preferences', async ({ page }) => {
  await delayedHost(page);
  await page.locator('.markdown-content p').click(); await page.keyboard.press('End');
  await page.keyboard.insertText(' one'); await page.keyboard.insertText(' two');
  await page.getByRole('button', { name: '大纲', exact: true }).click();
  const saved = await page.evaluate(() => (window as any).savedViewState);
  expect(saved).toMatchObject({ draft: 'first one two\n', base: 'first\n', ui: { outline: true } });
  await expect(page.locator('#sync-state')).toHaveText('同步中');
});

test('an unsynced empty draft is offered for recovery', async ({ page }) => {
  await delayedHost(page, '');
  await expect(page.locator('#conflict')).toBeVisible();
  await expect(page.locator('#conflict-reason')).toContainText('重载前未同步');
  expect(await page.evaluate(() => (window as any).savedViewState.draft)).toBe('');
});
