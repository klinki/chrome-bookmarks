# Bug Description

## Title
Cannot drag bookmarks to a newly created folder in the left tree view

## Status
- open

## Reported Symptoms
- After creating a new folder from the tree item context menu, dragging a bookmark onto that new folder in the left tree view does not highlight the folder as a valid drop target.

## Expected Behavior
- Newly created folders in the tree should immediately behave like other folder nodes and highlight/accept bookmark drops.

## Actual Behavior
- The new folder appears in the tree, but does not highlight and does not accept dropped bookmarks.

## Reproduction Details
- Right-click a tree folder and create `New folder`.
- Drag a bookmark from list view onto the newly created tree folder.
- Observe that the folder is not highlighted as a drop target.

## Affected Area
- Tree view drag-and-drop target handling for folder nodes created during the current session.

## Constraints
- Keep existing drag-and-drop behavior for existing folders and tags unchanged.
- Preserve current context menu folder creation flow.

## Open Questions
- Is the issue caused by stale local tree node state in `tree-item` components after creation?
- Is drop-target eligibility computed from outdated `children`/`url` metadata?
