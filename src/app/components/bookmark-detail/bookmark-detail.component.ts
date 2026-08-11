import { ChangeDetectionStrategy, Component, computed, inject, input, signal, effect } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TagsService } from '../../services/tags.service';
import { AiService } from '../../services/ai.service';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { developmentLogger } from '../../services/development-logger';
import {
  isUsefulnessScore,
  USEFULNESS_RUBRIC,
  UsefulnessService
} from '../../services/usefulness.service';

@Component({
  selector: 'app-bookmark-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './bookmark-detail.component.html',
  styleUrl: './bookmark-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookmarkDetailComponent {
  private tagsService = inject(TagsService);
  private aiService = inject(AiService);
  private bookmarksFacade = inject(BookmarksFacadeService);
  private usefulnessService = inject(UsefulnessService);
  private fb = inject(FormBuilder);

  public selection = input<chrome.bookmarks.BookmarkTreeNode[] | null>([]);
  public isCategorizing = signal(false);
  public isRatingUsefulness = signal(false);
  public isSaving = signal(false);
  public readonly usefulnessRubric = USEFULNESS_RUBRIC;

  public editForm = this.fb.group({
    title: [''],
    url: ['']
  });

  private currentId: string | null = null;

  constructor() {
    effect(() => {
      const sel = this.selection();
      if (!sel || sel.length !== 1) {
        this.currentId = null;
        return;
      }

      const item = sel[0];
      const incoming = {
        title: item.title,
        url: item.url ?? ''
      };
      if (item.id !== this.currentId) {
        this.currentId = item.id;
        this.editForm.reset(incoming);
        return;
      }

      const patch: Partial<typeof incoming> = {};
      if (this.editForm.controls.title.pristine) {
        patch.title = incoming.title;
      }
      if (this.editForm.controls.url.pristine) {
        patch.url = incoming.url;
      }
      if (Object.keys(patch).length > 0) {
        this.editForm.patchValue(patch);
      }
    });
  }

  public async saveChanges() {
    const sel = this.selection();
    if (!sel || sel.length !== 1) return;

    const savedId = sel[0].id;
    const submitted = {
      title: this.editForm.value.title ?? '',
      url: this.editForm.value.url ?? ''
    };
    this.isSaving.set(true);
    try {
      await this.bookmarksFacade.updateBookmark(savedId, {
        title: submitted.title || undefined,
        url: submitted.url || undefined
      });

      const currentSelection = this.selection();
      const currentValue = this.editForm.getRawValue();
      if (
        currentSelection?.length === 1
        && currentSelection[0].id === savedId
        && currentValue.title === submitted.title
        && currentValue.url === submitted.url
      ) {
        this.editForm.markAsPristine();
      }
    } catch (error) {
      developmentLogger.error('bookmark.save.failed', error);
      alert('Failed to save bookmark.');
    } finally {
      this.isSaving.set(false);
    }
  }

  public currentTags = computed(() => {
    const sel = this.selection() ?? [];
    if (sel.length === 1) {
      return this.tagsService.getTagsForBookmark(sel[0].id);
    }

    // For multiple items, return intersection of tags
    if (sel.length > 1) {
      const firstTags = this.tagsService.getTagsForBookmark(sel[0].id);
      return firstTags.filter(tag =>
        sel.every(item => this.tagsService.getTagsForBookmark(item.id).includes(tag))
      );
    }

    return [];
  });

  public currentUsefulnessScore = computed(() => {
    const sel = this.selection() ?? [];
    return sel.length === 1
      ? this.usefulnessService.getRatingForBookmark(sel[0].id)?.score
      : undefined;
  });

  public isFolder = computed(() => {
    const sel = this.selection() ?? [];
    return sel.length > 0 && sel[0].url === undefined;
  });

  public singleItemSelected = computed(() => {
    return (this.selection() ?? []).length === 1;
  });

  public singleBookmarkSelected = computed(() => {
    return this.singleItemSelected() && !this.isFolder();
  });

  public singleFolderSelected = computed(() => {
    return this.singleItemSelected() && this.isFolder();
  });

  public multipleItemsSelected = computed(() => {
    return (this.selection() ?? []).length > 1;
  });

  public onlyBookmarksSelected = computed(() => {
    const sel = this.selection() ?? [];
    // If none of the selected items are folders (url is undefined means folder)
    return this.multipleItemsSelected() && !sel.some(item => item.url === undefined);
  });

  public mixedSelection = computed(() => {
    return this.multipleItemsSelected() && !this.onlyBookmarksSelected();
  });

  public async aiCategorize() {
    const sel = this.selection() ?? [];
    if (sel.length === 0) return;

    this.isCategorizing.set(true);
    try {
      const suggestions = await this.aiService.suggestTags(sel, this.tagsService.availableTags());

      const tagUpdates: Record<string, string[]> = {};
      const newAvailableTags: string[] = [];
      for (const [id, tags] of Object.entries(suggestions)) {
        const current = this.tagsService.getTagsForBookmark(id);
        tagUpdates[id] = Array.from(new Set([...current, ...tags]));
        newAvailableTags.push(...tags);
      }
      this.tagsService.setTagsForBookmarks(tagUpdates);
      this.tagsService.addAvailableTags(newAvailableTags);
    } catch (error) {
      developmentLogger.error('bookmark.categorization.failed', error);
      alert('AI categorization failed.');
    } finally {
      this.isCategorizing.set(false);
    }
  }

  public async aiRateUsefulness(): Promise<void> {
    const bookmarks = (this.selection() ?? []).filter(item => !!item.url);
    if (bookmarks.length === 0) {
      return;
    }

    this.isRatingUsefulness.set(true);
    try {
      const scores = await this.aiService.scoreUsefulness(bookmarks);
      this.usefulnessService.setAiScores(scores);
    } catch (error) {
      developmentLogger.error('bookmark.usefulness.rating.failed', error);
      alert('AI usefulness rating failed.');
    } finally {
      this.isRatingUsefulness.set(false);
    }
  }

  public setManualUsefulness(event: Event): void {
    const sel = this.selection() ?? [];
    if (sel.length !== 1 || !(event.target instanceof HTMLSelectElement)) {
      return;
    }

    if (event.target.value === '') {
      this.usefulnessService.setManualScore(sel[0].id, null);
      return;
    }

    const score = Number(event.target.value);
    if (isUsefulnessScore(score)) {
      this.usefulnessService.setManualScore(sel[0].id, score);
    }
  }

  public removeTag(tag: string) {
    const sel = this.selection() ?? [];
    if (sel.length === 1) {
      this.tagsService.removeTagFromBookmark(sel[0].id, tag);
    } else if (sel.length > 1) {
      this.tagsService.removeTagFromBookmarks(sel.map(b => b.id), tag);
    }
  }

  public addTag(input: HTMLInputElement) {
    const val = input.value.trim();
    const sel = this.selection() ?? [];
    if (val) {
      if (sel.length === 1) {
        this.tagsService.addTagToBookmark(sel[0].id, val);
      } else if (sel.length > 1) {
        this.tagsService.addTagToBookmarks(sel.map(b => b.id), val);
      }
      this.tagsService.addAvailableTag(val);
      input.value = '';
    }
  }
}
