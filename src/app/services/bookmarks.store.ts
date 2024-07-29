import {patchState, signalStore, withComputed, withMethods, withState} from '@ngrx/signals';
import {IncognitoAvailability} from "./constants";
import {NodeMap} from "./types";
import {computed, inject} from "@angular/core";
import {BookmarksFacadeService} from "./bookmarks-facade.service";
import {rxMethod} from "@ngrx/signals/rxjs-interop";
import {debounceTime, distinctUntilChanged, pipe, switchMap, tap} from "rxjs";
import {BookmarksProviderService} from "./bookmarks-provider.service";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {tapResponse} from "@ngrx/operators";

// |items| is used as a set and all values in the map are true.
export interface SelectionState {
  items: Set<string>;
  anchor?: string|null;
}

/**
 * Note:
 * - If |results| is null, it means no search results have been returned. This
 *   is different to |results| being [], which means the last search returned 0
 *   results.
 * - |term| is the last search that was performed by the user, and |results| are
 *   the last results that were returned from the backend. We don't clear
 *   |results| on incremental searches, meaning that |results| can be 'stale'
 *   data from a previous search term (while |inProgress| is true). If you need
 *   to know the exact search term used to generate |results|, you'll need to
 *   add a new field to the state to track it (eg, SearchState.resultsTerm).
 */
export interface SearchState {
  term: string;
  inProgress: boolean;
  results: string[]|null;
}

export type FolderOpenState = Map<string, boolean>;

export interface PreferencesState {
  canEdit: boolean;
  incognitoAvailability: IncognitoAvailability;
}

export interface BookmarksPageState {
  nodes: NodeMap;
  selectedFolder: string|null;
  folderOpenState: FolderOpenState;
  prefs: PreferencesState;
  search: SearchState;
  selection: SelectionState;
}

const initialState: BookmarksPageState = {
  nodes: {},
  selectedFolder: null,
  folderOpenState: new Map(),
  prefs: {
    canEdit: true,
    incognitoAvailability: IncognitoAvailability.ENABLED,
  },
  search: {
    results: null,
    term: '',
    inProgress: false,
  },
  selection: {
    anchor: null,
    items: new Set(),
  }
};

export const BookmarksStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({search, nodes, selectedFolder}) => ({
    isShowingSearch: computed(() => search.results() != null),
    getDisplayedList: computed(() => {
      if (search.results() != null) {
        return search.results();
      }

      const selectedFolderId = selectedFolder();
      if (selectedFolderId == null) {
        return [];
      }

      const bookmarks = nodes();
      const children = bookmarks[selectedFolderId]!.children;
      return children;
    }),
  })),
  withMethods((
    store,
    bookmarksFacade = inject(BookmarksFacadeService),
    provider = inject(BookmarksProviderService)
  ) => ({
    updateSearch(search: string): void {
      patchState(store, (state) => ({
        search: {
          ...state.search,
          term: search
        }
      }));
    },
    loadBySearchQuery: rxMethod<string>(
      pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => patchState(store, { search: { ...store.search(), inProgress: true } })),
        switchMap((query) => {
          return fromPromise(provider.search(query)).pipe(
            tapResponse({
              next: (searchResults) => patchState(store, { search: {
                ...store.search(),
                results: searchResults.map(x => x.id)
              } }),
              error: console.error,
              finalize: () => patchState(store, { search: {
                ...store.search(),
                  inProgress: false,
                } } )
            }),
          );
        })
      )
    ),
  })),
);
