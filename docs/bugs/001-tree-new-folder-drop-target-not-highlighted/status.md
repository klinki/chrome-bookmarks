# Bug Status

## Current State
awaiting_user_confirmation

## Active Attempt
`fix-attempt-001.md`

## Last Updated
2026-04-19

## Confirmation Date
pending

## Resolution Summary
Root cause fixed locally by making bookmark node map updates event-driven after bookmark changes.

## Attempt History
- `fix-attempt-001.md` - created
- `fix-attempt-001.md` - implemented and locally verified; awaiting user confirmation

## State Change Log
- 2026-04-19: bug opened
- 2026-04-19: investigation started
- 2026-04-19: attempt 001 started
- 2026-04-19: investigation completed; stale `injectAllBookmarksMap()` data identified as root cause
- 2026-04-19: attempt 001 implementation completed
- 2026-04-19: targeted unit verification passed
- 2026-04-19: awaiting user confirmation

## Notes
- User report: newly created folder via right-click menu does not highlight as a drop target when dragging bookmarks in left tree view.
