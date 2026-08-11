import { test, expect } from '@playwright/test';
import { getMockData, setupChromeMock, setupAiMock } from './e2e-utils';
import { AppPage } from './app.po';

const { root, MOCK_BOOKMARKS_MAP } = getMockData();

test.beforeEach(async ({ page }) => {
    await setupChromeMock(page, root, MOCK_BOOKMARKS_MAP, {
        // Enable allowNewTags so AI suggestions aren't filtered out
        aiConfig: {
            baseUrl: 'http://localhost:11434/v1',
            apiKey: '',
            model: 'llama3:8b',
            allowNewTags: true
        }
    });
    await setupAiMock(page, {
        '101': ['technology', 'programming'],
        '102': ['development', 'web']
    }, {
        '101': 4,
        '102': 2
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
    const aiButton = detail.getByRole('button', { name: 'AI Categorize', exact: true });
    await aiButton.click();

    // Wait for categorization to complete
    await page.waitForTimeout(1000);

    // Verify tags are applied (mock returns 'technology', 'programming' for id 101)
    await expect(detail.locator('.tag-chip').filter({ hasText: 'technology' })).toBeVisible();
});

test('AI usefulness rating uses the anchored rubric and updates the list', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');

    const listView = page.locator('app-list-view');
    const row = listView.locator('tbody tr').filter({ hasText: 'Bookmark B1' });
    await row.click();

    const detail = page.locator('app-bookmark-detail');
    const rating = detail.locator('#usefulness-score');
    await expect(rating.locator('option')).toHaveText([
        'Not rated',
        '1 — very low expected future value',
        '2 — limited, narrow, or easily replaceable value',
        '3 — useful in a specific situation',
        '4 — strong, reusable reference or tool',
        '5 — exceptional, distinctive, or repeatedly valuable'
    ]);

    await detail.getByRole('button', { name: 'AI Rate Usefulness' }).click();

    await expect(rating).toHaveValue('4');
    await expect(row.locator('td').nth(3)).toHaveText('4');
});

test('AI Categorize with allowNewTags=false only applies existing tags', async ({ page, context }) => {
    // Create a new page with different config for this test
    const newPage = await context.newPage();

    // Setup with allowNewTags=false and only 'technology' as available tag
    await setupChromeMock(newPage, root, MOCK_BOOKMARKS_MAP, {
        aiConfig: {
            baseUrl: 'http://localhost:11434/v1',
            apiKey: '',
            model: 'llama3:8b',
            allowNewTags: false
        },
        // Pre-populate only 'technology' as available tag
        availableTags: ['technology']
    });
    await setupAiMock(newPage, {
        '101': ['technology', 'programming'],  // AI suggests both, but only 'technology' should be applied
        '102': ['development', 'web']
    });

    const appPage = new AppPage(newPage);
    await appPage.navigate();

    await expandFolder(newPage, 'Bookmarks Bar');
    await selectTreeFolder(newPage, 'Only Bookmarks');

    const listView = newPage.locator('app-list-view');
    const bookmark = listView.getByText('Bookmark B1', { exact: true });
    await bookmark.click();

    // Wait for detail panel
    const detail = newPage.locator('app-bookmark-detail');
    await expect(detail.getByText('Bookmark Details')).toBeVisible();

    // Click AI Categorize
    const aiButton = detail.getByRole('button', { name: 'AI Categorize', exact: true });
    await aiButton.click();

    // Wait for categorization to complete
    await newPage.waitForTimeout(1000);

    // Verify only 'technology' tag is applied (it was in availableTags)
    await expect(detail.locator('.tag-chip').filter({ hasText: 'technology' })).toBeVisible();

    // Verify 'programming' tag is NOT applied (it was not in availableTags)
    await expect(detail.locator('.tag-chip').filter({ hasText: 'programming' })).not.toBeVisible();

    await newPage.close();
});


test('Model discovery dialog traps focus and restores the trigger', async ({ page }) => {
    await page.locator('a.settings-link').click();
    await page.locator('nav').getByText('AI Categorization').click();

    const trigger = page.getByRole('button', { name: 'Discover local models' });
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Discover Local Models' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close model discovery' })).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(dialog.locator(':focus')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
});
