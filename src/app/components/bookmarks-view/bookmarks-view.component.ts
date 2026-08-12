import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { SearchBoxComponent } from "../search-box";
import { TreeViewComponent } from "../tree-view";
import { ListViewComponent } from "../list-view";
import { BookmarkDetailComponent } from "../bookmark-detail/bookmark-detail.component";
import { BookmarksFacadeService } from "../../services/bookmarks-facade.service";
import { DragAndDropService } from "../../services/drag-and-drop.service";

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

interface SearchRouteState {
  query: string;
  scopeFolderId?: string;
}

@Component({
  standalone: true,
  selector: 'app-bookmarks-view',
  templateUrl: 'bookmarks-view.component.html',
  imports: [
    CommonModule,
    RouterModule,
    SearchBoxComponent,
    TreeViewComponent,
    ListViewComponent,
    BookmarkDetailComponent
  ],
  styleUrls: ['./bookmarks-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookmarksViewComponent {
  private facade = inject(BookmarksFacadeService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private routeUpdates = new Subject<SearchRouteState>();

  public selectedBookmarkIds = this.facade.selectedBookmarkIds;
  public directories = this.facade.directories;
  public items = this.facade.items;
  public selectedBookmarks = this.facade.selectedBookmarks;
  public searchTerm = this.facade.searchTerm;
  public searchError = this.facade.searchError;
  public searchChips = this.facade.searchChips;
  public searchScopeFolderId = this.facade.searchScopeFolderId;
  public searchScopeFolders = this.facade.searchScopeFolders;

  constructor() {
    const destroyRef = inject(DestroyRef);
    inject(DragAndDropService).start();
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(params => {
        this.facade.search(params.get('q') ?? '');
        this.facade.setSearchScope(params.get('scope') ?? undefined);
      });
    this.routeUpdates.pipe(
      debounceTime(300),
      distinctUntilChanged((left, right) =>
        left.query === right.query && left.scopeFolderId === right.scopeFolderId),
      takeUntilDestroyed(destroyRef)
    ).subscribe(state => {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          q: state.query || null,
          scope: state.scopeFolderId || null
        },
        queryParamsHandling: 'merge'
      });
    });
  }

  public search(searchTerm: string | null) {
    this.facade.search(searchTerm);
    this.updateRoute(searchTerm ?? '', this.searchScopeFolderId());
  }

  public setScope(folderId?: string): void {
    this.facade.setSearchScope(folderId);
    this.updateRoute(this.searchTerm(), folderId);
  }

  public removeChip(index: number): void {
    this.facade.removeSearchChip(index);
    this.updateRoute(this.searchTerm(), this.searchScopeFolderId());
  }

  public canonicalizeSearch(): void {
    this.facade.canonicalizeSearch();
    this.updateRoute(this.searchTerm(), this.searchScopeFolderId());
  }

  private updateRoute(query: string, scopeFolderId?: string): void {
    this.routeUpdates.next({ query, scopeFolderId });
  }
}
