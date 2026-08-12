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
  collectionId?: string;
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
  public selectedSmartCollection = this.facade.selectedSmartCollection;

  constructor() {
    const destroyRef = inject(DestroyRef);
    inject(DragAndDropService).start();
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(params => {
        const collectionId = params.get('collection');
        if (collectionId) {
          void this.facade.smartCollectionsService.whenReady().then(() =>
            this.facade.activateSmartCollection(collectionId));
        } else {
          this.facade.search(params.get('q') ?? '');
          this.facade.setSearchScope(params.get('scope') ?? undefined);
        }
      });
    this.routeUpdates.pipe(
      debounceTime(300),
      distinctUntilChanged((left, right) =>
        left.query === right.query
          && left.scopeFolderId === right.scopeFolderId
          && left.collectionId === right.collectionId),
      takeUntilDestroyed(destroyRef)
    ).subscribe(state => {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          q: state.query || null,
          scope: state.scopeFolderId || null,
          collection: state.collectionId || null
        },
        queryParamsHandling: 'merge'
      });
    });
  }

  public search(searchTerm: string | null) {
    this.facade.search(searchTerm);
    this.updateRoute(searchTerm ?? '', this.searchScopeFolderId(), undefined);
  }

  public setScope(folderId?: string): void {
    this.facade.setSearchScope(folderId);
    this.updateRoute(this.searchTerm(), folderId, undefined);
  }

  public removeChip(index: number): void {
    this.facade.removeSearchChip(index);
    this.updateRoute(this.searchTerm(), this.searchScopeFolderId(), this.facade.selectedSmartCollectionId());
  }

  public canonicalizeSearch(): void {
    this.facade.canonicalizeSearch();
    this.updateRoute(this.searchTerm(), this.searchScopeFolderId(), this.facade.selectedSmartCollectionId());
  }

  public createCollection(): void {
    const name = window.prompt('Smart Collection name');
    if (name?.trim()) {
      this.facade.createSmartCollection(name);
      this.updateCollectionRoute();
    }
  }

  public updateCollection(): void {
    this.facade.updateSelectedSmartCollection();
  }

  public editCollection(): void {
    const current = this.selectedSmartCollection();
    if (!current) return;
    const query = window.prompt('Smart Collection query', current.query);
    if (query !== null) {
      this.facade.editSelectedSmartCollection(query);
      this.updateCollectionRoute();
    }
  }

  public renameCollection(): void {
    const current = this.selectedSmartCollection();
    if (!current) return;
    const name = window.prompt('Smart Collection name', current.name);
    if (name?.trim()) this.facade.renameSelectedSmartCollection(name);
  }

  public duplicateCollection(): void {
    this.facade.duplicateSelectedSmartCollection();
    this.updateCollectionRoute();
  }

  public deleteCollection(): void {
    if (window.confirm('Delete this Smart Collection?')) {
      this.facade.deleteSelectedSmartCollection();
      this.updateRoute('', undefined, undefined);
    }
  }

  private updateCollectionRoute(): void {
    this.updateRoute(
      this.searchTerm(),
      this.searchScopeFolderId(),
      this.facade.selectedSmartCollectionId()
    );
  }

  private updateRoute(query: string, scopeFolderId?: string, collectionId?: string): void {
    this.routeUpdates.next({ query, scopeFolderId, collectionId });
  }
}
