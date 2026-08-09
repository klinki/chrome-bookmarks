import { TestBed } from '@angular/core/testing';
import { vi, beforeEach, afterEach } from 'vitest';
import { Subject } from 'rxjs';
import { TagsService } from './tags.service';
import { BookmarksService, type BookmarkRemovedPayload } from './chrome/bookmarks/bookmarks.service';

describe('TagsService', () => {
    let originalChromeStorage: typeof chrome.storage;
    let service: TagsService;
    let mockStorage: { [key: string]: string };

    beforeEach(() => {
        originalChromeStorage = chrome.storage;
        (chrome as any).storage = undefined;
        // Reset mock storage for each test
        mockStorage = {};
        vi.spyOn(Storage.prototype, 'getItem')
            .mockImplementation((key: string) => mockStorage[key] || null);
        vi.spyOn(Storage.prototype, 'setItem')
            .mockImplementation((key: string, value: string) => {
                mockStorage[key] = value;
            });

        TestBed.configureTestingModule({});
        service = TestBed.inject(TagsService);
    });

    afterEach(() => {
        (chrome as any).storage = originalChromeStorage;
        vi.restoreAllMocks();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('recovers from malformed and invalid persisted values', () => {
        mockStorage['bookmarkTags'] = '{not-json';
        mockStorage['availableTags'] = JSON.stringify([' Work ', 42, 'Work', '']);

        (service as any).loadFromStorage();

        expect(service.bookmarkTags()).toEqual({});
        expect(service.availableTags()).toEqual(['Work']);
    });

    it('normalizes persisted bookmark tag records', () => {
        mockStorage['bookmarkTags'] = JSON.stringify({
            valid: [' Work ', 'Work', 'Personal'],
            invalid: 'not-an-array',
            empty: []
        });

        (service as any).loadFromStorage();

        expect(service.bookmarkTags()).toEqual({
            valid: ['Work', 'Personal']
        });
    });

    describe('getTagsForBookmark', () => {
        it('should return empty array for bookmark without tags', () => {
            const tags = service.getTagsForBookmark('123');
            expect(tags).toEqual([]);
        });

        it('should return tags for bookmark with tags', () => {
            service.setTagsForBookmark('123', ['tech', 'web']);
            const tags = service.getTagsForBookmark('123');
            expect(tags).toEqual(['tech', 'web']);
        });
    });

    describe('setTagsForBookmark', () => {
        it('should set tags for a bookmark', () => {
            service.setTagsForBookmark('123', ['tag1', 'tag2']);
            expect(service.getTagsForBookmark('123')).toEqual(['tag1', 'tag2']);
        });

        it('should remove bookmark from tags when empty array provided', () => {
            service.setTagsForBookmark('123', ['tag1']);
            service.setTagsForBookmark('123', []);
            expect(service.getTagsForBookmark('123')).toEqual([]);
        });
    });

    describe('addTagToBookmark', () => {
        it('should add a tag to a bookmark', () => {
            service.addTagToBookmark('123', 'newTag');
            expect(service.getTagsForBookmark('123')).toContain('newTag');
        });

        it('should not add duplicate tags', () => {
            service.addTagToBookmark('dup-test-123', 'tag');
            service.addTagToBookmark('dup-test-123', 'tag');
            expect(service.getTagsForBookmark('dup-test-123')).toEqual(['tag']);
        });
    });

    describe('addTagToBookmarks', () => {
        it('should add a tag to multiple bookmarks', () => {
            service.addTagToBookmarks(['1', '2', '3'], 'common-tag');
            expect(service.getTagsForBookmark('1')).toContain('common-tag');
            expect(service.getTagsForBookmark('2')).toContain('common-tag');
            expect(service.getTagsForBookmark('3')).toContain('common-tag');
        });
    });

    it('persists a batch of bookmark tag updates once', () => {
        const setItem = vi.mocked(Storage.prototype.setItem);
        setItem.mockClear();

        service.setTagsForBookmarks({
            '1': ['One'],
            '2': ['Two']
        });

        expect(service.bookmarkTags()).toEqual({
            '1': ['One'],
            '2': ['Two']
        });
        expect(setItem).toHaveBeenCalledTimes(1);
    });

    describe('removeTagFromBookmark', () => {
        it('should remove a tag from a bookmark', () => {
            service.setTagsForBookmark('123', ['a', 'b', 'c']);
            service.removeTagFromBookmark('123', 'b');
            expect(service.getTagsForBookmark('123')).toEqual(['a', 'c']);
        });
    });

    describe('removeTagFromBookmarks', () => {
        it('should remove a tag from multiple bookmarks', () => {
            service.setTagsForBookmark('1', ['a', 'common']);
            service.setTagsForBookmark('2', ['b', 'common']);
            service.removeTagFromBookmarks(['1', '2'], 'common');
            expect(service.getTagsForBookmark('1')).toEqual(['a']);
            expect(service.getTagsForBookmark('2')).toEqual(['b']);
        });
    });

    describe('availableTags', () => {
        it('should add an available tag', () => {
            service.addAvailableTag('new-tag');
            expect(service.availableTags()).toContain('new-tag');
        });

        it('should not add duplicate available tags', () => {
            service.addAvailableTag('tag');
            service.addAvailableTag('tag');
            const occurrences = service.availableTags().filter(t => t === 'tag').length;
            expect(occurrences).toBe(1);
        });

        it('should remove an available tag', () => {
            service.addAvailableTag('to-remove');
            service.removeAvailableTag('to-remove');
            expect(service.availableTags()).not.toContain('to-remove');
        });

        it('should set all available tags', () => {
            service.setAvailableTags(['tag1', 'tag2', 'tag3']);
            expect(service.availableTags()).toEqual(['tag1', 'tag2', 'tag3']);
        });
    });

    it('persists multiple available tags once', () => {
        const setItem = vi.mocked(Storage.prototype.setItem);
        setItem.mockClear();

        service.addAvailableTags(['One', 'Two', 'One']);

        expect(service.availableTags()).toEqual(['One', 'Two']);
        expect(setItem).toHaveBeenCalledTimes(1);
    });

    it('removes persisted metadata when Chrome reports a bookmark deletion', () => {
        const removed$ = new Subject<BookmarkRemovedPayload>();
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                TagsService,
                { provide: BookmarksService, useValue: { onRemovedEvent$: removed$ } }
            ]
        });
        service = TestBed.inject(TagsService);
        service.setTagsForBookmarks({
            removed: ['Old'],
            retained: ['Keep']
        });
        const setItem = vi.mocked(Storage.prototype.setItem);
        setItem.mockClear();

        removed$.next(['removed', {} as chrome.bookmarks.BookmarkRemoveInfo]);

        expect(service.bookmarkTags()).toEqual({ retained: ['Keep'] });
        expect(setItem).toHaveBeenCalledTimes(1);
    });
});
