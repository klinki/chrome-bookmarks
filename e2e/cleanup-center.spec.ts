import { expect, test } from '@playwright/test';
import { setupChromeMock } from './e2e-utils';

test('reviews duplicate findings and quarantines selected copies', async ({ page }) => {
  const root = createCleanupTree();
  await setupChromeMock(page, root, {}, {
    bookmarkTags: {
      'exact-a': ['reference'],
      'exact-b': ['work'],
      'probable-a': ['reference'],
      'probable-b': ['reference'],
      stale: ['archive'],
      unknown: ['archive'],
      low: ['review']
    },
    bookmarkUsefulness: {
      low: { score: 1, source: 'manual' }
    }
  });

  await page.goto('/#/cleanup');
  await expect(page.getByRole('heading', { name: 'Cleanup Center' })).toBeVisible();
  const exactCategory = page.getByRole('button', { name: /Exact duplicate URLs/ });
  await expect(exactCategory).toContainText('2');
  await expect(page.getByRole('button', { name: /Probable duplicate URLs/ })).toContainText('2');
  await expect(page.getByRole('button', { name: /Stale bookmarks/ })).toContainText('1');
  await expect(page.getByRole('button', { name: /Unknown usage/ })).toContainText('7');
  await expect(page.getByRole('button', { name: /Usefulness 1–2/ })).toContainText('1');
  await expect(page.getByRole('button', { name: /Empty folders/ })).toContainText('1');

  const group = page.locator('.duplicate-group').first();
  await expect(group).toContainText('2 bookmarks');
  await group.getByRole('button', { name: 'Select copies' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Quarantine selected' }).click();

  const quarantinedCategory = page.getByRole('button', { name: /Quarantined items/ });
  await expect(quarantinedCategory).toContainText('2');
  await quarantinedCategory.click();
  await expect(page.locator('.finding-row').filter({ hasText: 'Exact B' })).toBeVisible();
});

test('requires confirmation before permanent purge', async ({ page }) => {
  await setupChromeMock(page, createCleanupTree());
  await page.goto('/#/cleanup');
  await page.getByRole('button', { name: /Quarantined items/ }).click();
  const item = page.locator('.finding-row').filter({ hasText: 'Already quarantined' });
  await item.locator('input[type="checkbox"]').check();

  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Permanently purge' }).click();

  await expect(item).toBeVisible();
});

test('keeps a 10,000-finding Cleanup view below 100 rendered rows', async ({ page }) => {
  test.setTimeout(60_000);
  const root = createLargeTree(10_000);
  await setupChromeMock(page, root);
  await page.goto('/#/cleanup');
  const untagged = page.getByRole('button', { name: /Untagged bookmarks/ });
  await expect(untagged).toContainText('10000', { timeout: 30_000 });
  await untagged.click();

  const rows = page.locator('.finding-viewport .finding-row');
  await expect.poll(() => rows.count()).toBeGreaterThan(0);
  expect(await rows.count()).toBeLessThan(100);
});

function createCleanupTree(): chrome.bookmarks.BookmarkTreeNode {
  const now = Date.now();
  const root: chrome.bookmarks.BookmarkTreeNode = { id: '0', title: 'root', children: [] };
  const bar = folder(root, '1', 'Bookmarks Bar');
  const other = folder(root, '2', 'Other Bookmarks');
  const source = folder(bar, 'source', 'Source');
  bookmark(source, 'exact-a', 'Exact A', 'https://exact.example/path');
  bookmark(source, 'exact-b', 'Exact B', 'https://exact.example/path');
  bookmark(source, 'probable-a', 'Probable A', 'https://Example.com/article?utm_source=test&id=1');
  bookmark(source, 'probable-b', 'Probable B', 'https://example.com/article?id=1#read');
  bookmark(source, 'stale', 'Stale', 'https://stale.example', { dateLastUsed: now - 800 * 86_400_000 });
  bookmark(source, 'unknown', 'Unknown', 'https://unknown.example', { dateAdded: now - 800 * 86_400_000 });
  bookmark(source, 'undated', 'Undated', 'https://undated.example');
  bookmark(source, 'low', 'Low usefulness', 'https://low.example');
  folder(source, 'empty', 'Empty');
  const trash = folder(other, 'trash', 'Trash');
  const cleanup = folder(trash, 'cleanup', 'Cleanup');
  const staleReason = folder(cleanup, 'stale-reason', 'Stale');
  bookmark(staleReason, 'quarantined', 'Already quarantined', 'https://trash.example');
  return root;
}

function createLargeTree(count: number): chrome.bookmarks.BookmarkTreeNode {
  const root: chrome.bookmarks.BookmarkTreeNode = { id: '0', title: 'root', children: [] };
  const bar = folder(root, '1', 'Bookmarks Bar');
  folder(root, '2', 'Other Bookmarks');
  const source = folder(bar, 'source', 'Large source');
  for (let index = 0; index < count; index += 1) {
    bookmark(source, `large-${index}`, `Large ${index}`, `https://large.example/${index}`, {
      dateAdded: Date.now()
    });
  }
  return root;
}

function folder(
  parent: chrome.bookmarks.BookmarkTreeNode,
  id: string,
  title: string
): chrome.bookmarks.BookmarkTreeNode {
  parent.children ??= [];
  const node: chrome.bookmarks.BookmarkTreeNode = {
    id,
    parentId: parent.id,
    index: parent.children.length,
    title,
    children: []
  };
  parent.children.push(node);
  return node;
}

function bookmark(
  parent: chrome.bookmarks.BookmarkTreeNode,
  id: string,
  title: string,
  url: string,
  extra: Record<string, number> = {}
): void {
  parent.children ??= [];
  parent.children.push({
    id,
    parentId: parent.id,
    index: parent.children.length,
    title,
    url,
    ...extra
  });
}
