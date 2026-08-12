import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportExportService } from './import-export.service';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { TagsService } from './tags.service';
import { UsefulnessService } from './usefulness.service';
import { SmartCollectionsService } from './smart-collections.service';

describe('ImportExportService', () => {
  let service: ImportExportService;
  let create: ReturnType<typeof vi.fn>;
  let removeTree: ReturnType<typeof vi.fn>;
  let tagsService: {
    bookmarkTags: ReturnType<typeof vi.fn>;
    availableTags: ReturnType<typeof vi.fn>;
    setTagsForBookmarks: ReturnType<typeof vi.fn>;
    addAvailableTags: ReturnType<typeof vi.fn>;
    setAvailableTags: ReturnType<typeof vi.fn>;
  };
  let usefulnessService: {
    bookmarkUsefulness: ReturnType<typeof vi.fn>;
    setRatingsForBookmarks: ReturnType<typeof vi.fn>;
  };
  let smartCollectionsService: {
    collections: ReturnType<typeof vi.fn>;
    isSmartCollection: ReturnType<typeof vi.fn>;
    mergeImported: ReturnType<typeof vi.fn>;
    replaceAll: ReturnType<typeof vi.fn>;
  };

  const fileWith = (content: string) => ({
    text: () => Promise.resolve(content)
  }) as File;

  beforeEach(() => {
    let nextId = 0;
    create = vi.fn().mockImplementation((bookmark: chrome.bookmarks.BookmarkCreateArg) => {
      nextId++;
      return Promise.resolve({ id: `new-${nextId}`, ...bookmark });
    });
    removeTree = vi.fn().mockResolvedValue(undefined);
    tagsService = {
      bookmarkTags: vi.fn().mockReturnValue({}),
      availableTags: vi.fn().mockReturnValue(['Existing']),
      setTagsForBookmarks: vi.fn(),
      addAvailableTags: vi.fn(),
      setAvailableTags: vi.fn()
    };
    usefulnessService = {
      bookmarkUsefulness: vi.fn().mockReturnValue({}),
      setRatingsForBookmarks: vi.fn()
    };
    smartCollectionsService = {
      collections: vi.fn().mockReturnValue([]),
      isSmartCollection: vi.fn().mockReturnValue(true),
      mergeImported: vi.fn().mockReturnValue([]),
      replaceAll: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        ImportExportService,
        {
          provide: BookmarksProviderService,
          useValue: {
            create,
            removeTree,
            getBookmarks: vi.fn().mockResolvedValue([{
              id: 'root',
              title: 'root',
              children: [{
                id: 'bookmarks-bar',
                parentId: 'root',
                title: 'Bookmarks Bar',
                children: []
              }]
            }])
          }
        },
        { provide: TagsService, useValue: tagsService },
        { provide: UsefulnessService, useValue: usefulnessService },
        { provide: SmartCollectionsService, useValue: smartCollectionsService }
      ]
    });
    service = TestBed.inject(ImportExportService);
  });

  it('validates the complete JSON tree before creating the import folder', async () => {
    const backup = {
      version: 1,
      root: [{
        id: '0',
        title: 'root',
        children: [
          {
            id: 'valid',
            title: 'Valid',
            url: 'https://valid.example'
          },
          {
            id: 'invalid',
            title: 'Invalid',
            url: 'not a URL'
          }
        ]
      }],
      tags: {}
    };

    await expect(service.importJson(fileWith(JSON.stringify(backup))))
      .rejects.toThrow('Invalid bookmark URL');
    expect(create).not.toHaveBeenCalled();
    expect(tagsService.setTagsForBookmarks).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON tags before mutating bookmarks', async () => {
    const backup = {
      version: 1,
      root: [{
        id: '0',
        title: 'root',
        children: [{
          id: 'bookmark',
          title: 'Bookmark',
          url: 'https://example.com'
        }]
      }],
      tags: { bookmark: 'not-an-array' }
    };

    await expect(service.importJson(fileWith(JSON.stringify(backup))))
      .rejects.toThrow('Invalid tags for bookmark bookmark');
    expect(create).not.toHaveBeenCalled();
  });

  it('validates every HTML entry before creating the import folder', async () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
      <DL>
        <DT><A HREF="https://valid.example">Valid</A>
        <DT><A>Missing URL</A>
      </DL>`;

    await expect(service.importHtml(fileWith(html)))
      .rejects.toThrow('Bookmark HTML entry is missing a URL');
    expect(create).not.toHaveBeenCalled();
    expect(tagsService.setTagsForBookmarks).not.toHaveBeenCalled();
  });

  it('imports a validated JSON plan and restores its tags', async () => {
    const backup = {
      version: 1,
      root: [{
        id: '0',
        title: 'root',
        children: [{
          id: 'bookmark',
          title: 'Bookmark',
          url: 'https://example.com'
        }]
      }],
      tags: { bookmark: ['Reference'] }
    };

    await service.importJson(fileWith(JSON.stringify(backup)));

    expect(create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      parentId: 'bookmarks-bar'
    }));
    expect(create).toHaveBeenNthCalledWith(2, {
      parentId: 'new-1',
      title: 'Bookmark',
      url: 'https://example.com'
    });
    expect(tagsService.setTagsForBookmarks).toHaveBeenCalledTimes(1);
    expect(tagsService.setTagsForBookmarks).toHaveBeenCalledWith({
      'new-2': ['Reference']
    });
    expect(tagsService.addAvailableTags).toHaveBeenCalledWith(new Set(['Reference']));
  });

  it('imports version 2 usefulness ratings and remaps bookmark IDs', async () => {
    const backup = {
      version: 2,
      root: [{
        id: '0',
        title: 'root',
        children: [{
          id: 'bookmark',
          title: 'Bookmark',
          url: 'https://example.com'
        }]
      }],
      tags: {},
      usefulness: {
        bookmark: { score: 4, source: 'manual' }
      }
    };

    await service.importJson(fileWith(JSON.stringify(backup)));

    expect(usefulnessService.setRatingsForBookmarks).toHaveBeenCalledWith({
      'new-2': { score: 4, source: 'manual' }
    });
  });

  it.each([
    ['missing map', undefined],
    ['out-of-range score', { bookmark: { score: 6, source: 'ai' } }],
    ['invalid source', { bookmark: { score: 3, source: 'import' } }]
  ])('rejects version 2 with %s', async (_label, usefulness) => {
    const backup = {
      version: 2,
      root: [{
        id: 'bookmark',
        title: 'Bookmark',
        url: 'https://example.com'
      }],
      tags: {},
      ...(usefulness === undefined ? {} : { usefulness })
    };

    await expect(service.importJson(fileWith(JSON.stringify(backup)))).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it('exports version 3 with usefulness provenance and Smart Collections', async () => {
    usefulnessService.bookmarkUsefulness.mockReturnValue({
      bookmark: { score: 5, source: 'ai' }
    });
    const download = vi.spyOn(service as any, 'downloadFile').mockImplementation(() => undefined);

    await service.exportJson();

    const blob = download.mock.calls[0][0] as Blob;
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result)));
      reader.addEventListener('error', () => reject(reader.error));
      reader.readAsText(blob);
    });
    const data = JSON.parse(text);
    expect(data.version).toBe(3);
    expect(data.usefulness).toEqual({
      bookmark: { score: 5, source: 'ai' }
    });
    expect(data.smartCollections).toEqual([]);
  });

  it('validates and imports version 3 collections with remapped folder scopes', async () => {
    const collection = {
      id: 'collection', name: 'Work', query: 'tag:work', queryVersion: 1,
      scopeFolderId: 'folder', sortColumn: 'title', sortDirection: 'asc',
      createdAt: 1, updatedAt: 1
    };
    const backup = {
      version: 3,
      root: [{ id: '0', title: 'root', children: [{ id: 'folder', title: 'Folder', children: [] }] }],
      tags: {}, usefulness: {}, smartCollections: [collection]
    };

    await service.importJson(fileWith(JSON.stringify(backup)));

    expect(smartCollectionsService.mergeImported).toHaveBeenCalledWith(
      [collection],
      new Map([['folder', 'new-2']])
    );
  });

  it('rejects malformed version 3 collections before bookmark mutation', async () => {
    smartCollectionsService.isSmartCollection.mockReturnValue(false);
    const backup = {
      version: 3,
      root: [], tags: {}, usefulness: {}, smartCollections: [{ query: 'broken (' }]
    };

    await expect(service.importJson(fileWith(JSON.stringify(backup))))
      .rejects.toThrow('Invalid Smart Collection');
    expect(create).not.toHaveBeenCalled();
  });

  it('rolls back bookmarks, metadata, and collections when collection application fails', async () => {
    smartCollectionsService.mergeImported.mockImplementation(() => {
      throw new Error('Collection write failed');
    });
    const backup = {
      version: 3,
      root: [{ id: 'bookmark', title: 'Bookmark', url: 'https://example.com' }],
      tags: {}, usefulness: {}, smartCollections: [{
        id: 'collection', name: 'Collection', query: 'example', queryVersion: 1,
        sortColumn: 'title', sortDirection: 'asc', createdAt: 1, updatedAt: 1
      }]
    };

    await expect(service.importJson(fileWith(JSON.stringify(backup))))
      .rejects.toThrow('Collection write failed');
    expect(removeTree).toHaveBeenCalledWith('new-1');
    expect(smartCollectionsService.replaceAll).toHaveBeenCalledWith([]);
  });

  it('removes the partial tree and tag state when bookmark creation fails', async () => {
    const backup = {
      version: 1,
      root: [{
        id: '0',
        title: 'root',
        children: [
          {
            id: 'first',
            title: 'First',
            url: 'https://first.example'
          },
          {
            id: 'second',
            title: 'Second',
            url: 'https://second.example'
          }
        ]
      }],
      tags: { first: ['Imported'] }
    };
    create
      .mockReset()
      .mockResolvedValueOnce({ id: 'import-root', title: 'Imported' })
      .mockResolvedValueOnce({ id: 'created-first', title: 'First' })
      .mockRejectedValueOnce(new Error('Create failed'));

    await expect(service.importJson(fileWith(JSON.stringify(backup))))
      .rejects.toThrow('Create failed');

    expect(removeTree).toHaveBeenCalledWith('import-root');
    expect(tagsService.setTagsForBookmarks).toHaveBeenCalledTimes(1);
    expect(tagsService.setTagsForBookmarks).toHaveBeenCalledWith({
      'import-root': [],
      'created-first': []
    });
    expect(tagsService.addAvailableTags).not.toHaveBeenCalled();
    expect(tagsService.setAvailableTags).toHaveBeenCalledWith(['Existing']);
  });
});
