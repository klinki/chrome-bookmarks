import { test, expect } from '@playwright/test';

function addDirectory(id: string, title: string, parent: chrome.bookmarks.BookmarkTreeNode | null, managed?: string) {
    let directory: any = {
        id: id,
        title: title,
        parentId: undefined,
        index: undefined,
        children: [],
        expanded: false
    };

    if (parent != null) {
        directory.parentId = parent.id;
        directory.index = parent?.children?.length ?? undefined;
        parent?.children?.push(directory);
    }

    addBookmark(directory);

    return directory;
}

function addUrl(id: string, title: string, url: string, directory: chrome.bookmarks.BookmarkTreeNode) {
    let bookmark = {
        id: id,
        title: title,
        url: url,
        parentId: directory.id,
        index: directory?.children?.length
    };
    directory?.children?.push(bookmark);
    addBookmark(bookmark);

    return bookmark;
}

function addBookmark(bookmark: chrome.bookmarks.BookmarkTreeNode) {
    MOCK_BOOKMARKS_MAP[bookmark.id] = bookmark;
}

const MOCK_BOOKMARKS_MAP: { [id: string]: chrome.bookmarks.BookmarkTreeNode } = {};

// Root setup
const root = addDirectory('0', 'root', null);
const bookmarksBar = addDirectory('1', 'Bookmarks Bar', root);
const otherBookmarks = addDirectory('2', 'Other Bookmarks', root);

// 1) Folder with only bookmarks
const onlyBookmarks = addDirectory('3', 'Only Bookmarks', bookmarksBar);
addUrl('101', 'Bookmark B1', 'https://example.com/b1', onlyBookmarks);
addUrl('102', 'Bookmark B2', 'https://example.com/b2', onlyBookmarks);

// 2) Folder with only subfolders
const onlySubfolders = addDirectory('4', 'Only Subfolders', bookmarksBar);
const subfolderS1 = addDirectory('401', 'Subfolder S1', onlySubfolders);
addDirectory('402', 'Subfolder S2', onlySubfolders);

// 3) Folder with mixed content
const mixedContent = addDirectory('5', 'Mixed Content', bookmarksBar);
addUrl('501', 'Bookmark M1', 'https://example.com/m1', mixedContent);
addDirectory('502', 'Subfolder M2', mixedContent);

// Top level items in Bookmarks Bar for easy access
addUrl('11', 'Top Bookmark', 'https://example.com/top', bookmarksBar);

// Searchable items for search tests
addUrl('search-1', 'Duplicate Item 1', 'https://example.com/d1', bookmarksBar);
addUrl('search-2', 'Duplicate Item 2', 'https://example.com/d2', otherBookmarks);
addUrl('search-3', 'Duplicate Item 1', 'https://example.com/d3', subfolderS1);
addDirectory('search-folder-1', 'Duplicate Item Folder 1', bookmarksBar);

test.beforeEach(async ({ page }) => {
    // Mock chrome API before each test
    await page.addInitScript((rootNode) => {
        (window as any).isE2E = true;

        const findNode = (node: any, targetId: string): any => {
            if (node.id === targetId) return node;
            if (node.children) {
                for (const child of node.children) {
                    const found = findNode(child, targetId);
                    if (found) return found;
                }
            }
            return null;
        };

        const recursiveSearch = (node: any, query: string, results: any[]) => {
            if (node.id !== '0' && node.title && node.title.toLowerCase().includes(query.toLowerCase())) {
                results.push(node);
            }
            if (node.children) {
                for (const child of node.children) {
                    recursiveSearch(child, query, results);
                }
            }
        };

        (window as any).chrome = {
            runtime: {
                getURL: (path: string) => path,
            },
            bookmarks: {
                getTree: (callback: any) => callback([JSON.parse(JSON.stringify(rootNode))]),
                getChildren: (id: string, callback: any) => {
                    const node = findNode(rootNode, id);
                    callback(JSON.parse(JSON.stringify(node?.children || [])));
                },
                search: (query: any, callback: any) => {
                    const results: any[] = [];
                    const queryString = typeof query === 'string' ? query : query.query;
                    if (queryString) {
                        recursiveSearch(rootNode, queryString, results);
                    }
                    callback(JSON.parse(JSON.stringify(results)));
                },
                onCreated: { addListener: () => { }, removeListener: () => { } },
                onRemoved: { addListener: () => { }, removeListener: () => { } },
                onChanged: { addListener: () => { }, removeListener: () => { } },
                onMoved: { addListener: () => { }, removeListener: () => { } },
                onChildrenReordered: { addListener: () => { }, removeListener: () => { } },
                onImportBegan: { addListener: () => { }, removeListener: () => { } },
                onImportEnded: { addListener: () => { }, removeListener: () => { } },
            }
        };
    }, root);

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

test('Tree View structure is correct and expands', async ({ page }) => {
    const treeView = page.locator('app-tree-view');
    await expect(treeView.getByText('Bookmarks Bar')).toBeVisible();
    await expect(treeView.getByText('Other Bookmarks')).toBeVisible();

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
