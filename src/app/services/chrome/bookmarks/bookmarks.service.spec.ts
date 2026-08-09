/* tslint:disable:no-unused-variable */

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarksService } from './bookmarks.service';

describe('Bookmarks Service', () => {
  const bookmarkApi = {
    get: vi.fn(),
    getChildren: vi.fn(),
    getRecent: vi.fn(),
    getTree: vi.fn(),
    getSubTree: vi.fn(),
    search: vi.fn(),
    create: vi.fn(),
    move: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeTree: vi.fn()
  };
  const chromeEvent = {
    addListener: vi.fn(),
    removeListener: vi.fn()
  };
  let service: BookmarksService;

  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        bookmarks: {
          ...bookmarkApi,
          onCreated: chromeEvent,
          onRemoved: chromeEvent,
          onChanged: chromeEvent,
          onMoved: chromeEvent,
          onChildrenReordered: chromeEvent,
          onImportBegan: chromeEvent,
          onImportEnded: chromeEvent
        }
      },
      writable: true
    });
    TestBed.configureTestingModule({ providers: [BookmarksService] });
    service = TestBed.inject(BookmarksService);
  });

  it('creates the service', () => {
    expect(service).toBeTruthy();
  });

  const createArg = { parentId: '1', title: 'New bookmark', url: 'https://example.com' };
  const destination = { parentId: '2', index: 0 };
  const changes = { title: 'Renamed' };
  const rejectionCases = [
    { name: 'get', method: bookmarkApi.get, invoke: () => service.get('1'), args: ['1'] },
    { name: 'getChildren', method: bookmarkApi.getChildren, invoke: () => service.getChildren('1'), args: ['1'] },
    { name: 'getRecent', method: bookmarkApi.getRecent, invoke: () => service.getRecent(5), args: [5] },
    { name: 'getTree', method: bookmarkApi.getTree, invoke: () => service.getTree(), args: [] },
    { name: 'getSubTree', method: bookmarkApi.getSubTree, invoke: () => service.getSubTree('1'), args: ['1'] },
    { name: 'search', method: bookmarkApi.search, invoke: () => service.search('query'), args: ['query'] },
    { name: 'create', method: bookmarkApi.create, invoke: () => service.create(createArg), args: [createArg] },
    { name: 'move', method: bookmarkApi.move, invoke: () => service.move('1', destination), args: ['1', destination] },
    { name: 'update', method: bookmarkApi.update, invoke: () => service.update('1', changes), args: ['1', changes] },
    { name: 'remove', method: bookmarkApi.remove, invoke: () => service.remove('1'), args: ['1'] },
    { name: 'removeTree', method: bookmarkApi.removeTree, invoke: () => service.removeTree('1'), args: ['1'] }
  ];

  it.each(rejectionCases)('propagates native $name rejections', async ({ method, invoke, args }) => {
    const failure = new Error('Chrome API failed');
    method.mockRejectedValueOnce(failure);

    const result = invoke();

    expect(method).toHaveBeenCalledWith(...args);
    await expect(result).rejects.toBe(failure);
  });
});

