# Bookmark Usefulness Index

## Summary

Implement a persistent, AI-generated bookmark usefulness rating. Use an integer scale from `1` to `5`; a missing value means unscored. The classifier estimates general utility using only the bookmark title and URL.

Save this plan verbatim, excluding the `<proposed_plan>` wrapper tags, to `docs/features/001-bookmark-usefullness/plan.md`. Use that exact directory spelling.

## Rating Rubric

Use the following wording verbatim in the LLM prompt and user-facing rating labels:

1 — very low expected future value  
2 — limited, narrow, or easily replaceable value  
3 — useful in a specific situation  
4 — strong, reusable reference or tool  
5 — exceptional, distinctive, or repeatedly valuable

The prompt must treat `3` as the ordinary default and reserve `1` and `5` for clear cases.

## Implementation Changes

- Add a usefulness metadata service storing ratings by bookmark ID under `bookmarkUsefulness`:
  - Rating shape: `{ score: 1 | 2 | 3 | 4 | 5, source: 'ai' | 'manual' }`.
  - Support individual and batched updates, clearing a rating, validation during loading, and cleanup when bookmarks are deleted.
- Add a separate AI scoring operation using batches of 10 and strict JSON-schema output.
  - Send only each bookmark’s ID, title, and URL.
  - Include the verbatim rating rubric in the prompt.
  - Require one valid, unique integer score per requested bookmark; reject the entire batch for missing, duplicate, unknown, or out-of-range results.
  - On failure, stop processing, preserve earlier completed batches, and apply nothing from the failed batch.
- Generalize the existing AI progress state so tag categorization and usefulness scoring share one mutually exclusive, cancellable job indicator.
- Add settings actions:
  - **Rate Unscored** processes bookmarks without ratings.
  - **Re-rate AI Scores** refreshes AI-generated ratings while preserving manual values.
- Add **AI Rate Usefulness** for selected bookmarks. This explicit selection action may replace a manual rating with an AI rating.
- Add a sortable **Usefulness** list column. Folders and unscored bookmarks display `—`; folders remain grouped first and missing scores sort after scored bookmarks.
- Add an editable detail control with “Not rated” and the verbatim labeled values 1–5. User edits are stored with `source: 'manual'`.
- Keep usefulness scoring separate from tag categorization; existing tag behavior remains unchanged.

## Interfaces and Persistence

- Extend bookmark sort columns with `'usefulness'`.
- Add AI APIs for scoring one batch and running bulk modes `unscored` and `rerate-ai`.
- Upgrade JSON backups to version 2 with a validated `usefulness` map, preserving score provenance.
- Continue accepting version 1 backups as having no usefulness data; remap imported ratings to newly created bookmark IDs.
- Leave HTML bookmark import/export unchanged.

## Test Plan

- Test rating normalization, persistence, manual/AI provenance, clearing, batched writes, and deletion cleanup.
- Test that the prompt contains the exact rubric wording and sends only ID, title, and URL.
- Test all five scores, malformed responses, incomplete batches, duplicate or unknown IDs, cancellation, and stop-on-error behavior.
- Test bulk-mode filtering and protection of manual ratings.
- Test list rendering and numeric sorting, including folders and unscored values.
- Test manual editing and selected-bookmark AI scoring in the detail panel.
- Test version 2 export/import, version 1 compatibility, ID remapping, and malformed usefulness metadata.
- Run unit tests, lint, build, and focused Playwright coverage without calling a live LLM; redirect generated artifacts to `.temp/`.

## Assumptions

- The index measures general expected future utility, not personal relevance.
- V1 does not fetch page content or use bookmark dates, browsing history, explanations, or confidence values.
- Manual ratings are protected from bulk AI refreshes but can be intentionally replaced through selected-bookmark scoring.
- Code and storage identifiers use the correctly spelled `usefulness`; only the requested documentation directory uses `usefullness`.
- The existing unrelated `playwright-report/index.html` modification remains untouched.
