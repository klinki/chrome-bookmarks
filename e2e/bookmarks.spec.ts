import { test, expect } from '@playwright/test';
import { getMockData, setupChromeMock } from './e2e-utils';
import { AppPage } from './app.po';

const { root, MOCK_BOOKMARKS_MAP } = getMockData();

test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    await setupChromeMock(page, root, MOCK_BOOKMARKS_MAP);
    const appPage = new AppPage(page);
    await appPage.navigate();
});

/**
 * Helper to expand a folder by its title in the Tree View
 */
async function expandFolder(page: any, title: string) {
    const treeView = page.locator('app-tree-view');
    const row = treeView.locator('.tree-row').filter({ hasText: title }).first();
    await row.locator('.expand-icon').click();
}

/**
 * Helper to select a folder item IN Tree View
 */
async function selectTreeFolder(page: any, title: string) {
    const treeView = page.locator('app-tree-view');
    const row = treeView.locator('.tree-row').filter({ hasText: title }).first();
    await row.click();
}

test('Tree View structure is correct and expands', async ({ page }) => {
    const treeView = page.locator('app-tree-view');
    try {
        await expect(treeView.getByText('Bookmarks Bar')).toBeVisible();
        await expect(treeView.getByText('Other Bookmarks')).toBeVisible();
    } catch (e) {
        console.log('FAIL: Tree View not correct');
        await page.screenshot({ path: 'failure-screenshot.png' });
        console.log(await page.content());
        throw e;
    }

    // Verify subfolders are NOT visible yet in tree
    await expect(treeView.getByText('Only Bookmarks')).not.toBeVisible();

    await expandFolder(page, 'Bookmarks Bar');

    // Now they should be visible in tree
    await expect(treeView.getByText('Only Bookmarks')).toBeVisible();
    await expect(treeView.getByText('Only Subfolders')).toBeVisible();
    await expect(treeView.getByText('Mixed Content')).toBeVisible();
});

test('Folder with only bookmarks', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');
    
    const listView = page.locator('app-list-view');
    await expect(listView.getByText('Bookmark B1', { exact: true })).toBeVisible();
    await expect(listView.getByText('Bookmark B2', { exact: true })).toBeVisible();
    await expect(listView.locator('.tree-label')).toHaveCount(0); 
});

test('Folder with only subfolders', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Subfolders');
    
    const listView = page.locator('app-list-view');
    await expect(listView.getByText('Subfolder S1', { exact: true })).toBeVisible();
    await expect(listView.getByText('Subfolder S2', { exact: true })).toBeVisible();
    await expect(listView.locator('.tree-label')).toHaveCount(2);
});

test('Folder with mixed content', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Mixed Content');
    
    const listView = page.locator('app-list-view');
    await expect(listView.getByText('Bookmark M1', { exact: true })).toBeVisible();
    await expect(listView.getByText('Subfolder M2', { exact: true })).toBeVisible();
    await expect(listView.locator('.tree-label')).toHaveCount(1);
});

test('Selection: Single bookmark', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');
    await page.locator('app-list-view').getByText('Bookmark B1', { exact: true }).click();
    
    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText('Bookmark Details')).toBeVisible();
    await expect(detail.locator('input[name="title"]')).toHaveValue('Bookmark B1');
});

test('Selection: Single folder', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Subfolders');
    await page.locator('app-list-view').getByText('Subfolder S1', { exact: true }).click();
    
    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText('Folder Details')).toBeVisible();
    await expect(detail.getByText('Name: Subfolder S1')).toBeVisible();
});

test('Selection: Multiple folders', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Subfolders');
    
    const s1 = page.locator('app-list-view').getByText('Subfolder S1', { exact: true });
    const s2 = page.locator('app-list-view').getByText('Subfolder S2', { exact: true });
    
    await s1.click();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await s2.click();
    await page.keyboard.up(modifier);
    
    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText(/Selected 2 items/)).toBeVisible(); 
});

test('Selection: Multiple bookmarks', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');
    
    const b1 = page.locator('app-list-view').getByText('Bookmark B1', { exact: true });
    const b2 = page.locator('app-list-view').getByText('Bookmark B2', { exact: true });
    
    await b1.click();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await b2.click();
    await page.keyboard.up(modifier);
    
    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText('Selected 2 bookmarks')).toBeVisible();
});

test('Selection: Mixed folder and bookmark', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Mixed Content');
    
    const m1 = page.locator('app-list-view').getByText('Bookmark M1', { exact: true });
    const m2 = page.locator('app-list-view').getByText('Subfolder M2', { exact: true });
    
    await m1.click();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await m2.click();
    await page.keyboard.up(modifier);
    
    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText(/Selected 2 items/)).toBeVisible();
});

test('Search functionality finds items across folders and types', async ({ page }) => {
    const searchBox = page.locator('app-search-box input');
    await searchBox.fill('Duplicate Item');
    
    // Wait for the debounce time (300ms) + some buffer for rendering
    await page.waitForTimeout(600);
    
    const listView = page.locator('app-list-view');
    
    // Check for search results in the table body
    const items = listView.locator('tbody tr');
    await expect(items).toHaveCount(4);
    
    await expect(listView.getByText('Duplicate Item 1', { exact: true })).toHaveCount(2);
    await expect(listView.getByText('Duplicate Item 2', { exact: true })).toHaveCount(1);
    await expect(listView.getByText('Duplicate Item Folder 1', { exact: true })).toHaveCount(1);
    
    // In search result list, folders should still have the tree-label span (as per list-view.component.html)
    const folderRow = listView.locator('tr', { hasText: 'Duplicate Item Folder 1' });
    await expect(folderRow.locator('.tree-label')).toBeVisible();
    
    // Verify selection works from search results
    await listView.getByText('Duplicate Item 1', { exact: true }).first().click();
    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText('Bookmark Details')).toBeVisible();
    await expect(detail.locator('input[name="title"]')).toHaveValue('Duplicate Item 1');
});
