# TAINA Knowledge Map V1 — release checklist

## Confirmed in the preparation environment
- [x] TypeScript static check: `tsc --noEmit`
- [x] Unit tests: `node --experimental-strip-types --test tests/*.test.mjs` — 65/65 passed (локальная проверка 2026-11-07; включая CSP и ранжирование рисков)
- [x] XLSX export structure: valid OpenXML archive with 9 worksheets
- [x] ZIP archive integrity

## Latest branch CI evidence — 2026-11-09
- [x] Exact dependency versions and `package-lock.json` are committed; CI installed from the lockfile with `npm ci`.
- [x] Dependency audit completed successfully (`npm audit --audit-level=high`).
- [x] Unit tests completed successfully.
- [x] Playwright browser tests completed successfully.
- [x] Production TypeScript/Vite build completed successfully.

Verified on PR head `575ee25ebfe49d142af03e7730c256cd60e6ae8d` by GitHub Actions run [42527485978](https://github.com/ritarakunova-hub/taina-knowledge-map/actions/runs/42527485978), job `validate` (all steps successful). This supersedes the earlier preparation-environment blockers below for this branch head. It does **not** replace the manual real-browser acceptance checks that remain unchecked.

## Must be completed before public sale
- [ ] Pin dependency versions, generate and commit a lockfile, then run dependency vulnerability scanning (`npm audit` or equivalent).
- [ ] Install dependencies in a network-enabled environment: `npm install` (ошибка DNS `EAI_AGAIN` при обращении к `registry.npmjs.org`; `node_modules` не создан)
- [ ] Production build: `npm run build` attempted; blocked because Vite is not installed (`vite: not found`)
- [ ] Playwright E2E: `npm test`
- [ ] Verify production CSP and security headers in a built browser deployment.
- [ ] Manually verify first-run onboarding and IndexedDB persistence after reload
- [ ] Manually verify JSON export, import/replace, and merge on a backup copy
- [ ] Verify automatic JSON backup download before opening the demo and before replacing a project (Playwright test added, not yet executed)
- [ ] Verify XLSX opens in Microsoft Excel and LibreOffice
- [ ] Verify 390px mobile layout and desktop layout in a real browser
- [ ] Review all demo content and ensure it is clearly marked as fictional
- [ ] Proofread all Russian interface copy and the buyer guide

## Security review (2026-11-07)
- [x] Dev server bound to 127.0.0.1 instead of all network interfaces.
- [x] Production CSP and strict referrer policy configured in Vite build HTML transform (browser verification still pending).
- [x] JSON import capped at 5 MiB and validated before applying.
- [x] Merging imported evidence invalidates the prior VERIFY sign-off.
- [x] Security review document added.
- [ ] Dependency pinning, lockfile, and vulnerability scan.
- [ ] Production/browser verification of CSP and security headers.

## Product limitations to disclose
- Local browser storage only; no account, cloud sync, or team collaboration.
- User must export JSON backups regularly. Clearing browser/site data can remove local data.
- Do not store sensitive, personal, medical, client, financial, or confidential data.
- AI prompts are copyable text; no AI model is connected inside the app.
- Automated quality checks are advisory and do not certify the truth or completeness of company knowledge.

Do not describe the product as production-ready until every mandatory item above has been checked.
- [x] VERIFY requires a classified gap, valid process link, recognised status, and a valid owner for high/critical priority.
- [x] Prevent autosave from writing a fresh empty project before IndexedDB hydration completes; on load failure, do not overwrite stored data.
- [x] Validate the raw IndexedDB record before migration/defaulting, so missing V2 collections cannot be silently normalized into empty arrays.
- [x] Offer a JSON backup before manual project reset.
- [x] Delay CSV object-URL revocation to avoid interrupting browser downloads.

- [x] Добавлено руководство первого запуска: подготовка, 60–90 минут, 7-дневный маршрут, ограничения и резервное копирование.

- [x] Dashboard VERIFY warning now clears when the reviewer confirms that no gaps were found.
- [x] Legacy projects default to unconfirmed VERIFY during migration.

- [x] CSV export neutralizes spreadsheet formula injection markers; covered by unit test.
- [x] STRUCTURE rejects placeholder process steps and undefined outputs; dashboard flags these cases.

- [x] VERIFY requires explicit human confirmation and at least one fully described source linked to a valid process and owner.
- [x] Dashboard quality panel flags sources without a type; source completeness count now includes type, owner, location, and process link.
- [x] Any change to reviewed sources, processes, documents, gaps, or owners invalidates the previous VERIFY sign-off; unrelated task edits do not.

- [x] Added regression coverage: V2 backups with missing collections are rejected; supported V1 backups can still be migrated.

## Security and data integrity follow-up — 2026-11-07
- [x] Block editing until IndexedDB hydration and integrity validation finish.
- [x] Fail closed with a visible error and retry action when local data cannot be loaded safely.
- [x] Add cross-tab write coordination with an exclusive Web Locks writer lock; real-browser verification remains pending.
- [ ] Verify startup loading/error behavior in Playwright after dependencies are installed.


### Межвкладочная защита
- [x] Добавлена эксклюзивная Web Locks-блокировка для единственной вкладки с правом записи.
- [x] При занятой блокировке или отсутствии поддержки Web Locks интерфейс закрывает доступ к редактору (fail closed).
- [ ] Проверить реальное поведение двух вкладок в Playwright после установки зависимостей.

## Security hardening — 7 Nov 2026

- [x] Reject prototype-sensitive keys in imported/local project object graphs.
- [x] Bound object graph traversal to 64 levels and 100,000 visited values.
- [x] Keep 5 MiB import limit and project row/field limits.
- [x] Add regression tests for nested prototype keys and excessive nesting.
- [ ] Pin exact dependency versions and generate a lockfile in a network-enabled environment.
- [ ] Run dependency vulnerability audit.
- [ ] Run production build and Playwright browser tests.
- [ ] Verify CSP and multi-tab writer lock in real browsers.


## Active-record integrity — 7 Nov 2026

- [x] An active IndexedDB pointer that references a missing record now fails closed instead of being treated as a new empty workspace.
- [x] A malformed active pointer or a mismatch between the pointer ID and the stored record ID blocks loading and autosave.
- [x] Added four unit tests for valid, missing, malformed, and mismatched active records.
- [ ] Exercise dangling-pointer and mismatch recovery in a real IndexedDB browser test.

- [x] Missing active pointer with orphaned project records fails closed.
- [x] Warn before leaving while a save is pending or the latest save failed (source + unit tests; browser confirmation still pending).
- [ ] Verify recovery and beforeunload behavior in real browser E2E.

## Active project replacement integrity — 7 Nov 2026
- [x] Saving a replacement project removes the previous active record in the same IndexedDB transaction as writing the replacement and active pointer.
- [x] Same-ID saves do not delete the active record.
- [x] Missing or malformed previous pointers do not select a project record for deletion.
- [ ] Verify REPLACE in a real browser with IndexedDB inspection and forced transaction failure/reload.
- [x] Prevent stale autosave promise completions from marking a newer pending save as complete.
- [x] Add native IndexedDB browser smoke-test for successful replacement and rollback after transaction abort.
- [ ] Execute the IndexedDB browser smoke-test in an environment where browser loopback navigation is permitted (blocked here with `ERR_BLOCKED_BY_ADMINISTRATOR`).


## IndexedDB browser-test harness review — 7 Nov 2026
- [x] Corrected transaction event-listener timing in `tests/browser/indexeddb-atomicity.html`: completion/abort listeners are attached immediately after transaction creation.
- [x] Re-ran unit tests: 50/50 passed; global TypeScript check passed.
- [ ] Execute the corrected IndexedDB smoke test in a browser; Chromium headless timed out in this environment without a result.
- [ ] Complete dependency pinning, lockfile, npm audit, production build, CSP validation, and full browser E2E.


## Новая функция: семишаговый маршрут пользователя
- [x] Добавлен раздел «Путь за 7 дней» с динамическим прогрессом.
- [x] Прогресс определяется по заполненным данным, а не по прошедшим календарным дням.
- [x] Добавлены тесты критериев прохождения шагов.
- [ ] Проверить маршрут в реальном браузере на desktop и mobile после установки зависимостей.


## Управленческий отчёт — рекомендации директору
- [x] Формировать до трёх следующих действий только из реально выявленных сигналов.
- [x] Сортировать сначала по тяжести сигнала, затем по явно заданной руководителем критичности процесса.
- [x] Не показывать рекомендации для пустой карты и не дублировать одинаковое действие в рамках одного процесса.
- [x] Показывать основание и рекомендуемое действие для каждой рекомендации.
- [x] Документировать, что сортировка не является финансовым рейтингом или оценкой вероятности.
- [x] Добавить регрессионные тесты для ранжирования и пустого отчёта.
- [ ] Проверить блок рекомендаций в реальном браузере на учебном кейсе «Северный сервис».

Последняя проверка исходников: `node --experimental-strip-types --test tests/*.test.mjs` — 64/64 passed; `tsc --noEmit` — exit 0. В сценарии восстановления JSON исправлена обработка нативных диалогов: prompt и confirm теперь принимаются раздельно по типу. Playwright E2E не выполнялись: зависимости проекта отсутствуют в этой среде.


## End-to-end acceptance path — 7 Nov 2026

- [x] Confirm unit coverage for JSON parsing, schema validation, backup size limit, migration, merge ID remapping, and integrity constraints.
- [x] Add Playwright scenario: download JSON backup, make an edit, import backup with REPLACE, and confirm original company data is restored.
- [x] Handle the import prompt and replacement confirmation by dialog type in the E2E scenario (avoids two one-shot handlers consuming the same first dialog).
- [x] Add Playwright scenario: an empty map produces no invented management recommendations.
- [ ] Execute the new Playwright scenarios in a browser-enabled environment.
- [ ] Execute full user path: onboarding → linked owner/process/source → quality review → management report → task creation → JSON backup → reload → JSON restore.
- [ ] Verify backup replacement and merge in real browser, including confirmation dialogs and autosave completion.
- [ ] Verify persistence after browser restart and data recovery from downloaded JSON.

## Дополнительная проверка исходников — 7 Nov 2026

- [x] Повторный запуск unit tests: 63/63 passed.
- [x] Повторная проверка TypeScript: `tsc --noEmit` — exit 0.
- [x] Статический поиск опасных DOM/eval-паттернов (`dangerouslySetInnerHTML`, `eval`, `new Function`, `innerHTML`, `document.write`) — совпадений в `src/` и `index.html` не найдено.
- [x] Добавлен Playwright-сценарий полного первого цикла: onboarding → владелец → процесс → источник → качество карты → управленческий отчёт → задача → reload → JSON backup.
- [ ] Новый и остальные Playwright-сценарии не запускались: `@playwright/test` и Vite не установлены.
- [ ] Сценарий полного цикла требует выполнения в реальном браузере; до этого его селекторы и пользовательский поток считаются непроверенными.

## Reproducible build gate — 7 Nov 2026

- [ ] Replace floating `latest` dependency declarations in `package.json` with exact resolved versions.
- [ ] Generate and commit `package-lock.json` after exact versions have been written to the manifest.
- [x] Update `scripts/verify-release.ps1`: it now resolves the current registry tags with `npm install --save-exact package@latest`, checks that every direct dependency is an exact `x.y.z` version, then runs `npm ci` against the generated lockfile. (Script reviewed, not executed here.)
- [ ] Install from the lockfile with `npm ci` in a clean environment.
- [ ] Run `npm run build`, `npm run test:unit`, and `npm test` after the clean install.
- [ ] Record Node/npm versions and dependency audit output with the release candidate.

**Why this is a release blocker:** `package.json` currently declares every direct dependency as `latest`, and the project has no lockfile. That means a future install can resolve a different toolchain without any source-code change. The verification script now performs the pinning step on a network-enabled machine; it has not been run here because access to `registry.npmjs.org` failed with `EAI_AGAIN`. Do not guess package versions or create a fabricated lockfile. The 63 passing unit tests and TypeScript check validate the source under the currently available global TypeScript, not a reproducible clean install or Vite production bundle.

## Single-writer multi-tab acceptance scenario — 7 Nov 2026

- [x] Add Playwright scenario that opens two tabs in one browser context and expects the second tab to remain read-only while the first tab owns the Web Locks writer lock.
- [ ] Execute the scenario in Chromium and at least one additional supported browser.
- [ ] Verify that closing the first tab releases the lock and a reload in the second tab enables editing.
- [ ] Verify behavior when Web Locks is unavailable (the app must remain read-only).

The scenario is authored but not executed in this environment because the Playwright package and browser runner are not installed. Do not treat the presence of the test as proof of multi-tab behavior.

- [x] Add a Windows PowerShell release-verification script to create a lockfile from the registry, perform a clean install, install Chromium, run npm audit, build, unit tests, and Playwright E2E in sequence.
- [ ] Run `powershell -ExecutionPolicy Bypass -File .\\scripts\\verify-release.ps1` on a network-enabled Windows or CI environment and retain the resulting `package-lock.json` and logs.


## Дополнительная проверка CSP — 7 ноября 2026

- [x] Найдено несоответствие: production CSP задаёт `style-src 'self'`, но экран маршрута использовал inline React `style` для ширины прогресс-бара.
- [x] Оба места использования прогресс-индикатора переведены на семантический `<progress>` с оформлением в CSS; ослаблять CSP не пришлось.
- [x] Добавлен `tests/csp.test.mjs`: проверяет, что production CSP не разрешает `unsafe-inline`, JSX не использует inline style, а индикатор прогресса остаётся в DOM/CSS.
- [ ] Production CSP всё ещё нужно проверить в собранном браузере: meta CSP и политика целевого хостинга могут взаимодействовать.
- [x] После исправления: unit tests 64/64 passed; TypeScript — exit 0.


## Дополнительный UX/data portability audit — 7 Nov 2026

- [x] Обнаружено, что README называл `localhost:5173`, хотя Vite server/preview bind настроен на `127.0.0.1`; это разные browser origins и, следовательно, разные IndexedDB-хранилища.
- [x] README исправлен: пользователь должен открывать точный адрес, напечатанный Vite, и не переключаться между `localhost` и `127.0.0.1`. Добавлено предупреждение, что production-домен также имеет отдельное хранилище; перенос — через JSON backup.
- [ ] Проверить текст запуска и перенос backup на реальном браузере/production-домене.

Последняя локальная проверка исходников в этой сессии: `node --experimental-strip-types --test tests/*.test.mjs` — 64/64 passed. Production build и браузерные E2E не выполнялись.


## Исправление ранжирования рисков в управленческом отчёте — 7 Nov 2026

- [x] Разделены уровни `Высокий` и `Критический` для сигнала открытых проблем; высокий риск не повышается до критического автоматически.
- [x] Исправлено распознавание значения `Критический` из поля «Риск» (в UI используется мужской род), а также `Критическая` из поля «Приоритет».
- [x] Добавлен регрессионный тест на высокий риск, критический риск и критический приоритет.
- [x] Повторная проверка: 65/65 unit tests passed; `tsc --noEmit` — exit 0.
- [ ] Проверить визуальное ранжирование отчёта в реальном браузере на учебном кейсе.

Последний локальный прогон: `node --experimental-strip-types --test tests/*.test.mjs` — 65/65 passed; `tsc --noEmit` — exit 0. Production build и Playwright E2E по-прежнему не запускались.


## Подготовка запуска релизной проверки на Windows — 7 Nov 2026

- [x] Добавлено требование Node.js `>=22.6.0` в `package.json` и README (нужно для встроенного Node type stripping в unit tests).
- [x] `scripts/verify-release.ps1` проверяет версию Node.js до установки зависимостей.
- [x] Скрипт сохраняет полный терминальный вывод в `release-verification.log` и показывает путь к логу при ошибке.
- [ ] Сам скрипт не выполнялся в этой среде; финальная проверка должна пройти на компьютере/CI с доступом к npm registry.
