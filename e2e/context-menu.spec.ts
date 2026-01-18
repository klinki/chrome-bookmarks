import { test, expect } from '@playwright/test';
import { getMockData, setupChromeMock } from './e2e-utils';

const { root, MOCK_BOOKMARKS_MAP } = getMockData();

test.describe('Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await setupChromeMock(page, root, MOCK_BOOKMARKS_MAP);
    // Navigate to the app. Assuming default generic setup or configured baseUrl
    await page.goto('/');
  });

  test('should open context menu on right click on folder in tree', async ({ page }) => {
    // Locate a tree item. Assuming 'app-tree-item' and maybe a specific one or first one.
    // This depends on the app state/mock data.
    const treeItem = page.locator('app-tree-item').first();
    await expect(treeItem).toBeVisible();

    await treeItem.click({ button: 'right' });

    // Check for context menu
    const menu = page.locator('.cdk-overlay-pane .submenu');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('New folder');
    await expect(menu).toContainText('New bookmark');
  });

  test('should open context menu on right click on bookmark in list view', async ({ page }) => {
    // Select "Bookmarks Bar" which contains bookmarks
    const treeView = page.locator('app-tree-view');
    const bookmarksBar = treeView.locator('.tree-row').filter({ has: page.locator('.tree-label', { hasText: 'Bookmarks Bar' }) }).first();
    await bookmarksBar.click();

    // Locate a list item (tr).
    // Assuming there is at least one item.
    const row = page.locator('app-list-view tr[draggable="true"]').first();
    await expect(row).toBeVisible();

    await row.click({ button: 'right' });

    // Check for context menu
    const menu = page.locator('.cdk-overlay-pane .submenu');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Open in new Tab');
    await expect(menu).toContainText('Delete');
  });

  test('should have improved styling', async ({ page }) => {
    const treeItem = page.locator('app-tree-item').first();
    await treeItem.click({ button: 'right' });

    const menu = page.locator('.cdk-overlay-pane .submenu');
    
    // Check background color (approximate check of class application)
    const bgColor = await menu.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // #2b2d31 is rgb(43, 45, 49)
    expect(bgColor).toBe('rgb(43, 45, 49)');
  });
});
