# Feature 3 of 4: Advanced Search and Smart Collections

## Summary

Replace the current plain Chrome search with a local, structured search engine for 10,000–50,000 bookmarks. Add a hybrid query box and visual filter chips, plus saved Smart Collections in the left tree.

When documentation writes are authorized, save this plan to `docs/features/004-advanced-search-smart-collections/plan.md`. Do not implement it until all feature plans are complete.

## Search Engine and Query Language

- Build a serializable search document for every real bookmark and folder containing:
  - ID, type, title, URL, hostname, tags, full folder path, date added, optional date last used, usefulness score/source, and quarantine state.
- Run indexing and queries in a Web Worker:
  - Rebuild after debounced bookmark/tag/usefulness changes.
  - Debounce typed queries by 150 ms.
  - Tag requests with monotonically increasing IDs and ignore stale results.
  - Return ordered node IDs; resolve nodes from the shared facade snapshot.
- Unqualified text searches title, URL, hostname, tags, and full folder path using Unicode-normalized, case-insensitive substring matching.
- Support quoted phrases and escaped quotes/backslashes.
- Use this grammar and precedence:
  - Parentheses group expressions.
  - `NOT` and unary `-` bind strongest.
  - `AND` and implicit adjacency bind next.
  - `OR` binds weakest.
- Support fields:
  - `title:`, `url:`, `host:`, `tag:`, `path:`.
  - `type:bookmark|folder`.
  - `score:` with `=`, `<`, `<=`, `>`, or `>=`.
  - `source:ai|manual`.
  - `added:` and `used:` with ISO `YYYY-MM-DD` comparisons.
  - `age:` and `unused:` with durations such as `30d`, `6m`, or `2y`; define month as 30 days and year as 365 days.
  - `is:tagged|untagged|rated|unrated|usage-unknown|quarantined`.
- Missing values do not satisfy positive comparisons. `unused:` excludes unknown usage unless combined with `is:usage-unknown`.
- Exclude `Trash/Cleanup` results by default; `is:quarantined` explicitly includes them.
- Parse to a versioned AST. Invalid queries show an inline error with source position, disable saving, and retain the last valid result set.

## Search and Smart Collection UI

- Preserve plain-text typing in the existing search box while adding:
  - Filter button and visual filter panel.
  - Removable chips generated from the parsed AST.
  - Query/filter synchronization through a canonical query formatter.
  - Global scope by default and an optional folder-subtree picker storing a stable folder ID.
- Include folders and bookmarks in global and subtree results. The selected scope folder itself is excluded; descendants are included.
- Keep drag-and-drop disabled while viewing ad hoc or saved search results.
- Add a `Smart Collections` virtual root to the left tree, ahead of Tags and Servers.
- Persist `SmartCollection` records containing UUID, unique case-insensitive name, query text, query-language version, optional scope folder ID, sort column/direction, and timestamps.
- Provide Create from current search, Edit, Duplicate, Rename, and Delete actions.
- Sort collections alphabetically by name. Do not evaluate or display counts for every collection; show only the selected collection’s count in the results header.
- Persist sort changes for a selected Smart Collection; ad hoc search sorting remains temporary.
- Synchronize ad hoc queries and selected collection IDs with hash-route query parameters so browser Back/Forward restores search state.

## Persistence and Interfaces

- Add public types for `SearchDocument`, `SearchQueryAst`, `SearchParseError`, `SearchRequest`, `SearchResult`, and `SmartCollection`.
- Add parser/formatter, worker-backed index, and Smart Collection services.
- Store collections in `chrome.storage.local`; wait for the Scale Foundation metadata readiness state before indexing.
- Upgrade JSON backup to version 3 with a validated `smartCollections` array:
  - Continue accepting versions 1 and 2.
  - Validate every imported query before creating bookmarks.
  - Remap folder-scope IDs through the import source-to-created ID map.
  - Convert unresolved scopes to global and report a non-fatal warning.
  - Regenerate conflicting collection UUIDs and suffix conflicting names with ` (Imported)` and a numeric counter.
  - Apply collections only after bookmark creation succeeds; restore the prior collection state if later import work fails.
- Keep tag/usefulness backup shapes unchanged.

## Test Plan

- Test tokenizer/parser precedence, implicit AND, parentheses, negation, quoting, escaping, comparators, dates, durations, field validation, and source-positioned errors.
- Test all indexed fields, missing-value semantics, subtree scope, Trash exclusion, quarantine inclusion, Unicode/case normalization, folders, and stale worker-response suppression.
- Test chip/query round trips through the canonical formatter.
- Test Smart Collection CRUD, case-insensitive name uniqueness, alphabetical ordering, stored sorting, route restoration, and selected-only result counts.
- Test backup v3 export/import, v1/v2 compatibility, query validation before mutation, scope remapping, unresolved scopes, ID/name conflicts, and rollback.
- Add 10,000- and 50,000-document search benchmarks and verify that result rendering remains bounded by Feature 1 virtualization.
- Add Playwright coverage for plain-text compatibility, filter chips, Boolean queries, folder scope, saved collections, Back/Forward state, invalid-query UX, and keyboard accessibility.
- Run unit tests, lint, build, benchmarks, and focused/full Playwright suites with artifacts under `.temp/`.

## Assumptions

- Fuzzy matching, semantic/vector search, natural-language-to-query conversion, and AI ranking remain out of scope for this feature.
- Smart Collection evaluation is read-only; it never moves or deletes bookmarks.
- Feature 1 Scale Foundation is implemented before this feature, and Cleanup Center quarantine metadata is consumed when available.
- No new extension permissions or network requests are introduced.
- The locked Cleanup Center umbrella and Scale Foundation plans remain unchanged and queued for documentation-only saving.
- The existing uncommitted `playwright-report/index.html` change remains untouched.
