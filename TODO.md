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
  - Current remote alerts: [#386](https://github.com/klinki/chrome-bookmarks/security/dependabot/386),
    [#388](https://github.com/klinki/chrome-bookmarks/security/dependabot/388),
    [#389](https://github.com/klinki/chrome-bookmarks/security/dependabot/389),
    [#391](https://github.com/klinki/chrome-bookmarks/security/dependabot/391),
    [#393](https://github.com/klinki/chrome-bookmarks/security/dependabot/393),
    and [#394](https://github.com/klinki/chrome-bookmarks/security/dependabot/394).
    None were dismissed. They remain open while the fixes are unpushed.
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

- [ ] Recheck the six Axios alerts after an approved push and GitHub dependency scan.
- [x] Eliminate the affected `braces` dependency from the local dependency graph.

## Major upgrade review

| Package | Current | Reviewed target | Decision |
| --- | --- | --- | --- |
| TypeScript | 6.0.3 | 7.0.2 | Kept 6.0.3 as requested. Angular compiler-cli 22.2.2 and typescript-eslint 8.71.1 require TypeScript below 6.1. Revisit when both support TypeScript 7. |
| Vitest | 5.0.3 | 5.0.3 | Updated through `nx migrate` and verified with the complete unit suite, JUnit report, repeat helper, build, and E2E suite. No test or configuration changes were needed. |

Angular Build 22.2.2, Nx Vitest 23.3.0, and Analog 2.8.0 all declare support for
Vitest 5. Vite 8.3.4 and CI's Node 24 meet the declared engine requirements.
Validation ran locally on Node 26.0.0; GitHub CI awaits an approved push.

The repeat helper ran with Nx caching disabled and passed all 266 unit tests;
JUnit contains 266 cases with zero failures/errors. The production ZIP matches
all 46 extension output files, lint has zero warnings/errors, and all 52 E2E
tests pass. Vitest 5's default mock clearing was retained.

The existing `@nx/vitest:test` executor remains deprecated before Nx 24; convert
to inferred targets before that future upgrade. Package deprecation notices
remain for `@angular/animations` and transitive `whatwg-encoding`.

Sources checked on 11 October 2026:

- [Angular compatibility](https://angular.dev/reference/versions)
- [Nx 23.3.0 Vitest peer declarations](https://registry.npmjs.org/@nx%2Fvitest/23.3.0)
- [Analog 2.8.0 peer declarations](https://registry.npmjs.org/@analogjs%2Fvitest-angular/2.8.0)
- [Vitest 5 migration guide](https://vitest.dev/guide/migration/)
