/* tslint:disable:no-unused-variable */

import { waitForAsync, inject, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BookmarksService } from './bookmarks.service';

describe('Bookmarks Service', () => {
  beforeEach(() => {
    // Mock Chrome bookmarks API
    (globalThis as any).chrome = {
      bookmarks: {
        getTree: vi.fn(),
        getSubTree: vi.fn(),
        search: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        move: vi.fn(),
        onCreated: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() },
        onChanged: { addListener: vi.fn() },
        onMoved: { addListener: vi.fn() },
        onChildrenReordered: { addListener: vi.fn() },
        onImportBegan: { addListener: vi.fn() },
        onImportEnded: { addListener: vi.fn() },
      }
    };
    TestBed.configureTestingModule({ providers: [BookmarksService] });
   });

  it('should ...',
    waitForAsync(inject([BookmarksService], (service: BookmarksService) => {
      expect(service).toBeTruthy();
    })));
});

