import { test, expect } from '@playwright/test';
import { getMockData, setupChromeMock } from './e2e-utils';

const { root } = getMockData();
const initialStorage = {
    availableTags: ['test-tag'],
    bookmarkTags: {}
};

test.beforeEach(async ({ page }) => {
    await setupChromeMock(page, root, initialStorage);
    await page.goto('/');
});

/**
 * Helper to expand a folder by its title in the Tree View
 */
async function expandFolder(page: any, title: string) {
    const treeView = page.locator('app-tree-view');
    const row = treeView.locator('.tree-row').filter({ hasText: new RegExp(`^${title}$`) });
    await row.locator('.expand-icon').click();
}

/**
 * Helper to select a folder item IN Tree View
 */
async function selectTreeFolder(page: any, title: string) {
    const treeView = page.locator('app-tree-view');
    const row = treeView.locator('.tree-row').filter({ hasText: new RegExp(`^${title}$`) });
    await row.click();
}

test('Move Bookmark to Folder in Tree View', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');

    const listView = page.locator('app-list-view');
    const bookmark = listView.getByText('Bookmark B1', { exact: true });
    await expect(bookmark).toBeVisible();

    const targetFolder = page.locator('app-tree-view').locator('.tree-row').filter({ hasText: /^Other Bookmarks$/ });
    await expect(targetFolder).toBeVisible();

    await bookmark.dragTo(targetFolder);

    await expect(bookmark).not.toBeVisible();

    await selectTreeFolder(page, 'Other Bookmarks');
    await expect(listView.getByText('Bookmark B1', { exact: true })).toBeVisible();
});

test('Reorder Bookmarks in List View (Drop Above)', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');

    const listView = page.locator('app-list-view');
    const b1Row = listView.locator('tr').filter({ hasText: 'Bookmark B1' });
    const b2Row = listView.locator('tr').filter({ hasText: 'Bookmark B2' });

    // Initial order: B1 then B2
    await expect(listView.locator('tbody tr').nth(0)).toContainText('Bookmark B1');
    await expect(listView.locator('tbody tr').nth(1)).toContainText('Bookmark B2');

    // Drag B2 and drop on top of B1 to trigger DropPosition.ABOVE
    await b2Row.dragTo(b1Row, {
        targetPosition: { x: 5, y: 5 } // Top part of B1
    });

    // Verify: B2 should now be first
    await expect(listView.locator('tbody tr').nth(0)).toContainText('Bookmark B2');
    await expect(listView.locator('tbody tr').nth(1)).toContainText('Bookmark B1');
});

test('Move Bookmark to Tag in Tree View', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');

    const listView = page.locator('app-list-view');
    const bookmark = listView.getByText('Bookmark B1', { exact: true });

    await expandFolder(page, 'Tags');
    const targetTag = page.locator('app-tree-view').locator('.tree-row').filter({ hasText: /^test-tag$/ });
    await expect(targetTag).toBeVisible();

    await bookmark.dragTo(targetTag);

    // Verify: The bookmark should now have the tag in the list view
    const tagsCell = listView.locator('tr').filter({ hasText: 'Bookmark B1' }).locator('td').nth(2); // Tags is 5th col, but displayed columns order might differ. 
    // In ListViewComponent: displayedColumns = [title, url, tags, dateAdded, dateLastUsed] -> tags is 3rd (index 2)
    await expect(tagsCell).toContainText('test-tag');
    
    // Verify it appears in the tag folder
    await selectTreeFolder(page, 'test-tag');
    await expect(listView.getByText('Bookmark B1', { exact: true })).toBeVisible();
});
