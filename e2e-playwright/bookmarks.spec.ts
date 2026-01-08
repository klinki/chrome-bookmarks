import { test, expect } from '@playwright/test';

function addDirectory(id: string, title: string, parent: chrome.bookmarks.BookmarkTreeNode | null, managed?: string) {
    let directory: chrome.bookmarks.BookmarkTreeNode = {
        id: id,
        title: title,
        parentId: undefined,
        index: undefined,
        children: []
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
    // Object.freeze(bookmark);
    MOCK_BOOKMARKS[bookmark.id] = bookmark;
}

const MOCK_BOOKMARKS: { [id: string]: chrome.bookmarks.BookmarkTreeNode } = {};

const root = addDirectory('0', 'root', null);
const bookmarksBar = addDirectory('1', 'Bookmarks Bar', root);
const otherBookmarks = addDirectory('2', 'Other Bookmarks', root);
addUrl('10', 'Folder A', 'https://example.com/a', bookmarksBar);
addUrl('11', 'Bookmark B', 'https://example.com/b', bookmarksBar);
addUrl('101', 'Bookmark A1', 'https://example.com/a1', otherBookmarks);

test.beforeEach(async ({ page }) => {
    // Mock chrome API before each test
    await page.addInitScript((bookmarks) => {
        (window as any).isE2E = true;
        (window as any).chrome = {
            runtime: {
                getURL: (path: string) => path,
            },
            bookmarks: {
                getTree: (callback: any) => callback(JSON.parse(JSON.stringify(bookmarks))),
                getChildren: (id: string, callback: any) => {
                    const findNode = (nodes: any[], targetId: string): any => {
                        for (const node of nodes) {
                            if (node.id === targetId) return node;
                            if (node.children) {
                                const found = findNode(node.children, targetId);
                                if (found) return found;
                            }
                        }
                        return null;
                    };
                    const node = findNode(bookmarks, id);
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
    }, MOCK_BOOKMARKS);

    await page.goto('/');
});

test('Bookmarks tree works as expected', async ({ page }) => {
    const treeView = page.locator('app-tree-view');
    await expect(treeView).toBeVisible();

    await expect(page.getByText('Bookmarks Bar')).toBeVisible();
    await expect(page.getByText('Other Bookmarks')).toBeVisible();
});

test('Selecting a folder works as expected', async ({ page }) => {
    // Folder A should be visible because Bookmarks Bar is expanded in mock
    const folderA = page.getByText('Folder A');
    await expect(folderA).toBeVisible();
    await folderA.click();

    // The list view should show the children of Folder A (Bookmark A1)
    const listItem = page.locator('app-list-view').getByText('Bookmark A1');
    await expect(listItem).toBeVisible({ timeout: 10000 });
});

test('Selecting a bookmark works as expected and shows the bookmark detail', async ({ page }) => {
    await page.getByText('Folder A').click();

    const bookmarkA1 = page.locator('app-list-view').getByText('Bookmark A1');
    await expect(bookmarkA1).toBeVisible({ timeout: 10000 });
    await bookmarkA1.click();

    const detailView = page.locator('app-bookmark-detail');
    await expect(detailView).toBeVisible();

    // Based on the new implementation, it should show Bookmark Details
    await expect(page.getByText('Bookmark Details')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="title"]')).toHaveValue('Bookmark A1');
    await expect(page.locator('input[name="url"]')).toHaveValue('https://example.com/a1');
});
