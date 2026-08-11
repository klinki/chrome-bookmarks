# Cleanup Center and Large-Library Scale Foundation

## Summary

Add a first-class `/cleanup` workspace for safely reviewing a 10,000+ bookmark library. Create `docs/features/002-bookmark-cleanup-center/plan.md` with this plan.

All analysis remains local and requires no new host permissions. Cleanup candidates are quarantined under `Other Bookmarks/Trash/Cleanup/<reason>` and are never automatically deleted.

## Cleanup Analysis and Workflow

- Run cleanup analysis in a Web Worker, debounced after bookmark or metadata changes, with stale scan results discarded by request ID.
- Provide separate views for:
  - Exact duplicate URLs.
  - Probable duplicate URLs.
  - Stale bookmarks.
  - Unknown usage.
  - Untagged bookmarks.
  - Unrated bookmarks.
  - Usefulness scores 1–2.
  - Empty folders.
  - Quarantined items.
- Define exact duplicates as identical stored URL strings.
- Define probable duplicates for HTTP(S) URLs by lowercasing scheme/host, removing fragments/default ports and known tracking parameters (`utm_*`, `gclid`, `fbclid`, `mc_cid`, `mc_eid`), and sorting remaining query parameters. Preserve scheme, path, trailing slash, and meaningful parameters.
- Show probable groups only when distinct original URLs share the normalized key. They must be reviewed individually; exact groups may use bulk acceptance.
- Preselect a duplicate keeper by most recent known use, then higher usefulness, more tags, older creation date, and stable bookmark ID. Allow the user to change it.
- Before quarantining duplicate copies, union their tags onto the keeper. Do not change its title or usefulness rating; merged tags are not removed if a copy is later restored.
- Default the stale threshold to 730 days and make it configurable:
  - Stale: known `dateLastUsed` older than the cutoff.
  - Unknown usage: no last-used value and `dateAdded` older than the cutoff.
  - Undated items: missing both timestamps, shown as a subsection of Unknown usage.
- Exclude managed bookmarks, permanent Chrome roots, and the complete Trash/Cleanup subtree from actionable findings.

## Trash, Restore, and Purge Safety

- Reuse stored Trash/Cleanup folder IDs when valid. Otherwise reuse the first matching direct folder by index or create it under Chrome’s default Other Bookmarks location.
- Create distinct reason folders: `Exact duplicates`, `Probable duplicates`, `Stale`, `Unknown usage`, `Untagged`, `Unrated`, `Low usefulness`, and `Empty folders`.
- When a bookmark has several findings, place it in the folder for the view from which quarantine was initiated and record every matched reason.
- Persist a `QuarantineRecord` containing node ID, action reason, all matched reasons, original parent/index, and quarantine timestamp.
- Restore in original-index order. If the original parent is missing, managed, or inside Trash, move the item to `Other Bookmarks/Restored from Cleanup`.
- Remove stale quarantine records when an item is manually moved out of Trash or deleted.
- Permanently purge only selected quarantined items, after explicit confirmation and successful initiation of a complete JSON backup. Never purge on a timer.
- Batch quarantine, restore, and purge through a mutation coordinator that suppresses per-item tree refreshes, reports progress, and triggers one refresh when complete.

## Large-Library and AI Foundations

- Virtualize both the existing bookmark list and Cleanup Center results with Angular CDK fixed-height rows and sticky headers.
  - Keep sorting, range selection, Select All, keyboard navigation, and ARIA grid semantics operating over the full collection.
  - Keep rendered row count below 100 for a 10,000-item result.
- Replace whole-map tag/usefulness writes with 128 deterministic storage buckets.
  - Preserve the current `TagsService` and `UsefulnessService` APIs and logical backup format.
  - Migrate legacy maps once, mark migration complete only after bucket writes succeed, then remove legacy keys.
  - Update only affected buckets and expose readiness so cleanup/AI jobs wait for metadata loading.
- Persist one resumable `AiJobCheckpoint` containing operation, candidate IDs, next cursor, configuration fingerprint, tag-pool snapshot when applicable, timestamps, and last error.
  - Save the cursor after every successful batch.
  - Closing the page or encountering an error retains the checkpoint and exposes Resume/Discard controls.
  - Explicit cancellation/discard removes it.
  - Re-resolve bookmark IDs and eligibility before each resumed batch; preserve manual usefulness ratings.
  - Require restart when model, prompt version, or relevant AI configuration changed.
  - Retry transient network/429/5xx failures three times with 1/2/4-second delays; schema failures stop without advancing.
- Add deterministic 10k and 50k benchmark fixtures. Keep cleanup analysis linear apart from grouping/sorting and verify virtualization through bounded DOM assertions.

## Interfaces and Test Plan

- Add public types for `CleanupReason`, `CleanupFinding`, `DuplicateGroup`, `CleanupSettings`, `QuarantineRecord`, and `AiJobCheckpoint`.
- Add cleanup analyzer, quarantine, bulk-mutation, and chunked-storage services while retaining existing bookmark/tag/usefulness interfaces.
- Keep JSON backup version 2 compatible; quarantined bookmarks remain recoverable as normal bookmark-tree content even if cleanup-operation metadata is unavailable after import.
- Test URL normalization boundaries, overlapping findings, stale/unknown rules, keeper selection, tag merging, managed/Trash exclusions, and worker stale-result cancellation.
- Test folder creation/reuse, reason-based quarantine, stable-order restore, fallback restore, manual moves, backup-gated purge, partial failures, and refresh suppression.
- Test storage migration, bucket distribution, changed-bucket-only writes, interrupted migration recovery, and 10,000-record loading.
- Test AI checkpoint resume, discard, configuration mismatch, eligibility rechecks, retry behavior, and failed-batch cursor preservation.
- Add Playwright coverage for 10,000-item virtualization, duplicate review, each quarantine reason, restore, and purge confirmation using Chrome/AI mocks.
- Run unit tests, lint, build, benchmark scripts, and focused/full Playwright suites with artifacts under `.temp/`.

## Assumptions

- Broken-link checking, content similarity, AI clustering, and automatic folder reorganization remain out of scope.
- No additional extension permissions or remote requests are introduced.
- Missing `dateLastUsed` is never treated as proof that a bookmark is stale.
- Trash folders remain ordinary synchronized Chrome bookmark folders; cleanup metadata only adds restoration context.
- The pre-existing uncommitted `playwright-report/index.html` change remains untouched.
