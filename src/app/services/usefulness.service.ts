import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookmarksService } from './chrome/bookmarks/bookmarks.service';
import { BucketedBookmarkMetadataStore } from './bucketed-bookmark-metadata.store';

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
  public static readonly STORAGE_NAMESPACE = 'bookmarkUsefulness:v2';

  private readonly bookmarksService = inject(BookmarksService, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly metadataStore = new BucketedBookmarkMetadataStore<UsefulnessRating>({
    legacyKey: UsefulnessService.STORAGE_KEY,
    namespace: UsefulnessService.STORAGE_NAMESPACE,
    normalizeEntry: value => this.isUsefulnessRating(value) ? { ...value } : undefined
  });

  public readonly bookmarkUsefulness = this.metadataStore.values;
  public readonly ready = this.metadataStore.ready;
  public readonly loadError = this.metadataStore.loadError;

  constructor() {
    this.bookmarksService?.onRemovedEvent$
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([bookmarkId]) => this.removeBookmarkMetadata(bookmarkId));
  }

  public getRatingForBookmark(bookmarkId: string): UsefulnessRating | undefined {
    return this.bookmarkUsefulness()[bookmarkId];
  }

  public whenReady(): Promise<void> {
    return this.metadataStore.whenReady();
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
    const updates: Record<string, UsefulnessRating | null> = {};

    for (const [bookmarkId, rating] of Object.entries(ratingsByBookmarkId)) {
      if (!bookmarkId) {
        continue;
      }
      if (rating === null) {
        if (bookmarkId in this.bookmarkUsefulness()) {
          updates[bookmarkId] = null;
        }
        continue;
      }
      if (!this.isUsefulnessRating(rating)) {
        throw new Error(`Invalid usefulness rating for bookmark ${bookmarkId}`);
      }
      const existing = this.bookmarkUsefulness()[bookmarkId];
      if (existing?.score !== rating.score || existing.source !== rating.source) {
        updates[bookmarkId] = { ...rating };
      }
    }

    this.metadataStore.setEntries(updates);
  }

  private removeBookmarkMetadata(bookmarkId: string): void {
    if (!(bookmarkId in this.bookmarkUsefulness())) {
      return;
    }
    this.metadataStore.setEntries({ [bookmarkId]: null });
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
