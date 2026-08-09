# Comprehensive Code Review — 2026-08-09

## Review metadata

- **Revision reviewed:** `4ec81b7` (`fix(tree): select parent after folder deletion`)
- **Branch:** `fix/leaf-node-deletion`
- **Scope:** Angular application code, Chrome API adapters, state/services, bookmark tree and list interactions, drag-and-drop, AI categorization, import/export, unit and E2E tests, and build/test configuration.
- **Review type:** Static review plus unit, E2E, lint-target, and production-build verification.

## Rating model

### Severity

- **Critical:** Security compromise, unrecoverable data loss, or application-wide outage.
- **High:** Core user workflow is broken or an operation can falsely report success after failing.
- **Medium:** User-visible bug, material reliability/performance problem, or architectural risk.
- **Low:** Maintainability, diagnostics, accessibility, build hygiene, or localized inefficiency.

### Priority

- **P0:** Fix before merging or releasing.
- **P1:** Fix in the next corrective change set.
- **P2:** Schedule after correctness issues.
- **P3:** Opportunistic cleanup.

### Difficulty

- **Low:** Localized change with narrow test impact.
- **Medium:** Cross-file behavior or test changes required.
- **High:** State/data-flow redesign or broad migration required.

## Executive summary

The application has a useful test base, strict TypeScript and Angular template settings, signal-based state, immutable selection-set updates, and explicit bookmark-event refresh flows. The current folder-deletion change is covered by focused unit tests and correctly selects the parent folder after deletion.

The repository is not release-ready on macOS: the E2E suite has **six deterministic selection failures** caused by hard-coded Windows/Linux modifier handling. The other release-blocking concern is the Chrome API adapter: every callback wrapper accepts a `reject` function but never uses it, so Chrome API failures cannot propagate to callers. This undermines save, move, delete, import, and progress/error behavior.

Additional material risks exist in the development bookmark mock, drag-and-drop target detection, AI cancellation, import validation, tree expansion state, sorting, and repeated full-tree loading. The repository also has no configured Nx lint target.

### Finding count

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 2 |
| Medium | 14 |
| Low | 5 |
| **Total** | **21** |

## Verification results

| Check | Result | Evidence |
|---|---|---|
| Unit tests | **Pass** | 28 files passed; 75 tests passed. |
| Playwright E2E | **Fail** | 27 passed; 6 failed. Failures cover multi-select, Meta+click, Meta+A, and deselection on macOS. |
| Nx lint | **Unavailable** | `nx lint bookmarks` fails with `Cannot find configuration for task bookmarks:lint`. |
| Production build | **Pass with warnings** | Initial bundle 847.04 kB versus 500 kB warning budget; AI settings CSS 4.30 kB versus 2 kB warning budget; Angular reports unused CDK imports and a redundant optional chain. |
| Commit whitespace | **Pass** | `git diff --check HEAD^ HEAD` passed before this review. |

## Positive observations

1. `tsconfig.json` enables `strict`, `noImplicitReturns`, strict injection parameters, and strict Angular templates.
2. `SelectionService` publishes readonly signals and replaces `Set` instances rather than mutating signal values in place.
3. `BookmarksFacadeService.deleteBookmarks()` deduplicates IDs, clears selection immediately, uses `Promise.allSettled`, exposes progress, and restores refresh state in `finally`.
4. Drag event subscriptions use `takeUntilDestroyed`, avoiding document-listener leaks.
5. Bookmark-map refreshes are event-driven and covered by `bookmarks-provider.service.spec.ts`.
6. Unit coverage includes selection ranges, deferred delete confirmation, refresh-storm suppression, folder deletion, settings effects, tags, and AI response handling.
7. E2E tests use a browser-level Chrome API mock and cover CRUD, selection, search, drag-and-drop, context menus, import/export, and AI features.

---

## Detailed findings

### F-01 — macOS multi-selection and Select All are broken

- **Severity:** High
- **Priority:** P0
- **Difficulty:** Low
- **Status:** Confirmed by E2E execution

`ListViewComponent.itemClick()` hard-codes `isMac = false`, so `Meta+click` is treated as an ordinary click (`src/app/components/list-view/list-view.component.ts:135-146`). The global Select All handler only checks `event.ctrlKey` (`:164-175`). `ListViewMatTableComponent` repeats both patterns (`src/app/components/list-view-mat-table/list-view-mat-table.component.ts:131-142,172-178`).

The Playwright suite correctly chooses `Meta` on Darwin. Six tests failed after all configured retries:

- `bookmarks.spec.ts`: multiple folders, multiple bookmarks, and mixed selection.
- `selection-extended.spec.ts`: modifier range selection, Select All, and Select All then deselect one.

Use `event.metaKey || event.ctrlKey` for additive selection and Select All. Keep the behavior platform-independent rather than branching on a hard-coded platform flag.

### F-02 — Chrome API failures never reject

- **Severity:** High
- **Priority:** P0
- **Difficulty:** Medium
- **Status:** Confirmed code-path defect; failure impact is [INFERENCE]

Every method in `BookmarksService` creates a `Promise`, accepts `reject`, and passes only `resolve` to a Chrome callback (`src/app/services/chrome/bookmarks/bookmarks.service.ts:51-180`). `StorageArea` repeats the pattern (`src/app/services/chrome/storage/storage-area.class.ts:35-119`). Callback failures are exposed through `chrome.runtime.lastError`; the wrappers never inspect it. The installed Chrome types also expose native Manifest V3 Promise overloads for bookmarks operations.

Consequences [INFERENCE]:

- `BookmarksFacadeService.deleteBookmarks()` cannot observe failures through `Promise.allSettled`.
- Bookmark edits can mark the form pristine even when Chrome rejected the update.
- Drag/drop, import, and folder deletion can report completion or leave inconsistent UI state.
- A callback result omitted on error can flow as `undefined`, causing secondary destructuring/type errors.

Prefer the native Promise overloads (`chrome.bookmarks.get(...)`, `remove(...)`, and so on without callbacks). If callback compatibility is required, centralize a wrapper that rejects when `chrome.runtime.lastError` is present. See the [Chrome bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks).

### F-03 — the development bookmark mock does not implement Chrome semantics

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** High
- **Status:** Confirmed by static inspection

`MockBookmarksService` is the default non-production service, but key methods materially differ from the real API (`src/app/services/chrome/bookmarks/mock-bookmarks.service.ts`):

- `getRecent()` ignores `count` and sorts oldest-first (`:123-134`).
- Object-query search uses `includes('')`, so omitted query fields match almost every node (`:145-159`).
- `create()` uses `Object.create(bookmark)` and does not initialize `children` for a new folder; later child creation can silently skip `parent.children?.push(...)` (`:162-178`).
- `move()` ignores the requested insertion index, always appends, and does not update `bookmark.parentId` (`:181-208`).
- `update()` and `remove()` do not emit change/removal events, so reactive views may not refresh (`:211-233`).
- `removeTree()` does not recursively remove descendants (`:236-238`).
- `remove()` resolves before performing work; exceptions after the first resolve are swallowed (`:221-233`).

This makes manual development behavior unreliable and allows tests against the mock to validate contracts that production does not have. Replace it with a deterministic in-memory tree implementation and shared contract tests for the mock and Chrome adapter.

### F-04 — “Open all bookmarks” opens an undefined URL

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Low
- **Status:** Confirmed code-path defect; browser result is [INFERENCE]

The folder context menu labels the action “Open all bookmarks” (`src/app/components/menus/folder-menu/folder-menu.component.html:3`), but the handler calls `window.open(this.getUrl(), '_blank')`, and `getUrl()` returns `folder.url` (`folder-menu.component.ts:39-45,102-104`). Folders do not have URLs.

The action therefore does not traverse or open any child bookmarks and is expected to open a blank tab or do nothing [INFERENCE]. Implement explicit descendant/bookmark handling with the Chrome tabs API, or remove the action until its intended scope and popup behavior are defined.

### F-05 — dropping into an empty list cannot match the list target

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Low
- **Status:** Confirmed code-path mismatch; interaction result is [INFERENCE]

`isBookmarkList()` recognizes only `BOOKMARKS-LIST` (`src/app/services/drag-and-drop.service.ts:561-563`), while the rendered host is `APP-LIST-VIEW` (`src/app/components/list-view/list-view.component.ts:15`; `bookmarks-view.component.html:22-25`). No `bookmarks-list` element exists in the repository.

When a folder is empty there is no `<tr>` target, so `getBookmarkElement()` cannot identify a valid list destination [INFERENCE]. Align the predicate with the actual host and add an E2E case that moves an item into an empty selected folder.

### F-06 — the search-result drag guard is permanently ineffective

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Low
- **Status:** Confirmed code-path defect

`calculateValidDropPositions()` intends to forbid dragging on a search result list, but calls `isShowingSearch()` with a newly constructed state whose `results` is always `[]` (`src/app/services/drag-and-drop.service.ts:389-393`). `isShowingSearch()` returns true only when `results.length > 0` (`src/app/services/util.ts:77-79`). The condition is therefore always false.

Inject the real search state or expose an explicit `isSearching` signal from the facade. Add drag tests while search results are active.

### F-07 — multi-item drag moves are unordered and drop errors are detached

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Medium
- **Status:** Confirmed implementation pattern; ordering impact is [INFERENCE]

`BookmarksProviderService.moveMultiple()` starts every move concurrently with the same destination object (`src/app/services/bookmarks-provider.service.ts:81-84`). Repeated insertion at one index can reverse or otherwise destabilize item order [INFERENCE], especially when moving within the same parent.

`DragAndDropService` invokes its async `onDrop()` inside `tap()` without awaiting or handling the returned Promise (`src/app/services/drag-and-drop.service.ts:66-70,160-200`). If a move rejects, the RxJS subscription does not own that rejection and cleanup is not protected by `finally`.

Perform order-aware moves sequentially or compute adjusted indices. Catch errors at the event boundary and always clear drag state in `finally`.

### F-08 — AI cancellation can overlap with a restarted run

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Medium
- **Status:** Confirmed state-machine race; timing result is [INFERENCE]

`cancelCategorization()` immediately sets `isCancelled = true` and `isProcessing = false` (`src/app/services/bookmarks.store.ts:201-208`), which re-enables the UI button. A new run resets `isCancelled` to false (`src/app/services/ai.service.ts:149-156`). The previous request has no `AbortController` and may still be waiting in `fetch()` (`:62-111,180`). When it resumes, it can see the new run’s false cancellation state and write tags/progress into the new run [INFERENCE].

Use a per-run token plus `AbortController`, keep the operation active until the old run settles, and ensure only the owning run may update progress or tags. Apply the same timeout/abort handling to model discovery.

### F-09 — imports mutate bookmarks before complete validation and have no rollback

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** High
- **Status:** Confirmed code path; partial-import impact is [INFERENCE]

JSON import validates only that `root` is an array, ignores the backup `version`, and does not validate node/tag shapes (`src/app/services/import-export.service.ts:34-67`). HTML import creates an import folder before verifying that a `<dl>` exists (`:159-172`). Both formats recursively mutate Chrome bookmarks as parsing proceeds, with no cleanup if a later node fails (`:70-84,175-234`). The destination is also hard-coded to parent ID `1` instead of resolving the browser’s bookmarks-bar folder.

Malformed or unsupported files can leave partial imported trees and repeated retries can create duplicates [INFERENCE]. Parse and validate the complete input first, resolve the destination through tree metadata, then import. If any create fails, remove the import root or provide an explicit partial-import result.

### F-10 — folder expansion state is stored by mutating transient input nodes

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Medium
- **Status:** Confirmed architecture; refresh behavior is [INFERENCE]

`TreeItemComponent.toggle()` mutates `directory.expanded` directly (`src/app/components/tree-view/tree-item.component.ts:43-50`). Directory refreshes rebuild wrapper nodes using `Object.create(bookmark)` (`src/app/services/bookmarks-provider.service.ts:51-57`), so expansion is not held in durable state. The existing `folderOpenState` state is unused by the rendered tree.

Any bookmark event can replace the directory tree and collapse user-expanded folders [INFERENCE]. Store expansion by folder ID in a signal/service and derive `[expanded]` without mutating Chrome API objects.

### F-11 — sorting has invalid comparator behavior and cannot sort tags

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Low
- **Status:** Confirmed code-path defect

`OrderByPipe` reads the selected column directly from `BookmarkTreeNode` (`src/app/pipes/order-by.pipe.ts:19-37`). The visible `tags` column is computed by `TagsService` and does not exist on the node, so clicking Tags cannot produce a meaningful ordering. For two folders, the comparator returns `-order` in both argument directions, violating comparator antisymmetry and allowing unstable results.

Provide a typed sort-value accessor for every displayed column, return `0` for equivalent values, and add tests covering two folders, mixed folders/bookmarks, tags, missing dates, and ascending/descending order.

### F-12 — one bookmark event triggers redundant full-tree reads and traversals

- **Severity:** Medium
- **Priority:** P2
- **Difficulty:** High
- **Status:** Confirmed data flow

`BookmarksFacadeService.directories` subscribes twice to the same refresh trigger and independently calls `getDirectoryTreeWithoutRoot()` and `getBookmarks()` (`src/app/services/bookmarks-facade.service.ts:48-57`). The former itself calls `getTree()`, resulting in two full tree reads per refresh. It then traverses the full tree to calculate host counts (`:62-89`). Tag/server item views request and traverse the tree again (`:200-239`).

The debounced search stream adds `startWith(this.searchTerm())` after `distinctUntilChanged` (`:122-126`), so the signal’s own initial emission is not deduplicated against the synthetic initial value and can trigger duplicate initial work [INFERENCE].

Create one shared, replayed tree snapshot per bookmark revision and derive directory nodes, node map, server counts, tags, and list items from it. Use `Set` membership for matching tags instead of repeated array `includes()` calls.

### F-13 — bookmark editing can ignore same-ID refreshes and race selection changes

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Medium
- **Status:** Confirmed code path; user-visible timing is [INFERENCE]

The bookmark-detail effect patches the form only when the selected ID changes (`src/app/components/bookmark-detail/bookmark-detail.component.ts:37-55`). A refreshed node with the same ID but changed title/URL is ignored. During `saveChanges()`, the selected item is captured, but the completion always marks the current form pristine (`:58-74`). If the user selects another bookmark before the save resolves, that second form can be marked pristine by the first bookmark’s completion [INFERENCE].

Track the selected node revision/value while preserving genuinely dirty user edits. On completion, mark pristine only when the current selection still matches the saved ID and submitted values.

### F-14 — tag persistence is unvalidated, accumulates stale IDs, and writes repeatedly

- **Severity:** Medium
- **Priority:** P2
- **Difficulty:** Medium
- **Status:** Confirmed implementation; growth impact is [INFERENCE]

The local-storage fallback parses tag JSON without error handling (`src/app/services/tags.service.ts:31-40`), while Chrome storage values are trusted without runtime shape validation (`:21-30`). Tags associated with removed bookmark IDs are never deleted. AI and import flows add available tags one at a time, and each addition writes storage and updates a signal (`ai.service.ts:183-192`; `import-export.service.ts:58-65,223-228`).

Malformed data can prevent startup in local development, and stale bookmark IDs can grow indefinitely [INFERENCE]. Validate and normalize persisted data, subscribe to bookmark removal for cleanup, and expose batch mutation methods that perform one signal update and one storage write.

### F-15 — quality gates are incomplete and artifact paths violate repository rules

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Medium
- **Status:** Confirmed by commands/configuration

- `nx lint bookmarks` cannot run because `project.json` has no lint target.
- The E2E suite currently fails six tests, so `npm test` is not green on this workstation.
- Vitest writes JUnit output to `test-results/junit-report.xml` (`vitest.config.ts:13-16`) and Playwright writes JUnit output to `test-results/e2e-junit.xml` (`playwright.config.ts:9`), contrary to the repository rule that artifacts belong under `.temp/`.
- `ListViewMatTableComponent` has an entirely skipped suite (`src/app/components/list-view-mat-table/list-view-mat-table.component.spec.ts:10`).
- `passWithNoTests: true` weakens detection of accidental test discovery failures (`vitest.config.ts:12`).

Add a real lint target and CI command, move all generated reports under `.temp/`, remove or re-enable skipped suites, and make missing tests fail unless a specific target intentionally permits none.

### F-16 — duplicated state systems and unreachable implementations increase maintenance cost

- **Severity:** Low
- **Priority:** P2
- **Difficulty:** Medium
- **Status:** Confirmed by reference search

The active UI uses `BookmarksFacadeService` plus `SelectionService`, while `BookmarksStore` still contains legacy bookmark nodes, selected-folder, search, and folder-open state that is not used by the rendered bookmark view (`src/app/services/bookmarks.store.ts:60-124`). The store is currently needed mainly for AI preferences/progress.

Other unreachable or vestigial code includes:

- `ListViewMatTableComponent`, referenced only by its skipped test.
- `FilterBookmarksPipe`, with no template or source consumer.
- `StorageService`/`StorageArea`, referenced only by their test.
- Empty lifecycle hooks, the no-op `DragAndDropService.init()`, unused component inputs, and unused injected services such as `Router` in `FolderMenuComponent`.

Choose one state architecture, migrate live behavior, and delete the abandoned path rather than maintaining parallel models.

### F-17 — application code imports private RxJS internals

- **Severity:** Low
- **Priority:** P2
- **Difficulty:** Low
- **Status:** Confirmed

`bookmarks-facade.service.ts`, `bookmarks-provider.service.ts`, and `bookmarks.store.ts` import `fromPromise` from `rxjs/internal/observable/innerFrom`. Private paths are not a compatibility contract and can break on an RxJS upgrade.

Use the public `from()` API from `rxjs` for Promises.

### F-18 — production hot paths emit verbose console output

- **Severity:** Low
- **Priority:** P2
- **Difficulty:** Low
- **Status:** Confirmed; unit output demonstrates noise

Document-level `dragover`, `drop`, and `dragend` handlers log raw events (`src/app/services/drag-and-drop.service.ts:41-76`). Selection, list clicks, keyboard events, facade refreshes, directory changes, and every sort also log. `itemClick()` logs complete bookmark objects, including bookmark titles and URLs (`src/app/components/list-view/list-view.component.ts:135-150`).

This creates avoidable work on drag hot paths, obscures useful diagnostics, and exposes bookmark data in extension console logs. Remove logs or route them through a development-only logger with structured levels.

### F-19 — interactive list/tree semantics are incomplete

- **Severity:** Medium
- **Priority:** P2
- **Difficulty:** Medium
- **Status:** Confirmed template structure; accessibility impact is [INFERENCE]

List rows and headers are mouse-clickable `<tr>`/`<th>` elements without keyboard activation, focusability, button semantics, or `aria-sort` (`src/app/components/list-view/list-view.component.html:1-43`). Tree items declare `role="treeitem"`, but the container lacks `role="tree"`, items are not individually focusable, and arrow-key navigation is absent (`tree-item.component.html:1-35`; `tree-view.component.html:1-12`). The AI modal lacks dialog semantics and focus management (`ai-settings.component.html:75-120`).

Keyboard-only and assistive-technology workflows are incomplete [INFERENCE]. Add semantic controls/ARIA, roving tabindex and tree keyboard behavior, modal focus trapping/restoration, and accessibility-oriented E2E checks.

### F-20 — production budgets already warn and legacy styles add weight

- **Severity:** Low
- **Priority:** P2
- **Difficulty:** Medium
- **Status:** Confirmed by production build

The production build reports an 847.04 kB initial bundle against a 500 kB warning budget and a 4.30 kB AI settings stylesheet against a 2 kB component-style warning budget. `project.json` globally includes legacy `src/style/tree.css` and `src/style/list.css` while tree/list components also carry component styles.

Audit whether the legacy global styles are still required, remove unused Angular Material/CDK code and dead components, and track bundle composition before raising budgets. Treat the current warnings as a baseline regression gate rather than normal output.

### F-21 — timing-based “performance” tests are brittle and do not protect a product budget

- **Severity:** Low
- **Priority:** P3
- **Difficulty:** Low
- **Status:** Confirmed test design

`list-view.perf.spec.ts` compares two wall-clock loops once and asserts that one duration is lower (`:51-74`). Scheduling, JIT warm-up, CPU contention, and test ordering can change the result. The test duplicates favicon implementations rather than invoking the production pipe, so it can pass after production regresses. `verify-flaky-tests.ps1` runs the complete unit and E2E suite ten times but is Windows-only, hard-coded, and not integrated with a documented target.

Keep correctness tests deterministic. Move benchmarks to a dedicated benchmark command with warm-up, repeated samples, and explicit thresholds against production functions.

---

## Recommended remediation sequence

1. Restore a green cross-platform E2E baseline and configure lint.
2. Fix Chrome API rejection semantics, then update every fire-and-forget caller to handle failures.
3. Repair the development mock so local/manual testing reflects production behavior.
4. Correct drag/drop target detection, search guards, multi-move ordering, and async cleanup.
5. Make AI runs cancellable and imports validate before mutation.
6. Consolidate tree snapshots/state, expansion state, and duplicate legacy store code.
7. Address sorting, editor synchronization, tag persistence, accessibility, logging, and bundle/test hygiene.

## TODO checklist

- [ ] **T-01 — Support `Meta` and `Control` consistently for additive selection and Select All.** Severity: **High** · Priority: **P0** · Difficulty: **Low**
- [ ] **T-02 — Replace callback-only Chrome bookmark/storage wrappers with rejecting Promise adapters and add failure-path tests.** Severity: **High** · Priority: **P0** · Difficulty: **Medium**
- [ ] **T-03 — Rebuild `MockBookmarksService` to honor create, move, update, remove, removeTree, search, recent, index, parent, and event contracts.** Severity: **Medium** · Priority: **P1** · Difficulty: **High**
- [ ] **T-04 — Implement or remove the folder “Open all bookmarks” action.** Severity: **Medium** · Priority: **P1** · Difficulty: **Low**
- [ ] **T-05 — Recognize the actual `APP-LIST-VIEW` drag target and cover drops into empty folders.** Severity: **Medium** · Priority: **P1** · Difficulty: **Low**
- [ ] **T-06 — Wire drag restrictions to real search state and test search-result dragging.** Severity: **Medium** · Priority: **P1** · Difficulty: **Low**
- [ ] **T-07 — Make multi-item moves order-aware; await drop work and clear drag state in `finally`.** Severity: **Medium** · Priority: **P1** · Difficulty: **Medium**
- [ ] **T-08 — Add per-run AI cancellation with `AbortController` and operation ownership.** Severity: **Medium** · Priority: **P1** · Difficulty: **Medium**
- [ ] **T-09 — Validate complete JSON/HTML imports before mutation and clean up partial imports on failure.** Severity: **Medium** · Priority: **P1** · Difficulty: **High**
- [ ] **T-10 — Move folder expansion state into a durable signal keyed by folder ID.** Severity: **Medium** · Priority: **P1** · Difficulty: **Medium**
- [ ] **T-11 — Replace the sort comparator with typed column accessors and add Tags/folder ordering tests.** Severity: **Medium** · Priority: **P1** · Difficulty: **Low**
- [ ] **T-12 — Share one bookmark-tree snapshot per revision and derive directories, maps, servers, tags, and items from it.** Severity: **Medium** · Priority: **P2** · Difficulty: **High**
- [ ] **T-13 — Synchronize same-ID bookmark refreshes and guard save completion against selection changes.** Severity: **Medium** · Priority: **P1** · Difficulty: **Medium**
- [ ] **T-14 — Validate tag persistence, remove deleted-bookmark metadata, and batch storage writes.** Severity: **Medium** · Priority: **P2** · Difficulty: **Medium**
- [ ] **T-15 — Add an Nx lint target, make lint part of CI, move reports under `.temp/`, and remove skipped/pass-with-no-tests gaps.** Severity: **Medium** · Priority: **P1** · Difficulty: **Medium**
- [ ] **T-16 — Consolidate bookmark state and remove unreachable components, pipes, storage wrappers, hooks, inputs, and injections.** Severity: **Low** · Priority: **P2** · Difficulty: **Medium**
- [ ] **T-17 — Replace private `rxjs/internal` imports with public `from()` imports.** Severity: **Low** · Priority: **P2** · Difficulty: **Low**
- [ ] **T-18 — Remove production console logging or gate it behind a development logger.** Severity: **Low** · Priority: **P2** · Difficulty: **Low**
- [ ] **T-19 — Add keyboard/ARIA behavior for list sorting, row selection, tree navigation, and modal focus.** Severity: **Medium** · Priority: **P2** · Difficulty: **Medium**
- [ ] **T-20 — Reduce the initial bundle/style warnings and remove unused legacy styling/dependencies before changing budgets.** Severity: **Low** · Priority: **P2** · Difficulty: **Medium**
- [ ] **T-21 — Replace timing assertions in unit tests with a dedicated benchmark workflow against production code.** Severity: **Low** · Priority: **P3** · Difficulty: **Low**
