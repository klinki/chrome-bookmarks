import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-bookmark-detail',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './bookmark-detail.component.html',
  styleUrl: './bookmark-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookmarkDetailComponent {
  public selection = input<chrome.bookmarks.BookmarkTreeNode[] | null>([]);

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
    return this.multipleItemsSelected() && !sel.some(bookmark => (bookmark.children?.length ?? 0) > 0);
  });

  public mixedSelection = computed(() => {
    return this.multipleItemsSelected() && !this.onlyBookmarksSelected();
  });
}
