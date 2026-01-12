const MOCK_BOOKMARKS_MAP: { [id: string]: chrome.bookmarks.BookmarkTreeNode } = {};

export function getMockData() {
    function addDirectory(id: string, title: string, parent: chrome.bookmarks.BookmarkTreeNode | null) {
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

    return { root, MOCK_BOOKMARKS_MAP };
}

export async function setupChromeMock(page: any, rootNode: any, mockMap: any = {}, initialStorage: any = {}) {
    await page.addInitScript(({ rootNodeArg, mockMapArg, initialStorageArg }: { rootNodeArg: any, mockMapArg: any, initialStorageArg: any }) => {
        try {
            console.log('E2E: Starting mock injection');
            (window as any).isE2E = true;

            // Provide data for MockBookmarksService
            (window as any).e2eBookmarks = {
                root: rootNodeArg,
                map: mockMapArg
            };

            let storageData = { ...initialStorageArg };

            const chromeMock = {
                runtime: {
                    getURL: (path: string) => path,
                },
                storage: {
                    local: {
                        get: (keys: any, callback: any) => {
                            if (typeof keys === 'string') {
                                callback({ [keys]: storageData[keys] });
                            } else if (Array.isArray(keys)) {
                                const res: any = {};
                                keys.forEach(k => res[k] = storageData[k]);
                                callback(res);
                            } else {
                                callback(storageData);
                            }
                        },
                        set: (data: any, callback: any) => {
                            Object.assign(storageData, data);
                            if (callback) callback();
                        }
                    }
                },
                bookmarks: {
                   // We don't need real implementations here because we are using MockBookmarksService
                   // but we provide the subjects/listeners just in case something checks them
                   onCreated: { addListener: () => {}, removeListener: () => {} },
                   onRemoved: { addListener: () => {}, removeListener: () => {} },
                   onChanged: { addListener: () => {}, removeListener: () => {} },
                   onMoved: { addListener: () => {}, removeListener: () => {} },
                   onChildrenReordered: { addListener: () => {}, removeListener: () => {} },
                   onImportBegan: { addListener: () => {}, removeListener: () => {} },
                   onImportEnded: { addListener: () => {}, removeListener: () => {} },
                }
            };

            (window as any).chrome = chromeMock;
            console.log('E2E: Mock injection complete');
        } catch (e) {
            console.error('E2E: Mock injection failed', e);
        }

        // Hide webpack overlay if it appears
        const style = document.createElement('style');
        style.textContent = `
            #webpack-dev-server-client-overlay {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }, { rootNodeArg: rootNode, mockMapArg: mockMap, initialStorageArg: initialStorage });
}
