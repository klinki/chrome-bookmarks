import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookmarksService } from './chrome/bookmarks/bookmarks.service';

export interface BookmarkTags {
  [bookmarkId: string]: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TagsService {
  private readonly STORAGE_KEY_BOOKMARK_TAGS = 'bookmarkTags';
  private readonly STORAGE_KEY_AVAILABLE_TAGS = 'availableTags';
  private readonly bookmarksService = inject(BookmarksService, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  public bookmarkTags = signal<BookmarkTags>({});
  public availableTags = signal<string[]>([]);

  constructor() {
    this.loadFromStorage();
    this.bookmarksService?.onRemovedEvent$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([bookmarkId]) => this.removeBookmarkMetadata(bookmarkId));
  }

  private loadFromStorage(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(
        [this.STORAGE_KEY_BOOKMARK_TAGS, this.STORAGE_KEY_AVAILABLE_TAGS],
        result => {
          this.bookmarkTags.set(this.normalizeBookmarkTags(
            result[this.STORAGE_KEY_BOOKMARK_TAGS]
          ));
          this.availableTags.set(this.normalizeTagList(
            result[this.STORAGE_KEY_AVAILABLE_TAGS]
          ));
        }
      );
      return;
    }

    this.bookmarkTags.set(this.parseStoredBookmarkTags(
      localStorage.getItem(this.STORAGE_KEY_BOOKMARK_TAGS)
    ));
    this.availableTags.set(this.parseStoredAvailableTags(
      localStorage.getItem(this.STORAGE_KEY_AVAILABLE_TAGS)
    ));
  }

  private parseStoredBookmarkTags(value: string | null): BookmarkTags {
    if (!value) {
      return {};
    }
    try {
      return this.normalizeBookmarkTags(JSON.parse(value));
    } catch {
      return {};
    }
  }

  private parseStoredAvailableTags(value: string | null): string[] {
    if (!value) {
      return [];
    }
    try {
      return this.normalizeTagList(JSON.parse(value));
    } catch {
      return [];
    }
  }

  private normalizeBookmarkTags(value: unknown): BookmarkTags {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    const normalized: BookmarkTags = {};
    for (const [bookmarkId, tags] of Object.entries(value)) {
      if (!bookmarkId) {
        continue;
      }
      const normalizedTags = this.normalizeTagList(tags);
      if (normalizedTags.length > 0) {
        normalized[bookmarkId] = normalizedTags;
      }
    }
    return normalized;
  }

  private normalizeTagList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return Array.from(new Set(
      value
        .filter((tag): tag is string => typeof tag === 'string')
        .map(tag => tag.trim())
        .filter(Boolean)
    ));
  }

  private saveBookmarkTags(tags: BookmarkTags): void {
    this.bookmarkTags.set(tags);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      void chrome.storage.local.set({ [this.STORAGE_KEY_BOOKMARK_TAGS]: tags });
    } else {
      localStorage.setItem(this.STORAGE_KEY_BOOKMARK_TAGS, JSON.stringify(tags));
    }
  }

  private saveAvailableTags(tags: string[]): void {
    this.availableTags.set(tags);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      void chrome.storage.local.set({ [this.STORAGE_KEY_AVAILABLE_TAGS]: tags });
    } else {
      localStorage.setItem(this.STORAGE_KEY_AVAILABLE_TAGS, JSON.stringify(tags));
    }
  }

  private removeBookmarkMetadata(bookmarkId: string): void {
    if (!(bookmarkId in this.bookmarkTags())) {
      return;
    }
    const current = { ...this.bookmarkTags() };
    delete current[bookmarkId];
    this.saveBookmarkTags(current);
  }

  public getTagsForBookmark(bookmarkId: string): string[] {
    return this.bookmarkTags()[bookmarkId] || [];
  }

  public setTagsForBookmark(bookmarkId: string, tags: string[]): void {
    this.setTagsForBookmarks({ [bookmarkId]: tags });
  }

  public setTagsForBookmarks(tagsByBookmarkId: Readonly<Record<string, readonly string[]>>): void {
    const current = { ...this.bookmarkTags() };
    let changed = false;
    for (const [bookmarkId, tags] of Object.entries(tagsByBookmarkId)) {
      const normalizedTags = this.normalizeTagList(tags);
      if (normalizedTags.length === 0) {
        if (bookmarkId in current) {
          delete current[bookmarkId];
          changed = true;
        }
      } else if (JSON.stringify(current[bookmarkId] ?? []) !== JSON.stringify(normalizedTags)) {
        current[bookmarkId] = normalizedTags;
        changed = true;
      }
    }
    if (changed) {
      this.saveBookmarkTags(current);
    }
  }

  public addTagToBookmark(bookmarkId: string, tag: string): void {
    const tags = this.getTagsForBookmark(bookmarkId);
    if (!tags.includes(tag)) {
      this.setTagsForBookmark(bookmarkId, [...tags, tag]);
    }
  }

  public addTagToBookmarks(bookmarkIds: string[], tag: string): void {
    const updates = Object.fromEntries(bookmarkIds.map(id => [
      id,
      [...this.getTagsForBookmark(id), tag]
    ]));
    this.setTagsForBookmarks(updates);
  }

  public removeTagFromBookmark(bookmarkId: string, tag: string): void {
    this.setTagsForBookmark(
      bookmarkId,
      this.getTagsForBookmark(bookmarkId).filter(current => current !== tag)
    );
  }

  public removeTagFromBookmarks(bookmarkIds: string[], tag: string): void {
    const updates = Object.fromEntries(bookmarkIds.map(id => [
      id,
      this.getTagsForBookmark(id).filter(current => current !== tag)
    ]));
    this.setTagsForBookmarks(updates);
  }

  public setAvailableTags(tags: string[]): void {
    this.saveAvailableTags(this.normalizeTagList(tags));
  }

  public addAvailableTag(tag: string): void {
    this.addAvailableTags([tag]);
  }

  public addAvailableTags(tags: Iterable<string>): void {
    const merged = this.normalizeTagList([...this.availableTags(), ...tags]);
    if (merged.length !== this.availableTags().length) {
      this.saveAvailableTags(merged);
    }
  }

  public removeAvailableTag(tag: string): void {
    this.saveAvailableTags(this.availableTags().filter(current => current !== tag));
  }
}
