import { defineConfig, devices } from '@playwright/test';

const slowMo = Number(process.env['PLAYWRIGHT_SLOW_MO'] ?? 0);

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env['CI'],
    retries: process.env['CI'] ? 2 : 0,
    workers: process.env['CI'] ? 1 : undefined,
    reporter: [['html'], ['junit', { outputFile: 'test-results/e2e-junit.xml' }]],
    outputDir: '.temp/test-results',
    use: {
        baseURL: 'http://localhost:4200',
        trace: 'on-first-retry',
        headless: true,
        launchOptions: { slowMo },
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm start',
        url: 'http://localhost:4200',
        reuseExistingServer: !process.env['CI'],
    },
});
