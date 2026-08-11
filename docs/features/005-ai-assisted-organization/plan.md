# Feature 4 of 4: AI-Assisted Organization

## Summary

Add a local-first organization workspace for large bookmark libraries. It will use embeddings to cluster bookmarks, then use the configured chat LLM to name topics and propose folder and tag changes.

Save this plan verbatim, excluding the `<proposed_plan>` wrapper, to `docs/features/005-ai-assisted-organization/plan.md`. Create all locked plan files before modifying implementation code.

## Organization Workflow

- Add a lazy-loaded `/organize` workspace supporting all bookmarks, a folder subtree, a Smart Collection, or the current selection. Exclude folders and quarantined bookmarks, reporting excluded items.
- Require an existing destination root. Propose at most two new folder levels beneath it; reuse case-insensitively matching folders and never move or delete existing folders.
- Choose a deterministic default topic count of `min(n, 80, max(1, round(sqrt(n) / 2)))`, adjustable from `1` to `min(n, 100)`.
- Present a virtualized review containing proposed folders, bookmark moves, up to three topic tags per cluster, and tag consolidations. Nothing is selected by default.
- Allow users to rename proposed folders and tags, reassign or exclude bookmarks, choose canonical tags, and approve actions individually or by cluster.
- Apply approved tag consolidations across the whole library. Only approved synonym replacements may remove tags; arbitrary tag removal is out of scope.

## AI Analysis and Page Enrichment

- Extend AI settings with a required embedding model, reusing the existing OpenAI-compatible base URL and API key. Add an embedding connection test.
- Embed title, URL, folder path, tags, and usefulness. Process batches of 16 with strict validation for count, dimensions, and finite numeric vectors.
- Cache vectors in IndexedDB by bookmark-input and embedding-configuration fingerprints. Cache content-enriched vectors for 30 days and use HTTP validators where available.
- Cluster normalized vectors in a Web Worker using deterministic seeded cosine k-means++. Preserve every bookmark, including small or singleton clusters.
- Label clusters from centroid-nearest representatives using strict JSON-schema chat output. Require complete, unique cluster mappings and return folder paths, topic tags, confidence, and a short rationale.
- Generate tag-consolidation candidates from normalized spelling and embedding similarity, then require strict-schema LLM confirmation. Default the canonical value to the most-used existing spelling.
- Keep page enrichment off by default. Add optional HTTP/HTTPS host permissions requested only when the user enables it, plus an explicit revoke action.
- Fetch pages without credentials or script execution, accept only HTML, use a 10-second timeout and 2 MB response limit, and extract metadata, headings, and at most 6,000 characters of readable text.
- Send extracted text only to the embedding endpoint and discard it immediately afterward. Never persist excerpts or send them to the chat-labeling operation.
- Treat fetch, parsing, and unsupported-page failures as skipped enrichment: continue with bookmark metadata and show a final failure summary.

## Interfaces, Persistence, and Safety

- Add typed organization scopes, plans, clusters, proposals, progress, model fingerprints, conflicts, and apply/undo journals.
- Store recomputable embeddings and draft plans in IndexedDB. Keep the shared mutually exclusive AI job checkpoint small, resumable, and linked to the IndexedDB plan.
- Invalidate vectors when their input or embedding configuration changes; invalidate generated labels when chat-model or prompt fingerprints change.
- Before applying, revalidate bookmark existence, parent, tags, usefulness, destination root, and required folders. Leave stale proposals unselected and require review rather than silently overwriting changes.
- Show the complete selected diff and generate a version 3 JSON backup before mutation.
- Apply folder creation, tag changes, and bookmark moves through the bulk mutation coordinator. On failure, rollback completed changes in reverse order and report anything that could not be restored.
- Retain one conflict-aware undo journal across restarts. Undo only items still matching their recorded post-apply state, remove generated folders only when empty, and replace the journal only after warning before another apply.
- Do not include embeddings, drafts, page text, or undo journals in JSON backups; they are local, derived state.

## Test Plan

- Test embedding serialization, validation, cache invalidation, resumable batches, cancellation, transient retries, and model changes.
- Test deterministic clustering, adjustable topic counts, representative selection, strict cluster-label schemas, tag candidate grouping, and malformed or incomplete AI responses.
- Test optional permission grant/revoke, HTML extraction limits, credential omission, redirects, timeouts, oversized responses, unsupported content, and non-retention of page text.
- Test every organization scope, quarantine exclusion, folder reuse, two-level validation, virtualized review, editing, reassignment, and default-unselected proposals.
- Test whole-library tag consolidation, duplicate canonical tags, stale-plan conflicts, backup-before-apply, rollback, one-step undo, partial undo conflicts, and empty-folder cleanup.
- Run unit tests, lint, build, and focused Playwright tests with mocked embedding, chat, permission, and page-fetch APIs. Add 10,000- and 50,000-bookmark performance fixtures and redirect all generated artifacts to `.temp/`.

## Assumptions

- Features 1–3 are implemented first, providing virtualized lists, bulk mutation coordination, resumable AI jobs, quarantine semantics, Smart Collections, and version 3 backups.
- Existing folders outside the selected destination root remain untouched, and empty source folders are left for Cleanup Center.
- Page enrichment is optional and explicitly disclosed because a configured AI endpoint may be remote.
- Organization plans are advisory until the user explicitly selects and applies actions.
