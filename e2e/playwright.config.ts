import { defineConfig, devices } from '@playwright/test';

const IS_CI = !!process.env['CI'];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: '../coverage/e2e', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  // Run all 4 browsers locally; only Chromium in CI for speed
  projects: IS_CI
    ? [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
      ],
  webServer: {
    command: 'npm start',
    cwd: '../frontend',
    url: 'http://localhost:4200',
    reuseExistingServer: !IS_CI,
    timeout: 120_000,
  },
});
