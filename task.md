# PCB audit and implementation backlog

## Current implementation — 2026-10-18

Baseline remains **master**, commit **d26480cfabc1794f13a65ace77be0ede78d27c13**, plus preserved pre-existing changes. The user authorized source/test/local configuration fixes after the read-only audit. **E01 and B31–B33 are now resolved and verified.** Existing controller/route/model/field names, all 33 PRD registrations, dependencies, PRD.md and the staged README deletion were preserved.

**Final suites: 57 unit/mocked passed, 6 integration passed, zero failed/skipped.** Integration is one guarded parent fixture plus five lifecycle subtests. All **44 JavaScript files** and the PowerShell script parsed. Actual .env validation, disconnected app import and normal entrypoint startup through the explicit local launcher passed. The API startup check was stopped; local MongoDB 8.0.34 remains **rs0 PRIMARY**.

**64 checkpoints: 60 PASS, 4 PARTIAL, 0 FAIL, 0 UNVERIFIED.** Endpoint subset: **32 PASS, 1 PARTIAL**. Remaining PARTIAL checkpoints R02/R44/R58/R63 concern broader authentication/security and real delivery verification, not an absent endpoint. No completion percentage or production-readiness claim is made.

PASS means implementation plus relevant available verification supports the stated contract. PARTIAL means an incomplete requirement or outstanding security/deployment verification. FAIL means absent/fundamentally broken. UNVERIFIED means evidence is insufficient. Passing mocked SMTP proves notification generation/acceptance handling, not real inbox delivery; HTTP cookie/CORS tests do not prove browser behavior.

Evidence: **A** tests/auth.test.js; **P** tests/project.test.js; **C** tests/contracts.test.js; **S** tests/mongodb-safety.test.js; **I** tests/integration.test.js and tests/helpers/integration-lifecycle.js. C checks all 33 registrations; A/P use real HTTP, JWT/bcrypt and Mongoose behavior with mocked collections; I uses real local MongoDB, indexes, transactions and disk with mocked SMTP.

## Backend-ready gate

**No confirmed source-code blocker from E01/B31–B33 remains. Core API/persistence checks support beginning controlled local frontend integration. Full browser sign-off remains open.**

- [x] **E01:** actual .env passes unchanged validateEnvironment; independent crypto.randomBytes(48) secrets replace the reused secrets; local URLs match the user-selected client. Unrelated values and both MongoDB URI values preserved.
- [x] **B31/B32/B33:** protocol/mail defects fixed with executed regressions; see resolution record below.
- [x] **T02/T03 core gate:** real register/verify/login, existing/new invitations, roles, two projects, tasks/subtasks/notes, uploads/cascades/rollback, refresh/logout/reset/change/expiry/replay passed with owned-resource cleanup.
- [x] **P10 decisions and HTTP contracts:** user selected http://localhost:5173, /reset-password/:token and /invitations/:projectId/:token. Credentialed CORS/preflight, cookie attributes/precedence and denied Origin checks passed at HTTP level.
- [x] **Local startup:** npm.cmd run dev:local uses separate pcb_development via a process-only MONGO_URI override and executes src/index.js. Configuration/topology/index initialization, health and error probes passed. .env MONGO_URI remains untouched.
- [ ] **P10/T06 browser sign-off:** implement the selected client pages and verify actual browser login, credentials, refresh coordination, logout and link handoff. Keep localhost on both client/API for the local cookie flow. Acceptance: browser tests pass without CORS/cookie workarounds; pre-login/missing-Origin CSRF and HTTPS/proxy policy are reviewed before deployment.
- [ ] **T02/P12 live mail:** verify configured sender/TLS/inbox and delivery failure handling only with explicit external-send authorization. Acceptance: real verification/reset/invitation links reach intended inboxes without secrets in logs.
- [ ] **Production gates:** P01/P02/P08/P09 and D04–D06 below remain. These do not require adding unrelated APIs before local frontend work.

Next concrete step: start the local API with `npm.cmd run dev:local` and implement/test the selected frontend authentication and invitation/reset pages using [docs/frontend-integration.md](docs/frontend-integration.md). No frontend files or browser harness were created in this task. Ordinary npm start/dev still use the original application URI; use the explicit local launcher here.

## B31–B33 / E01 resolution record

Original findings remain recorded for continuity; this section supersedes their audit-only open status.

- [x] **B31 — confirmed bug, medium / P1, resolved.** Unsupported charset/content encoding and malformed compression previously returned sanitized 500. src/app.js now recognizes actual parser types, tracks parser provenance with a WeakSet, and maps gzip/deflate errors and Brotli format errors to 400. Unsupported charset/encoding is 415, malformed JSON 400, limits 413, internal faults still sanitized 500. CORS precedes parsing so approved clients can read errors. A exercised malformed JSON; unsupported charset/encoding; invalid/truncated gzip, deflate and Brotli; plain/compressed oversized bodies; and valid compressed bodies reaching an injected internal error with a misleading zlib code that still returns 500. No broad status-code passthrough was added.
- [x] **B32 — confirmed bug, low / P2, resolved.** Case-sensitive string replacement rejected bearer/BEARER. verifyJWT now parses the complete scheme plus SP-separated token case-insensitively, rejecting missing credentials, wrong schemes, embedded whitespace and comma-separated tokens. Cookie precedence is unchanged. A passed casing/malformed/invalid/expiry and valid-cookie-versus-invalid-header/invalid-cookie-versus-valid-header cases. JWT verification, algorithms and token-version rules remain intact.
- [x] **B33 — confirmed bug, medium / P1, resolved.** Exact comparison rejected accepted IDN SMTP envelopes. recipientIdentity in mail.utils.js compares IDNA ASCII lowercase domains and semantically equivalent local-part quoting, preserving local-part case and stored account-email policy. A uses installed MailComposer normalization for ordinary, Unicode-domain, Unicode-local-part and quoted addresses through register/resend/forgot flows; equivalent domain acceptance, wrong mailbox/case, empty/invalid recipients and transport failure checks pass. I also exercises IDN invitations and registration against real DB. Genuine rejection remains 502; no real mail was sent.
- [x] **E01 — environment limitation, high / P0, resolved.** Actual SERVER_URL/FORGOT_PASSWORD_REDIRECT_URL and equal signing secrets previously failed validation. .env now contains independently generated strong secrets, a local SERVER_URL matching PORT, and approved client URLs/CORS. PROJECT_INVITATION_REDIRECT_URL was added for the chosen landing route. Actual validation and local startup passed without weakening the validator. MONGO_URI and MONGODB_TEST_URI values were preserved; a named local launcher avoids the non-local URI.

## PRD compliance — all 33 endpoints

All paths below start with /api/v1. Actual preserved spellings appear here; Express case-insensitive routing satisfies the PRD's lowercase forgot-password path, and the verification parameter's spelling does not change URL matching. Project creation follows the existing user-approved interpretation: a verified user creates a project and receives its Admin membership.

| ID | Done | Required/actual route | Status | Current evidence or limitation |
| --- | --- | --- | --- | --- |
| R01 | [x] | POST /api/v1/auth/register | PASS | A/I real registration, hashing/verification; normalized SMTP mocked; B33 closed |
| R02 | [ ] | POST /api/v1/auth/login | PARTIAL | A/I login/expiry/revocation passes; P08 operational abuse/verification remains |
| R03 | [x] | POST /api/v1/auth/logout | PASS | A revocation/replay/cookie checks |
| R04 | [x] | GET /api/v1/auth/current-user | PASS | A/I safe projection, cookie/header auth; B32 casing regressions pass |
| R05 | [x] | POST /api/v1/auth/change-password | PASS | A hash, old-password, revocation |
| R06 | [x] | POST /api/v1/auth/refresh-token | PASS | A body/cookie/replay; I concurrent rotation |
| R07 | [x] | GET /api/v1/auth/verify-email/:verficationToken | PASS | A/I verification/resend/expiry/replay |
| R08 | [x] | POST /api/v1/auth/forgot-Password | PASS | A/I reset initiation and IDN acceptance; actual inbox delivery remains T02 |
| R09 | [x] | POST /api/v1/auth/reset-password/:resetToken | PASS | A/I real reset/expiry/reuse rejection and session revocation |
| R10 | [x] | POST /api/v1/auth/resend-email-verification | PASS | A/I resend after expiry, already-verified denial; B33 closed |
| R11 | [x] | GET /api/v1/projects | PASS | P zero/one/multiple; I real member-count aggregation |
| R12 | [x] | POST /api/v1/projects | PASS | P rollback; I real project + creator membership |
| R13 | [x] | GET /api/v1/projects/:projectId | PASS | P parent/access/read |
| R14 | [x] | PUT /api/v1/projects/:projectId | PASS | P role, typed partial update |
| R15 | [x] | DELETE /api/v1/projects/:projectId | PASS | P rollback/cascade/files; I child/create race |
| R16 | [x] | GET /api/v1/projects/:projectId/members | PASS | P all roles, safe profiles, legacy alias |
| R17 | [x] | POST /api/v1/projects/:projectId/members | PASS | P/I existing/new IDN invitations, pending/acceptance/rotation/expiry; B33 closed |
| R18 | [x] | PUT /api/v1/projects/:projectId/members/:userId | PASS | P role/enum/last-Admin/concurrent demotion |
| R19 | [x] | DELETE /api/v1/projects/:projectId/members/:userId | PASS | P assignment cleanup/rollback; I last-Admin denial |
| R20 | [x] | GET /api/v1/tasks/:projectId | PASS | P roles/population/status 200 |
| R21 | [x] | POST /api/v1/tasks/:projectId | PASS | P validation/uploads; I real creation/assignee |
| R22 | [x] | GET /api/v1/tasks/:projectId/t/:taskId | PASS | P scoped aggregation, population and missing child |
| R23 | [x] | PUT /api/v1/tasks/:projectId/t/:taskId | PASS | P CRUD/status/null assignment/upload caps |
| R24 | [x] | DELETE /api/v1/tasks/:projectId/t/:taskId | PASS | P cascade/files/rollback; I Member denial |
| R25 | [x] | POST /api/v1/tasks/:projectId/t/:taskId/subtasks | PASS | P parent/role checks; I creation |
| R26 | [x] | PUT /api/v1/tasks/:projectId/st/:subTaskId | PASS | P all roles/parent/boolean; I Member completion |
| R27 | [x] | DELETE /api/v1/tasks/:projectId/st/:subTaskId | PASS | P missing/foreign parent and privileged deletion |
| R28 | [x] | GET /api/v1/notes/:projectId | PASS | P role/parent/list/population |
| R29 | [x] | POST /api/v1/notes/:projectId | PASS | P role, trimmed bounded content |
| R30 | [x] | GET /api/v1/notes/:projectId/n/:noteId | PASS | P parent substitution/missing/read |
| R31 | [x] | PUT /api/v1/notes/:projectId/n/:noteId | PASS | P scoped update/validation/roles |
| R32 | [x] | DELETE /api/v1/notes/:projectId/n/:noteId | PASS | P scoped delete/roles/missing |
| R33 | [x] | GET /api/v1/healthcheck | PASS | A mounted liveness HTTP |

## Other PRD checkpoints

| ID | Done | Requirement | Status | Current evidence or limitation |
| --- | --- | --- | --- | --- |
| R34 | [x] | Role enum | PASS | admin, project_admin, member preserved; P role matrix |
| R35 | [x] | Task status enum | PASS | todo, in_progress, done; P complete status cycle |
| R36 | [x] | Multiple attachments | PASS | P/I multiple files, append/cap, persisted metadata and actual disk cleanup |
| R37 | [x] | public/images storage | PASS | P real upload/download and cleanup; directory preserved |
| R38 | [x] | Attachment URL/MIME/size | PASS | P/I persisted url/mimeTypes/size plus exact downloaded bytes |
| R39 | [x] | Secure Multer handling | PASS | P MIME/signature/size/count/authorization; P09 operational limits |
| R40 | [x] | CORS | PASS | A/P allowed/denied origins and static-file headers; P10 browser gap |
| R41 | [x] | Input validation/errors | PASS | A/P/I typed/ID/enum checks; B31 parser/CORS/status regressions pass |
| R42 | [x] | JWT access/refresh authentication | PASS | A/I rotation/version/expiry/replay; B32 complete scheme parsing fixed |
| R43 | [x] | Email verification gate | PASS | A/P unverified accounts denied project resources |
| R44 | [ ] | Secure password reset | PARTIAL | A/I reset/change revocation passes; P08 timing/enumeration and live delivery open |
| R45 | [x] | Role middleware | PASS | P every resource family and transaction-time membership recheck |
| R46 | [x] | Assign only project members | PASS | P missing/foreign assignee rejection/removal; I valid assignment |
| R47 | [x] | Project member counts | PASS | P zero/multiple fixtures; I real aggregation |
| R48 | [x] | Email invitations | PASS | P/I existing/new recipients, IDN SMTP normalization, single-use acceptance |
| R49 | [x] | Project-creation policy | PASS | User-approved verified-user creation grants project Admin; P/I |
| R50 | [x] | Admin project mutation | PASS | P denies lower roles; I create/delete behavior |
| R51 | [x] | Admin member management | PASS | P role checks and last-Admin invariant; I denial |
| R52 | [x] | Privileged task mutation | PASS | P both privileged roles; I Member deletion denial |
| R53 | [x] | All project roles read tasks | PASS | P three-role lists/details and outsiders |
| R54 | [x] | All roles update subtask completion | PASS | P boolean-only Member edits; I completion |
| R55 | [x] | Privileged subtask create/delete | PASS | P both privileged roles; I create |
| R56 | [x] | Admin note mutations | PASS | P both lower roles denied |
| R57 | [x] | All project roles read notes | PASS | P list/detail, outsider and foreign-resource denial |
| R58 | [ ] | Secure auth/authorization outcome | PARTIAL | Core A/P/I and local startup pass; P08/P10 deployment/browser security remains |
| R59 | [x] | Complete project lifecycle | PASS | I full onboarding/collaboration/notes/uploads and real failure rollback; wider recovery P01 |
| R60 | [x] | Task/subtask hierarchy | PASS | P CRUD/relationships/cascades; I parent/child creation and deletion |
| R61 | [x] | RBAC implementation | PASS | P complete role policy; I selected restrictions |
| R62 | [x] | File attachment workflow | PASS | P/I real DB plus disk metadata/download/append/delete/cascade rollback |
| R63 | [ ] | Verification/reset notifications | PARTIAL | A/I notifications and normalized/rejected recipients pass; real SMTP/inbox unverified |
| R64 | [x] | API documentation through endpoint structure | PASS | history.md route table plus docs/frontend-integration.md setup/contracts; README deletion preserved |

## Revalidation of previous B-series findings

B01–B30 describe historical fixes, not new source changes in this task. Their existing regressions passed again in the final 57-test suite; the expanded real fixture adds persistence evidence. Original IDs and findings are retained; B31–B33 were fixed in the current authorized implementation.

| ID | Current disposition / evidence |
| --- | --- |
| B01 | [x] Invalid pipeline import absent; app-only import and C passed. |
| B02 | [x] main/start reference existing src/index.js; source parses. E01 is now resolved; actual local startup passed. |
| B03 | [x] validate calls errors.isEmpty(); A/P malformed inputs reject before writes. |
| B04 | [x] Both member-list aliases require membership; P outsider/role checks pass. |
| B05 | [x] Password-change validator factory is invoked; A successful/rejected requests complete. |
| B06 | [x] Singular project join/projection is consistent; P and I member-count aggregation pass. |
| B07 | [x] Verification links target mounted /api/v1/auth path; A checks generated links. |
| B08 | [x] SMTP rejection becomes 502 and registration explains persistence/retry; A/P. B33's separate false-failure case is now fixed. |
| B09 | [x] Login accepts email/password without username; A/I. |
| B10 | [x] refreshToken and retained refrershToken alias agree; A. |
| B11 | [x] Logout/password reset/change clear refresh state and increment tokenVersion; A. |
| B12 | [x] Auth public projections omit reset/verification/session internals; A. |
| B13 | [x] dotenv/config precedes app evaluation in index.js; A/P CORS tests pass with test configuration. |
| B14 | [x] Resource ID validators and BSON/Cast mapping exist; A/P malformed IDs return 400. |
| B15 | [x] Central JSON error serialization exists and sanitizes faults; A/P. B31 parser cases now pass. |
| B16 | [x] Member role validators and transactional invitation acceptance enforce enums; A/P. Old membership upsert behavior was replaced by authorized invitations. |
| B17 | [x] Task controller uses User's default export; import and P pass. |
| B18 | [x] References use registered lowercase user; P real Mongoose population with mocked collections passes. |
| B19 | [x] URLs use actual UUID filenames; P downloads exact stored bytes. |
| B20 | [x] Metadata preserves attachements/mimeTypes/size; P. |
| B21 | [x] Task detail filters task plus project; all child APIs check parent relationships; P cross-project denial. |
| B22 | [x] Assignment requires same-project membership and existing user; P invalid cases, I valid assignment. |
| B23 | [x] Shared typed six-character/72-byte new-password validation, no trimming; A. |
| B24 | [x] Missing/non-string refresh input yields 401; A. |
| B25 | [x] Original registration/reset/task-read status mismatches are corrected; A/P/I. B31 is now resolved. |
| B26 | [x] Current handoff documents reconcile implementation and measured claims. README deletion is preserved; the current entrypoint is docs/frontend-integration.md. Remaining historical-document cleanup is D07. |
| B27 | [x] Plural member collection routes and retained singular aliases are mounted; C/P. |
| B28 | [x] Empty accepted-recipient lists fail, instead of reporting success; A. B33 normalization now passes. |
| B29 | [x] Auth/member/task/note projections hide private avatar paths and user internals; A/P. |
| B30 | [x] Typed bounded project fields, partial-update validation and runValidators exist; P. |

## Potential risks and settled product decisions

No additional exploit is claimed from these observations. Completed work is identified explicitly; remaining acceptance criteria are future work.

| ID | State / classification | Remaining acceptance criteria |
| --- | --- | --- |
| P01 | [ ] Potential integrity/operations risk. Real transaction rollback, cascade failure/retry, duplicate membership/invitation/refresh races and project-delete/create race pass. | Exercise transient-error retries, uncertain commits, sustained contention and failover; prove no orphan records or incorrect file deletion under recovery. |
| P02 | [ ] Deployment limitation. Membership unique index is declared and I produces exactly one duplicate-key loser. | Inspect authorized target deployment for duplicates and actual indexes before rollout; plan any cleanup explicitly. Do not infer production data from pcb_test. |
| P03 | [x] Last-Admin policy and assignment clearing implemented; P concurrent demotion/removal and I sole-Admin denial pass. | Covered policy retained; wider contention belongs to P01. |
| P04 | [x] Invitation policy settled; I verifies existing/new recipients, expiry/rotation/single consumption and exact email binding. | Client route selected; actual browser handoff remains P10. |
| P05 | [x] Roles are per-project; verified users can create projects and become Admin. | Preserve this explicit decision; no global Admin override. |
| P06 | [x] Account actions remain available before email verification; project/task/subtask/note access requires verification. | A/P gate checks pass. |
| P07 | [x] Original read/replace refresh and token-consumption races were repaired; A/I replay/version, real auth lifecycle and refresh race pass. | Actual SMTP remains T02; broader contention/recovery remains P01. |
| P08 | [ ] Potential security risk. Bounded per-process IP/account limiter exists; normal forgot response is uniform, but SMTP failure/timing and registration can distinguish accounts. Proxy trust/shared enforcement are unverified. | Decide enumeration policy, test timing/failure paths and shared/proxy rate limits, including expensive password/token operations. |
| P09 | [ ] Potential storage risk. P/I now verify real DB + disk signatures/metadata/download/cascades/rollback and owned-file cleanup. | Verify persistent/shared storage, crash-orphan/uncertain-commit reconciliation, failed-unlink recovery and bounded queue progress without deleting referenced/legacy files. |
| P10 | [ ] Browser/deployment verification. Local origin and landing routes chosen; real HTTP preflight/cookie/CORS/denied-Origin behavior passes. | Actual browser credential/refresh/link flow, pre-login/missing-Origin CSRF policy and HTTPS/proxy behavior must pass before browser/deployment sign-off. |
| P11 | [ ] Optional scaling/product work. Lists/cascades are unpaginated; project names globally unique and account-email matching case-sensitive. | Measure workloads/query plans; change pagination, uniqueness or case policy only through an explicit compatible API/data decision. |
| P12 | [ ] Environment/deployment limitation. E01/local entrypoint/index startup now pass; health remains liveness only. | Verify actual SMTP sender/TLS/inbox with send authorization; deployment listen/shutdown/recovery and operational monitoring remain. |

## PRD feature groups and remaining tests/deployment

| ID | State | Evidence / acceptance criteria |
| --- | --- | --- |
| M01 | [x] Task API present | Five routes; P CRUD/roles/parents/status/assignment and I selected writes. |
| M02 | [x] Subtask API present | Three routes; P all-role completion versus privileged title/create/delete, I completion. |
| M03 | [x] Notes API present | Five routes; P/I full scoped CRUD/roles/population and persistence. |
| M04 | [x] Attachments present | P multiple files/metadata/retrieval/append/delete; no new removal endpoint invented. Operations remain P09/T03. |
| M05 | [x] Validation/error completion | B31/B32 parser/scheme regressions pass without weakening sanitization or authentication; browser portion remains T06. |
| M06 | [x] Core collaboration policy settled | Preserve P04/P05/P06 decisions. |
| T01 | [x] Focused historical bug regressions | A/P/C/S passed; do not equate mocks to live isolation. |
| T02 | [ ] Real auth/mail lifecycle: DB portion complete | I passed register/verify/resend/login/refresh/logout/reset/change/expiry/replay. Remaining: explicitly authorized real SMTP sender/TLS/inbox verification; no mock acceptance claim substitutes for delivery. |
| T03 | [ ] Real collaboration lifecycle: core gate complete | I passed existing/new invitations, all roles, two-project denials, task/subtask/note CRUD, real DB + disk uploads/cleanup and injected cascade rollback. Remaining: broader transient/uncertain-commit/failover recovery and queue persistence scenarios in P01/P09. |
| T04 | [x] Role and parent regressions | C registers all 33; P verifies applicable roles, outsiders, unverified users, parent substitution and removed members. |
| T05 | [x] Mocked and real persistence + file workflows | P/I cover metadata, downloads, append, task/project deletion, rollback retaining referenced files and owned-file cleanup. Production crash/storage recovery remains P09. |
| T06 | [ ] HTTP error contracts complete; browser checks open | B31/B32 regressions pass. Complete actual browser/HTTPS/proxy checks in P10 without CORS or cookie workarounds. |
| D01 | [x] Entry/import repair present | Actual configuration/import and normal src/index.js startup through the verified local launcher pass; no non-local application URI contacted. |
| D02 | [x] Runtime documented | Tested Node 24.14.0/npm 11.9.0; installed dependency minimum Node 20.19.0, no install/update. |
| D03 | [x] Actual local configuration ready | validateEnvironment on the edited .env passes; secrets generated independently, selected client URLs set, original DB URIs preserved and local startup verified. Production configuration remains separate. |
| D04 | [ ] Deployment DB verification | Local 8.0.34 rs0 PRIMARY and fixture indexes/transactions pass; authorized deployment duplicate/index checks, backups/restore and failover remain. |
| D05 | [ ] Operational readiness | Local app startup/index initialization/health and stopped listener verified. Target deployment listen failures, graceful deadlines, proxy/HTTPS, persistent file permissions and cleanup-worker recovery remain. |
| D06 | [ ] Supply-chain/CI review | With authorization, run dependency advisory/license review and add CI gates for syntax, mocks and guarded integration. Existing lock integrity is not a vulnerability scan. |
| D07 | [ ] Documentation discoverability | docs/frontend-integration.md is the current API/setup entrypoint; history/task and implementation-decisions MongoDB status updated. Preserve staged README deletion; decide future root entrypoint and reconcile remaining historical requiredThings.md claims. |
| O01 | [ ] Optional improvements | Measure need for pagination, readiness/metrics, structured logs and root placeholder cleanup; no unsolicited API expansion. |

## Local MongoDB and test readiness

Existing Community **8.0.34**, PID **12456** at verification, single-member **rs0 PRIMARY**, config version 1, only **127.0.0.1:27018**. No download/install/reset/reconfiguration or MongoDB start/stop was needed. Paths and narrow ignore rules remain as documented in history.md and docs/windows-mongodb.md.

Integration reads only guarded MONGODB_TEST_URI, refuses existing application collections, verifies actual local topology/paths before writes/index creation, then drops only its owned collections. No whole-database deletion. Multer filename capture identifies exactly the fixture's temporary files; finally cleanup never sweeps unrelated uploads. After each executed fixture, pcb_test had zero collections, public/images only gitkeep, and no integration lock remained.

Interactive startup now has a separate **pcb_development** database. It did not exist before this task. The local launcher initialized eight application collections/indexes; record counts remained zero. These persistent development collections were retained. Automated fixture writes never used this DB. Original .env MONGO_URI (non-local) and MONGODB_TEST_URI values are unchanged; no Atlas connection occurred.

## Commands and actual outcomes

| Command / invocation | Final result and limitation |
| --- | --- |
| `npm.cmd test` | **57 passed / 0 failed / 0 skipped**, 2 suites, about 5.72 s. Includes every prior passing regression and all 33 route contracts. |
| `npm.cmd run test:integration` | **6 passed / 0 failed / 0 skipped**, about 4.20 s: one parent fixture + five lifecycle subtests. Passed twice, including rerun after final source changes. |
| `$files = @(rg --files src tests scripts -g '*.js'); foreach ($file in $files) { node --check $file }` | **44 files passed**, including all 34 application files. |
| PowerShell Parser.ParseFile on scripts/mongodb.ps1 | Passed. Existing script unchanged. |
| `node scripts/dev-local.js --check` | Actual local configuration and project rs0 PRIMARY passed; no app startup or model writes in --check. |
| `npm.cmd run dev:local` | Normal src/index.js startup, local DB/index initialization and HTTP listen passed. Health 200, unauthenticated current-user 401, malformed JSON 400 and credentialed local CORS verified. Ctrl+C stopped the API; npm's interrupted batch wrapper exited 1, with no startup error. Listener removal confirmed. |
| `validateEnvironment(dotenv.parse(fs.readFileSync(".env")))` in Node module stdin | Passed; no values printed. Validator unchanged. |
| App import after loading actual .env into that process; assert mongoose.connection.readyState === 0 | Passed; no listener/DB connection from import. |
| `node scripts/mongodb-admin.js status` | Existing local version/paths/PID/PRIMARY verified. |
| Read-only local collection/file/lock inspection | pcb_test zero collections; pcb_development eight collections with zero records; public/images only gitkeep; no test lock. |
| `git diff --check`; `git diff --cached --check` | Passed on final edits. No lint/build scripts; no dependencies installed, upgraded or removed. |

Initial sandbox attempts to run each suite failed worker creation with EPERM. Approved reruns executed the actual tests; final counts above are their results. No application-test failure was hidden or counted as a pass. The intentional cascade fault is an asserted 500 with real rollback, not an unhandled test failure.

No production/Atlas connection or real SMTP occurred. All integration emails used in-memory capture and installed MailComposer envelope normalization. Full browser, live SMTP, production topology/data/index review, backups/restore, failover and crash/shared-storage behavior remain unverified.

## Current task changes and preservation

Changed by this implementation: ignored **.env**; **src/app.js**, **src/middlewares/auth.middleware.js**, **src/utils/mail.utils.js**; **tests/auth.test.js**, **tests/integration.test.js**; **package.json** (added dev:local only); **docs/windows-mongodb.md**, **docs/implementation-decisions.md**, **history.md**, **task.md**.

Created: **scripts/dev-local.js**, **tests/helpers/integration-lifecycle.js**, **docs/frontend-integration.md**. No dependencies, controllers, routes, models, schema fields or API names were changed. Existing MongoDB scripts/install/configuration and the pre-existing test URI guard were preserved. Original .env values outside the six explicitly changed/added local keys were checked unchanged; .env stays ignored and generated secrets are absent from tracked/source/documentation files.

Pre-existing changes retained: unstaged .gitignore/history.md/package.json/task.md/tests/integration.test.js; staged README.md deletion; untracked docs/windows-mongodb.md, scripts/mongodb.ps1, scripts/mongodb-admin.js, scripts/lib/mongodb-test.js, tests/mongodb-safety.test.js. Nothing staged, committed, reset, cleaned or discarded. Final hashes against the implementation's 63-file baseline confirmed exactly 11 intended modified files and three additions, with no removals. PRD.md/package-lock.json and MongoDB runtime control files remain unchanged.

Future work must preserve this history, nomenclature and user-selected local URLs. Use the guarded pcb_test fixture for automated DB changes, the explicit dev:local launcher for development, and never fall back to Atlas. Broader production and external-email tasks require the applicable authorization; actual browser sign-off is the next integration milestone.
