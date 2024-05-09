import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {SearchBoxComponent} from "../search-box";
import {TreeViewComponent} from "../tree-view";
import {ListViewComponent} from "../list-view";
import {AsyncPipe} from "@angular/common";
import {BookmarkDetailComponent} from "../bookmark-detail/bookmark-detail.component";
import {BookmarksFacadeService} from "../../services/bookmarks-facade.service";

@Component({
  standalone: true,
  selector: 'app-bookmarks-view',
  templateUrl: 'bookmarks-view.component.html',
  imports: [
    SearchBoxComponent,
    TreeViewComponent,
    ListViewComponent,
    AsyncPipe,
    BookmarkDetailComponent
  ],
  styleUrls: ['./bookmarks-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookmarksViewComponent implements OnInit {
  public selectedItems$ = this.facade.selectedBookmarkIds$;
  public directories$ = this.facade.directories$;
  public items$ = this.facade.items$;
  public selectedBookmarks$ = this.facade.selectedBookmarks$;

  constructor(private facade: BookmarksFacadeService) {
  }

  ngOnInit() {
  }

  public search(searchTerm: string|null) {
    this.facade.search(searchTerm);
  }
}
