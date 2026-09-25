# GEBOOM (Good Enough Bookmark Manager)

Planned features for this extension:
* Table with name, address, added date with sorting
* Search (possibly keep current functionality)
* Trash for deleted bookmarks
* Drag & Drop (for search as well)

Future features:
* Tags
* Sync with other browsers (and devices)
* Relevance measure (find out how to estimate, most recently visited and mostly visited have bigger relevance than older ones)
* Sharing options

This project was generated with [angular-cli](https://github.com/angular/angular-cli) version 1.0.0-beta.9.
[.editorconfig](.editorconfig)
## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run the production build with:

```bash
npm run build
```

The build artifacts are stored in `dist/bookmarks/`. To load the unpacked Chrome extension, select `dist/bookmarks/browser/` as the extension directory in `chrome://extensions`.

The build also runs `npm run verify:extension`, which validates the packaged extension in `dist/bookmarks/browser/`. It checks that `manifest.json` is valid, declares a background service worker and options page, and that those files and the manifest icons exist beside the manifest. Run the check independently after an existing build with:

```bash
npm run verify:extension
```

The development and production build variants run the same verification step.

To build and package an installable ZIP, run:

```bash
npm run build:extension
```

The archive is written to `.temp/chrome-extension/chrome-bookmarks.zip`, with `manifest.json` at the archive root. The build workflow uploads this ZIP as the `chrome-extension` artifact. Packaging requires PowerShell 7 (`pwsh`).

## Running tests

For fast local iteration, keep the `CI` environment variable unset or empty. Playwright uses its presence to select one worker, enable retries, and require a fresh development server; those safeguards make the suite substantially slower.

```bash
# Unit tests only
npm run test:unit

# End-to-end tests with local parallelism
CI='' npm run test:e2e

# Visible, single-browser E2E run with slowed interactions
CI='' npm run test:e2e:visible

# Complete local suite
CI='' npm test

# Repeat the full suite to look for flaky tests (10 runs by default)
npm run verify:flaky

# Repeat only unit or E2E tests a chosen number of times
npm run verify:flaky -- -Count 3 -Script test:unit
```

Visible mode adds a 300 ms delay to each Playwright action. Override it when needed, for example with `PLAYWRIGHT_SLOW_MO=750 npm run test:e2e:visible`.

Do not use `CI=false`: it is a non-empty string and therefore enables CI mode. Use CI mode only for final verification:

```bash
CI=1 npm test
npm run lint
npm run build
npm run benchmark
```

The repeat helper exits with a failure status if any run fails. It requires PowerShell 7 (`pwsh`) and works on Windows, macOS, and Linux.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
