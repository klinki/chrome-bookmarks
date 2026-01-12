import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TagsService } from '../../services/tags.service';
import { AiService } from '../../services/ai.service';

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

  public selection = input<chrome.bookmarks.BookmarkTreeNode[] | null>([]);
  public isCategorizing = signal(false);

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
