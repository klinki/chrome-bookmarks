import { test, expect } from '@playwright/test';
import { getMockData, setupChromeMock, setupAiMock } from './e2e-utils';
import { AppPage } from './app.po';

const { root, MOCK_BOOKMARKS_MAP } = getMockData();

test.beforeEach(async ({ page }) => {
    await setupChromeMock(page, root, MOCK_BOOKMARKS_MAP);
    await setupAiMock(page, {
        '101': ['technology', 'programming'],
        '102': ['development', 'web']
    });
    const appPage = new AppPage(page);
    await appPage.navigate();
});

async function expandFolder(page: any, title: string) {
    const treeView = page.locator('app-tree-view');
    const row = treeView.locator('.tree-row').filter({ has: page.locator('.tree-label', { hasText: new RegExp(`^${title}$`) }) }).first();
    const isExpanded = await row.evaluate((el: Element) => el.parentElement?.getAttribute('expanded') === 'true');
    if (!isExpanded) {
        await row.locator('.expand-icon').click();
    }
}

async function selectTreeFolder(page: any, title: string) {
    const treeView = page.locator('app-tree-view');
    const row = treeView.locator('.tree-row').filter({ has: page.locator('.tree-label', { hasText: new RegExp(`^${title}$`) }) }).first();
    await row.click();
}

test('Navigate to AI Settings Page', async ({ page }) => {
    // Click on settings link
    const settingsLink = page.locator('a.settings-link');
    await expect(settingsLink).toBeVisible();
    await settingsLink.click();

    // Navigate to AI settings via sidebar
    await page.locator('nav').getByText('AI Categorization').click();

    // Verify AI Settings page loads
    await expect(page.locator('h2').filter({ hasText: 'AI Categorization' })).toBeVisible();
});

test('Configure AI Endpoint and Model', async ({ page }) => {
    // Navigate to AI settings
    await page.locator('a.settings-link').click();
    await page.locator('nav').getByText('AI Categorization').click();

    // Wait for settings form
    await expect(page.locator('h2').filter({ hasText: 'AI Categorization' })).toBeVisible();

    // Fill in the form using input ids
    const baseUrlInput = page.locator('#baseUrl');
    await baseUrlInput.fill('http://localhost:11434/v1');

    const modelInput = page.locator('#model');
    await modelInput.fill('llama3:latest');

    // Save config button
    const saveButton = page.locator('button[type="submit"]').filter({ hasText: 'Save Configuration' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Verify save button becomes disabled after save
    await expect(saveButton).toBeDisabled();
});

test('AI Categorize Bookmark Applies Tags', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');

    const listView = page.locator('app-list-view');
    const bookmark = listView.getByText('Bookmark B1', { exact: true });
    await bookmark.click();

    // Wait for detail panel
    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText('Bookmark Details')).toBeVisible();

    // Click AI Categorize
    const aiButton = detail.locator('button.ai-btn');
    await aiButton.click();

    // Wait for categorization to complete
    await page.waitForTimeout(1000);

    // Verify tags are applied (mock returns 'technology', 'programming' for id 101)
    await expect(detail.locator('.tag-chip').filter({ hasText: 'technology' })).toBeVisible();
});
