import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookmarksService } from './chrome/bookmarks/bookmarks.service';
import { BucketedBookmarkMetadataStore } from './bucketed-bookmark-metadata.store';

export interface BookmarkTags {
  [bookmarkId: string]: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TagsService {
  public static readonly STORAGE_KEY = 'bookmarkTags';
  public static readonly STORAGE_NAMESPACE = 'bookmarkTags:v2';
  private readonly STORAGE_KEY_AVAILABLE_TAGS = 'availableTags';
  private readonly bookmarksService = inject(BookmarksService, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly metadataStore = new BucketedBookmarkMetadataStore<string[]>({
    legacyKey: TagsService.STORAGE_KEY,
    namespace: TagsService.STORAGE_NAMESPACE,
    normalizeEntry: value => {
      const tags = this.normalizeTagList(value);
      return tags.length > 0 ? tags : undefined;
    }
  });

  public bookmarkTags = this.metadataStore.values;
  public availableTags = signal<string[]>([]);
  public readonly ready = this.metadataStore.ready;
  public readonly loadError = this.metadataStore.loadError;

  constructor() {
    this.loadAvailableTags();
    this.bookmarksService?.onRemovedEvent$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([bookmarkId]) => this.removeBookmarkMetadata(bookmarkId));
  }

  public whenReady(): Promise<void> {
    return this.metadataStore.whenReady();
  }

  private loadAvailableTags(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(
        [this.STORAGE_KEY_AVAILABLE_TAGS],
        result => {
          this.availableTags.set(this.normalizeTagList(
            result[this.STORAGE_KEY_AVAILABLE_TAGS]
          ));
        }
      );
      return;
    }

    this.availableTags.set(this.parseStoredAvailableTags(
      localStorage.getItem(this.STORAGE_KEY_AVAILABLE_TAGS)
    ));
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
    this.metadataStore.setEntries({ [bookmarkId]: null });
  }

  public getTagsForBookmark(bookmarkId: string): string[] {
    return this.bookmarkTags()[bookmarkId] || [];
  }

  public setTagsForBookmark(bookmarkId: string, tags: string[]): void {
    this.setTagsForBookmarks({ [bookmarkId]: tags });
  }

  public setTagsForBookmarks(tagsByBookmarkId: Readonly<Record<string, readonly string[]>>): void {
    const updates: Record<string, string[] | null> = {};
    for (const [bookmarkId, tags] of Object.entries(tagsByBookmarkId)) {
      const normalizedTags = this.normalizeTagList(tags);
      if (normalizedTags.length === 0) {
        if (bookmarkId in this.bookmarkTags()) {
          updates[bookmarkId] = null;
        }
      } else if (JSON.stringify(this.bookmarkTags()[bookmarkId] ?? []) !== JSON.stringify(normalizedTags)) {
        updates[bookmarkId] = normalizedTags;
      }
    }
    this.metadataStore.setEntries(updates);
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
