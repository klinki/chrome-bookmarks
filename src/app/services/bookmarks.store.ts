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

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface PreferencesState {
  canEdit: boolean;
  incognitoAvailability: IncognitoAvailability;
  aiConfig: AiConfig;
}

export interface CategorizationProgress {
  total: number;
  processed: number;
  isProcessing: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  currentBatch: string;
}

export interface CategorizationProgress {
  total: number;
  processed: number;
  isProcessing: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  currentBatch: string;
}

export interface BookmarksPageState {
  nodes: NodeMap;
  selectedFolder: string | null;
  folderOpenState: FolderOpenState;
  prefs: PreferencesState;
  search: SearchState;
  selection: SelectionState;
  progress: CategorizationProgress;
}

const initialState: BookmarksPageState = {
  nodes: {},
  selectedFolder: null,
  folderOpenState: new Map(),
  prefs: {
    canEdit: true,
    incognitoAvailability: IncognitoAvailability.ENABLED,
    aiConfig: {
      baseUrl: 'http://localhost:11434/v1',
      apiKey: '',
      model: 'llama3:8b'
    }
  },
  search: {
    results: null,
    term: '',
    inProgress: false,
  },
  selection: {
    anchor: null,
    items: new Set(),
  },
  progress: {
    total: 0,
    processed: 0,
    isProcessing: false,
    isPaused: false,
    isCancelled: false,
    currentBatch: ''
  }
};

const STORAGE_KEY_AI_CONFIG = 'aiConfig';

export const BookmarksStore = signalStore(
  { providedIn: 'root', protectedState: false },
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
    updateAiConfig(config: Partial<AiConfig>): void {
      patchState(store, (state) => {
        const newConfig = {
          ...state.prefs.aiConfig,
          ...config
        };

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [STORAGE_KEY_AI_CONFIG]: newConfig });
        } else {
          localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(newConfig));
        }

        return {
          prefs: {
            ...state.prefs,
            aiConfig: newConfig
          }
        };
      });
    },
    loadBySearchQuery: rxMethod<string>(
      pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => patchState(store, { search: { ...store.search(), inProgress: true } })),
        switchMap((query) => {
          return fromPromise(provider.search(query)).pipe(
            tapResponse({
              next: (searchResults) => patchState(store, {
                search: {
                  ...store.search(),
                  results: searchResults.map(x => x.id)
                }
              }),
              error: console.error,
              finalize: () => patchState(store, {
                search: {
                  ...store.search(),
                  inProgress: false,
                }
              })
            }),
          );
        })
      )
    ),
    updateProgress(progress: Partial<CategorizationProgress>): void {
      patchState(store, (state) => ({
        progress: {
          ...state.progress,
          ...progress
        }
      }));
    },
    togglePause(): void {
      patchState(store, (state) => ({
        progress: {
          ...state.progress,
          isPaused: !state.progress.isPaused
        }
      }));
    },
    cancelCategorization(): void {
      patchState(store, (state) => ({
        progress: {
          ...state.progress,
          isCancelled: true,
          isProcessing: false
        }
      }));
    },
    resetProgress(): void {
      patchState(store, (state) => ({
        progress: initialState.progress
      }));
    }
  })),
  withHooks({
    onInit(store) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY_AI_CONFIG], (result) => {
          if (result[STORAGE_KEY_AI_CONFIG]) {
            store.updateAiConfig(result[STORAGE_KEY_AI_CONFIG]);
          }
        });
      } else {
        const saved = localStorage.getItem(STORAGE_KEY_AI_CONFIG);
        if (saved) {
          try {
            store.updateAiConfig(JSON.parse(saved));
          } catch (e) {
            console.error('Failed to parse AI config from localStorage', e);
          }
        }
      }
    }
  })
);
