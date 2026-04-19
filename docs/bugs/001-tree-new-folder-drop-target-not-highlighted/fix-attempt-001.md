# Fix Attempt 001

## Attempt Status
awaiting_user_confirmation

## Goal
Restore drag-and-drop targeting so folders created from the tree context menu immediately highlight and accept dropped bookmarks.

## Relation To Previous Attempts
First attempt for this bug.

## Proposed Change
- Investigate tree-node drop eligibility and state updates after folder creation.
- Ensure tree item drop target checks use up-to-date folder metadata.
- Add or update test coverage for dropping onto a newly created folder.

## Risks
- Changes could accidentally allow invalid drop targets (e.g., bookmarks or tags in unintended contexts).
- Tree DnD behavior for existing folders could regress.

## Files And Components
- `src/app/components/tree-view/*`
- `src/app/components/menus/*` (if creation flow impacts tree item data refresh)
- `e2e/drag-and-drop.spec.ts` and/or `e2e/context-menu.spec.ts`

## Verification Plan
- Run focused unit tests for tree item/tree view DnD behavior.
- Run focused e2e test for create-folder then drag-to-tree-folder flow.

## Implementation Summary
- Updated `injectAllBookmarksMap()` in `src/app/services/bookmarks-provider.service.ts` to recompute the node map whenever bookmark lifecycle events fire (`created`, `removed`, `changed`, `moved`, `childrenReordered`, import begin/end), instead of computing only once at startup.
- Added a safe empty-tree guard while rebuilding the node map.
- Updated mock bookmarks creation flow in `src/app/services/chrome/bookmarks/mock-bookmarks.service.ts` to emit `onCreatedEvent$`, so non-production/test behavior mirrors real bookmark event flow.
- Expanded `src/app/services/bookmarks-provider.service.spec.ts` with a focused test that validates map refresh after a create event.

## Test Results
- `pnpm vitest run src/app/services/bookmarks-provider.service.spec.ts` passed (2 tests).
- `pnpm vitest run src/app/services/drag-and-drop.service.spec.ts` passed (1 test).

## Outcome
- Local verification is successful for the map-refresh root cause and no regressions were found in targeted unit tests.
- Ready for user confirmation in UI: create folder from tree context menu, then drag bookmark onto new folder in left tree view and confirm highlight/drop works.

## Next Step
- Wait for user confirmation from real usage flow.

## Remaining Gaps
- No e2e scenario added yet for "create folder then drag to new folder in tree" flow.
