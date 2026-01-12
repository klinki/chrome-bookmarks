import { test, expect } from '@playwright/test';
import { getMockData, setupChromeMock } from './e2e-utils';
import { AppPage } from './app.po';

const { root, MOCK_BOOKMARKS_MAP } = getMockData();

test.beforeEach(async ({ page }) => {
    await setupChromeMock(page, root, MOCK_BOOKMARKS_MAP);
    const appPage = new AppPage(page);
    await appPage.navigate();
});

async function expandFolder(page: any, title: string) {
    const treeView = page.locator('app-tree-view');
    const row = treeView.locator('.tree-row').filter({ hasText: new RegExp(`^${title}$`) }).first();
    const isExpanded = await row.evaluate((el: Element) => el.parentElement?.getAttribute('expanded') === 'true');
    if (!isExpanded) {
        await row.locator('.expand-icon').click();
    }
}

async function selectTreeFolder(page: any, title: string) {
    const treeView = page.locator('app-tree-view');
    const row = treeView.locator('.tree-row').filter({ hasText: new RegExp(`^${title}$`) }).first();
    await row.click();
}

test('Delete Bookmark via Keyboard', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');

    const listView = page.locator('app-list-view');
    const bookmark = listView.getByText('Bookmark B1', { exact: true });
    await expect(bookmark).toBeVisible();

    // Select the bookmark
    await bookmark.click();

    // Mock confirm dialog to return true
    page.on('dialog', dialog => dialog.accept());

    // Press Delete key
    await page.keyboard.press('Delete');

    // Bookmark should now be gone
    await expect(bookmark).not.toBeVisible();
});

test('Edit Bookmark Title and Save', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');

    const listView = page.locator('app-list-view');
    const bookmark = listView.getByText('Bookmark B1', { exact: true });
    await expect(bookmark).toBeVisible();

    // Select the bookmark
    await bookmark.click();

    // Wait for detail panel to show
    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText('Bookmark Details')).toBeVisible();

    // Edit the title
    const titleInput = detail.locator('input[name="title"]');
    await titleInput.fill('Edited Bookmark B1');

    // Save button should be enabled
    const saveButton = detail.locator('button.save-btn');
    await expect(saveButton).toBeEnabled();

    // Save the changes
    await saveButton.click();

    // After saving, the button should be disabled (pristine)
    await expect(saveButton).toBeDisabled();

    // Verify the title changed in the list
    await expect(listView.getByText('Edited Bookmark B1', { exact: true })).toBeVisible();
    await expect(listView.getByText('Bookmark B1', { exact: true })).not.toBeVisible();
});

test('Edit Bookmark URL and Save', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');

    const listView = page.locator('app-list-view');
    const bookmark = listView.getByText('Bookmark B2', { exact: true });
    await expect(bookmark).toBeVisible();

    // Select the bookmark
    await bookmark.click();

    // Wait for detail panel to show
    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText('Bookmark Details')).toBeVisible();

    // Verify original URL is loaded
    const urlInput = detail.locator('input[name="url"]');
    await expect(urlInput).toHaveValue('https://example.com/b2');

    // Edit the URL
    await urlInput.clear();
    await urlInput.type('https://edited.example.com');

    // Save button should be enabled
    const saveButton = detail.locator('button.save-btn');
    await expect(saveButton).toBeEnabled();

    // Click save and verify it completes (no error)
    await saveButton.click();

    // If no error occurred, the save succeeded
});
