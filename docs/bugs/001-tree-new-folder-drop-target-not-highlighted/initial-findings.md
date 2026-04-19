# Initial Findings

## Confirmed Facts
- `DragAndDropService` validates tree drop targets against `bookmarksMap()` and rejects unknown IDs.
- `bookmarksMap()` comes from `injectAllBookmarksMap()`, which previously loaded `getBookmarks()` only once at startup.
- A folder created later can exist in the UI tree but still be missing from the stale map, causing drop target validation to return `DropPosition.NONE`.

## Likely Cause
- Stale bookmark node map in drag-and-drop validation: newly created folders are not present in `injectAllBookmarksMap()` output because the signal was not refreshed on bookmark lifecycle events.

## Unknowns
- None blocking this attempt.

## Reproduction Status
- Reproduction path identified from code flow and map refresh behavior.

## Evidence Gathered
- User report in this thread.
- `src/app/services/drag-and-drop.service.ts` checks `if (!nodesMap[itemId]) return DropPosition.NONE;`
- `src/app/services/bookmarks-provider.service.ts` previously built the map from a single `getBookmarks()` Promise.
