# Repository follow-ups

Work through these items in order. Commit each completed change separately using
Conventional Commits. Do not push commits without David's explicit approval.

- [x] Verify the live preview deployment and cleanup.
  - Deploy the existing remote revision through GitHub Actions.
  - Confirm the preview serves the app and its assets from the site root.
  - Verify redeployment replaces old files and cleanup removes the preview.
  - Record the workflow runs, URL checks, and any access limitations.
  - On 11 October 2026, deployed remote revision `5c97144` successfully in
    [run 38131851231](https://github.com/klinki/chrome-bookmarks/actions/runs/38131851231).
    HTTPS, the bookmark view, 16 root assets, and browser console checks passed.
  - [Redeployment run 38132035443](https://github.com/klinki/chrome-bookmarks/actions/runs/38132035443)
    replaced the asset graph and removed all five obsolete JavaScript chunks.
  - [Cleanup run 38137287063](https://github.com/klinki/chrome-bookmarks/actions/runs/38137287063)
    succeeded. The live preview root, `index.html`, and `manifest.json` each
    returned HTTP 404 after cleanup.
- [x] Fix the remaining lint warnings.
  - Resolve the 39 warnings reported by the previous audit without disabling rules.
  - Run lint and the tests needed for the affected behavior.
  - Verified on 11 October 2026: zero warnings/errors, production extension ZIP
    build, 266 unit tests, and 52 E2E tests passed.
- [x] Check Dependabot against the current dependency lockfile.
  - Reconcile GitHub's previously reported 21 alerts with a fresh dependency audit.
  - Address confirmed advisories and record any alerts that require separate work.
  - The final local audit on 11 October 2026 reports zero advisories. The
    dependency updates removed `axios` and `braces` from the lockfile, resolving
    the previously outstanding braces advisory without suppressing it.
  - The old Axios, brace-expansion, and smol-toml overrides were removed. Nx
    23.3.0 pins Undici 7.29.0, so a targeted override selects its security patch
    7.29.1. All ten Undici advisories found during the update are resolved.
  - The final lockfile passed pnpm 10 frozen installation, peer checks, lint,
    production extension packaging, 266 unit tests, and 52 E2E tests.
  - The authenticated GitHub check on 11 October 2026 found six open alerts,
    all development-only Axios alerts introduced by Nx 23.2.1. GitHub identifies
    Axios 1.20.0 as the fix for all six. The subsequent Nx update removed Axios
    entirely from the local dependency graph.
    GitHub's dependency files were last checked on 25 September 2026. The old
    21-alert push banner is no longer the current alert inventory.
  - Previously open remote alerts: [#386](https://github.com/klinki/chrome-bookmarks/security/dependabot/386),
    [#388](https://github.com/klinki/chrome-bookmarks/security/dependabot/388),
    [#389](https://github.com/klinki/chrome-bookmarks/security/dependabot/389),
    [#391](https://github.com/klinki/chrome-bookmarks/security/dependabot/391),
    [#393](https://github.com/klinki/chrome-bookmarks/security/dependabot/393),
    and [#394](https://github.com/klinki/chrome-bookmarks/security/dependabot/394).
    None were dismissed. After the approved push of `7226f0e`, GitHub's
    dependency scan on 11 October 2026 closed all six automatically. The
    authenticated Dependabot inventory now shows zero open alerts.
- [x] Review the deferred TypeScript and Vitest major upgrades.
  - Check current Angular, Nx, Analog, and ESLint compatibility constraints.
  - Document the supported upgrade path, blockers, and validation required before
    applying a major upgrade.
  - Review and supported updates completed on 11 October 2026; findings below.
  - Nx and all direct `@nx/*` packages were updated to 23.3.0 using `nx migrate`.
    Angular/CDK/CLI/build packages are 22.2.2, Analog packages are 2.8.0, and the
    remaining supported direct dependencies were updated through the same tool.
    Nx generated no code migrations for these version changes.

## Remaining work

- [x] Recheck the six Axios alerts after an approved push and GitHub dependency scan.
  All six closed automatically; zero alerts remain open.
- [x] Eliminate the affected `braces` dependency from the local dependency graph.
- [x] Remove the deprecated Angular animations dependency and legacy no-op
  providers from startup and test fixtures. Build and all tests pass without it.
- [x] Remove deprecated `whatwg-encoding`. Its parent chain was
  `@nx/web -> http-server 14.1.1 -> html-encoding-sniffer 3.0.0`.
  The latest http-server still uses v3, so a narrowly scoped override selects
  sniffer 7.0.0 for that parent. Its Node requirement is compatible with this
  project's supported versions. Eight live static-server cases preserved
  UTF-8, Latin-1, UTF-16, CSS, and JavaScript charsets and response bytes.
- [x] Convert Vitest to inferred Nx targets using
  `@nx/vitest:convert-to-inferred`. The full-suite npm `test` script is excluded
  from Nx script inference to prevent it from replacing the unit target.
  All other existing npm-script targets are preserved. JUnit and coverage
  outputs are declared under `.temp/`; a cache hit restored the JUnit file
  byte for byte after deletion. `npm test` passed 266 unit and 52 E2E tests.
  Playwright's artifact directory is isolated beneath `.temp/test-results/playwright`
  so its cleanup preserves both unit and E2E JUnit reports in the parent directory.
- [ ] Investigate the web preview's Google favicon fallback. During the live
  check on 11 October 2026, the Seznam and Centrum favicon requests were blocked
  by Chromium with `net::ERR_BLOCKED_BY_ORB`. The fallback in
  `src/app/pipes/favicon.pipe.ts` currently sends the Chrome-style `pageUrl`
  parameter to Google's endpoint. Check the service's expected request format
  and add coverage for the web fallback; existing tests cover the Chrome path.
  Folder navigation, bookmark details, and search still worked.

## Major upgrade review

| Package | Current | Reviewed target | Decision |
| --- | --- | --- | --- |
| TypeScript | 6.0.3 | 7.0.2 | Kept 6.0.3 as requested. Angular compiler-cli 22.2.2 and typescript-eslint 8.71.1 require TypeScript below 6.1. Revisit when both support TypeScript 7. |
| Vitest | 5.0.3 | 5.0.3 | Updated through `nx migrate` and verified with the complete unit suite, JUnit report, repeat helper, build, and E2E suite. No test or configuration changes were needed. |

Angular Build 22.2.2, Nx Vitest 23.3.0, and Analog 2.8.0 all declare support for
Vitest 5. Vite 8.3.4 and CI's Node 24 meet the declared engine requirements.
Validation ran locally on Node 26.0.0 and passed on CI's Node 24 after the
approved push of `7226f0e`.

The repeat helper ran with Nx caching disabled and passed all 266 unit tests;
JUnit contains 266 cases with zero failures/errors. The production ZIP matches
all 46 extension output files, lint has zero warnings/errors, and all 52 E2E
tests pass. Vitest 5's default mock clearing was retained.

The legacy Vitest executor and both deprecated dependency packages are now
removed. The final audit and peer checks are clean.
[GitHub CI run 38143295667](https://github.com/klinki/chrome-bookmarks/actions/runs/38143295667)
passed frozen installation, lint, extension packaging and artifact upload,
266 unit tests, and 52 E2E tests. Both JUnit files were parsed: 318 tests passed
with zero failures or skips. Remote Dependabot verification found zero open alerts.

## Workflow action maintenance

- [x] Update all active external action references to their latest stable releases
  checked on 11 October 2026. JavaScript actions declare Node 24; the SSH/SCP
  actions use composite steps.
  - Checkout 7.0.1, Node setup 7.1.0, pnpm setup 6.1.0, artifact upload 7.0.2,
    JUnit reporting 6.6.1, GitHub script 9.0.0, SSH key setup 2.8.1,
    SSH deployment 1.2.5, and SCP deployment 1.0.0.
  - Exact release versions are pinned. Project Node 24, pnpm 10, caching,
    report paths, extension archive format, and preview inputs are preserved.
  - Official migration notes and action manifests were reviewed. Actionlint
    1.7.12 passed; all 21 action references passed manifest/input checks.
    The PR comment script passed a local check with the v9 injected context.
- [x] Verify the updated actions in GitHub CI and a live preview deployment/cleanup
  after the approved push of `a51cdb9`.
  - [CI run 38147885453](https://github.com/klinki/chrome-bookmarks/actions/runs/38147885453)
    passed frozen installation, lint, extension build/upload, 266 unit tests,
    52 E2E tests, and the combined 318-test JUnit report. Node runtime
    deprecation warnings are gone.
  - [Preview deploy run 38155032607](https://github.com/klinki/chrome-bookmarks/actions/runs/38155032607)
    succeeded on the same revision. Headless Playwright verified HTTPS,
    folder navigation, bookmark selection/details, and search. All 27
    responses from the preview host returned HTTP 200, CSS and JavaScript
    MIME types were correct, and the app reported zero console errors/warnings.
    The two external favicon failures are tracked separately above.
  - [Preview cleanup run 38155400917](https://github.com/klinki/chrome-bookmarks/actions/runs/38155400917)
    succeeded. Playwright confirmed the root returns HTTP 404; direct checks
    also confirmed 404 for `index.html`, `manifest.json`, `main.js`, and
    `styles.css`.
  - Manual preview runs exercised the SSH key, SSH, and SCP actions. The
    PR-only comment step was skipped; its `github-script` v9 compatibility
    was checked locally without posting a comment.

Release references:

- [Checkout 7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)
- [Node setup 7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0)
- [pnpm setup 6.1.0](https://github.com/pnpm/action-setup/releases/tag/v6.1.0)
- [Artifact upload 7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)
- [JUnit reporting 6.6.1](https://github.com/mikepenz/action-junit-report/releases/tag/v6.6.1)
- [GitHub script 9.0.0](https://github.com/actions/github-script/releases/tag/v9.0.0)
- [SSH key setup 2.8.1](https://github.com/shimataro/ssh-key-action/releases/tag/v2.8.1)
- [SSH deployment 1.2.5](https://github.com/appleboy/ssh-action/releases/tag/v1.2.5)
- [SCP deployment 1.0.0](https://github.com/appleboy/scp-action/releases/tag/v1.0.0)

Sources checked on 11 October 2026:

- [Angular compatibility](https://angular.dev/reference/versions)
- [Nx 23.3.0 Vitest peer declarations](https://registry.npmjs.org/@nx%2Fvitest/23.3.0)
- [Analog 2.8.0 peer declarations](https://registry.npmjs.org/@analogjs%2Fvitest-angular/2.8.0)
- [Vitest 5 migration guide](https://vitest.dev/guide/migration/)
