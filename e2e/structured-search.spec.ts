import { expect, test } from '@playwright/test';
import { getMockData, setupChromeMock } from './e2e-utils';

test.describe('structured bookmark search', () => {
  test.beforeEach(async ({ page }) => {
    const { root, MOCK_BOOKMARKS_MAP } = getMockData();
    await setupChromeMock(page, root, MOCK_BOOKMARKS_MAP);
    await page.goto('/');
    await expect(page.locator('app-search-box input[type="search"]')).toBeVisible();
  });

  test('keeps plain text compatibility and evaluates Boolean phrases', async ({ page }) => {
    const search = page.locator('app-search-box input[type="search"]');
    const rows = page.locator('app-list-view tbody tr');

    await search.fill('Duplicate Item 1');
    await expect(rows).toHaveCount(3);

    await search.fill('title:"Duplicate Item 1" OR title:"Subfolder M2"');
    await expect(rows).toHaveCount(3);
    await expect(page.getByRole('gridcell', { name: 'Subfolder M2' })).toBeVisible();
  });

  test('shows positioned errors while retaining the last valid results', async ({ page }) => {
    const search = page.locator('app-search-box input[type="search"]');
    const rows = page.locator('app-list-view tbody tr');

    await search.fill('Duplicate Item 1');
    await expect(rows).toHaveCount(3);
    await search.fill('title:"unfinished');

    await expect(page.getByRole('alert')).toContainText('character');
    await expect(rows).toHaveCount(3);
  });

  test('creates removable filter chips and scopes to folder descendants', async ({ page }) => {
    const rows = page.locator('app-list-view tbody tr');
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByLabel('Field').selectOption('type');
    await page.getByLabel('Value').fill('folder');
    await page.getByRole('button', { name: 'Add filter' }).click();

    const chip = page.locator('.search-chip');
    await expect(chip).toContainText('type:folder');
    await expect(rows).not.toHaveCount(0);
    await chip.getByRole('button').click();

    await page.getByLabel('Folder scope').selectOption('3');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'Only Bookmarks' })).toHaveCount(0);
  });

  test('restores query and stable folder scope from the hash route', async ({ page }) => {
    await page.goto('/#/?q=title%3A%22Bookmark%20B1%22&scope=3');

    await expect(page.locator('app-search-box input[type="search"]')).toHaveValue('title:"Bookmark B1"');
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByLabel('Folder scope')).toHaveValue('3');
    await expect(page.locator('app-list-view tbody tr')).toHaveCount(1);
    await expect(page.getByText('Bookmark B1', { exact: true })).toBeVisible();
  });

  test('restores previous ad hoc searches with browser history', async ({ page }) => {
    const search = page.locator('app-search-box input[type="search"]');
    await search.fill('title:"Bookmark B1"');
    await expect(page).toHaveURL(/B1/);
    await expect(page.getByRole('gridcell', { name: 'Bookmark B1' })).toBeVisible();

    await search.fill('title:"Bookmark B2"');
    await expect(page).toHaveURL(/B2/);
    await expect(page.getByRole('gridcell', { name: 'Bookmark B2' })).toBeVisible();
    await page.goBack();

    await expect(search).toHaveValue('title:"Bookmark B1"');
    await expect(page.getByRole('gridcell', { name: 'Bookmark B1' })).toBeVisible();
  });

  test('creates, edits, duplicates, renames, and deletes Smart Collections', async ({ page }) => {
    const search = page.locator('app-search-box input[type="search"]');
    await search.fill('title:"Bookmark B1"');
    await page.getByRole('button', { name: 'Filters' }).click();
    page.once('dialog', dialog => dialog.accept('Reading'));
    await page.getByRole('button', { name: 'Save as Smart Collection' }).click();

    await expect(page).toHaveURL(/collection=/);
    await expect(page.getByLabel('Bookmark folders').getByText('Reading', { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('1 results');

    page.once('dialog', dialog => dialog.accept('title:"Bookmark B2"'));
    await page.getByRole('button', { name: 'Edit query' }).click();
    await expect(page.getByRole('gridcell', { name: 'Bookmark B2' })).toBeVisible();

    await page.getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.getByLabel('Bookmark folders').getByText('Reading Copy', { exact: true })).toBeVisible();
    page.once('dialog', dialog => dialog.accept('To Read'));
    await page.getByRole('button', { name: 'Rename' }).click();
    await expect(page.getByLabel('Bookmark folders').getByText('To Read', { exact: true })).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByLabel('Bookmark folders').getByText('To Read', { exact: true })).toHaveCount(0);
  });
});
