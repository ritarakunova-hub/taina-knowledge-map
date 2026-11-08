# TAINA Knowledge Map V1 — security review

Review date: 2026-11-07
Latest source audit: 2026-11-07  
Scope: source-code review of the supplied V1 archive and automated unit tests. This is not a penetration test, dependency audit, or certification.

## Changes made in this review

- Development server now binds to `127.0.0.1`, not `0.0.0.0`, reducing accidental exposure to the local network.
- Production HTML receives a restrictive Content Security Policy: scripts and styles from the same origin only; no objects; no base URL override; forms restricted to same origin. A strict referrer policy is also added.
- JSON import is limited to 5 MiB and rejects malformed JSON and invalid project structures before replacing or merging data. Validation also caps total records (5,000), individual text fields (100,000 characters), diagnostic keys (100), and change-log entries (1,000), with bounded metadata fields.
- Merging another project's evidence now invalidates the current VERIFY sign-off. The sign-off cannot silently survive an expanded evidence scope.
- Clearing the local workspace now clears project data and the active-project pointer in one IndexedDB transaction.
- Tests cover oversized JSON, malformed JSON, invalid project structures, collection/field limits, diagnostic types, bounded history, and VERIFY invalidation after merge.

## Security properties observed in the source

- No use of `eval`, `new Function`, `dangerouslySetInnerHTML`, direct `innerHTML`, or app-level network requests was found in the reviewed source files.
- User content is rendered through React text/controls, which escape text by default.
- CSV export neutralizes spreadsheet formula prefixes; XLSX cells are written as text values.
- Import validates project schema, IDs, and supported references before applying it.
- The app has no backend, accounts, authentication, authorization, or team-sharing layer. Local browser data is not encrypted by this application.

## Remaining risks / release blockers

- Dependencies are declared with `latest`; no lockfile is present. Exact dependency versions and supply-chain provenance are therefore not reproducible. Pin versions and commit a lockfile in a network-enabled build environment.
- `npm audit` / equivalent vulnerability scanning has not been run because dependencies could not be installed in this environment. Package manifests still use `latest`; pinning versions and generating a lockfile must happen in a network-enabled build environment. This remains a supply-chain reproducibility risk.
- Production build and browser E2E tests have not been executed. The production CSP injection is source-reviewed but not verified against a built bundle in a browser. The preview server is also explicitly bound to loopback.
- Deployment must add HTTP response headers at the hosting layer, at minimum `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), and an appropriate `Permissions-Policy`.
- IndexedDB is not encrypted at rest. Anyone with access to the same operating-system account/browser profile, browser debugging tools, or a malicious browser extension may be able to read the project.
- Do not store personal, medical, financial, client, credential, or confidential business information in V1. Use synthetic or appropriately anonymized data.
- This review did not include dynamic penetration testing, browser-extension threat testing, malicious-file fuzzing, or a formal threat model.

## Current assessment

**Improved security posture; not security-certified and not approved for sensitive company data.** V1 is suitable only for a controlled pilot with non-sensitive/anonymized information after a successful production build and browser checks.

## Additional hardening pass (2026-11-07)

- Imported project collections are capped at 5,000 total rows; individual text values are capped at 100,000 characters; diagnostic entries are capped at 100; change-log entries are capped at 1,000 and their fields are length-bounded. This reduces accidental or hostile import payloads that could freeze rendering or consume excessive storage.
- Local reset now clears the project store and active-project pointer in one IndexedDB read-write transaction.
- Both Vite development and preview servers bind to `127.0.0.1` and send local security headers (`nosniff`, frame denial, strict referrer policy, and a restrictive Permissions Policy).
- Unit suite at this review point: 30/30 passed. Global TypeScript check (`tsc --noEmit`, TypeScript 5.8.3) passed.
- Static source scan found no `eval`, `new Function`, `innerHTML`, `outerHTML`, `dangerouslySetInnerHTML`, `document.write`, `fetch`, `XMLHttpRequest`, `postMessage`, or `window.open` usage in application source/configuration.

These checks are source-level safeguards, not proof against all denial-of-service or browser vulnerabilities. Exact dependency pinning, lockfile generation, dependency vulnerability scanning, production build, and browser E2E remain outstanding because npm registry DNS resolution fails in this environment (`EAI_AGAIN`).

## Startup data-loss hardening (2026-11-07)

- Identified a startup race: the editor was rendered while IndexedDB hydration and integrity validation were still pending. A user could begin typing into the initial in-memory project, then have those edits replaced when the stored project finished loading.
- The application now renders a loading state until the stored project has been read and validated. If loading or validation fails, it renders a blocking error state with a retry action; the editor and autosave remain unavailable. This prevents edits from being silently overwritten during startup and preserves the prior fail-closed behavior for damaged data.
- Validation after this change: 30/30 unit tests passed; global TypeScript 5.8.3 `tsc --noEmit` passed.
- Browser-level verification of the loading/error states remains pending because Vite/Playwright dependencies are not installed in this environment.

## Multi-tab write coordination (2026-11-07)

- Added a browser Web Locks single-writer lock. The first tab obtains the exclusive project lock; another tab receives a blocking read-only message and cannot load the editor or run autosave. The lock is released when the owning app unmounts or the tab closes.
- The app fails closed if Web Locks is unavailable or the lock request fails; it does not silently allow concurrent editing.
- Added unit tests for the lock-busy and lock-held/release behavior. These test the lock adapter with a mock LockManager; real cross-tab behavior still requires browser E2E verification.
- Vite dev and preview responses now add `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a strict referrer policy, and a restrictive Permissions Policy. A deployed static host must configure equivalent HTTP headers itself.
- Current validation: 32/32 unit tests pass; global TypeScript `tsc --noEmit` passes.

## Remaining multi-tab verification

- The Web Locks coordination is implemented fail-closed, but real two-tab contention, lock release on tab close, and reload behavior have not been exercised in a browser because the browser test dependencies are not installed. Treat the unit tests as adapter tests, not end-to-end proof.

## Import object-graph hardening (2026-11-07)

- The shared project validator now walks imported and locally loaded object graphs iteratively before schema checks. It rejects prototype-sensitive keys (`__proto__`, `prototype`, `constructor`), nesting deeper than 64 levels, and object graphs exceeding 100,000 visited values.
- The walk is iterative to avoid recursive stack exhaustion on deeply nested attacker-controlled JSON. The existing 5 MiB file limit, 5,000-record cap, field-size limits, and reference validation remain in force.
- Added regression tests for prototype-sensitive keys at multiple depths and deeply nested payloads.
- Validation in this pass: 34/34 unit tests passed; global TypeScript 5.8.3 `tsc --noEmit` passed.
- A fresh npm registry check still fails with `EAI_AGAIN` resolving `registry.npmjs.org`. No dependencies were installed, no lockfile was generated, and no `npm audit`, production build, or browser E2E run could be completed.

This reduces the import parser's attack surface; it is not a substitute for dependency scanning, browser testing, or a penetration test.


## IndexedDB active-pointer integrity — 2026-11-07

- Found a recovery edge case: when the IndexedDB `active` setting existed but its referenced project record was missing, `load()` returned `null`. The UI could then treat the workspace as a fresh project and autosave a new empty project, concealing the broken pointer state.
- `load()` now fails closed when the active pointer is malformed, references a missing record, or does not match the stored record's `id`. The editor remains unavailable because hydration does not complete; autosave cannot run.
- Added four focused unit tests for valid, dangling, malformed, and mismatched pointer/record combinations.
- Current validation: 38/38 unit tests passed; global TypeScript 5.8.3 `tsc --noEmit` passed.
- This is a pure validation-layer test. IndexedDB corruption/recovery still needs browser-level tests with real IndexedDB. Dependency pinning, lockfile, `npm audit`, production build, CSP validation, and Playwright remain release blockers.


## Orphaned IndexedDB projects and unload warning — 2026-11-07

- A second recovery edge case was found during source review: when the active-project pointer was absent but project records remained in IndexedDB, `load()` treated the workspace as a fresh install. It now counts stored projects and fails closed if orphaned records exist; only a genuinely empty project store is treated as first launch.
- Added tests for empty first launch, orphaned records, and invalid project counts.
- Source review also found that an earlier checklist note claimed a `beforeunload` warning, but no handler was actually present in the current application source. Added the handler: navigation warns while a debounced save is pending or the latest save failed. Successful/idle states do not trigger the warning. Browser confirmation behavior remains to be verified in E2E.
- Current validation: 44/44 unit tests passed; global TypeScript check passed. This is still not a browser test.

## Active-project replacement transaction — 2026-11-07

- A source-level re-audit found that the save transaction wrote a newly imported project's ID as active but did not remove the previously active project's record when the imported project had a different ID. This left stale project records in IndexedDB after REPLACE and contradicted the single-active-project behavior described in the product.
- `save()` now reads the previous active ID and, when it differs from the incoming snapshot ID, deletes only that previous active record before writing the new snapshot and active pointer in the same read-write transaction. Unrelated/orphaned records are not silently deleted.
- Added regression tests for same-ID saves, project replacement, and malformed/missing prior pointers.
- Validation in this pass: 47/47 unit tests passed; global TypeScript 5.8.3 `tsc --noEmit` passed. A fresh npm registry probe still fails with `EAI_AGAIN`; no dependencies, lockfile, npm audit, production bundle, or browser E2E could be run.
- The new tests cover the decision logic for identifying the prior active record. The actual IndexedDB transaction still requires browser-level verification.


## Save-status race and IndexedDB browser smoke test — 2026-11-07

- Found a UI/data-safety race in the debounced autosave flow: an earlier save promise could resolve after a newer edit had started saving and overwrite the visible status with “Сохранено локально”. Because the unload guard reads that status, this could suppress the warning while a newer save was still pending.
- Added monotonically increasing save revisions. Only the latest save operation may update the visible save status; cleanup invalidates the prior revision. Removed an unobserved parallel save during migration; the normal hydrated autosave now persists the migrated project and reports failures through the same guarded path.
- Added three regression unit tests for current, stale, and invalid save revisions.
- Added `tests/browser/indexeddb-atomicity.html`, a real-browser IndexedDB smoke test covering successful replacement and rollback after an aborted transaction. Attempted to run it in Chromium via Playwright, but the environment blocked navigation to the local test server with `net::ERR_BLOCKED_BY_ADMINISTRATOR`; therefore the browser transaction test is prepared but NOT passed.
- Validation in this pass: 50/50 unit tests passed; global TypeScript `tsc --noEmit` passed. Production build, dependency audit, and full app E2E remain blocked because npm dependencies are not installed and loopback browser navigation is restricted in this environment.


## IndexedDB browser smoke-test harness correction — 2026-11-07

- Re-reviewed the standalone IndexedDB transaction smoke test before relying on it. Found that it attached `transaction.oncomplete` handlers after awaiting the final request promises; a fast browser could dispatch `complete` before those handlers were registered, leaving the test itself hanging.
- Updated the harness to attach completion/abort/error listeners immediately after each transaction is created, before issuing or awaiting requests. This is a test-harness correction, not evidence that the app's IndexedDB flow passed in a browser.
- Re-ran the complete Node unit suite: 50/50 passed. Global TypeScript 5.8.3 `tsc --noEmit` passed.
- Attempted to execute the standalone HTML test in installed Chromium using a local `file://` URL; the headless process timed out without returning a test result. Therefore the browser test remains NOT PASSED.
- npm registry remains unavailable: `npm view vite version --fetch-retries=0 --fetch-timeout=5000` returned `EAI_AGAIN` for `registry.npmjs.org`. No lockfile, dependency audit, or production build was produced.

The browser test is now less likely to hang due to missed transaction events, but real IndexedDB behavior, app E2E, and production CSP remain unverified.


## Management-report severity correction — 2026-11-07

- Source review found inconsistent severity mapping for open gaps: the previous implementation promoted any high-risk/high-priority gap to `critical` and did not recognise the UI risk value `Критический` because it checked a different grammatical form.
- The report now maps `Критический` risk or `Критическая` priority to critical, `Высокий` risk or `Высокая` priority to high, and all other values to medium. When multiple open gaps are linked to one process, the most severe explicit level is used.
- Added a regression test covering high risk, critical risk, and critical priority.
- Validation: 65/65 unit tests passed; global `tsc --noEmit` passed. Browser rendering and production bundle remain unverified.


## CI verification update — 2026-11-08

The earlier entries above describe the state of the initial source-only review on 2026-11-07. They are historical and are superseded for build/test/dependency-scan status by the following verification:

- A committed `package-lock.json` is present (lockfileVersion 3); direct dependencies are exact-version pinned in `package.json` and the lockfile.
- GitHub Actions run [42518950149](https://github.com/ritarakunova-hub/taina-knowledge-map/actions/runs/42518950149) on commit `14bca0beb63b4477ae0b7d80b1545920331691e0` completed successfully on 2026-11-08.
- The run completed `npm ci`, `npm audit --audit-level=high`, the unit test suite, Playwright browser tests, and the production build. The audit step exited successfully, meaning no dependency advisory at high or critical severity was reported by that run. This is not a claim that the dependency tree has zero advisories at every severity.
- The PR validation workflow has read-only `contents: read` permissions. The deploy workflow has the Pages permissions required for deployment. Third-party Actions are currently referenced by version tags (for example, `@v4` and `@v5`), not immutable commit SHAs; pinning Actions to verified full SHAs remains a supply-chain hardening task.
- The PR remains open and in Draft. Its code has not been merged or deployed by this PR. The successful run validates the PR branch, not the production website.

## Remaining security limitations

- This is still a source review plus automated CI checks, not a penetration test, independent security assessment, or certification.
- The dependency audit was run with `--audit-level=high`; lower-severity findings, license suitability, malicious-package behavior, and transitive package provenance require separate review.
- GitHub Pages static hosting does not inherit the local Vite preview's HTTP response headers. The production HTML includes a CSP meta policy, but deployment-level headers such as `X-Content-Type-Options`, `X-Frame-Options` / `frame-ancestors`, and `Permissions-Policy` have not been independently verified on the live response.
- Real IndexedDB crash/rollback behavior and multi-tab contention have unit coverage and a browser smoke-test harness, but the standalone atomicity harness is not part of the passing Playwright suite yet.
- No authentication, authorization, encryption at rest, server-side audit log, or team-sharing model exists in V1. Continue to use synthetic or anonymized information only.

**Updated assessment:** the PR branch now passes dependency installation, high/critical dependency audit threshold, unit tests, browser E2E tests, and production build. It is suitable for controlled review and a non-sensitive pilot after merge/deployment checks; it is not approved for confidential corporate data.
