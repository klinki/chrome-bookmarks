import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import {
  BookmarksService,
  type BookmarkRemovedPayload
} from './chrome/bookmarks/bookmarks.service';
import { UsefulnessService } from './usefulness.service';

describe('UsefulnessService', () => {
  let originalChromeStorage: typeof chrome.storage;
  let service: UsefulnessService;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    originalChromeStorage = chrome.storage;
    (chrome as any).storage = undefined;
    mockStorage = {};
    vi.spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key: string) => mockStorage[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementation((key: string, value: string) => {
        mockStorage[key] = value;
      });

    TestBed.configureTestingModule({});
    service = TestBed.inject(UsefulnessService);
  });

  afterEach(() => {
    (chrome as any).storage = originalChromeStorage;
    vi.restoreAllMocks();
  });

  it('normalizes persisted ratings and drops invalid entries', () => {
    mockStorage = {
      [UsefulnessService.STORAGE_KEY]: JSON.stringify({
        ai: { score: 4, source: 'ai' },
        manual: { score: 2, source: 'manual' },
        outOfRange: { score: 6, source: 'ai' },
        fractional: { score: 2.5, source: 'manual' },
        badSource: { score: 3, source: 'import' }
      })
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(UsefulnessService);

    expect(service.bookmarkUsefulness()).toEqual({
      ai: { score: 4, source: 'ai' },
      manual: { score: 2, source: 'manual' }
    });
  });

  it('recovers from malformed persisted JSON', () => {
    mockStorage = { [UsefulnessService.STORAGE_KEY]: '{invalid' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(UsefulnessService);

    expect(service.bookmarkUsefulness()).toEqual({});
  });

  it('stores manual provenance and clears a rating', () => {
    service.setManualScore('bookmark', 5);
    expect(service.getRatingForBookmark('bookmark')).toEqual({
      score: 5,
      source: 'manual'
    });

    service.setManualScore('bookmark', null);
    expect(service.getRatingForBookmark('bookmark')).toBeUndefined();
  });

  it('persists a batch of AI scores to bucket storage', async () => {
    const setItem = vi.mocked(Storage.prototype.setItem);
    setItem.mockClear();

    service.setAiScores({ first: 1, second: 5 });

    expect(service.bookmarkUsefulness()).toEqual({
      first: { score: 1, source: 'ai' },
      second: { score: 5, source: 'ai' }
    });
    await vi.waitFor(() => expect(setItem).toHaveBeenCalled());
    expect(setItem.mock.calls.some(([key]) => key.startsWith('bookmarkUsefulness:v2:bucket:')))
      .toBe(true);
  });

  it('rejects invalid programmatic ratings without changing state', () => {
    expect(() => service.setRatingsForBookmarks({
      invalid: { score: 0, source: 'ai' } as any
    })).toThrow('Invalid usefulness rating for bookmark invalid');
    expect(service.bookmarkUsefulness()).toEqual({});
  });

  it('removes metadata when Chrome reports a bookmark deletion', async () => {
    const removed$ = new Subject<BookmarkRemovedPayload>();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        UsefulnessService,
        { provide: BookmarksService, useValue: { onRemovedEvent$: removed$ } }
      ]
    });
    service = TestBed.inject(UsefulnessService);
    service.setAiScores({ removed: 2, retained: 4 });
    await vi.waitFor(() => expect(Storage.prototype.setItem).toHaveBeenCalled());
    const setItem = vi.mocked(Storage.prototype.setItem);
    setItem.mockClear();

    removed$.next(['removed', {} as BookmarkRemovedPayload[1]]);

    expect(service.bookmarkUsefulness()).toEqual({
      retained: { score: 4, source: 'ai' }
    });
    await vi.waitFor(() => expect(setItem).toHaveBeenCalled());
  });
});
