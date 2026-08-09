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

Both High-severity findings and twelve of fourteen Medium-severity findings are fixed. Cross-platform selection recognizes macOS modifiers; Chrome adapters propagate Promise rejections; the development mock matches Chrome mutation/event semantics; and T-04 through T-14 now have focused regression coverage.

Material risks remain in accessibility, logging, and bundle/test hygiene. The repository also has no configured Nx lint target.

### Finding status

| Severity | Original | Open | Fixed |
|---|---:|---:|---:|
| Critical | 0 | 0 | 0 |
| High | 2 | 0 | 2 |
| Medium | 14 | 2 | 12 |
| Low | 5 | 5 | 0 |
| **Total** | **21** | **7** | **14** |

## Verification results

| Check | Result | Evidence |
|---|---|---|
| Unit tests | **Pass** | 31 files passed; 122 tests passed, including open-all traversal, empty-list/search drag guards, ordered moves and cleanup, owned AI cancellation, full import validation, and rollback. |
| Playwright E2E | **Pass** | 36 tests passed, including recursive folder opening, empty-list drops, and search-result drag rejection. |
| Nx lint | **Unavailable** | `nx lint bookmarks` fails with `Cannot find configuration for task bookmarks:lint`. |
| Production build | **Pass with warnings** | Initial bundle 850.76 kB versus 500 kB warning budget; AI settings CSS 4.30 kB versus 2 kB warning budget; Angular reports unused CDK imports and a redundant optional chain. |
| Working-tree whitespace | **Pass** | `git diff --check` passed after the T-04 through T-09 fixes. |

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

### F-01 — macOS multi-selection and Select All were broken

- **Severity:** High
- **Priority:** P0
- **Difficulty:** Low
- **Status:** Fixed and verified on 2026-08-09

At review time, `ListViewComponent.itemClick()` hard-coded `isMac = false`, so `Meta+click` was treated as an ordinary click (`src/app/components/list-view/list-view.component.ts:135-146`). The global Select All handler checked only `event.ctrlKey` (`:164-175`). `ListViewMatTableComponent` repeated both patterns (`src/app/components/list-view-mat-table/list-view-mat-table.component.ts:131-142,172-178`).

The initial Playwright run correctly chose `Meta` on Darwin. Six tests failed after all configured retries:

- `bookmarks.spec.ts`: multiple folders, multiple bookmarks, and mixed selection.
- `selection-extended.spec.ts`: modifier range selection, Select All, and Select All then deselect one.

**Resolution:** Both list implementations now treat `event.metaKey || event.ctrlKey` as the additive/Select All modifier. Unit regressions cover Meta+click and Meta+A, the 15 targeted selection E2E tests pass, and the full E2E suite passes 33/33.

### F-02 — Chrome API failures did not reject

- **Severity:** High
- **Priority:** P0
- **Difficulty:** Medium
- **Status:** Fixed and verified on 2026-08-09

At review time, every method in `BookmarksService` created a `Promise`, accepted `reject`, and passed only `resolve` to a Chrome callback (`src/app/services/chrome/bookmarks/bookmarks.service.ts:51-180`). `StorageArea` repeated the pattern (`src/app/services/chrome/storage/storage-area.class.ts:35-119`). Callback failures were exposed through `chrome.runtime.lastError`; the wrappers never inspected it.

Consequences [INFERENCE]:

- `BookmarksFacadeService.deleteBookmarks()` cannot observe failures through `Promise.allSettled`.
- Bookmark edits can mark the form pristine even when Chrome rejected the update.
- Drag/drop, import, and folder deletion can report completion or leave inconsistent UI state.
- A callback result omitted on error can flow as `undefined`, causing secondary destructuring/type errors.

**Resolution:** The bookmark and storage adapters now return Chrome's native Manifest V3 promises, preserving native rejection semantics without custom callback wrappers. Folder/bookmark menu mutations await these promises and report failures instead of creating unhandled rejections. Sixteen adapter regressions verify rejection propagation, and the full unit, E2E, and production-build checks pass.

### F-03 — the development bookmark mock did not implement Chrome semantics

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** High
- **Status:** Fixed and verified on 2026-08-09

At review time, `MockBookmarksService` was the default non-production service, but key methods materially differed from the real API (`src/app/services/chrome/bookmarks/mock-bookmarks.service.ts`):

- `getRecent()` ignores `count` and sorts oldest-first (`:123-134`).
- Object-query search uses `includes('')`, so omitted query fields match almost every node (`:145-159`).
- `create()` uses `Object.create(bookmark)` and does not initialize `children` for a new folder; later child creation can silently skip `parent.children?.push(...)` (`:162-178`).
- `move()` ignores the requested insertion index, always appends, and does not update `bookmark.parentId` (`:181-208`).
- `update()` and `remove()` do not emit change/removal events, so reactive views may not refresh (`:211-233`).
- `removeTree()` does not recursively remove descendants (`:236-238`).
- `remove()` resolves before performing work; exceptions after the first resolve are swallowed (`:221-233`).

**Resolution:** `MockBookmarksService` is now a deterministic indexed tree. It returns detached snapshots; honors default parents and insertion indices; maintains parent/index invariants; implements newest-first bounded recent results and all-field object search; recursively removes trees; rejects invalid operations atomically; and emits the same tuple payloads as the Chrome event adapter for create, move, change, and removal events. Eleven contract tests cover these behaviors.

### F-04 — “Open all bookmarks” opens an undefined URL

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Low
- **Status:** **Fixed 2026-08-09**

The folder context menu labels the action “Open all bookmarks” (`src/app/components/menus/folder-menu/folder-menu.component.html:3`), but the handler calls `window.open(this.getUrl(), '_blank')`, and `getUrl()` returns `folder.url` (`folder-menu.component.ts:39-45,102-104`). Folders do not have URLs.

The action therefore does not traverse or open any child bookmarks and is expected to open a blank tab or do nothing [INFERENCE]. Implement explicit descendant/bookmark handling with the Chrome tabs API, or remove the action until its intended scope and popup behavior are defined.

**Resolution:** The menu now retrieves the complete folder subtree, traverses descendant bookmarks in folder order, and opens each URL through `chrome.tabs.create({ active: false })`. Unit and Playwright tests verify nested traversal and the two expected background tabs.

### F-05 — dropping into an empty list cannot match the list target

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Low
- **Status:** **Fixed 2026-08-09**

`isBookmarkList()` recognizes only `BOOKMARKS-LIST` (`src/app/services/drag-and-drop.service.ts:561-563`), while the rendered host is `APP-LIST-VIEW` (`src/app/components/list-view/list-view.component.ts:15`; `bookmarks-view.component.html:22-25`). No `bookmarks-list` element exists in the repository.

When a folder is empty there is no `<tr>` target, so `getBookmarkElement()` cannot identify a valid list destination [INFERENCE]. Align the predicate with the actual host and add an E2E case that moves an item into an empty selected folder.

**Resolution:** Drag target detection now recognizes both rendered list hosts and resolves an empty list to the selected folder before requiring an `itemid`. Unit coverage verifies the `ON` drop position, and Playwright moves a tree folder into an empty selected list.

### F-06 — the search-result drag guard is permanently ineffective

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Low
- **Status:** **Fixed 2026-08-09**

`calculateValidDropPositions()` intends to forbid dragging on a search result list, but calls `isShowingSearch()` with a newly constructed state whose `results` is always `[]` (`src/app/services/drag-and-drop.service.ts:389-393`). `isShowingSearch()` returns true only when `results.length > 0` (`src/app/services/util.ts:77-79`). The condition is therefore always false.

Inject the real search state or expose an explicit `isSearching` signal from the facade. Add drag tests while search results are active.

**Resolution:** `DragAndDropService` now consumes the facade's real `searchTerm` signal and rejects list/item destinations whenever search is active. Unit coverage checks both target types; Playwright verifies a search-result drag does not move the bookmark.

### F-07 — multi-item drag moves are unordered and drop errors are detached

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Medium
- **Status:** **Fixed 2026-08-09**

`BookmarksProviderService.moveMultiple()` starts every move concurrently with the same destination object (`src/app/services/bookmarks-provider.service.ts:81-84`). Repeated insertion at one index can reverse or otherwise destabilize item order [INFERENCE], especially when moving within the same parent.

`DragAndDropService` invokes its async `onDrop()` inside `tap()` without awaiting or handling the returned Promise (`src/app/services/drag-and-drop.service.ts:66-70,160-200`). If a move rejects, the RxJS subscription does not own that rejection and cleanup is not protected by `finally`.

Perform order-aware moves sequentially or compute adjusted indices. Catch errors at the event boundary and always clear drag state in `finally`.

**Resolution:** `moveMultiple()` now performs sequential, index-adjusted moves and reverses same-parent execution only when moving a selected block later. The drop subscription owns the Promise through `concatMap`, reports failure at the event boundary, and clears drag state in `finally`. Focused tests cover cross-folder order, same-folder order, awaited rejection, and cleanup.

### F-08 — AI cancellation can overlap with a restarted run

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Medium
- **Status:** **Fixed 2026-08-09**

`cancelCategorization()` immediately sets `isCancelled = true` and `isProcessing = false` (`src/app/services/bookmarks.store.ts:201-208`), which re-enables the UI button. A new run resets `isCancelled` to false (`src/app/services/ai.service.ts:149-156`). The previous request has no `AbortController` and may still be waiting in `fetch()` (`:62-111,180`). When it resumes, it can see the new run’s false cancellation state and write tags/progress into the new run [INFERENCE].

Use a per-run token plus `AbortController`, keep the operation active until the old run settles, and ensure only the owning run may update progress or tags. Apply the same timeout/abort handling to model discovery.

**Resolution:** Each categorization run owns an `AbortController`; starting another run aborts the previous request, cancellation aborts transport work, and only the active controller may finish progress state or apply tags. Angular resource cancellation is also forwarded to model-discovery fetches. A focused test verifies the in-flight signal aborts and no tags are written.

### F-09 — imports mutate bookmarks before complete validation and have no rollback

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** High
- **Status:** **Fixed 2026-08-09**

JSON import validates only that `root` is an array, ignores the backup `version`, and does not validate node/tag shapes (`src/app/services/import-export.service.ts:34-67`). HTML import creates an import folder before verifying that a `<dl>` exists (`:159-172`). Both formats recursively mutate Chrome bookmarks as parsing proceeds, with no cleanup if a later node fails (`:70-84,175-234`). The destination is also hard-coded to parent ID `1` instead of resolving the browser’s bookmarks-bar folder.

Malformed or unsupported files can leave partial imported trees and repeated retries can create duplicates [INFERENCE]. Parse and validate the complete input first, resolve the destination through tree metadata, then import. If any create fails, remove the import root or provide an explicit partial-import result.

**Resolution:** JSON and HTML inputs are converted to bounded, fully validated import plans before any mutation. Validation covers version, node/tag shape, duplicate IDs, URLs, depth, and node count. The destination folder is resolved from the live tree; any later create failure removes the import root and restores bookmark/available-tag state. Tests verify malformed late entries cause zero creates and creation failures roll back partial state.

### F-10 — folder expansion state is stored by mutating transient input nodes

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Medium
- **Status:** Fixed 2026-08-09

`TreeItemComponent` now reads and toggles expansion through `SelectionService`, which stores an immutable set of expanded folder IDs. `TreeViewComponent` expands selected ancestor paths by ID, so replacement bookmark node objects preserve expansion without mutation.

Focused component and service tests cover ID-based persistence, path expansion, and the absence of an `expanded` mutation on input nodes.

### F-11 — sorting has invalid comparator behavior and cannot sort tags

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Low
- **Status:** Fixed 2026-08-09

`OrderByPipe` now accepts the five displayed columns as a typed union and obtains values through a typed accessor. `ListViewComponent` supplies computed tag values from `TagsService`; folders remain ahead of bookmarks, equivalent values return `0`, and missing values sort last.

Focused tests cover folder-to-folder ordering, mixed folders and bookmarks, Tags, missing dates, and both directions.

### F-12 — one bookmark event triggers redundant full-tree reads and traversals

- **Severity:** Medium
- **Priority:** P2
- **Difficulty:** High
- **Status:** Fixed 2026-08-09

`BookmarksFacadeService` now performs one replayed `getBookmarks()` read per accepted revision. A single traversal builds the node map, flat bookmark list, hostname index, and server counts; directories and every list mode derive from that snapshot. Drag/drop consumes the facade’s shared node map rather than creating an independent event subscription.

Tag-search matching uses a `Set`, and the debounced search stream deduplicates its synthetic and signal-backed initial values.

Focused tests verify one tree read per revision and derive the bookmark map, server nodes, tag results, and selected-folder items from the shared snapshot.

### F-13 — bookmark editing can ignore same-ID refreshes and race selection changes

- **Severity:** Medium
- **Priority:** P1
- **Difficulty:** Medium
- **Status:** Fixed 2026-08-09

The bookmark-detail effect now synchronizes same-ID refreshes field by field: pristine controls accept current bookmark values while dirty controls preserve local edits. Changing selection resets the form to the newly selected node.

Save completion marks the form pristine only when both the selected bookmark ID and current form values still match the submitted operation. Focused tests cover same-ID refreshes, dirty-field preservation, and selection changes during an unresolved save.

### F-14 — tag persistence is unvalidated, accumulates stale IDs, and writes repeatedly

- **Severity:** Medium
- **Priority:** P2
- **Difficulty:** Medium
- **Status:** Fixed 2026-08-09

`TagsService` now validates and normalizes both Chrome and local-storage payloads, recovers from malformed JSON, trims and deduplicates tags, and removes metadata when Chrome emits a bookmark-removal event.

Batch APIs update bookmark-tag records and available tags once per collection. AI categorization and imports use those APIs; imports accumulate tag changes until bookmark creation succeeds. Focused tests cover malformed data, runtime shape validation, deletion cleanup, batched persistence, and the AI/import callers.

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

1. Keep the restored cross-platform E2E baseline green and configure lint.
2. Keep Chrome API failure-path coverage green as mutation flows evolve.
3. Keep the development mock contract suite aligned with Chrome behavior.
4. Correct drag/drop target detection, search guards, multi-move ordering, and async cleanup.
5. Make AI runs cancellable and imports validate before mutation.
6. Consolidate tree snapshots/state, expansion state, and duplicate legacy store code.
7. Address sorting, editor synchronization, tag persistence, accessibility, logging, and bundle/test hygiene.

## TODO checklist

- [x] **T-01 — Support `Meta` and `Control` consistently for additive selection and Select All.** Severity: **High** · Priority: **P0** · Difficulty: **Low** · Status: **Fixed 2026-08-09**
- [x] **T-02 — Replace callback-only Chrome bookmark/storage wrappers with rejecting Promise adapters and add failure-path tests.** Severity: **High** · Priority: **P0** · Difficulty: **Medium** · Status: **Fixed 2026-08-09**
- [x] **T-03 — Rebuild `MockBookmarksService` to honor create, move, update, remove, removeTree, search, recent, index, parent, and event contracts.** Severity: **Medium** · Priority: **P1** · Difficulty: **High** · Status: **Fixed 2026-08-09**
- [x] **T-04 — Implement or remove the folder “Open all bookmarks” action.** Severity: **Medium** · Priority: **P1** · Difficulty: **Low** · Status: **Fixed 2026-08-09**
- [x] **T-05 — Recognize the actual `APP-LIST-VIEW` drag target and cover drops into empty folders.** Severity: **Medium** · Priority: **P1** · Difficulty: **Low** · Status: **Fixed 2026-08-09**
- [x] **T-06 — Wire drag restrictions to real search state and test search-result dragging.** Severity: **Medium** · Priority: **P1** · Difficulty: **Low** · Status: **Fixed 2026-08-09**
- [x] **T-07 — Make multi-item moves order-aware; await drop work and clear drag state in `finally`.** Severity: **Medium** · Priority: **P1** · Difficulty: **Medium** · Status: **Fixed 2026-08-09**
- [x] **T-08 — Add per-run AI cancellation with `AbortController` and operation ownership.** Severity: **Medium** · Priority: **P1** · Difficulty: **Medium** · Status: **Fixed 2026-08-09**
- [x] **T-09 — Validate complete JSON/HTML imports before mutation and clean up partial imports on failure.** Severity: **Medium** · Priority: **P1** · Difficulty: **High** · Status: **Fixed 2026-08-09**
- [x] **T-10 — Move folder expansion state into a durable signal keyed by folder ID.** Severity: **Medium** · Priority: **P1** · Difficulty: **Medium** · Status: **Fixed 2026-08-09**
- [x] **T-11 — Replace the sort comparator with typed column accessors and add Tags/folder ordering tests.** Severity: **Medium** · Priority: **P1** · Difficulty: **Low** · Status: **Fixed 2026-08-09**
- [x] **T-12 — Share one bookmark-tree snapshot per revision and derive directories, maps, servers, tags, and items from it.** Severity: **Medium** · Priority: **P2** · Difficulty: **High** · Status: **Fixed 2026-08-09**
- [x] **T-13 — Synchronize same-ID bookmark refreshes and guard save completion against selection changes.** Severity: **Medium** · Priority: **P1** · Difficulty: **Medium** · Status: **Fixed 2026-08-09**
- [x] **T-14 — Validate tag persistence, remove deleted-bookmark metadata, and batch storage writes.** Severity: **Medium** · Priority: **P2** · Difficulty: **Medium** · Status: **Fixed 2026-08-09**
- [ ] **T-15 — Add an Nx lint target, make lint part of CI, move reports under `.temp/`, and remove skipped/pass-with-no-tests gaps.** Severity: **Medium** · Priority: **P1** · Difficulty: **Medium**
- [ ] **T-16 — Consolidate bookmark state and remove unreachable components, pipes, storage wrappers, hooks, inputs, and injections.** Severity: **Low** · Priority: **P2** · Difficulty: **Medium**
- [ ] **T-17 — Replace private `rxjs/internal` imports with public `from()` imports.** Severity: **Low** · Priority: **P2** · Difficulty: **Low**
- [ ] **T-18 — Remove production console logging or gate it behind a development logger.** Severity: **Low** · Priority: **P2** · Difficulty: **Low**
- [ ] **T-19 — Add keyboard/ARIA behavior for list sorting, row selection, tree navigation, and modal focus.** Severity: **Medium** · Priority: **P2** · Difficulty: **Medium**
- [ ] **T-20 — Reduce the initial bundle/style warnings and remove unused legacy styling/dependencies before changing budgets.** Severity: **Low** · Priority: **P2** · Difficulty: **Medium**
- [ ] **T-21 — Replace timing assertions in unit tests with a dedicated benchmark workflow against production code.** Severity: **Low** · Priority: **P3** · Difficulty: **Low**
