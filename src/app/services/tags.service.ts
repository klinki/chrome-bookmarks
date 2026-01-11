import { Injectable, signal } from '@angular/core';

export interface BookmarkTags {
    [bookmarkId: string]: string[];
}

@Injectable({
    providedIn: 'root'
})
export class TagsService {
    private readonly STORAGE_KEY_BOOKMARK_TAGS = 'bookmarkTags';
    private readonly STORAGE_KEY_AVAILABLE_TAGS = 'availableTags';

    public bookmarkTags = signal<BookmarkTags>({});
    public availableTags = signal<string[]>([]);

    constructor() {
        this.loadFromStorage();
    }

    private async loadFromStorage() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get([this.STORAGE_KEY_BOOKMARK_TAGS, this.STORAGE_KEY_AVAILABLE_TAGS], (result) => {
                if (result[this.STORAGE_KEY_BOOKMARK_TAGS]) {
                    this.bookmarkTags.set(result[this.STORAGE_KEY_BOOKMARK_TAGS]);
                }
                if (result[this.STORAGE_KEY_AVAILABLE_TAGS]) {
                    this.availableTags.set(result[this.STORAGE_KEY_AVAILABLE_TAGS]);
                }
            });
        } else {
            // Fallback for local development
            const savedBookmarkTags = localStorage.getItem(this.STORAGE_KEY_BOOKMARK_TAGS);
            if (savedBookmarkTags) {
                this.bookmarkTags.set(JSON.parse(savedBookmarkTags));
            }
            const savedAvailableTags = localStorage.getItem(this.STORAGE_KEY_AVAILABLE_TAGS);
            if (savedAvailableTags) {
                this.availableTags.set(JSON.parse(savedAvailableTags));
            }
        }
    }

    private saveBookmarkTags(tags: BookmarkTags) {
        this.bookmarkTags.set(tags);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [this.STORAGE_KEY_BOOKMARK_TAGS]: tags });
        } else {
            localStorage.setItem(this.STORAGE_KEY_BOOKMARK_TAGS, JSON.stringify(tags));
        }
    }

    private saveAvailableTags(tags: string[]) {
        this.availableTags.set(tags);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [this.STORAGE_KEY_AVAILABLE_TAGS]: tags });
        } else {
            localStorage.setItem(this.STORAGE_KEY_AVAILABLE_TAGS, JSON.stringify(tags));
        }
    }

    public getTagsForBookmark(bookmarkId: string): string[] {
        return this.bookmarkTags()[bookmarkId] || [];
    }

    public setTagsForBookmark(bookmarkId: string, tags: string[]) {
        const current = { ...this.bookmarkTags() };
        if (tags.length === 0) {
            delete current[bookmarkId];
        } else {
            current[bookmarkId] = tags;
        }
        this.saveBookmarkTags(current);
    }

    public addTagToBookmark(bookmarkId: string, tag: string) {
        const tags = this.getTagsForBookmark(bookmarkId);
        if (!tags.includes(tag)) {
            this.setTagsForBookmark(bookmarkId, [...tags, tag]);
        }
    }

    public addTagToBookmarks(bookmarkIds: string[], tag: string) {
        const current = { ...this.bookmarkTags() };
        let changed = false;

        bookmarkIds.forEach(id => {
            const tags = current[id] || [];
            if (!tags.includes(tag)) {
                current[id] = [...tags, tag];
                changed = true;
            }
        });

        if (changed) {
            this.saveBookmarkTags(current);
        }
    }

    public removeTagFromBookmark(bookmarkId: string, tag: string) {
        const tags = this.getTagsForBookmark(bookmarkId);
        this.setTagsForBookmark(bookmarkId, tags.filter(t => t !== tag));
    }

    public removeTagFromBookmarks(bookmarkIds: string[], tag: string) {
        const current = { ...this.bookmarkTags() };
        let changed = false;

        bookmarkIds.forEach(id => {
            const tags = current[id];
            if (tags && tags.includes(tag)) {
                const newTags = tags.filter(t => t !== tag);
                if (newTags.length === 0) {
                    delete current[id];
                } else {
                    current[id] = newTags;
                }
                changed = true;
            }
        });

        if (changed) {
            this.saveBookmarkTags(current);
        }
    }

    public setAvailableTags(tags: string[]) {
        this.saveAvailableTags(tags);
    }

    public addAvailableTag(tag: string) {
        const current = this.availableTags();
        if (!current.includes(tag)) {
            this.saveAvailableTags([...current, tag]);
        }
    }

    public removeAvailableTag(tag: string) {
        this.saveAvailableTags(this.availableTags().filter(t => t !== tag));
    }
}
