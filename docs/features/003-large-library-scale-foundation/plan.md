# Feature 1 of 4: Large-Library Scale Foundation

## Summary

Harden the existing bookmark manager for collections of 10,000–50,000 items before implementing Cleanup Center behavior.

When execution is eventually authorized, save this plan to `docs/features/003-large-library-scale-foundation/plan.md`. Do not implement it until all four feature plans are complete.

## Implementation Changes

- Virtualize the existing bookmark list with Angular CDK:
  - Use fixed-height rows and a sticky header.
  - Keep fewer than 100 rows mounted for a 10,000-item result.
  - Preserve sorting, range selection, Select All, keyboard navigation, context menus, drag handling, and ARIA grid semantics over the complete sorted collection.
- Add a reusable bulk-mutation coordinator:
  - Suppress repeated bookmark-tree refreshes during bulk delete or move operations.
  - Expose operation name, total, completed, failures, and cancellation state.
  - Always issue one final refresh, including after partial failure.
  - Migrate existing multi-delete and multi-move flows onto it.
- Replace whole-map tag and usefulness persistence with 128 deterministic storage buckets:
  - Use FNV-1a hashing of bookmark ID to select a bucket.
  - Keep `availableTags` as a separate key.
  - Update all affected buckets through one `chrome.storage.local.set()` call and update Angular signals once per logical batch.
  - Preserve existing `TagsService`, `UsefulnessService`, and JSON backup interfaces.

## Storage Migration and AI Jobs

- Migrate legacy `bookmarkTags` and `bookmarkUsefulness` maps independently:
  1. Read and normalize the legacy map.
  2. Write all non-empty v2 buckets.
  3. Write a manifest containing storage version and populated bucket IDs.
  4. Remove the legacy key only after all prior writes succeed.
- If migration was interrupted before the manifest was written, treat the legacy map as authoritative and rebuild the buckets. Once the manifest exists, buckets are authoritative.
- Expose metadata readiness signals; bookmark analysis and AI jobs must wait until both stores finish loading.
- Add one persisted `AiJobCheckpoint` for mutually exclusive bulk AI work:
  - Store operation, candidate IDs, next cursor, totals, timestamps, prompt version, configuration fingerprint, optional tag-pool snapshot, status, and last error.
  - Persist progress after every successful batch.
  - Re-resolve each candidate and recheck eligibility before processing; skip deleted bookmarks and protect usefulness ratings changed to manual.
  - Keep the checkpoint when the page closes or a batch fails.
  - Show Resume and Discard controls in AI Settings.
  - Explicit cancellation or Discard removes the checkpoint.
  - Require a restart if model, endpoint, prompt version, tag policy, or tag-pool snapshot changed; exclude API-key contents from the fingerprint.
  - Retry network, HTTP 429, and HTTP 5xx failures three times after 1, 2, and 4 seconds. Invalid schema responses stop immediately without advancing the cursor.

## Interfaces and Tests

- Add `BucketedBookmarkMetadataStore<T>`, `MetadataStorageManifest`, `BulkMutationProgress`, `AiJobCheckpoint`, and `AiJobStatus` types.
- Keep JSON backup version 2 and its logical tag/usefulness maps unchanged.
- Add deterministic 10,000- and 50,000-bookmark fixtures plus a benchmark command whose output is redirected to `.temp/`.
- Test bounded DOM rendering, scrolling, sorting, full-list selection, keyboard behavior, and drag/context-menu behavior across virtualized rows.
- Test bucket distribution, touched-bucket-only writes, readiness, successful migration, interrupted migration, malformed buckets, deletion cleanup, and 10,000-record loading.
- Test refresh suppression, progress, cancellation, partial failures, and final refresh for bulk mutations.
- Test AI checkpoint creation, resume, discard, configuration mismatch, page-reload recovery, eligibility rechecks, retries, schema failure, and cursor preservation.
- Run unit tests, lint, build, benchmarks, and focused/full Playwright suites with artifacts under `.temp/`.

## Assumptions

- This feature does not add Cleanup Center routes, duplicate detection, Trash folders, advanced search, or AI organization.
- Chrome storage remains the persistence backend; IndexedDB is not introduced.
- The visual bookmark table may be internally restructured to support virtualization, but its columns and user-visible behavior remain unchanged.
- The locked umbrella plan remains unchanged at `docs/features/002-bookmark-cleanup-center/plan.md`.
- The existing uncommitted `playwright-report/index.html` change remains untouched.
