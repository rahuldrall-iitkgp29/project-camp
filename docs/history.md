# PCB project history and Codex handoff

## Current implementation — 2026-10-18

The user authorized fixing the blockers from the preceding read-only audit. **E01 and B31–B33 are resolved and verified.** Core APIs and real persistence now support controlled local frontend integration; actual browser sign-off and production gates remain open. Baseline: **master**, commit **d26480cfabc1794f13a65ace77be0ede78d27c13**, plus preserved pre-existing changes.

**Final results: 57 unit/mocked passed; 6 integration passed; zero failures/skips.** Integration is one guarded parent fixture plus five lifecycle subtests. All **44 JavaScript files** (34 application + tests/scripts) and the existing PowerShell script parse. Actual .env validation, disconnected app import and normal src/index.js startup via the new explicit local launcher passed.

Local MongoDB remains Community **8.0.34**, **rs0 PRIMARY**, only **127.0.0.1:27018**, PID **12456** at verification. Tests still use **pcb_test** exclusively. The new **pcb_development** database is separate; the local launcher overrides MONGO_URI only in its process. The original non-local .env MONGO_URI and MONGODB_TEST_URI values are preserved. No Atlas or real SMTP connection was made.

Current PRD register: **60 PASS / 4 PARTIAL / 0 FAIL / 0 UNVERIFIED** across 64 checkpoints; endpoint subset **32 PASS / 1 PARTIAL**, all 33 mounted. Remaining PARTIAL checkpoints concern operational authentication/security and real delivery, not absent handlers. These counts are not a completion percentage or production certification.

The user selected **http://localhost:5173**, **/reset-password/:token**, and **/invitations/:projectId/:token** for local frontend integration. Read [docs/frontend-integration.md](docs/frontend-integration.md) for startup, cookies/tokens, links, errors and upload contracts. README.md remains absent/staged deleted; it was not restored. Existing product decisions and all controller/route/model/field names remain unchanged.

### Changes and rationale

- **E01:** generated two independent 48-byte cryptographic secrets locally; changed only the authorized secret/URL/CORS keys and added PROJECT_INVITATION_REDIRECT_URL. SERVER_URL matches the existing PORT. The validator is unchanged and passes; unrelated environment values and both database URI values were checked unchanged. No secret values belong in documentation/output/Git.
- **B31:** app.js records parser-origin errors and maps installed body-parser/zlib client failures narrowly: malformed JSON/compression 400, unsupported charset/encoding 415, limits 413. Unexpected internal errors remain sanitized 500 even when carrying a zlib-like code. Brotli format errors are distinguished from allocation/internal errors. CORS now precedes parsing so the approved frontend can read these errors.
- **B32:** verifyJWT parses a complete case-insensitive Bearer scheme/token boundary. Missing/wrong schemes, tabs/embedded whitespace and comma-separated tokens reject. Nonempty access-cookie precedence, JWT algorithm/expiry/version checks and refresh protections are preserved.
- **B33:** mail acceptance uses canonical IDNA domain identity plus equivalent local-part quoting, retaining local-part case and stored email policy. Tests use installed MailComposer's actual envelope normalization, including Unicode and quoted addresses; wrong mailbox/case, empty accepted lists and SMTP exceptions still yield 502.
- **Integration:** extended the existing guarded fixture rather than adding a framework. Five named real lifecycle subtests cover onboarding, invitations, all roles, resources/files, rollback and session recovery. Multer filename capture identifies fixture-owned files for precise cleanup.
- **Local startup:** scripts/dev-local.js validates local configuration and the existing project replica set before importing the normal entrypoint. Its explicit process-only database override avoids the retained non-local URI. --check performs only configuration/topology verification.

No dependency was added/upgraded, no PRD change, no production migration/deployment and no MongoDB download/reset/reconfiguration occurred.

## Project and important modules

PCB is a project collaboration REST backend: accounts, project memberships and roles, tasks/subtasks, notes and public task attachments. Package name remains `project-mangement`, ES modules, version 1.0.0. Tested runtime: Node **24.14.0**, npm **11.9.0**. Installed stack includes Express **5.2.1**, Mongoose **9.7.3** (MongoDB driver **7.2.0**), bcrypt, jsonwebtoken, express-validator, Multer, Nodemailer/Mailgen, cookie-parser, CORS and dotenv. Installed dependency metadata requires Node at least **20.19.0**. Dependencies and lockfile were not changed.

| Location                                          | Responsibility                                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| src/index.js                                      | Loads dotenv before app evaluation, validates configuration, connects DB/initializes indexes, starts HTTP and attachment cleanup worker, handles shutdown.                                       |
| src/app.js                                        | Importable Express app; parsers, cookies, Origin/CORS checks, static downloads, five route mounts, 404 and JSON error handling. Import itself opens no DB connection/listener.                   |
| src/db/database.js                                | Application connection through MONGO_URI; requires replica set or sharded topology and successful model index initialization before serving.                                                     |
| src/controllers/auth.controler.js                 | Ten account handlers, public projections, token/session lifecycle and notification flow.                                                                                                         |
| src/controllers/project.controlers.js             | Project/member CRUD, invitations, acceptance, member counts, last-Admin and removal rules.                                                                                                       |
| src/controllers/task.controler.js                 | Five task and three subtask handlers, scoped relationships and attachment operations.                                                                                                            |
| src/controllers/note.controler.js; healthCheck.js | Five project-note handlers; liveness handler.                                                                                                                                                    |
| src/routes/                                       | auth.route.js, project.route.js, task.route.js, note.route.js, healthCheck_route.js; actual methods/gates listed below.                                                                          |
| src/models/                                       | Eight Mongoose models described below. User is registered as lowercase user; references preserve that name.                                                                                      |
| src/middlewares/                                  | auth.middleware.js, validtor.middleware.js, rateLimit.middleware.js, multer.middleware.js.                                                                                                       |
| src/validators/index.validatorts.js               | Typed body, token and resource-ID validators; partial-update allowlists.                                                                                                                         |
| src/utils/                                        | apiError.js, apiResponse.js, asyncHandler.js, constants.js, env.utils.js, mail.utils.js, project.utils.js, attachment.utils.js.                                                                  |
| tests/                                            | auth.test.js, project.test.js, contracts.test.js, mongodb-safety.test.js, integration.test.js; helpers/database.js mocks persistence; helpers/integration-lifecycle.js extends the real fixture. |
| scripts/                                          | mongodb.ps1 lifecycle; mongodb-admin.js and lib/mongodb-test.js administration/isolation guard; dev-local.js explicit development launcher.                                                      |
| public/images/                                    | Real public uploads; only gitkeep remained after test cleanup.                                                                                                                                   |
| tools/mongodb/; .local/                           | Ignored local binaries, data, logs and runtime controls; no system service/PATH installation.                                                                                                    |
| docs/                                             | frontend-integration.md is the client/setup entrypoint; windows-mongodb.md documents the server; implementation-decisions.md preserves approved policies and updated DB status.                  |

README.md was deliberately preserved as staged deleted. requiredThings.md still contains historical status that must not override measured results here; further discoverability/historical cleanup is D07.

## Actual API contracts

All table paths are relative to **/api/v1**. Success bodies use **{ statuscode, data, message, success }**, preserving lowercase `statuscode` and the `ApiRespones` class. The last column gives HTTP success status and input → **data** shape. Empty-body operations may omit a request body. JSON IDs/dates serialize as strings; raw resource documents may include timestamps and `__v`.

**JWT** means a valid current access token; email verification is not required for account actions. **Verified JWT** also requires verified email. Every project/task/subtask/note route uses verified JWT; **Any project role** means membership in that specific project. **Admin / Project Admin** means either per-project role; Member cannot mutate tasks. All 33 route registrations are checked by tests/contracts.test.js, with HTTP behavior in the auth/project suites and selected real-persistence cases in integration.test.js.

| ID  | Method and path                             | Controller              | Access                                  | Success / request → data                                                  |
| --- | ------------------------------------------- | ----------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| R01 | POST /auth/register                         | registerUser            | Public                                  | 201: email, username, password → { user }                                 |
| R02 | POST /auth/login                            | login                   | Public                                  | 200: email, password → user, accessToken, refreshToken                    |
| R03 | POST /auth/logout                           | logoutUser              | JWT                                     | 200: no body → {} and cleared cookies                                     |
| R04 | GET /auth/current-user                      | getCurrentUser          | JWT                                     | 200: → public user                                                        |
| R05 | POST /auth/change-password                  | changeCurrentPassword   | JWT                                     | 200: oldPassword, newPassword → {}                                        |
| R06 | POST /auth/refresh-token                    | refreshAccessToken      | Refresh cookie/body                     | 200: refreshToken → accessToken, refreshToken, refrershToken              |
| R07 | GET /auth/verify-email/:verficationToken    | verifyEmail             | Public token                            | 200: → isEmailVerified                                                    |
| R08 | POST /auth/forgot-Password                  | forgotPasswordRequest   | Public                                  | 200: email → {}                                                           |
| R09 | POST /auth/reset-password/:resetToken       | resetForgotPassword     | Public token                            | 200: newPassword → {}                                                     |
| R10 | POST /auth/resend-email-verification        | resendEmailVerification | JWT                                     | 200: no body → {}                                                         |
| R11 | GET /projects                               | getProjects             | Verified JWT                            | 200: → [{ project, role }]                                                |
| R12 | POST /projects                              | createProject           | Verified JWT                            | 201: name, optional description → Project                                 |
| R13 | GET /projects/:projectId                    | getProjectById          | Any project role                        | 200: → Project                                                            |
| R14 | PUT /projects/:projectId                    | updateProject           | Admin                                   | 200: name and/or description → Project                                    |
| R15 | DELETE /projects/:projectId                 | deleteProject           | Admin                                   | 200: → deleted Project                                                    |
| R16 | GET /projects/:projectId/members            | getsProjectMembers      | Any project role                        | 200: → [{ project, user, role, createdAt, updatedAt }]                    |
| R17 | POST /projects/:projectId/members           | addMemberToProject      | Admin                                   | 201: email, role → { invitation: pending details }                        |
| R18 | PUT /projects/:projectId/members/:userId    | updateMemberRole        | Admin                                   | 200: newRole → ProjectMember                                              |
| R19 | DELETE /projects/:projectId/members/:userId | deleteMember            | Admin                                   | 200: → deleted ProjectMember                                              |
| R20 | GET /tasks/:projectId                       | getTasks                | Any project role                        | 200: → Task[] with public assignedTo                                      |
| R21 | POST /tasks/:projectId                      | createTask              | Admin / Project Admin                   | 201: title; optional description, assignedTo, status, attachements → Task |
| R22 | GET /tasks/:projectId/t/:taskId             | getTaskById             | Any project role                        | 200: → Task with public assignee and subtasks/creators                    |
| R23 | PUT /tasks/:projectId/t/:taskId             | updateTask              | Admin / Project Admin                   | 200: partial task fields or appended uploads → Task                       |
| R24 | DELETE /tasks/:projectId/t/:taskId          | deleteTask              | Admin / Project Admin                   | 200: → deleted Task                                                       |
| R25 | POST /tasks/:projectId/t/:taskId/subtasks   | createSubTask           | Admin / Project Admin                   | 201: title → Subtask                                                      |
| R26 | PUT /tasks/:projectId/st/:subTaskId         | UpdateSubTask           | Any role: completion; privileged: title | 200: title and/or boolean isCompleted → Subtask                           |
| R27 | DELETE /tasks/:projectId/st/:subTaskId      | deleteSubTask           | Admin / Project Admin                   | 200: → deleted Subtask                                                    |
| R28 | GET /notes/:projectId                       | getNotes                | Any project role                        | 200: → ProjectNote[] with public createdBy                                |
| R29 | POST /notes/:projectId                      | createNote              | Admin                                   | 201: content → ProjectNote                                                |
| R30 | GET /notes/:projectId/n/:noteId             | getNoteById             | Any project role                        | 200: → ProjectNote with public createdBy                                  |
| R31 | PUT /notes/:projectId/n/:noteId             | updateNote              | Admin                                   | 200: content → ProjectNote                                                |
| R32 | DELETE /notes/:projectId/n/:noteId          | deleteNote              | Admin                                   | 200: → deleted ProjectNote                                                |
| R33 | GET /healthcheck                            | healthCheck             | Public                                  | 200: → { message }                                                        |

Auth handlers live in auth.controler.js; project/member handlers in project.controlers.js; task/subtask handlers in task.controler.js; note handlers in note.controler.js; healthCheck in healthCheck.js.

Additional registered contracts:

- **POST /api/v1/projects/:projectId/invitations/:invitationToken/accept** → `acceptProjectInvitation`: verified JWT, matching recipient email and unexpired invitation token; existing membership is not required. Returns 200 with ProjectMember.
- **GET and POST /api/v1/projects/:projectId/member** retain the singular legacy aliases with the same permissions/behavior as plural /members.
- **GET /** returns the existing text placeholder. It is not a PRD endpoint.
- Preserve `forgot-Password`, `verficationToken`, `UpdateSubTask`, `attachements`, `mimeTypes` and `refrershToken`. Express default case-insensitive routing accommodates the PRD's lowercase forgot-password spelling.

Important schemas and validation:

- Registration takes email, username and password. Username is trimmed, lowercase, 3–20 characters; emails are trimmed and validated, with exact stored-email matching retained. New passwords are strings of at least six characters and at most 72 UTF-8 bytes; they are **not trimmed**. Login/old password accept existing nonempty strings within the byte limit.
- Public account data omits password, refresh/session version, reset/verification internals, `__v` and avatar.localPath. Related populated user profiles also omit private fields; no password/token values belong in API documentation.
- Project name/title limits are 200 characters; descriptions and note content at most 10,000. Required text is trimmed/nonempty; optional descriptions may be empty. Project updates require name and/or description and reject unknown fields.
- Task create requires title; optional description, assignedTo and status. Task update is partial and can consist only of appended uploads. **JSON null assignedTo clears assignment**; an assigned user must exist and belong to the same project. Do not send a serialized attachment metadata array: uploads use multipart field **attachements**.
- Task statuses: **todo, in_progress, done**. Roles: **admin, project_admin, member**. Member may update only boolean isCompleted on subtasks; privileged roles may also edit title. Notes accept only content. Unsupported update fields/empty updates reject.
- Resource IDs must be 24 hexadecimal characters. Token endpoints reject malformed/expired/replayed tokens. Missing authenticated membership commonly yields 403 before resource lookup; authorized missing resources return 404. Cross-project child IDs cannot be substituted.

Errors use **{ statusCode, data: null, success: false, message, errors }**, preserving the different `statusCode` casing. Validation is 422; malformed IDs/JSON/URLs 400; missing/invalid sessions 401; permission/verification denial 403; missing resources 404; duplicate/invariant conflicts 409; upload/body limits 413; unsupported file content 415; mail failures 502; unsupported/uncertain transactions 503. Unexpected faults are sanitized 500 without stacks/credentials. B31 is resolved: known charset/encoding/decompression errors now receive appropriate 4xx with CORS; internal faults remain sanitized.

## Models, integrity and business rules

| Model / file                                    | Relationships and important constraints                                                                                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| user / user.models.js                           | Unique trimmed email and unique lowercase username; bcrypt password; avatar, optional fullName, verification state, one saved refresh token, tokenVersion and hashed temporary tokens/expiry. |
| Project / project.models.js                     | Unique project name globally, description and required createdBy → user. Project.__v is also touched to serialize project mutations.                                                          |
| ProjectMember / projectmember.models.js         | Required project → Project, user → user and role enum; unique (project,user), plus user/project lookup index.                                                                                 |
| ProjectInvitation / projectInvitation.models.js | Project, exact email, role, invitedBy, hidden tokenHash and expiresAt; unique (project,email), TTL on expiry. Token expiry is checked explicitly, independently of TTL timing.                |
| Task / task.models.js                           | Required project, title; optional assignedTo/assignedBy → user; status, attachements array of url/mimeTypes/size; project/assignee index.                                                     |
| Subtask / subtask.models.js                     | Required task → Task and createdBy → user; title, boolean isCompleted; task index.                                                                                                            |
| ProjectNote / note.models.js                    | Required project and createdBy → user, content; project index.                                                                                                                                |
| FileDeletion / fileDeletion.models.js           | Unique filename and timestamps; durable jobs for committed attachment deletion.                                                                                                               |

Previously approved policies remain in force: verified users may create a project and receive its Admin membership; roles are per project with no global override. Account actions remain available before email verification; collaboration resources require verification. Both new and existing users must accept emailed invitations. Attachments are deliberately public under the PRD. The detailed role matrix permits Member subtask completion, not general task mutation; no extra Member task-edit permission is inferred from less precise PRD prose.

Project creation writes the project and creator membership in one transaction. Existing-project writes use `withProjectWrite`: increment the parent project's version, then recheck membership/role inside the transaction. This prevents several deletion/assignment write-skew cases. Child queries constrain project/task/note relationships; task detail aggregation scopes both task and project. User references use the actual lowercase registered model. Member counts aggregate the singular project relationship.

A project must retain at least one Admin. Member removal clears that user's task assignments in the same transaction; historical authorship remains. Project deletion cascades tasks/subtasks/notes/members/invitations and queues attachment removal. Task deletion also removes its subtasks and queues files. Driver transactions retry supported transient failures; sessions end in finally blocks. An uncertain commit retains uploaded files and returns 503 so clients check state before retrying. Wider failure/retry and crash-orphan reconciliation are still P01/P09/T03.

## Authentication, invitations and browser behavior

Registration hashes the password and stores hashed verification state before SMTP. Mail failure leaves the account and returns an explicit 502 directing login/resend. Verification/reset temporary tokens contain 20 random bytes, are stored as SHA-256 hashes, expire after 20 minutes and are conditionally consumed once. Resend rotates the verification token; already verified accounts reject.

Login accepts email/password without username, compares bcrypt and returns public user plus access/refresh tokens, also setting cookies. JWTs use HS256 and configurable expiries. Access verification loads the user and checks tokenVersion. Refresh checks its signature, stored token and version, then uses a conditional compare-and-replace update; refresh JWT IDs prevent same-second duplicate rotation. One saved refresh token per user means later logins replace the refresh session; previously issued access tokens remain usable until expiry or version revocation. Logout/password change/reset clear refresh state and increment tokenVersion, invalidating earlier access tokens. Password change also guards the old password/version against races. Missing legacy tokenVersion is treated as zero until revocation.

Refresh accepts the refresh cookie first, otherwise body.refreshToken. Access authentication prefers access cookie, otherwise Authorization. Refresh responses preserve both refreshToken and historical refrershToken aliases. Missing/non-string refresh input returns 401. B32 is resolved: Bearer scheme casing is accepted, while malformed scheme/token boundaries reject. Cookie precedence is unchanged.

Forgot-password normally returns the same 200 message for known/unknown emails, but SMTP failures/timing and registration behavior can reveal account existence; P08 is a policy/security risk requiring verification. The auth router has a bounded, per-process IP/account rate limiter with 429 and Retry-After. It is not distributed gateway enforcement.

Invitations expire after seven days, are stored hashed, bound to project and exact email, and consumed transactionally when a verified recipient accepts. Re-inviting rotates the pending token; sending failure leaves a pending invitation for retry. Existing members use role-update rather than invitation to change permissions. If configured, PROJECT_INVITATION_REDIRECT_URL receives appended project/token path segments; otherwise mail points to the authenticated **POST** acceptance API. Opening a link does not itself submit that POST; a client must handle login/verification/acceptance.

Verification links use the configured server origin and mounted API path; reset links append the token to FORGOT_PASSWORD_REDIRECT_URL. Mail uses SMTP timeouts, TLS-on-connect for port 465, MAIL_FROM override and acceptance checks. **B33 is resolved:** acceptance now compares normalized recipient identities consistently with SMTP envelopes, including internationalized domains and optional local-part quoting. Actual stored email matching remains unchanged. All delivery tests used in-memory transports; no real SMTP delivery was attempted.

Cookies are HttpOnly, SameSite=Lax and Secure in production mode. Cookie-authenticated writes carrying an unapproved Origin return 403. CORS uses configured origins, credentials and allowed headers. CORS headers do not themselves block arbitrary clients. Real browser, missing-Origin/pre-login cases, cross-site deployment, HTTPS and reverse-proxy behavior remain P10; no blanket CSRF-safety claim is made.

## Attachments and filesystem behavior

Multer runs after authentication/permission checks and stores project-relative public/images files using UUID filenames. Accepted MIME/signature pairs: PNG, JPEG, GIF, WebP and PDF. Limits: five files per task (including prior attachments), each **1,000,000 bytes**; multipart text/part limits also apply. The controller validates signatures and builds actual stored-file URLs from SERVER_URL. Metadata preserves **attachements: [{ url, mimeTypes, size }]**. Task updates append uploads; there is no PRD requirement for a separate individual-file-removal API.

Public downloads force attachment disposition, nosniff and sandbox CSP; URLs provide no confidentiality. Signature checks are not malware scanning or full format validation. Failed requests clean temporary uploads; failed unlink attempts can queue jobs. Committed deletions are retried by a worker, processing at most 100 jobs per pass, running on startup and once per minute. Process crashes before DB persistence, uncertain commit outcomes, stale/legacy names and shared/persistent-storage behavior still need reconciliation/recovery verification.

## Environment names and startup

The table lists names only; actual secrets are never reproduced. Non-secret local frontend URLs above were explicitly selected by the user.

| Names                                                                                     | Purpose                                                                                                   |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| MONGO_URI                                                                                 | Application database only. Production/Atlas configuration remains separate from integration testing.      |
| MONGODB_TEST_URI                                                                          | Dedicated isolated local pcb_test fixture/status connection; no fallback to application/legacy variables. |
| PORT, NODE_ENV, CORS_ORIGIN                                                               | HTTP listening, production cookie/configuration behavior, approved browser origins.                       |
| ACCESS_TOKEN_SECRET, ACCESS_TOKEN_EXPIRY                                                  | Access signing and duration.                                                                              |
| REFRESH_TOKEN_SECRET, REFRESH_TOKEN_EXPIRY                                                | Distinct refresh signing and duration.                                                                    |
| SERVER_URL                                                                                | Public API/attachment origin and verification links; invitation fallback.                                 |
| FORGOT_PASSWORD_REDIRECT_URL, PROJECT_INVITATION_REDIRECT_URL                             | Reset and optional invitation client landing URLs.                                                        |
| MAILTRAP_SMTP_HOST, MAILTRAP_SMTP_PORT, MAILTRAP_SMTP_USER, MAILTRAP_SMTP_PASS, MAIL_FROM | SMTP connection/authentication and optional sender.                                                       |

`validateEnvironment` checks required strings, HTTP URL form, Mongo URI scheme, ports, duration syntax and differing JWT secrets; production adds a minimum secret length. This is configuration validation, not a connectivity or entropy audit.

**E01 is resolved.** The audit originally found invalid SERVER_URL/FORGOT_PASSWORD_REDIRECT_URL and equal access/refresh secrets. Independently generated secrets and approved local URL/CORS settings now pass the unchanged validator. A local PROJECT_INVITATION_REDIRECT_URL was added. Scripts preserve .env encoding/newlines where practical and verified unrelated values unchanged; .env stays ignored.

The existing application URI is non-local and was not contacted. For this workflow use `npm.cmd run dev:local`: it validates the actual environment, verifies the project-local replica set, selects separate pcb_development only in its process, then imports src/index.js. Ordinary npm start/dev retain their original MONGO_URI behavior; no global environment was changed. The chosen local API URL matches PORT; the selected frontend is localhost:5173.

On valid startup, connectDB uses MONGO_URI, checks transactional topology and initializes model indexes before listen; production duplicates/index failures require operator review. The entrypoint also starts the deletion worker and handles SIGINT/SIGTERM with a shutdown deadline. The normal entrypoint was exercised through dev:local: model/index readiness, HTTP listen, health, unauthenticated denial and malformed-JSON/CORS responses passed. The previously absent pcb_development database now has eight initialized collections and zero records, retained for development. Ctrl+C stopped the startup-check listener. Production failover, listen-failure recovery, shutdown deadlines and file-worker crash recovery remain unverified.

## Project-local MongoDB

Current status confirms the existing setup remains ready; no MongoDB lifecycle/setup action was necessary in this implementation:

| Property                  | Verified state                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Version/topology          | Community 8.0.34; rs0, one member, PRIMARY, configuration version 1.                                                                         |
| Process/listener          | PID 12456 at audit time; only 127.0.0.1:27018. PID is observational, not a future shutdown target.                                           |
| Executable                | tools/mongodb/mongodb-win32-x86_64-windows-8.0.34/bin/mongod.exe                                                                             |
| Data                      | .local/mongodb-data/                                                                                                                         |
| Logs                      | .local/mongodb-logs/mongod.log; stdout.log and stderr.log in that directory.                                                                 |
| Runtime controls          | .local/mongodb-runtime/mongod.cfg, instance.json and management/test locks.                                                                  |
| Test DB and configuration | pcb_test, selected only by MONGODB_TEST_URI; actual variable passed exact local guard without printing its value.                            |
| Integrity                 | Retained archive SHA-256 recomputed: 6b021a0864494e4decf278b36477a29eb36072432773e4e62c2f42c302630db0; matches the pinned official checksum. |

The prior setup records the official archive source as https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-8.0.34.zip, with official checksum/release metadata verification before execution. It recorded Windows 11 x64 compatibility and existing Visual C++ runtime DLLs, with no system prerequisite installation. The preceding audit recomputed the official archive hash. This implementation reused that installation and verified current paths/configuration/PRIMARY without downloading anything. Mongoose 9.7.3 / driver 7.2.0 successfully ran the expanded fixture twice. Neither mongosh nor Database Tools is required.

From the repository root in Windows PowerShell:

```powershell
npm.cmd run mongodb:status
npm.cmd test
npm.cmd run test:integration
node scripts/dev-local.js --check
npm.cmd run dev:local  # Interactive app uses pcb_development, never pcb_test
```

For a future authorized local lifecycle operation:

```powershell
npm.cmd run mongodb:start
npm.cmd run mongodb:status
npm.cmd run mongodb:stop
```

`npm.cmd run test:unit` aliases npm test. Scripts resolve paths from their project location, even when PowerShell's working directory differs; npm commands themselves need the repository as working directory (or npm --prefix). Npm invokes the local PowerShell script with a process-only execution-policy override. Detailed setup: [docs/windows-mongodb.md](docs/windows-mongodb.md).

Start checks ownership/port state, uses the local executable in a hidden process, logs locally and waits for PRIMARY. Replica initialization is allowed only for an unconfigured server; existing replica configuration is retained. Stop validates recorded PID/start time/executable plus server identity before graceful shutdown; it does not kill arbitrary MongoDB processes or remove data. A management lock serializes operations. MongoDB Start/Stop paths were **not executed during the audit or this implementation**; the existing server stayed running. The prior setup's stop/restart, repeat-start and alternate-working-directory success are historical evidence, not new results.

`mongodb:install` is for a missing installation and verifies the official archive; it was not rerun. `mongodb:smoke` performs temporary writes/deletion and was not rerun during this audit/implementation; the original setup documented its success. Current integration connection and fixture writes provide the new Mongoose/transaction evidence.

For connection/startup failure, inspect Status and the local mongod.log/stderr.log (redact any sensitive output before sharing). A port/ownership mismatch requires process inspection; do not terminate unrelated instances. For missing runtime DLL errors (for example 0xC0000135), identify the named Microsoft Visual C++ x64 dependency; scripts never silently install system prerequisites. For failed elections, inspect replica status/logs without resetting configuration/data. Missing/unsafe test configuration must fail closed; never substitute Atlas. Existing application collections or a stale test lock require owner/process inspection before separately authorized cleanup.

The ignore rules cover local binaries/data/log/runtime paths and .env; .env.example is not inadvertently ignored. The original MONGO_URI and MONGODB_TEST_URI values remain unchanged. Only the explicitly authorized local secret/URL/CORS settings changed in .env.

## Tests, measured outcomes and limits

| Command/check executed after implementation         | Actual result                                                                                                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd test`                                      | **57 passed / 0 failed / 0 skipped**, 2 suites; final run about 5.72 seconds. Existing B01–B30/33-route regressions remain passing.                                        |
| `npm.cmd run test:integration`                      | **6 passed / 0 failed / 0 skipped**, about 4.20 seconds; one parent fixture plus five named lifecycle subtests, not six independent fixtures. Expanded suite passed twice. |
| `node --check` over src/tests/scripts               | **44 files passed**, including all 34 application JS files.                                                                                                                |
| PowerShell Parser.ParseFile on scripts/mongodb.ps1  | Passed; existing script unchanged.                                                                                                                                         |
| Actual .env validateEnvironment and app-only import | Passed; Mongoose remains disconnected, import starts no listener.                                                                                                          |
| `node scripts/dev-local.js --check`                 | Actual local configuration and project replica-set verification passed without model writes.                                                                               |
| `npm.cmd run dev:local`                             | Normal src/index.js startup, index initialization and listener passed; health 200, no-auth 401, malformed JSON 400 and approved-origin credentialed CORS passed.           |
| Ctrl+C and listener check                           | API listener stopped. The interrupted npm batch wrapper exited 1; no startup failure occurred. MongoDB stayed running.                                                     |
| `node scripts/mongodb-admin.js status`              | Community 8.0.34, PID 12456, project paths, loopback and rs0 PRIMARY verified.                                                                                             |
| Post-fixture read-only inspection                   | pcb_test zero collections; public/images only gitkeep; integration.lock absent.                                                                                            |
| Read-only development DB inspection                 | pcb_development has eight initialized application collections/indexes and **zero records**. Fixture never uses it.                                                         |
| `git diff --check`; `git diff --cached --check`     | Passed. No lint/build scripts; no formatter, build, dependency install or advisory scan.                                                                                   |

Initial sandbox attempts to run the unit and integration commands failed at Node worker creation with EPERM. Approved reruns executed the tests; only those completed runs supply the pass counts. There were no failing application tests after the fixes. The integration's injected cascade exception intentionally asserts 500 plus actual rollback and successful retry.

Unit/mail regressions cover all B31 cases, including invalid/truncated gzip/deflate/Brotli, compressed/plain body limits and parser-error CORS. They prove valid compressed requests reaching internal zlib-like errors remain 500. B32 casing/malformed headers, expiry and cookie precedence pass. B33 normal/IDN/Unicode-local/quoted recipients and actual MailComposer normalization pass; wrong recipient/local-case, empty/invalid accepted lists and transport errors still fail.

Real integration retains the previous unique-index/member aggregation, transaction rollback, last-Admin denial, concurrent refresh rotation and project-delete/create races. Added named subtests:

1. **Onboarding:** real register/hash, expired verification denial/resend, single-use verification, unverified project denial, authenticated creator Admin membership and duplicate project handling.
2. **Invitations:** existing/new IDN recipients, pending membership, exact-email/verification requirements, expiry/rotation, simultaneous acceptance with one winner, role changes and Admin versus lower-role restrictions.
3. **Resources/files:** task/subtask/note create/read/update, all-role reads, Project Admin task writes, Member completion-only behavior, real metadata persistence, exact public downloads and appended files, status changes and null assignment.
4. **Isolation/rollback/cleanup:** two-project child substitution denial, invalid-assignee transaction rollback with uploaded-file cleanup, injected mid-cascade failure retaining DB rows/files with no committed deletion jobs, removed-member assignment cleanup/access denial, individual deletion and successful project cascade.
5. **Sessions/client HTTP:** credentialed CORS preflight, denied Origin, cookie attributes/auth/refresh, rotation/reuse denial, logout, reset expiry/single use and old-session revocation, password change and access/refresh expiry.

The parent fixture connects only through the existing exact MONGODB_TEST_URI guard and verifies actual paths/topology/PRIMARY before model creation/indexes. AutoCreate/autoIndex remain disabled until verification. It refuses existing application collections, obtains its exclusive lock and drops only successfully created collections at completion; no whole database deletion occurs. Temporary file ownership is captured from that fixture's Multer filename callbacks, not inferred by deleting every new file in a shared directory. Connections/server/lock are closed; cleanup still runs on failure. The new lifecycle helper performs no independent connection or database selection.

No automated test contacted Atlas, production services or real SMTP. The local startup check used the separate previously absent development database; its probes sent no emails and created no user/project records. No existing application data was modified. Running MongoDB data/log files naturally change during operation.

Actual browser behavior, live sender/TLS/inbox delivery, deployment proxy/HTTPS/CSRF policy, production duplicate/index review, backups/restore/failover, sustained contention and persistent/shared-storage crash recovery remain unverified. Wider transient/uncertain-commit and queue-recovery scenarios are still P01/P09/T03; the complete local happy path plus targeted faults does not prove every recovery scenario.

## Remaining readiness work

There is no remaining confirmed source-code blocker among E01/B31–B33. Begin local frontend integration with [docs/frontend-integration.md](docs/frontend-integration.md), then obtain **actual browser sign-off** for login/credentials, serialized refresh/logout and the selected invitation/reset pages. HTTP tests passed; no frontend or browser harness was created. Preserve localhost on both client and API for the local cookie workflow.

Real SMTP requires explicit external-send authorization. P08 enumeration/shared rate-control policy, P10 HTTPS/proxy/pre-login/missing-Origin CSRF policy, P01/P02 deployment data/index/transaction recovery and P09 persistent storage remain production/security gates. Pagination, readiness/metrics, root placeholder wording and extra APIs are optional. See task.md for preserved IDs, priorities and acceptance criteria; no new global-admin or invitation policy decision is needed.

## Historical continuity

The earlier 2026-10-17 audit identified B01–B27; authorized authentication/backend work repaired those and B28–B30 while preserving nomenclature. The original 2026-10-18 MongoDB setup installed the local replica set and hardened isolation. Its 53 unit/mocked and one integration pass were reconfirmed by the subsequent read-only audit.

That audit changed only history.md/task.md, identified E01/B31–B33 and reported **52 PASS / 12 PARTIAL** with missing full real-persistence coverage. The current authorized implementation resolves those defects and adds the measured lifecycle coverage above; the old counts/open statuses are historical, not the current state. B01–B30 were revalidated through the full current regression suite, import and syntax checks; their resolutions are retained in task.md.

## Files changed and preservation

Changed in this task:

- **src/app.js**, **src/middlewares/auth.middleware.js**, **src/utils/mail.utils.js**: focused parser/CORS, header and mail fixes.
- **tests/auth.test.js**, **tests/integration.test.js**: regressions, actual envelope mock and expanded guarded fixture.
- **package.json**: added dev:local while retaining all prior script changes.
- Ignored **.env**: ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, SERVER_URL, FORGOT_PASSWORD_REDIRECT_URL, CORS_ORIGIN; added PROJECT_INVITATION_REDIRECT_URL. Unrelated values and database URI values preserved.
- **docs/windows-mongodb.md**, **docs/implementation-decisions.md**, **history.md**, **task.md**: actual setup/readiness/test updates.
- Created **scripts/dev-local.js**, **tests/helpers/integration-lifecycle.js**, **docs/frontend-integration.md**.

Pre-existing Git changes retained: unstaged .gitignore/history.md/package.json/task.md/tests/integration.test.js; staged README.md deletion; untracked docs/windows-mongodb.md, scripts/mongodb.ps1, scripts/mongodb-admin.js, scripts/lib/mongodb-test.js and tests/mongodb-safety.test.js. The earlier MongoDB setup remains intact.

Final verification uses the new implementation baseline of 63 files, not the preceding audit baseline. Only the intended files above changed/were added; .gitignore, PRD.md, package-lock.json, all controller/route/model files and MongoDB config/ownership/control files remain byte-identical. Generated real secrets were checked absent from source/test/documentation files and .env remains ignored. No staging, commit, reset, clean, stash, renaming or discarded work occurred.

Final Git inventory: the preceding changed/untracked files, plus modified src/app.js, src/middlewares/auth.middleware.js, src/utils/mail.utils.js, tests/auth.test.js and docs/implementation-decisions.md; new scripts/dev-local.js, tests/helpers/integration-lifecycle.js and docs/frontend-integration.md. The existing untracked docs/windows-mongodb.md was also updated. .env remains ignored; only README.md is staged deleted. Local runtime DB data/logs are excluded from byte equality because of authorized tests/startup.

## Instructions for future Codex sessions

Read current history.md/task.md, the complete uppercase PRD.md, applicable instructions and client/setup docs; inspect current Git state before changes. Do not repeat completed audit work unnecessarily. Preserve current controller/model/function/field names and spelling aliases, including ApiRespones/statuscode, attachements/mimeTypes, UpdateSubTask and refrershToken. Do not invent global roles, broaden Member task permissions, silently change email matching or remove compatibility aliases.

Use `npm.cmd run dev:local` for local interactive startup; it preserves the non-local on-disk MONGO_URI. Use only the guarded MONGODB_TEST_URI/pcb_test fixture for automated database tests; never substitute the development database or Atlas, reset a replica set or delete existing data to force tests to pass. Inspect fixture ownership/cleanup before extensions. Preserve user-selected local origins/routes; production configuration remains a separate task.

Never expose actual environment secrets or put them in Git, tests or documentation. Keep audit-only scopes read-only; this implementation was separately authorized. Report actual pass/fail/skip outcomes and distinguish mocked SMTP, real MongoDB, browser and deployment verification. Do not send real email without explicit authorization. Maintain historical IDs and unresolved acceptance criteria instead of erasing findings when their status changes.
