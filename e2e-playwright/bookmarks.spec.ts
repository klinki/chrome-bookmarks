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
addDirectory('401', 'Subfolder S1', onlySubfolders);
addDirectory('402', 'Subfolder S2', onlySubfolders);

// 3) Folder with mixed content
const mixedContent = addDirectory('5', 'Mixed Content', bookmarksBar);
addUrl('501', 'Bookmark M1', 'https://example.com/m1', mixedContent);
addDirectory('502', 'Subfolder M2', mixedContent);

// Top level items in Bookmarks Bar for easy access
addUrl('11', 'Top Bookmark', 'https://example.com/top', bookmarksBar);

test.beforeEach(async ({ page }) => {
    // Mock chrome API before each test
    await page.addInitScript((rootNode) => {
        (window as any).isE2E = true;
        (window as any).chrome = {
            runtime: {
                getURL: (path: string) => path,
            },
            bookmarks: {
                getTree: (callback: any) => callback([JSON.parse(JSON.stringify(rootNode))]),
                getChildren: (id: string, callback: any) => {
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
                    const node = findNode(rootNode, id);
                    callback(JSON.parse(JSON.stringify(node?.children || [])));
                },
                search: (query: any, callback: any) => callback([]),
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
    await expect(listView.getByText('Bookmark B1')).toBeVisible();
    await expect(listView.getByText('Bookmark B2')).toBeVisible();
    await expect(listView.locator('.tree-label')).toHaveCount(0);
});

test('Folder with only subfolders', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Subfolders');

    const listView = page.locator('app-list-view');
    await expect(listView.getByText('Subfolder S1')).toBeVisible();
    await expect(listView.getByText('Subfolder S2')).toBeVisible();
    await expect(listView.locator('.tree-label')).toHaveCount(2);
});

test('Folder with mixed content', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Mixed Content');

    const listView = page.locator('app-list-view');
    await expect(listView.getByText('Bookmark M1')).toBeVisible();
    await expect(listView.getByText('Subfolder M2')).toBeVisible();
    await expect(listView.locator('.tree-label')).toHaveCount(1);
});

test('Selection: Single bookmark', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Bookmarks');
    await page.locator('app-list-view').getByText('Bookmark B1').click();

    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText('Bookmark Details')).toBeVisible();
    await expect(detail.locator('input[name="title"]')).toHaveValue('Bookmark B1');
});

test('Selection: Single folder', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Subfolders');
    await page.locator('app-list-view').getByText('Subfolder S1').click();

    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText('Folder Details')).toBeVisible();
    await expect(detail.getByText('Name: Subfolder S1')).toBeVisible();
});

test('Selection: Multiple folders', async ({ page }) => {
    await expandFolder(page, 'Bookmarks Bar');
    await selectTreeFolder(page, 'Only Subfolders');

    const s1 = page.locator('app-list-view').getByText('Subfolder S1');
    const s2 = page.locator('app-list-view').getByText('Subfolder S2');

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

    const b1 = page.locator('app-list-view').getByText('Bookmark B1');
    const b2 = page.locator('app-list-view').getByText('Bookmark B2');

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

    const m1 = page.locator('app-list-view').getByText('Bookmark M1');
    const m2 = page.locator('app-list-view').getByText('Subfolder M2');

    await m1.click();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await m2.click();
    await page.keyboard.up(modifier);

    const detail = page.locator('app-bookmark-detail');
    await expect(detail.getByText(/Selected 2 items/)).toBeVisible();
});
