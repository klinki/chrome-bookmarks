# Repository follow-ups

Work through these items in order. Commit each completed change separately using
Conventional Commits. Do not push commits without David's explicit approval.

- [ ] Verify the live preview deployment and cleanup.
  - Deploy the existing remote revision through GitHub Actions.
  - Confirm the preview serves the app and its assets from the site root.
  - Verify redeployment replaces old files and cleanup removes the preview.
  - Record the workflow runs, URL checks, and any access limitations.
- [x] Fix the remaining lint warnings.
  - Resolve the 39 warnings reported by the previous audit without disabling rules.
  - Run lint and the tests needed for the affected behavior.
  - Verified on 11 October 2026: zero warnings/errors, production extension ZIP
    build, 266 unit tests, and 52 E2E tests passed.
- [ ] Check Dependabot against the current dependency lockfile.
  - Reconcile GitHub's previously reported 21 alerts with a fresh dependency audit.
  - Address confirmed advisories and record any alerts that require separate work.
- [ ] Review the deferred TypeScript and Vitest major upgrades.
  - Check current Angular, Nx, Analog, and ESLint compatibility constraints.
  - Upgrade when supported, or document the specific blockers and revisit criteria.
  - Validate any upgrades with build, unit tests, and E2E tests.
