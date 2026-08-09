import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportExportService } from './import-export.service';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { TagsService } from './tags.service';

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
        { provide: TagsService, useValue: tagsService }
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
