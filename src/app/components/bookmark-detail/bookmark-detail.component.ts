import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-bookmark-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bookmark-detail.component.html',
  styleUrl: './bookmark-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookmarkDetailComponent {

  @Input()
  public selection: chrome.bookmarks.BookmarkTreeNode[] | null = [];

  public get onlyBookmarksSelected() {
    return !this.selection?.some(bookmark => {
      return (bookmark.children?.length ?? 0) > 0;
    });
  }

  public get singleItemSelected() {
    return this.selection?.length == 1;
  }

  public get mixedSelection() {
    return !this.singleItemSelected && !this.onlyBookmarksSelected;
  }
}
