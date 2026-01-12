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
                const queryString = query.toLowerCase();
                if (node.id !== '0' && ((node.title && node.title.toLowerCase().includes(queryString)) || (node.url && node.url.toLowerCase().includes(queryString)))) {
                    results.push(node);
                }
                if (node.children) {
                    for (const child of node.children) {
                        recursiveSearch(child, query, results);
                    }
                }
            };

            const listeners: any = {
                onCreated: [],
                onRemoved: [],
                onChanged: [],
                onMoved: [],
            };

            const moveNode = (id: string, destination: { parentId: string, index?: number }) => {
                const node = findNode(rootNodeArg, id);
                if (!node) return;

                const oldParentId = node.parentId;
                const oldParent = findNode(rootNodeArg, oldParentId);
                let oldIndex = 0;
                if (oldParent && oldParent.children) {
                    oldIndex = oldParent.children.findIndex((c: any) => c.id === id);
                    if (oldIndex !== -1) {
                        oldParent.children.splice(oldIndex, 1);
                    }
                }

                const newParent = findNode(rootNodeArg, destination.parentId);
                if (newParent) {
                    if (!newParent.children) newParent.children = [];
                    node.parentId = destination.parentId;
                    if (destination.index !== undefined) {
                        newParent.children.splice(destination.index, 0, node);
                    } else {
                        newParent.children.push(node);
                    }

                    newParent.children.forEach((c: any, i: number) => { c.index = i; });

                    const moveInfo = {
                        parentId: destination.parentId,
                        index: destination.index ?? newParent.children.length - 1,
                        oldParentId: oldParentId,
                        oldIndex: oldIndex
                    };

                    listeners.onMoved.forEach((l: any) => l(id, moveInfo));
                }
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
                    getTree: (callback: any) => {
                        callback([JSON.parse(JSON.stringify(rootNodeArg))]);
                    },
                    getChildren: (id: string, callback: any) => {
                        const node = findNode(rootNodeArg, id);
                        callback(JSON.parse(JSON.stringify(node?.children || [])));
                    },
                    get: (idOrIds: string|string[], callback: any) => {
                        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
                        const results = ids.map(id => findNode(rootNodeArg, id)).filter(n => !!n);
                        callback(JSON.parse(JSON.stringify(results)));
                    },
                    search: (query: any, callback: any) => {
                        const results: any[] = [];
                        const queryString = typeof query === 'string' ? query : (query.query || query.title || query.url || '');
                        if (queryString) {
                            recursiveSearch(rootNodeArg, queryString, results);
                        }
                        callback(JSON.parse(JSON.stringify(results)));
                    },
                    move: (id: string, destination: any, callback?: any) => {
                        moveNode(id, destination);
                        if (callback) callback(JSON.parse(JSON.stringify(findNode(rootNodeArg, id))));
                    },
                    update: (id: string, changes: any, callback?: any) => {
                        const node = findNode(rootNodeArg, id);
                        if (node) {
                            Object.assign(node, changes);
                            listeners.onChanged.forEach((l: any) => l(id, changes));
                        }
                        if (callback) callback(JSON.parse(JSON.stringify(node)));
                    },
                    remove: (id: string, callback?: any) => {
                        const node = findNode(rootNodeArg, id);
                        if (node) {
                            const parent = findNode(rootNodeArg, node.parentId);
                            if (parent && parent.children) {
                                const index = parent.children.findIndex((c: any) => c.id === id);
                                if (index !== -1) {
                                    parent.children.splice(index, 1);
                                    listeners.onRemoved.forEach((l: any) => l(id, { parentId: node.parentId, index }));
                                }
                            }
                        }
                        if (callback) callback();
                    },
                    onCreated: { addListener: (l: any) => listeners.onCreated.push(l), removeListener: () => {} },
                    onRemoved: { addListener: (l: any) => listeners.onRemoved.push(l), removeListener: () => {} },
                    onChanged: { addListener: (l: any) => listeners.onChanged.push(l), removeListener: () => {} },
                    onMoved: { addListener: (l: any) => listeners.onMoved.push(l), removeListener: () => {} },
                    onChildrenReordered: { addListener: () => {}, removeListener: () => {} },
                    onImportBegan: { addListener: () => {}, removeListener: () => {} },
                    onImportEnded: { addListener: () => {}, removeListener: () => {} },
                }
            };

            try {
                Object.defineProperty(window, 'chrome', {
                    configurable: true,
                    enumerable: true,
                    value: chromeMock,
                    writable: true
                });
            } catch (e) {
                console.warn('E2E: Failed to redefine chrome, using property assignment', e);
                (window as any).chrome = chromeMock;
            }
            
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
