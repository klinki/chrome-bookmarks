import { expect, test } from '@playwright/test';
import { getMockData, setupChromeMock } from './e2e-utils';

test('virtualizes a 10,000-bookmark folder while preserving full row semantics', async ({ page }) => {
  const { root, MOCK_BOOKMARKS_MAP } = getMockData();
  const bookmarksBar = root.children?.find(node => node.id === '1');
  if (!bookmarksBar) {
    throw new Error('Bookmarks Bar not found');
  }

  const largeFolder: chrome.bookmarks.BookmarkTreeNode = {
    id: 'large-library',
    parentId: bookmarksBar.id,
    index: bookmarksBar.children?.length ?? 0,
    title: 'Large Library',
    children: Array.from({ length: 10_000 }, (_, index) => ({
      id: `large-${index}`,
      parentId: 'large-library',
      index,
      title: `Large Bookmark ${String(index).padStart(5, '0')}`,
      url: `https://large-${index % 100}.example/item/${index}`
    }))
  };
  bookmarksBar.children?.push(largeFolder);
  MOCK_BOOKMARKS_MAP[largeFolder.id] = largeFolder;
  largeFolder.children?.forEach(node => MOCK_BOOKMARKS_MAP[node.id] = node);

  await setupChromeMock(page, root, MOCK_BOOKMARKS_MAP);
  await page.goto('/');
  const bookmarksBarRow = page.locator('app-tree-view .tree-row')
    .filter({ has: page.locator('.tree-label', { hasText: /^Bookmarks Bar$/ }) })
    .first();
  await bookmarksBarRow.locator('.expand-icon').click();
  await page.locator('[role="treeitem"][data-tree-id="large-library"]').click();

  const grid = page.locator('app-list-view [role="grid"]');
  await expect(grid).toHaveAttribute('aria-rowcount', '10001');
  const rows = page.locator('app-list-view tbody tr');
  await expect.poll(() => rows.count()).toBeGreaterThan(0);
  expect(await rows.count()).toBeLessThan(100);

  const viewport = page.locator('app-list-view cdk-virtual-scroll-viewport');
  await viewport.evaluate(element => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('app-list-view tr[itemid="large-9999"]')).toBeVisible();
  expect(await rows.count()).toBeLessThan(100);
});
