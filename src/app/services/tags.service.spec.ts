import { TestBed } from '@angular/core/testing';
import { TagsService, BookmarkTags } from './tags.service';

describe('TagsService', () => {
    let service: TagsService;

    beforeEach(() => {
        // Mock localStorage
        const mockStorage: { [key: string]: string } = {};
        spyOn(localStorage, 'getItem').and.callFake((key: string) => mockStorage[key] || null);
        spyOn(localStorage, 'setItem').and.callFake((key: string, value: string) => {
            mockStorage[key] = value;
        });

        TestBed.configureTestingModule({});
        service = TestBed.inject(TagsService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
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
            service.addTagToBookmark('123', 'tag');
            service.addTagToBookmark('123', 'tag');
            expect(service.getTagsForBookmark('123')).toEqual(['tag']);
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
});
