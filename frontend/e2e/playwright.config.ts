import { defineConfig, devices } from '@playwright/test';

const IS_CI = !!process.env['CI'];
const ALL_BROWSERS = !!process.env['ALL_BROWSERS'];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 1,
  workers: IS_CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: '../../coverage/e2e', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  // Default: Chromium only (fast, matches CI).
  // Cross-browser: ALL_BROWSERS=true npx playwright test
  // Single browser: npx playwright test --project=firefox
  projects: ALL_BROWSERS
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
      ]
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    cwd: '..',
    url: 'http://localhost:4200',
    reuseExistingServer: !IS_CI,
    timeout: 120_000,
  },
});
