import { test, expect } from '@playwright/test';
import { getMockData, setupChromeMock } from './e2e-utils';
import { AppPage } from './app.po';

const { root, MOCK_BOOKMARKS_MAP } = getMockData();

test.beforeEach(async ({ page }) => {
    // Listen for console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error(`PAGE ERROR: ${msg.text()}`);
        }
    });

    await setupChromeMock(page, root, MOCK_BOOKMARKS_MAP);
    const appPage = new AppPage(page);
    await appPage.navigate();
});

test('Context menu works on top-level folder', async ({ page }) => {
    const treeView = page.locator('app-tree-view');
    const row = treeView.locator('.tree-row').filter({ has: page.locator('.tree-label', { hasText: /^Bookmarks Bar$/ }) }).first();

    // Right click
    await row.click({ button: 'right' });

    // Check for menu
    // The menu is appended to the body in a cdk-overlay-container
    const menu = page.locator('.cdk-overlay-container');
    await expect(menu).toContainText('Open all bookmarks');
    await expect(menu).toContainText('New folder');

    // Verify the right-clicked item is selected
    // Note: The parent container (app-tree-item) has the 'selected' attribute,
    // but our 'row' locator is .tree-row inside it.
    // The attribute is on the host element of app-tree-item.
    // In tree-item.component.html:
    // <div class="tree-item" [attr.selected]="isSelected() ? true : null">
    // So we need to look at the parent of .tree-row's parent (since .tree-row is inside div.tree-item)
    // Wait, let's check HTML structure again.

    // In tree-item.component.html:
    // <div class="tree-item" [attr.selected]="..." ...>
    //   <div class="tree-row" ...>

    // So .tree-row is a child of .tree-item.
    const treeItem = row.locator('xpath=..');
    await expect(treeItem).toHaveAttribute('selected', 'true');
});

test('Context menu works on nested folder', async ({ page }) => {
    const treeView = page.locator('app-tree-view');

    // Expand Bookmarks Bar
    const rootRow = treeView.locator('.tree-row').filter({ has: page.locator('.tree-label', { hasText: /^Bookmarks Bar$/ }) }).first();
    await rootRow.locator('.expand-icon').click();

    // Find nested folder "Only Subfolders"
    const nestedRow = treeView.locator('.tree-row').filter({ has: page.locator('.tree-label', { hasText: /^Only Subfolders$/ }) }).first();
    await expect(nestedRow).toBeVisible();

    // Right click on nested folder
    await nestedRow.click({ button: 'right' });

    // Check for menu
    const menu = page.locator('.cdk-overlay-container');
    await expect(menu).toContainText('Open all bookmarks');
    await expect(menu).toContainText('New folder');

    // Verify selection
    const treeItem = nestedRow.locator('xpath=..');
    await expect(treeItem).toHaveAttribute('selected', 'true');
});
