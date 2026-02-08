import { ChangeDetectionStrategy, Component, computed, inject, input, signal, effect } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TagsService } from '../../services/tags.service';
import { AiService } from '../../services/ai.service';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';

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
  private fb = inject(FormBuilder);

  public selection = input<chrome.bookmarks.BookmarkTreeNode[] | null>([]);
  public isCategorizing = signal(false);
  public isSaving = signal(false);

  public editForm = this.fb.group({
    title: [''],
    url: ['']
  });

  private currentId: string | null = null;

  constructor() {
    // Update form when selection changes
    effect(() => {
      const sel = this.selection();
      if (sel && sel.length === 1) {
        const item = sel[0];
        // Only update if the selected item has changed to avoid overwriting form state
        if (item.id !== this.currentId) {
          this.currentId = item.id;
          this.editForm.patchValue({
            title: item.title,
            url: item.url ?? ''
          });
          this.editForm.markAsPristine();
        }
      } else {
        this.currentId = null;
      }
    });
  }

  public async saveChanges() {
    const sel = this.selection();
    if (!sel || sel.length !== 1) return;

    this.isSaving.set(true);
    try {
      await this.bookmarksFacade.updateBookmark(sel[0].id, {
        title: this.editForm.value.title ?? undefined,
        url: this.editForm.value.url ?? undefined
      });
      this.editForm.markAsPristine();
    } catch (e) {
      console.error('Failed to save bookmark:', e);
      alert('Failed to save bookmark. Check console for details.');
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

      for (const [id, tags] of Object.entries(suggestions)) {
        // Merge suggested tags with existing ones
        const current = this.tagsService.getTagsForBookmark(id);
        const merged = Array.from(new Set([...current, ...tags]));
        this.tagsService.setTagsForBookmark(id, merged);

        // Also ensure suggested tags are in the available pool
        tags.forEach(tag => this.tagsService.addAvailableTag(tag));
      }
    } catch (e) {
      console.error('AI categorization failed:', e);
      alert('AI categorization failed. Check console for details.');
    } finally {
      this.isCategorizing.set(false);
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
