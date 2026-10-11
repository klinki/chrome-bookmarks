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
- [ ] Check Dependabot against the current dependency lockfile.
  - Reconcile GitHub's previously reported 21 alerts with a fresh dependency audit.
  - Address confirmed advisories and record any alerts that require separate work.
  - Local audit on 11 October 2026 found 17 development advisories and zero
    production advisories. Compatible patches for `axios` (1.20.0),
    `brace-expansion` (5.0.12), and `source-map-js` (1.2.2) reduced this to one
    development advisory. Nx's exact pins require the two targeted overrides.
  - `braces` 3.0.3 remains affected by
    [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
    GitHub lists no patched version and npm does not publish 3.0.4. Revisit when
    an upstream fix is published; the advisory has not been suppressed.
  - The patched lockfile passed pnpm 10 frozen installation, peer checks, lint,
    production extension packaging, 266 unit tests, and 52 E2E tests.
    The authenticated Dependabot alert comparison remains pending browser access.
- [x] Review the deferred TypeScript and Vitest major upgrades.
  - Check current Angular, Nx, Analog, and ESLint compatibility constraints.
  - Document the supported upgrade path, blockers, and validation required before
    applying a major upgrade.
  - Review completed on 11 October 2026; findings below.

## Major upgrade review

| Package | Current | Reviewed target | Decision |
| --- | --- | --- | --- |
| TypeScript | 6.0.3 | 7.0.2 | Keep 6.0.3. Both Angular compiler-cli 22.2.0 and latest 22.2.2 require `>=6.0 <6.1`. Revisit when Angular's compiler and build tooling explicitly support TypeScript 7. |
| Vitest | 4.1.11 | 5.0.3 | A supported peer range is available after aligning `nx` and all direct `@nx/*` packages to 23.3.0. Current Nx 23.2.1 excludes Vitest 5. |

Analog's installed `@analogjs/vitest-angular` 2.7.4 already declares support for
Vitest 5; latest Analog 2.8.0 does too. Vite 8.3.1 and CI's Node 24 meet Vitest 5's
requirements. These constraints establish an upgrade candidate; the candidate
has not yet been installed or tested in this repository.

For a Vitest upgrade, run the Nx migrations, review migration output, and then
validate the full build, unit suite, E2E suite, JUnit output, and repeat helper.
Vitest 5 enables `clearMocks` by default and rejects nested hoisted mock calls.
No `vi.mock`, `vi.unmock`, `vi.hoisted`, or `.sequential` calls were found in the
current source. Check shared mock call counts during the test run. The existing
`@nx/vitest:test` executor is also deprecated before Nx 24; review conversion to
inferred targets as part of the Nx migration.

Sources checked on 11 October 2026:

- [Angular compatibility](https://angular.dev/reference/versions)
- [Nx 23.3.0 Vitest peer declarations](https://registry.npmjs.org/@nx%2Fvitest/23.3.0)
- [Analog 2.7.4 peer declarations](https://registry.npmjs.org/@analogjs%2Fvitest-angular/2.7.4)
- [Vitest 5 migration guide](https://vitest.dev/guide/migration/)
