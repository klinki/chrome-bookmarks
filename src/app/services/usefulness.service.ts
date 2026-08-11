import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookmarksService } from './chrome/bookmarks/bookmarks.service';

export type UsefulnessScore = 1 | 2 | 3 | 4 | 5;
export type UsefulnessSource = 'ai' | 'manual';

export interface UsefulnessRating {
  score: UsefulnessScore;
  source: UsefulnessSource;
}

export interface BookmarkUsefulness {
  [bookmarkId: string]: UsefulnessRating;
}

export const USEFULNESS_RUBRIC: ReadonlyArray<{
  score: UsefulnessScore;
  description: string;
}> = [
  { score: 1, description: 'very low expected future value' },
  { score: 2, description: 'limited, narrow, or easily replaceable value' },
  { score: 3, description: 'useful in a specific situation' },
  { score: 4, description: 'strong, reusable reference or tool' },
  { score: 5, description: 'exceptional, distinctive, or repeatedly valuable' }
];

export function isUsefulnessScore(value: unknown): value is UsefulnessScore {
  return Number.isInteger(value) && typeof value === 'number' && value >= 1 && value <= 5;
}

@Injectable({
  providedIn: 'root'
})
export class UsefulnessService {
  public static readonly STORAGE_KEY = 'bookmarkUsefulness';

  private readonly bookmarksService = inject(BookmarksService, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  public readonly bookmarkUsefulness = signal<BookmarkUsefulness>({});

  constructor() {
    this.loadFromStorage();
    this.bookmarksService?.onRemovedEvent$
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([bookmarkId]) => this.removeBookmarkMetadata(bookmarkId));
  }

  public getRatingForBookmark(bookmarkId: string): UsefulnessRating | undefined {
    return this.bookmarkUsefulness()[bookmarkId];
  }

  public setManualScore(bookmarkId: string, score: UsefulnessScore | null): void {
    this.setRatingsForBookmarks({
      [bookmarkId]: score === null ? null : { score, source: 'manual' }
    });
  }

  public setAiScores(scoresByBookmarkId: Readonly<Record<string, UsefulnessScore>>): void {
    this.setRatingsForBookmarks(Object.fromEntries(
      Object.entries(scoresByBookmarkId).map(([bookmarkId, score]) => [
        bookmarkId,
        { score, source: 'ai' } satisfies UsefulnessRating
      ])
    ));
  }

  public setRatingsForBookmarks(
    ratingsByBookmarkId: Readonly<Record<string, UsefulnessRating | null>>
  ): void {
    const current = { ...this.bookmarkUsefulness() };
    let changed = false;

    for (const [bookmarkId, rating] of Object.entries(ratingsByBookmarkId)) {
      if (!bookmarkId) {
        continue;
      }
      if (rating === null) {
        if (bookmarkId in current) {
          delete current[bookmarkId];
          changed = true;
        }
        continue;
      }
      if (!this.isUsefulnessRating(rating)) {
        throw new Error(`Invalid usefulness rating for bookmark ${bookmarkId}`);
      }
      const existing = current[bookmarkId];
      if (existing?.score !== rating.score || existing.source !== rating.source) {
        current[bookmarkId] = { ...rating };
        changed = true;
      }
    }

    if (changed) {
      this.saveBookmarkUsefulness(current);
    }
  }

  private loadFromStorage(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([UsefulnessService.STORAGE_KEY], result => {
        this.bookmarkUsefulness.set(this.normalizeBookmarkUsefulness(
          result[UsefulnessService.STORAGE_KEY]
        ));
      });
      return;
    }

    const stored = localStorage.getItem(UsefulnessService.STORAGE_KEY);
    if (!stored) {
      return;
    }
    try {
      this.bookmarkUsefulness.set(this.normalizeBookmarkUsefulness(JSON.parse(stored)));
    } catch {
      this.bookmarkUsefulness.set({});
    }
  }

  private normalizeBookmarkUsefulness(value: unknown): BookmarkUsefulness {
    if (!this.isRecord(value)) {
      return {};
    }

    const normalized: BookmarkUsefulness = {};
    for (const [bookmarkId, rating] of Object.entries(value)) {
      if (bookmarkId && this.isUsefulnessRating(rating)) {
        normalized[bookmarkId] = { ...rating };
      }
    }
    return normalized;
  }

  private saveBookmarkUsefulness(ratings: BookmarkUsefulness): void {
    this.bookmarkUsefulness.set(ratings);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      void chrome.storage.local.set({ [UsefulnessService.STORAGE_KEY]: ratings });
    } else {
      localStorage.setItem(UsefulnessService.STORAGE_KEY, JSON.stringify(ratings));
    }
  }

  private removeBookmarkMetadata(bookmarkId: string): void {
    if (!(bookmarkId in this.bookmarkUsefulness())) {
      return;
    }
    const current = { ...this.bookmarkUsefulness() };
    delete current[bookmarkId];
    this.saveBookmarkUsefulness(current);
  }

  private isUsefulnessRating(value: unknown): value is UsefulnessRating {
    return this.isRecord(value)
      && isUsefulnessScore(value['score'])
      && (value['source'] === 'ai' || value['source'] === 'manual');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
