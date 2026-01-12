# Agent Documentation: Chrome Bookmarks Manager

This file provides context for AI agents working on this project. It highlights the technology stack, key commands, and architectural patterns.

## Project Overview
A web-based Chrome Bookmarks manager built with **Angular** and **Nx**. It features a tree view (left) and a list view (center) with bookmark details (right).

## Key Technology Stack
- **Framework**: Angular (using **Signals** for state management)
- **Styling**: SCSS / Angular Material
- **Testing**: Playwright (E2E), Karma (Unit)
- **Build System**: Nx

## Common Commands

### Development
- **Start Local Server**: `npm start` (Runs on http://localhost:4200)
- **Build**: `npm run build`
- **Lint**: `nx lint bookmarks`

### Testing
- **Run E2E Tests (Playwright)**: `npx playwright test`
  - *Note*: Tests are consolidated in the `/e2e` directory.
- **Run Unit Tests (Karma)**: `npm test` or `nx test bookmarks`

## Temporary Files & Artifacts
- **Directory**: `.temp/`
- **Rule**: All command outputs (txt), test results (json), screenshots (png), and tool-generated test results (e.g. Playwright's `test-results/`) should be redirected to the `.temp/` directory to keep the root clean.
  - *Example*: `npx playwright test > .temp/test-results.txt 2>&1`
- **Config**: Playwright is configured to use `.temp/test-results` for artifacts.
- **Git**: The `.temp/` directory is ignored by Git.

## E2E Testing Infrastructure
- **Directory**: `/e2e`
- **Mocking**: `e2e/e2e-utils.ts` contains `setupChromeMock` which injects a mock `chrome` object and `window.e2eBookmarks` data.
- **Page Object**: `e2e/app.po.ts` defines the `AppPage` class for common navigation and interactions.
- **Custom Logic**: The app uses `isE2E` flag and `MockBookmarksService` when running in non-production environments to facilitate testing.

## State Management & Services
- **`BookmarksFacadeService`**: Centralized state management using Angular Signals (`directories`, `items`, `selection`).
- **`BookmarksService`**: Wrapper for `chrome.bookmarks` API.
- **`SelectionService`**: Manages selection state and directory navigation.
- **`TagsService`**: Manages bookmark tagging (stored in `chrome.storage.local`).

## Known Nuances
- **MIME Warnings**: Browsers may show MIME type warnings for `tree.css` and `list.css` because they are served as `text/html` by the dev server, but they are included as inline styles as a fallback.
- **Keyboard Shortcuts**: E2E tests check `process.platform` for `Meta` (macOS) vs `Control` (Windows/Linux) keys.
