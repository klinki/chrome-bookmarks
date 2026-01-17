import { test, expect } from '@playwright/test';
import { getMockData, setupChromeMock } from './e2e-utils';
import { AppPage } from './app.po';

// Helper to create more items
function createExtendedMockData() {
    const { root, MOCK_BOOKMARKS_MAP } = getMockData();

    // Find Bookmarks Bar
    const bookmarksBar = root.children?.find((c: any) => c.id === '1');
    if (!bookmarksBar) throw new Error('Bookmarks Bar not found');

    // Create a folder for selection tests
    const selectionFolder = {
        id: '1000',
        title: 'Selection Test',
        parentId: '1',
        index: bookmarksBar.children?.length,
        children: [] as any[],
        expanded: false
    };
    bookmarksBar.children?.push(selectionFolder);
    MOCK_BOOKMARKS_MAP['1000'] = selectionFolder;

    // Add 5 items
    for (let i = 1; i <= 5; i++) {
        const item = {
            id: `100${i}`,
            title: `Item ${i}`,
            url: `https://example.com/item${i}`,
            parentId: '1000',
            index: i - 1
        };
        selectionFolder.children.push(item);
        MOCK_BOOKMARKS_MAP[item.id] = item;
    }

    return { root, MOCK_BOOKMARKS_MAP };
}

test.describe('Extended Selection', () => {
    test.beforeEach(async ({ page }) => {
        const { root, MOCK_BOOKMARKS_MAP } = createExtendedMockData();
        await setupChromeMock(page, root, MOCK_BOOKMARKS_MAP);
        const appPage = new AppPage(page);
        await appPage.navigate();

        // Navigate to the test folder
        const treeView = page.locator('app-tree-view');
        await treeView.locator('.tree-row').filter({ has: page.locator('.tree-label', { hasText: 'Bookmarks Bar' }) }).first().locator('.expand-icon').click();
        await treeView.locator('.tree-row').filter({ has: page.locator('.tree-label', { hasText: 'Selection Test' }) }).first().click();
    });

    test('Shift+Click range selection', async ({ page }) => {
        const listView = page.locator('app-list-view');
        const item1 = listView.getByText('Item 1', { exact: true });
        const item3 = listView.getByText('Item 3', { exact: true });

        // Click Item 1
        await item1.click();

        // Shift+Click Item 3
        await page.keyboard.down('Shift');
        await item3.click();
        await page.keyboard.up('Shift');

        // Check selection count
        const detail = page.locator('app-bookmark-detail');
        await expect(detail.getByText('Selected 3 bookmarks')).toBeVisible();

        // Verify specific items are selected (Item 1, 2, 3)
        await expect(listView.locator('tr[selected="true"]')).toHaveCount(3);
        await expect(listView.locator('tr[itemid="1001"][selected="true"]')).toBeVisible();
        await expect(listView.locator('tr[itemid="1002"][selected="true"]')).toBeVisible();
        await expect(listView.locator('tr[itemid="1003"][selected="true"]')).toBeVisible();
    });

    test('Ctrl+Click then Shift+Click (Standard behavior)', async ({ page }) => {
        // Standard behavior:
        // 1. Click Item 1. (Last: 1)
        // 2. Ctrl+Click Item 5. (Selection: 1, 5. Last: 5)
        // 3. Shift+Click Item 3. (Range from Last(5) to 3 -> 3,4,5).
        // If Shift+Click (no Ctrl), it usually REPLACES selection.
        // So expected: 3, 4, 5.
        // Wait, normally Shift+Click replaces selection but extends from anchor.
        // If I use Windows Explorer:
        // Click 1. Selects 1.
        // Ctrl+Click 5. Selects 1, 5. Focus is 5.
        // Shift+Click 3. Selects 1, 3, 4, 5. (Preserves 1, range 3-5 added/modified?)
        // Actually, Shift+Click in Windows Explorer usually selects range from Anchor to Current.
        // If Anchor was 5. Range 3-5.
        // Does it keep 1?
        // In Windows Explorer: Click 1. Ctrl+Click 5. Shift+Click 3. Result: 1, 3, 4, 5.
        // In macOS Finder: Click 1. Cmd+Click 5. Shift+Click 3. Result: 1, 3, 4, 5.

        // So effectively, Shift+Click should establish a range from "Last Active" to "Current", and REPLACE the selection created by that range?
        // Or MERGE it?
        // Standard behavior is actually complicated.
        // Let's implement what the user likely wants: Range selection.

        // If I do: Click 1. Shift+Click 3. -> 1, 2, 3.
        // Then Ctrl+Click 5. -> 1, 2, 3, 5.
        // Then Shift+Click 4?

        // Let's test the specific request: "Multi-selection with shift and mouse clicking".
        // Usually this means: Click A, Shift+Click B -> Selects Range A-B.

        // Test Ctrl+Shift+Click (Add Range)
        // Click 1.
        // Ctrl+Shift+Click 3.
        // Should select 1, 2, 3. (Same as Shift+Click)

        // What if: Click 1. Ctrl+Click 5. (1, 5 selected).
        // Ctrl+Shift+Click 3.
        // Range 5-3 (3,4,5). Added to existing (1, 5).
        // Result: 1, 3, 4, 5.

        const listView = page.locator('app-list-view');
        const item1 = listView.getByText('Item 1', { exact: true });
        const item3 = listView.getByText('Item 3', { exact: true });
        const item5 = listView.getByText('Item 5', { exact: true });

        // Click 1
        await item1.click();

        const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

        // Ctrl+Click 5
        await page.keyboard.down(modifier);
        await item5.click();
        await page.keyboard.up(modifier);

        await expect(listView.locator('tr[selected="true"]')).toHaveCount(2); // 1 and 5

        // Ctrl+Shift+Click 3
        await page.keyboard.down(modifier);
        await page.keyboard.down('Shift');
        await item3.click();
        await page.keyboard.up('Shift');
        await page.keyboard.up(modifier);

        // Expect: 1 (kept), 3, 4, 5 (range from 5 to 3). Total 4 items.
        // Note: The logic I saw in code calculates range from lastSelectedItem (which became 5).
        // So range is 3..5.
        // Existing selection was 1, 5.
        // New set should be Union(Existing, Range).
        await expect(listView.locator('tr[selected="true"]')).toHaveCount(4);

        const ids = ['1001', '1003', '1004', '1005'];
        for (const id of ids) {
             await expect(listView.locator(`tr[itemid="${id}"][selected="true"]`)).toBeVisible();
        }
    });

    test('Ctrl+A Select All', async ({ page }) => {
        const listView = page.locator('app-list-view');

        // Focus list by clicking one item first (or just ensure focus is on body/list)
        await listView.getByText('Item 1', { exact: true }).click();

        const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
        await page.keyboard.press(`${modifier}+a`);

        const detail = page.locator('app-bookmark-detail');
        await expect(detail.getByText('Selected 5 bookmarks')).toBeVisible();
        await expect(listView.locator('tr[selected="true"]')).toHaveCount(5);
    });

    test('Select All then deselect one', async ({ page }) => {
        const listView = page.locator('app-list-view');
        await listView.getByText('Item 1', { exact: true }).click();

        const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
        await page.keyboard.press(`${modifier}+a`);

        // Deselect Item 3 with Ctrl+Click
        await page.keyboard.down(modifier);
        await listView.getByText('Item 3', { exact: true }).click();
        await page.keyboard.up(modifier);

        await expect(listView.locator('tr[selected="true"]')).toHaveCount(4);
        await expect(listView.locator('tr[itemid="1003"][selected="true"]')).toHaveCount(0);
    });
});
