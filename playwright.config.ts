import { defineConfig, devices } from '@playwright/test';

// E2E chạy trên bản build (giống bản người chơi nhận). Đặt E2E_BASE_URL để dùng server có sẵn;
// không đặt thì tự chạy `vite preview` (cần `npm run build` trước).
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort', url: baseURL, reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
    // WebKit của Playwright gần Safari nhưng KHÔNG thay được test trên iPhone thật (xem docs/TESTING.md).
    { name: 'iphone-webkit', use: { ...devices['iPhone SE'] } },
  ],
});
