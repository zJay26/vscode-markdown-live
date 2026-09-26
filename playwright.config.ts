import { defineConfig } from '@playwright/test';
const port = Number(process.env.MARKDOWN_LIVE_TEST_PORT ?? 4186);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid MARKDOWN_LIVE_TEST_PORT');
const url = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/browser', timeout: 45000, workers: 1,
  reporter: [['list'], ['json', { outputFile: 'artifacts/playwright-report.json' }]],
  use: { baseURL: url, headless: true, viewport: { width: 1280, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure', channel: 'msedge' },
  // Never run the editor suite against an unrelated app already using this port.
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url, reuseExistingServer: false, timeout: 60000 },
});
