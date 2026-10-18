# PCB project history and Codex handoff

## Current handoff — full backend implementation, 2026-10-18

This session read history.md, task.md, the entire unchanged uppercase PRD.md, README.md, requiredThings.md and package/configuration before editing, then inspected every source module, tests, Git state and repository instructions. No applicable AGENTS.md was found. The work resumed on October 18 to complete documentation and final verification.

**Current result:** all 33 PRD method/path contracts are mounted; one additional invitation-acceptance endpoint and two legacy member aliases are available. The most recent suite reports **50 passed, 0 failed, 1 skipped**. The skipped test is the real MongoDB integration fixture: the user explicitly confirmed no isolated replica set is available. The app imports without connecting to MongoDB or starting the production entry point.

The 64 task.md checkpoints now read **59 PASS, 5 PARTIAL, 0 FAIL, 0 UNVERIFIED**. PASS describes the narrow source/isolated request contract and inherits the live-database/SMTP limitation. Partial items are R02/R44/R58/R59/R63: operational authentication/reset security, system lifecycle validation and real email delivery. This is not a declaration of full production compliance.

### Starting state and preservation

At the start of this session, package.json and 11 source files were already modified; history.md, task.md and tests/auth.test.js were untracked from the previous authorized authentication implementation. Those changes were preserved. No commit, reset, checkout, merge, migration, dependency install, .env edit or production service operation was performed.

The previous authentication patch resolved 17 B-series findings. This session resolved the remaining original B06/B17–B22/B25–B27 and added/fixed B28 (SMTP recipient acceptance), B29 (internal profile fields) and B30 (project field/update validation). Historical descriptions below refer to older states; current task.md resolution notes and this handoff take precedence.

### Explicit product decisions

- Verified users can create projects and become the new project's Admin. Roles remain scoped to ProjectMember; there is no global Admin override.
- Invitations must be accepted, including by new users. POST /members and its /member alias now return a pending invitation, not immediate membership. This behavioral change was explicitly authorized. Existing members use PUT for role changes.
- Keep account actions usable before verification; require verified email for project/task/subtask/note and invitation acceptance.
- No isolated database is configured; run mocks and record the limitation.

These decisions and transaction/storage compatibility implications were documented before implementation in [docs/implementation-decisions.md](docs/implementation-decisions.md). PRD.md was not edited. Last-Admin protection and clearing assignments on member removal implement the safe integrity behavior; historical author references remain.

### Architecture and module responsibilities

The structure remains Express routers -> authentication/role/input middleware -> existing controllers -> Mongoose models -> ApiRespones, with centralized sanitized errors. New helpers support transactions, files and configuration rather than introducing a replacement application architecture.

```text
src/
  app.js                     Auth, projects, tasks, notes, health mounts; parsers/CORS/static/errors
  index.js                   dotenv, config validation, DB/index readiness, listen/cleanup/shutdown
  controllers/
    auth.controler.js        Ten account/session handlers, preserved
    project.controlers.js    Projects, members, invitation sending/acceptance
    task.controler.js        Five task and three subtask handlers, including UpdateSubTask
    note.controler.js        NEW: five note handlers
    healthCheck.js           Existing public liveness
  routes/
    auth.route.js, project.route.js, healthCheck_route.js
    task.route.js            NEW: eight PRD task/subtask endpoints
    note.route.js            NEW: five PRD note endpoints
  models/
    user.models.js, project.models.js, projectmember.models.js
    task.models.js, subtask.models.js, note.models.js
    projectInvitation.models.js  NEW: pending invitations, hashed tokens/expiry
    fileDeletion.models.js       NEW: persistent file deletion jobs
  middlewares/
    auth.middleware.js, validtor.middleware.js, multer.middleware.js
    rateLimit.middleware.js  NEW: bounded IP/account auth throttling
  validators/index.validatorts.js  Existing factories plus resource/update/ID validators
  utils/
    existing apiError.js, apiResponse.js, asyncHandler.js, constants.js, mail.utils.js
    project.utils.js         NEW: transaction/parent/permission helpers
    attachment.utils.js      NEW: paths, limits, metadata, cleanup/queue
    env.utils.js             NEW: early sanitized configuration validation
tests/
  auth.test.js               Extended prior HTTP suite
  contracts.test.js          NEW: 33 mounted PRD contracts, rate/config/transaction error checks
  project.test.js            NEW: project/task/subtask/note/invitation/upload HTTP regressions
  helpers/database.js        NEW: collection adapter and rollback/failure fixtures
  integration.test.js        NEW: opt-in isolated replica-set integration
```

src/app.js registers taskRouter at /api/v1/tasks and noteRouter at /api/v1/notes. project.route.js adds plural member collections and preserves singular aliases. Its extra POST /:projectId/invitations/:invitationToken/accept is authenticated/verified and validates the invitation instead of requiring existing membership.

All original controller/export/module/schema names remain. References now use the existing lowercase user model; collection names and relationship fields are unchanged. attachements, mimeTypes, ApiRespones, statuscode, genrateTemporaryToken, UpdateSubTask, verficationToken and refrershToken remain. Auth responses additionally omit __v and avatar.localPath, and membership/task/note profiles expose only public avatar URLs.

### Current request and data-integrity flows

**Authentication:** the previous typed validation, exact password hashing, single-use temporary tokens, trusted URLs, atomic refresh replacement, unique jti and tokenVersion revocation remain. Unknown login accounts execute bcrypt comparison to reduce the obvious timing difference. Auth routes now have 100 requests per endpoint/IP/account per 15-minute per-process limits with bounded storage/Retry-After. Cookie writes with an Origin header require a configured origin. SMTP now checks accepted recipients as well as rejected promises, uses bounded timeouts and supports MAIL_FROM. Password reset/change/logout invalidate both access and refresh sessions as before.

**Projects:** getProjects joins the singular project relationship and calculates member counts. Creation writes project and creator membership in one transaction. Existing-project writes first increment the project's existing __v field, then recheck membership within the transaction. This shared write serializes membership changes, assignments, child writes and project deletion; transaction snapshot isolation alone would not prevent those races. Updates use typed partial fields and schema validation. Deletion transactionally removes tasks, subtasks, notes, members, invitations and queues attachment deletions.

**Members:** unique (project,user) plus user/project indexes are declared. Admin demotion/removal cannot eliminate the last Admin. Member removal clears Task.assignedTo in that project in the same transaction. No user record or historical createdBy/assignedBy is deleted.

**Invitations:** Admin POST member collection creates/replaces one pending invitation per project/email and sends mail. Tokens contain 20 random bytes, are stored as SHA-256 hashes, expire after seven days and are consumed in a transaction. The recipient must log in with a verified account whose email matches exactly. New recipients register/verify first. Re-inviting rotates the pending token; duplicate existing membership returns 409 and requires the role-update endpoint. SMTP failures return 502 without granting access. PROJECT_INVITATION_REDIRECT_URL can point to a frontend that preserves the token through onboarding; otherwise mail contains the API POST URL, which a GET alone will not accept.

**Tasks/subtasks/notes:** route gates enforce the PRD matrix and every resource is checked against its project. Task creation/update requires an existing same-project assignee; null explicitly clears assignment. Both privileged roles manage tasks and create/delete subtasks. All three roles can set boolean isCompleted; members cannot edit titles. Admin alone mutates notes; every role can read. Whitelisted typed inputs reject injected relationships, bad enums, arrays/objects, null/empty text and malformed IDs. Task detail includes safe assignee and subtask creator profiles.

**Attachments:** Multer runs after JWT/verification/role gates. POST/PUT tasks accept repeated attachements parts, maximum five files total per task and 1,000,000 bytes per file. PNG/JPEG/GIF/WebP/PDF MIME signatures are checked. Stored UUID filename, MIME and size produce the existing metadata shape. Static paths are module-relative and CORS applies; downloads are public per PRD, with Content-Disposition attachment, nosniff and a sandbox CSP. Task updates append files. Failed writes remove files or queue failed cleanup. Committed deletions use durable FileDeletion records, retried after deletion and once per minute by index.js. Unknown transaction commit outcomes preserve potentially referenced files and return 503 for reconciliation.

### Runtime/deployment requirements and remaining risks

- MongoDB must support transactions (replica set/sharded cluster). Startup checks topology, awaits Mongoose model/index initialization and only then listens. A standalone deployment is no longer adequate for these integrity guarantees. Existing duplicate memberships require deliberate cleanup before deploying the unique index; no live cleanup or migration occurred.
- Configuration names and safe examples are in README. validateEnvironment checks required DB/SMTP/token/link values, positive explicit JWT durations and distinct secrets; production secrets require at least 32 characters. Bare numeric expiry strings are rejected to avoid jsonwebtoken's millisecond interpretation.
- SERVER_URL remains the trusted public base. Optional additions: MAIL_FROM and PROJECT_INVITATION_REDIRECT_URL. MONGO_TEST_URI is test-only and never read by the production connection function. No real environment values are documented.
- index.js sanitizes startup failures, handles listen errors and bounded SIGINT/SIGTERM shutdown, and runs the deletion worker. Real deployment shutdown/browser/proxy/HTTPS behavior remains untested.
- P01/P02/T03/D04 remain open for real transactions/indexes/data/races. The mock adapter serializes transactions and supports rollback; it cannot establish actual MongoDB isolation/retry behavior.
- P08 remains open for distributed gateway throttling and registration/reset timing/failure enumeration. The application limiter is per process. Known reset accounts can still differ in SMTP timing/502 failure; queued non-enumerating mail delivery would require further design.
- P09 remains open for persistent/shared disk operations and orphan reconciliation after process crashes or uncertain commits. Content signatures do not scan malware. Old non-UUID attachment filenames are deliberately not automatically deleted by the new cleanup helper. Public attachments are not confidential.
- P10/P12 remain open for actual SMTP sender/TLS/inbox delivery, browser cookie/proxy behavior, storage permissions and operational verification. The health endpoint is liveness only.
- Lists/cascades remain unpaginated. Existing global project-name uniqueness and case-sensitive account email matching are preserved. Pagination, email case migration, invitation cancellation/decline UX, and separate readiness/metrics are future decisions rather than invented PRD endpoint requirements.
- No current confirmed B-series bug is left open, but that is bounded by the source/mocked/disk evidence and is not a guarantee that every runtime defect has been found.

### Test commands and measured outcomes

| Check | Most recent executed outcome |
| --- | --- |
| Baseline npm test | 24 passed after sandbox worker spawn EPERM and approved rerun |
| First expanded npm test | 44 passed |
| npm test after security/integrity additions | 50 passed, 0 failed, 1 skipped |
| Mounted PRD route contract | All 33 methods/paths, extra invitation endpoint and both member aliases passed |
| App-only dynamic import | Passed; production index.js was not imported |
| node --check source files | Passed before documentation closeout; final total recorded below |
| Live MongoDB integration | Skipped: user confirmed no isolated replica set / MONGO_TEST_URI |
| SMTP/deployment/advisory/install | Not run |

The final npm test completed successfully after implementation and documentation updates; the final verification section records the result. The tests execute real Express HTTP, Mongoose casting/population/hooks, JWT/bcrypt/validation and Multer/disk I/O. MongoDB collections, transaction scheduling/rollback, and Nodemailer transport are mocked. The integration fixture only accepts a URI naming a pcb_test_ database, creates a random disposable pcb_test_ database on that test server and drops only that generated database in cleanup. It does not load .env or use MONGO_URI.

README now describes setup, every endpoint group, request fields, response casing, roles, invitations, uploads and limits. requiredThings.md retains its useful historical contents under a superseded notice. Generated public/images files are ignored, with the existing gitkeep retained. package-lock.json and all dependency declarations are unchanged; package.json adds test:integration alongside the prior repaired scripts.

### Recommended next session

Run the guarded integration suite against an isolated MongoDB replica set, then verify real SMTP delivery and deployment configuration. Review existing duplicate memberships/indexes before applying the new runtime to existing data. Do not weaken transaction/authorization checks simply to make a standalone MongoDB instance appear to work.

The remaining document preserves the previous authentication handoff and original audit as history.

### Final verification — 2026-10-18

- `npm test` completed successfully after the implementation/documentation changes: **51 tests, 50 passed, 0 failed, 1 skipped** (27 auth, 19 project/resource, four contract/config/helper tests; one skipped MongoDB integration test). The final run took approximately 5.1 seconds in the Node runner.
- `node --check` passed for all **39** JavaScript files in src/ and tests/.
- `node --input-type=module -e "import('./src/app.js').then(() => console.log('Application import passed'))"` passed without running src/index.js or connecting to MongoDB.
- `git diff --check` initially identified CRLF/trailing-whitespace handling in the newly edited .gitignore. Its line endings were normalized and the repeated check **passed**. No lint/build script exists.
- The full tracked diff and all added implementation/test files were reviewed. No source/module/model/export renames or file deletions occurred.
- A documentation check confirmed exactly 64 unique checkpoints, counts **59/5/0/0**, 30 distinct resolved B IDs, and balanced Markdown fences.
- PRD.md SHA-256 remains `EADE92B71FE9612E59B8586D8589ADE647FE7672DDDA5DC2CA6BEF1833D6D5C3`; package-lock.json remains `F6623F211BF8A115D97A9BFED74909650DEFF0B5206FE8A8849915237A6E2CA3`.
- A local comparison found **zero** occurrences of configured secret/password/Mongo-URI values in source/tests/docs (values were not printed). .env remains ignored and untracked; no environment values were added.
- public/images contains only the original gitkeep after test cleanup. No generated attachment remains in the working tree.
- Final Git state: **23 tracked modified files, 17 untracked files, no deleted files**. Three untracked files (history.md, task.md, tests/auth.test.js) predated this session; 14 files were newly added here. No staging or commit was performed.

### Complete final file inventory

| Git state | File |
| --- | --- |
| Modified | .gitignore |
| Modified | README.md |
| Modified | package.json |
| Modified | requiredThings.md |
| Modified | src/app.js |
| Modified | src/controllers/auth.controler.js |
| Modified | src/controllers/project.controlers.js |
| Modified | src/controllers/task.controler.js |
| Modified | src/db/database.js |
| Modified | src/index.js |
| Modified | src/middlewares/auth.middleware.js |
| Modified | src/middlewares/multer.middleware.js |
| Modified | src/middlewares/validtor.middleware.js |
| Modified | src/models/note.models.js |
| Modified | src/models/project.models.js |
| Modified | src/models/projectmember.models.js |
| Modified | src/models/subtask.models.js |
| Modified | src/models/task.models.js |
| Modified | src/models/user.models.js |
| Modified | src/routes/auth.route.js |
| Modified | src/routes/project.route.js |
| Modified | src/utils/mail.utils.js |
| Modified | src/validators/index.validatorts.js |
| Untracked (new) | docs/implementation-decisions.md |
| Untracked (pre-existing, updated) | history.md |
| Untracked (new) | src/controllers/note.controler.js |
| Untracked (new) | src/middlewares/rateLimit.middleware.js |
| Untracked (new) | src/models/fileDeletion.models.js |
| Untracked (new) | src/models/projectInvitation.models.js |
| Untracked (new) | src/routes/note.route.js |
| Untracked (new) | src/routes/task.route.js |
| Untracked (new) | src/utils/attachment.utils.js |
| Untracked (new) | src/utils/env.utils.js |
| Untracked (new) | src/utils/project.utils.js |
| Untracked (pre-existing, updated) | task.md |
| Untracked (pre-existing, updated) | tests/auth.test.js |
| Untracked (new) | tests/contracts.test.js |
| Untracked (new) | tests/helpers/database.js |
| Untracked (new) | tests/integration.test.js |
| Untracked (new) | tests/project.test.js |

## Historical handoff — authorized authentication fixes, 2026-10-17

The user followed the read-only audit with “lets start with resolving the authentication bugs,” authorizing this implementation. The user also explicitly chose: **unverified users may perform account actions; project access requires verified email**. That decision is now enforced.

**Current status:** the app imports successfully and its authentication routes pass 24 HTTP regression tests with MongoDB and SMTP mocked. Startup entries point to the existing src/index.js. The full product is still incomplete: project listing/URL and integrity issues remain, task/subtask APIs are unmounted, and notes have only a model.

Current [task.md](task.md) checklist: **20 PASS, 15 PARTIAL, 27 FAIL, 2 UNVERIFIED** across 64 overlapping checkpoints. Seventeen confirmed findings are resolved: B01–B05, B07–B16, B23–B24. P06 is resolved by the user's choice, and P07's code changes are implemented; real MongoDB concurrency verification is outstanding. Original audit evidence is retained below as history.

### What changed and where

| File | Current responsibility/change |
| --- | --- |
| src/controllers/auth.controler.js | Existing ten handlers and genAccessAndRefreshToken names retained; fixed login, links, statuses, public-user fields, reset/change, refresh rotation, logout and mail failure handling; added small local helpers |
| src/models/user.models.js | Existing lowercase user model/default export retained; added tokenVersion default 0, embedded version in access/refresh JWTs, unique refresh jti |
| src/middlewares/auth.middleware.js | verifyJWT checks session version and returns safe req.user data; new requireVerifiedEmail gate; permission middleware checks projectId and returns 403 for no membership |
| src/middlewares/validtor.middleware.js | validate calls errors.isEmpty() so invalid input is rejected |
| src/validators/index.validatorts.js | Existing factories retained; typed auth fields, common password rule, no password trimming; member email/role types enforced |
| src/routes/auth.route.js | Existing paths retained; password-change factory now instantiated |
| src/routes/project.route.js | Router-wide JWT then verified-email gate; existing singular member-list path now also checks membership |
| src/controllers/project.controlers.js | Removed invalid unused nodemailer pipeline import; member-role upsert enables runValidators; other project logic preserved |
| src/utils/mail.utils.js | SMTP failures throw a sanitized ApiError(502) instead of being swallowed/logging raw transport errors |
| src/app.js | Sanitized JSON error/404 handling; CORS entries trimmed |
| src/index.js | dotenv/config evaluates before app construction; still connects DB/listens only when this entry is run |
| package.json | main=start target existing src/index.js; added npm test using Node's built-in runner; dependencies unchanged |
| tests/auth.test.js | New 24-test HTTP suite; mocked collection/SMTP boundary with real Express, validation, Mongoose hooks/casting, bcrypt, JWT and Mailgen |
| task.md / history.md | Updated resolved items, compliance and session handoff; original audit retained |

No existing file, controller, function, route, model, schema field, or response key was renamed. In particular verficationToken, emailVerficationToken, genrateTemporaryToken, ApiRespones, statuscode, and refrershToken remain. Refresh now additionally returns correctly spelled refreshToken with the same value as the retained refrershToken alias.

### Current authentication flows

- **Registration:** typed email/username/password validation -> duplicate check -> new User with hashed temporary verification token/expiry -> one save (bcrypt hook runs) -> SMTP send -> safe user response, HTTP/body status 201. SERVER_URL supplies the trusted origin for /api/v1/auth/verify-email/:verficationToken. URL configuration is checked before account persistence. A mail failure returns 502 explaining the account was created and the user can log in and resend.
- **Login:** email/password only; password whitespace is preserved. Bad credentials get a uniform 401. Signing and refresh replacement are guarded by the loaded password hash and session version so a concurrent reset/revocation cannot resurrect an old session. A safe public user and both tokens are returned.
- **Verification/resend:** tokens retain the existing 20-minute SHA-256 storage design. Verification is one findOneAndUpdate matching token/hash, unexpired time and unverified state; it clears the token and sets the flag atomically. Resend remains secured, usable by unverified accounts, and rejects already-verified accounts.
- **Project access:** verifyJWT loads the current account, then requireVerifiedEmail requires isEmailVerified before any project route. Authentication/account actions remain available without verification. Member listing also checks an allowed membership role; knowing a project ID is insufficient.
- **Access JWTs:** contain the existing user fields plus tokenVersion. verifyJWT checks signature with HS256, ID shape, user existence and current tokenVersion. Reset/verification fields, password, refresh token and tokenVersion are absent from req.user/public responses. Unexpected database errors remain 500 rather than being disguised as invalid JWTs.
- **Refresh:** cookie or body refreshToken, with missing/non-string inputs producing 401. A valid signed token must match the saved token and current tokenVersion. Replacement is a single conditional update; every refresh JWT has a unique jti. Only one concurrent use of an old refresh token can win. The response supplies accessToken, refreshToken and legacy refrershToken.
- **Logout:** clears stored refresh state, increments tokenVersion and clears both cookies. Both kinds of previously issued JWTs fail subsequent authorization, rather than access tokens remaining usable until expiry.
- **Forgot password:** validates a scalar email; known and unknown accounts share the same normal 200 message. For a known account it stores an expiring hashed token and sends a link based on FORGOT_PASSWORD_REDIRECT_URL. SMTP failure returns a sanitized 502. Timing and mail-failure distinctions are still P08 concerns.
- **Reset/change password:** validate new password, hash with bcrypt, then atomically replace credentials, clear pending reset/refresh state and increment tokenVersion. Reset matches the still-unexpired temporary token in that write; change matches the checked old password hash/session version. Atomic updates do not run save hooks, so these two paths explicitly hash before updating. Both clear cookies; reauthentication is required.
- **Errors:** JSON errors carry statusCode/data/success/message/errors (existing ApiError casing); successful ApiRespones still uses statuscode. Common malformed/expired-token/ID errors use 400, invalid sessions 401, missing project membership/unverified access 403, duplicate accounts 409, validator errors 422, oversized bodies 413 and SMTP failures 502. Raw exception stacks/credentials are not returned.

### Compatibility, configuration and data implications

- The user's per-project role design and unresolved global-admin/project-creation policy are unchanged. Invitation semantics also remain undecided.
- All project endpoints now require verified email, including project listing/creation. Frontends should offer verification/resend on 403. Login/current-user/logout/change-password/refresh/resend remain available to unverified accounts.
- Existing request bodies, route paths and exports were preserved. The project collection member URL remains singular /member pending B27; the plural PRD URL was not silently added or renamed.
- tokenVersion is an **additive** User field, defaulting to zero. Old documents/JWTs without it are interpreted as zero, including conditional updates that match missing values; logout/reset/change increments the stored value. No migration or live database update was performed during development.
- Refresh storage still has one slot per User. Later login normally replaces the previous refresh session; logout/reset/change revoke all of that user's access/refresh JWTs through the shared version.
- New-password policy retains the existing six-character minimum and rejects inputs exceeding bcrypt's 72 UTF-8 bytes. Passwords are never silently trimmed now. Login/old-password checks allow shorter legacy passwords so they can be changed. Old accounts whose passwords were previously trimmed still need the historically stored password or a reset.
- Cookies explicitly use HttpOnly and SameSite=Lax. Secure is enabled when NODE_ENV=production; use production mode with HTTPS. Cross-site frontend deployments, CSRF/proxy behavior and browser cookie handling need deployment testing; bearer transport remains available.
- Existing SERVER_URL is now also the verification-link origin, not just a future attachment base. SERVER_URL and FORGOT_PASSWORD_REDIRECT_URL must be HTTP(S) URLs without embedded credentials/query/fragment; the latter retains its configured path and appends the reset token. No request Host header is trusted for these links.
- .env and package-lock.json were not changed, and no dependency was installed. No actual tokens, credential values or connection strings were put in documentation/tests. Test keys/domains are isolated dummy values.
- dotenv is loaded before app construction in src/index.js. Direct app imports intentionally do not load .env; test fixtures supply their own environment. Do not start the real entry to perform a read-only import check.

### Available scripts now

| Command | Definition / use |
| --- | --- |
| npm run dev | nodemon ./src/index.js; real app/DB startup, not run in this session |
| npm start | node src/index.js; corrected real entry, not run against configured DB |
| npm test | node --test tests/*.test.js; isolated HTTP regression suite |
| node test-eval.js | Existing ignored local smoke script; now passes app import |
| node --check <file> | Syntax-only check; all 26 current source/test JS files passed |

The tests/ directory and tests/auth.test.js are new. No separate test dependency, CI workflow, deployment file or database fixture service was introduced.

### Actual validation results and limits

- Final npm test: **24 passed, 0 failed, 0 skipped**. An initial sandbox run failed before executing tests because Node worker spawn was blocked with EPERM. A requested/authorized escalated run passed; an earlier 21-test run passed before three additional targeted regressions were added.
- Tests cover all ten auth routes plus health/errors/CORS and project gates: malformed input before persistence, exact password hashing, duplicate-account race handling, login, verification expiry/replay, unverified access, member roles/IDs, safe user responses, body/cookie refresh, unique rotation/replay/concurrent use, revocation interleaving, logout, reset/change, legacy versions, SMTP failure/retry, cookie attributes and invalid link configuration.
- The suite uses a loopback HTTP listener. Collection methods and Nodemailer transport are mocked; mongoose.connect is guarded and connection readyState remains 0. The adapter tests query intent and controlled interleavings; it does not prove MongoDB topology/index/transaction behavior or real concurrency.
- node test-eval.js passed. Syntax checks passed on 26 JS files. git diff --check passed.
- No application deployment, real MongoDB connection/write, SMTP send, dependency install, environment update, migration, commit or Git-history change was performed. npm start/dev were not run.

### Remaining work and recommended next task

For authentication, add appropriate request/account abuse controls and examine timing/failure-path enumeration (P08); run an authorized isolated MongoDB/SMTP integration suite, including actual token races and mail delivery. Validate HTTPS, NODE_ENV, cookie/SameSite, proxy/CORS and deployment configuration (P10/P12). Do not label these checks complete based on the mocked suite.

Outside this patch, project listing joins (B06), member collection URL compatibility (B27), multi-document/uniqueness/last-admin policies (P01–P05), task/subtask/note/attachment implementation (B17–B22, M01–M04), remaining validators, task-read status (B25), and stale README/older audit claims (B26) remain. See task.md checkboxes for priorities.

The historical audit below describes the state **before** these authorized fixes. Its failed import/no-tests/read-only statements are preserved as historical evidence and do not override this current handoff or the user's later authorization.



## Original read-only audit snapshot — 2026-10-17

This document records the existing repository and a strictly read-only application audit. It is not an implementation log claiming fixes.

- Repository: Project Camp Backend (PCB); package name `project-mangement`, version 1.0.0.
- Baseline branch: `master` tracking `origin/master`.
- Baseline commit: `e4259b62c038f92138f61ce4ee9f72947b08cd1f`, dated 2026-10-17, subject `update`.
- Initial Git status: clean. Neither task.md nor history.md existed.
- Full PRD: [PRD.md](PRD.md), 180 lines. The user's reference `prd.md` means this existing uppercase filename; do not create a duplicate or rename it.
- Authorized output: create task.md and history.md only. Application files, package/lock/config/env files, existing notes, database/services, identifiers, and Git history were left unchanged.
- Detailed findings, evidence, priorities, compliance rows, and future checklists: [task.md](task.md).
- No ancestor/repository AGENTS.md was found during this audit. Future sessions should check again for applicable instructions.

**Status at the original audit:** the application import fails before startup (B01), and npm start targets a missing file (B02). Authentication/project/member functionality is partially implemented with substantial defects. Task/subtask APIs are unmounted; notes have only a model. This is not production ready.

PRD checkpoint counts: **8 PASS, 25 PARTIAL, 29 FAIL, 2 UNVERIFIED**, out of 64 overlapping audit checkpoints. A PASS describes a narrow source-level requirement, not a successfully exercised HTTP endpoint. All running endpoints are blocked by B01. No completion percentage or successful integration-test result is claimed.

## Project purpose and technology stack

PCB is a REST API for collaborative project management: accounts and email verification, JWT sessions, projects and team roles, tasks/assignees/attachments, subtasks and completion, project notes, and system health. The PRD defines admin, project_admin, and member permissions. Actual roles currently live on project memberships, not globally on users.

| Component | Existing technology / audited version | Purpose |
| --- | --- | --- |
| Runtime | Node.js, ES modules; local Node v24.14.0, npm 11.9.0 | JavaScript backend |
| HTTP | Express 5.2.1 | Routing, JSON/urlencoded parsing, static files |
| Database | MongoDB through Mongoose 9.7.3 | Schemas, queries, aggregation; no live DB inspection |
| Authentication | jsonwebtoken 9.0.3, bcrypt 6.0.0, cookie-parser 1.4.7 | Signed access/refresh JWTs, password hashing, cookies |
| Validation/CORS | express-validator 7.3.2, cors 2.8.6 | Request validators and browser origin policy |
| Email | Mailgen 2.0.36, Nodemailer 9.1.1 | HTML/text templates and configured SMTP |
| File storage | Multer 2.3.0 | Disk storage draft, not integrated into routes |
| Configuration | dotenv 17.4.2 | .env loading in src/index.js |
| Development | nodemon 3.1.14, Prettier 3.9.4 | Dev restart and formatting; no formatting was run |

package.json also declares @types/jsonwebtoken, @types/mailgen, and @types/nodemailer as dependencies; application source is JavaScript. package-lock.json is lockfile version 3 with 198 dependency entries plus the root. Root dependency maps agree with package.json; installed direct versions were inspected. All locked dependency entries have integrity metadata and npm-registry resolutions. This does not establish advisory/vulnerability safety.

The lock includes packages requiring Node >=20.19.0. No engines field or runtime-version file is committed. Local runtime compatibility is not evidence of a successful deployment.

## Existing directory structure

```text
repository/
  PRD.md
  README.md
  requiredThings.md             existing prior audit; contains stale completion claims
  package.json
  package-lock.json
  .gitignore
  .prettierignore
  .prettierrc
  .env                         local, ignored; values not documented
  commands.md                  local learning notes, ignored
  notes.txt                    local learning notes, ignored
  defination.txt               local terminology notes, ignored
  test-eval.js                 local ignored import smoke check
  task.md                      created by this audit
  history.md                   created by this audit
  public/
    .txt
    images/
      gitkeep
  src/
    .txt
    app.js
    index.js
    db/
      database.js
    controllers/
      auth.controler.js
      project.controlers.js
      task.controler.js
      healthCheck.js
    routes/
      auth.route.js
      project.route.js
      healthCheck_route.js
    models/
      user.models.js
      project.models.js
      projectmember.models.js
      task.models.js
      subtask.models.js
      note.models.js
    middlewares/
      auth.middleware.js
      validtor.middleware.js
      multer.middleware.js
    validators/
      index.validatorts.js
    utils/
      apiError.js
      apiResponse.js
      asyncHandler.js
      constants.js
      mail.utils.js
  node_modules/                existing installed dependencies, ignored
  .git/                        existing Git metadata
```

All unusual spellings above are existing identifiers and must be preserved without explicit permission. No services/repositories abstraction, job worker, frontend, migration system, tests directory, CI workflow, container/deployment configuration, or task/note router exists in the inspected project.

Learning files discuss setup, Linux/Git commands, Express, authentication, middleware, and uploads; they are explanatory notes rather than executable requirements. src/.txt and public/.txt are directory notes; public/images/gitkeep is a placeholder.

## Architecture and important modules

The intended request path is Express app -> mounted router -> authentication/permission/validation middleware -> controller -> Mongoose model -> ApiRespones. Errors are forwarded to Express's default handler. Controllers call models directly; there is no service layer.

| File | Responsibilities / important identifiers | Current state |
| --- | --- | --- |
| src/index.js | dotenv.config, port selection, connectDB, app.listen | Imports app before dotenv runs; connection starts on entry execution |
| src/app.js | JSON/urlencoded 16kb limits, static public, cookie parser, CORS, auth/projects/health mounts, root text response | B01 prevents import; no task/note router or JSON error middleware |
| src/db/database.js | connectDB calls mongoose.connect(MONGO_URI), logs outcome, exits on error | Not invoked by audit; real connection state unverified |
| src/controllers/auth.controler.js | genAccessAndRefreshToken; registerUser, login, logoutUser, getCurrentUser, verifyEmail, resendEmailVerification, refreshAccessToken, forgotPasswordRequest, resetForgotPassword, changeCurrentPassword | All ten endpoint handlers exist; numerous contract/security defects |
| src/controllers/project.controlers.js | getProjects, getProjectById, createProject, updateProject, deleteProject, addMemberToProject, getsProjectMembers, updateMemberRole, deleteMember | Invalid unused pipeline import blocks app; listing and access defects |
| src/controllers/task.controler.js | getTasks, createTask, getTaskById drafts; updateTask, deleteTask, createSubTask, UpdateSubTask, deleteSubTask empty | Invalid named User import; unmounted and incomplete |
| src/controllers/healthCheck.js | healthCheck returns ApiRespones(200, message) | Static liveness handler; does not check MongoDB |
| src/routes/auth.route.js | Ten authentication route/method registrations | Change-password factory not instantiated |
| src/routes/project.route.js | Nine route/method registrations; router-wide verifyJWT | Collection member paths are singular; list has no membership gate |
| src/routes/healthCheck_route.js | GET / -> healthCheck | Mounted at /api/v1/healthcheck |
| src/middlewares/auth.middleware.js | verifyJWT and validateProjectPermission(roles) | JWT loads user; project gate loads membership; incomplete route coverage |
| src/middlewares/validtor.middleware.js | validate converts express-validator errors to ApiError | Function-object check bypasses every validation error |
| src/middlewares/multer.middleware.js | upload export using diskStorage in public/images | No consumer route; per-file 1,000,000-byte cap only |
| src/validators/index.validatorts.js | userRegistrationValidator, userLoginValidator, userChanggedCurrentPasswordValidator, userForgotPasswordValidtor, userRestForgotPasswordValidator, createProjectValidator, addMemberToProjectValidator | Seven factories; incomplete policy/coverage and broken common enforcement |
| src/utils/apiResponse.js | ApiRespones(statuscode, data, message) | Outputs statuscode, data, message, success; preserve spelling |
| src/utils/apiError.js | ApiError(statusCode, meassage, errors, stack) | Error fields exist, but no application JSON serializer is installed |
| src/utils/asyncHandler.js | asyncHandler forwards promise rejection to next(err) | Express receives forwarded errors; wrapper does not return its promise |
| src/utils/constants.js | UserRolesEnum, AvailableUserRole, TaskStatusEnum, AvailableTaskStatus | Correct PRD enum strings |
| src/utils/mail.utils.js | sendingEmail; emailVerficationMailgenContent; forgotPasswordMailgenContent | Mailgen template generation and SMTP; swallowed send failures |

## Data models, relationships, and business rules

All six top-level schemas use timestamps. ObjectId refs are relationships by convention, not database foreign-key constraints.

| File / registered model | Collection convention | Fields and relationships |
| --- | --- | --- |
| src/models/user.models.js / `user` (default export) | users | avatar {url, localPath}; unique lowercased/trimmed username; unique trimmed email; fullName; password; isEmailVerified; refreshToken; forgotPasswordToken/Expiry; emailVerficationToken/Expiry |
| src/models/project.models.js / Project | projects | globally unique trimmed name; description; required createdBy referencing User |
| src/models/projectmember.models.js / ProjectMember | projectmembers | required user and project refs; role enum defaults to member; no declared compound unique index |
| src/models/task.models.js / Task | tasks | required title/project; description; optional assignedTo/assignedBy User refs; status defaults todo; attachements array with url, mimeTypes, size |
| src/models/subtask.models.js / Subtask | subtasks | required title/task/createdBy; isCompleted defaults false |
| src/models/note.models.js / ProjectNote | projectnotes | required project/createdBy/content |

Relationships: a user participates in many projects through ProjectMember; a project contains tasks and notes; a task contains separately stored Subtask documents. Subtasks are **not embedded** in Task, despite README wording.

Important existing rules and limitations:

- Project creation writes a Project then an admin ProjectMember for its creator. It is not atomic.
- Permissions query ProjectMember using both projectId and authenticated user ID. A creator field alone grants no fallback permission.
- Project names are unique across the collection, not per creator. The PRD does not specify whether this scope is intended.
- Adding an existing membership is an upsert that also changes its role; there is no separate duplicate-member rejection or invitation record.
- updateMemberRole expects body `newRole`, while addition expects `role`. The role-update handler checks AvailableUserRole explicitly.
- No last-admin, ownership-transfer, or member-task reassignment rule is enforced.
- Task status strings are exactly todo, in_progress, done. No transition restrictions are specified by the PRD or implemented.
- Every User ref is spelled `User`, but the registered model is lowercase `user`; populate fails (B18). Aggregate lookups against users use collection names and are unaffected by model-name resolution.
- No project/member/task/note relationship index is declared except project-name uniqueness; actual live indexes are unknown.
- The task model/controller consistently use the existing misspelling `attachements`. Do not rename it without permission. MIME field spellings disagree and need a compatible fix.
- fullName exists on User but registerUser only persists email, username, password, and verification status. This is an observed behavior, not a claimed PRD requirement to accept fullName.

## Actual routes and API contracts

These are registrations in source, **not demonstrated working endpoints**. The global import failure blocks them. Required task/note routes are listed in task.md/PRD.md.

### Authentication — /api/v1/auth

| Method / actual relative path | Handler | Authentication / expected input |
| --- | --- | --- |
| POST /register | registerUser | Public; email, username, password; destructured role is ignored |
| POST /login | login | Public; email/password validators; controller also wrongly requires username |
| GET /verify-email/:verficationToken | verifyEmail | Public; raw temporary token in URL; spelling agrees internally |
| POST /refresh-token | refreshAccessToken | Refresh cookie or body refreshToken; no access JWT prerequisite |
| POST /forgot-Password | forgotPasswordRequest | Public; email; Express routing is case-insensitive by default, so PRD's lowercase spelling is not a demonstrated failure |
| POST /reset-password/:resetToken | resetForgotPassword | Public; token param and body newPassword |
| POST /logout | logoutUser | verifyJWT |
| GET /current-user | getCurrentUser | verifyJWT |
| POST /change-password | changeCurrentPassword | verifyJWT; oldPassword/newPassword; currently stalls in validator factory |
| POST /resend-email-verification | resendEmailVerification | verifyJWT; user must not already be verified |

### Projects — /api/v1/projects

verifyJWT applies to every project route.

| Method / actual relative path | Handler | Additional permission/input |
| --- | --- | --- |
| GET / | getProjects | Authenticated user's memberships |
| POST / | createProject | name, optional description; no existing admin gate |
| GET /:projectId | getProjectById | validateProjectPermission(AvailableUserRole) |
| PUT /:projectId | updateProject | admin membership; name, description |
| DELETE /:projectId | deleteProject | admin membership |
| GET /:projectId/member | getsProjectMembers | No project membership gate; B04 |
| POST /:projectId/member | addMemberToProject | admin membership; email, role |
| PUT /:projectId/members/:userId | updateMemberRole | admin membership; newRole |
| DELETE /:projectId/members/:userId | deleteMember | admin membership |

The collection member paths are singular; PRD requires plural members. Existing detail paths already use plural members. Correcting paths must preserve consumers or have explicit approval for a contract change.

### Other paths

- GET /api/v1/healthcheck/ -> healthCheck, no authentication; returns a basic liveness message.
- GET / -> unrelated placeholder text.
- Static public directory is served before cookie parsing/CORS; public/images files would be accessible through /images.
- /api/v1/tasks and /api/v1/notes are not mounted. No upload endpoint exists.

## Important request flows

### Startup/configuration

ES module evaluation loads src/app.js, routers, controllers, and models before index.js executes dotenv.config. The invalid nodemailer pipeline import currently aborts this process. If repaired, the app captures CORS_ORIGIN before .env loads; other environment accesses inside runtime functions happen later. index.js then connects MongoDB and starts listening only after connection resolves. Errors can call process.exit(1).

Do not import src/index.js merely to check syntax or exports: it initiates a real database connection and server startup. Importing app alone does not intentionally connect/listen; it currently fails during module linking.

### Registration, verification, login

1. Registration validators sanitize/check inputs, then validate should reject errors; B03 currently lets them through.
2. registerUser searches email/username duplicates, creates User, and the pre-save hook hashes modified passwords with bcrypt cost 10.
3. genrateTemporaryToken creates 20 random bytes represented as hex, stores a SHA-256 hash, and sets a 20-minute expiry. Plain tokens are intended only for email links.
4. Registration saves verification hash/expiry and sends a Mailgen/Nodemailer email. Generated verification links use the wrong /api/v1/users prefix. Delivery errors are swallowed.
5. verifyEmail hashes the URL token, finds an unexpired matching user, clears verification fields, and sets isEmailVerified true.
6. login queries by email and compares bcrypt hash, but additionally demands any truthy username. It does not require isEmailVerified.
7. genAccessAndRefreshToken signs an access JWT containing _id/email/username and a refresh JWT containing _id; it stores one raw refresh token on User.
8. Login returns a public-ish user projection plus both tokens in JSON and sets accessToken/refreshToken cookies with httpOnly:true and secure:true. No explicit sameSite option is configured.

### JWT, project authorization, refresh, logout

verifyJWT takes the accessToken cookie first, otherwise replaces the literal Bearer prefix in Authorization. It verifies the JWT with ACCESS_TOKEN_SECRET, loads the user, excludes password/refresh/verification fields, and assigns req.user. Reset-token fields are mistakenly included. Database/token failures inside its try are all reported as invalid access tokens.

validateProjectPermission extracts projectId, constructs ObjectIds, looks up the caller's ProjectMember, assigns its role to req.user.role for the current request, and checks the supplied allowed roles. It does not define a global admin. Invalid IDs are unguarded. The member-list route omits this middleware.

refreshAccessToken verifies the incoming refresh JWT with REFRESH_TOKEN_SECRET, finds the user, compares the stored refresh value, generates/saves a new pair, and saves refresh again. It sets both cookies and returns accessToken plus misspelled refrershToken. Missing req.body can throw before the try block. Rotation is not atomic.

logoutUser empties the saved refresh token and clears both cookies. Existing access JWTs remain cryptographically valid until expiry; there is no revocation/session-version field. One saved refresh token means later logins generally replace earlier refresh sessions; concurrent and same-second behavior needs tests.

### Password recovery/change

forgotPasswordRequest finds a user by email, generates the same kind of expiring hashed temporary token, persists it, and sends a link under FORGOT_PASSWORD_REDIRECT_URL. Unknown users receive a distinguishable 404. Mail failure is not propagated.

resetForgotPassword hashes resetToken, queries hash plus future expiry, clears reset fields, replaces password, and saves without schema validation; the password pre-save hook still hashes modified values. New-password rules are too weak and their errors are bypassed. Existing refresh sessions are not revoked.

changeCurrentPassword would compare oldPassword and hash/save newPassword, but its route currently invokes a validator factory as middleware and never reaches the controller. Once reachable, it shares the session-revocation/password-policy concerns.

### Project and member operations

getProjects aggregates from memberships. The actual singular project field disagrees with plural lookup paths/output and singular unwind/projection. It cannot return the intended joined project data/member counts. Exact MongoDB output shape was not tested; do not assume it is always an empty array.

getProjectById and project update/delete are behind membership gates. updateProject uses findByIdAndUpdate without update validators; shared body validation is broken.

deleteProject deletes the project first, finds its task IDs, deletes their subtasks, then tasks, notes, and projectmembers. The intended cascade relationship is sensible, but failures/races can leave partial state; no transaction, compensation, or attachment-file cleanup exists.

addMemberToProject finds an existing account by email and upserts the membership/role. It sends no invite and cannot invite unregistered accounts. Its update does not enable schema validators. getsProjectMembers aggregates users with a limited profile projection, but does not authorize caller membership. Role updates/removals scope their queries to userId plus projectId.

### Draft tasks, files, subtasks, notes

getTasks checks project existence, queries Task.project, and populates assignedTo; populate fails due to B18 and it returns the wrong 201 read status. createTask checks only project existence, casts optional assignee without checking membership, maps req.files, and stores a task. Attachment URLs use originalname although Multer stores a timestamp-prefixed filename; incoming mimetype is not the schema's mimeTypes field.

getTaskById aggregates task, assignee, subtasks, and subtask creators. It matches taskId alone; it does not constrain task.project to the authorized projectId. This is dangerous to mount behind a route-level project gate until B21 is fixed.

updateTask/deleteTask/createSubTask/UpdateSubTask/deleteSubTask have empty bodies and would not respond if mounted. Notes have no controller at all. Multer's upload export is unused, has a per-file size limit, and lacks a complete content/count/cleanup policy.

## Environment-variable names and scripts

No environment values, credentials, tokens, or connection strings belong in this document. All thirteen directly referenced variable names below were present as names in the local .env; validity, strength, values, and external service functionality were not assessed.

| Variable | Use / timing |
| --- | --- |
| PORT | src/index.js listening port; fallback exists |
| CORS_ORIGIN | src/app.js comma-separated allowed origins; currently read before dotenv |
| MONGO_URI | src/db/database.js MongoDB connection |
| ACCESS_TOKEN_SECRET | Access JWT signing/verification |
| ACCESS_TOKEN_EXPIRY | Access JWT expiresIn option |
| REFRESH_TOKEN_SECRET | Refresh JWT signing/verification |
| REFRESH_TOKEN_EXPIRY | Refresh JWT expiresIn option |
| MAILTRAP_SMTP_HOST | Nodemailer SMTP host |
| MAILTRAP_SMTP_PORT | Nodemailer SMTP port |
| MAILTRAP_SMTP_USER | SMTP authentication username |
| MAILTRAP_SMTP_PASS | SMTP authentication password |
| FORGOT_PASSWORD_REDIRECT_URL | Frontend password reset link prefix |
| SERVER_URL | Draft attachment public URL base |

NODE_ENV is additionally relevant to Express's default error/production behavior, but it is not directly referenced by project source or among the thirteen observed .env keys. The code has no centralized environment validation. Expiry values must be compatible with jsonwebtoken; production secret requirements need review without exposing values.

| Command/script | Existing definition | Audit treatment |
| --- | --- | --- |
| npm run dev | nodemon ./src/index.js | Not executed; starts app/connects DB |
| npm start | node index.js | Not executed; target missing |
| package main | index.js | Metadata points to missing root file |
| node test-eval.js | Imports app, prints success only if import completes | Executed; failed on B01 |
| node --check <source file> | Built-in parser check | Executed for all 25 source files successfully |

There are no test, lint, build, format, migration, or CI scripts in package.json. Prettier configuration exists, but formatting would modify forbidden files and was not run. .gitignore covers node_modules, .env, learning notes, Zone.Identifier files, and test-eval.js. The local import smoke script is not a tracked regression suite.

## Existing feature state and unresolved issues

Detailed evidence and recommended fixes are in task.md; IDs there are the source of truth.

| Area | State / next concern |
| --- | --- |
| Startup | Blocked by B01; production entry wrong, B02 |
| Validation/errors | B03 bypass; B05 hanging middleware; missing typed/param validators; B14/B15 malformed-input/JSON errors |
| Authentication | Handlers present; B07–B12, B23/B24; password recovery does not end old refresh sessions |
| Projects | CRUD declared; B06 listing joins broken; P01 non-atomic creation/deletion |
| Membership/RBAC | Per-project gates exist; B04 member-list disclosure; B16 invalid roles; B27 wrong collection URL; P02/P03 uniqueness/admin integrity |
| Tasks | Unmounted drafts; B17 import, B18 references, B21 project scope, B22 assignee integrity; empty update/delete |
| Subtasks | Model only plus three empty handlers; completion API missing |
| Notes | Model only; all five endpoints absent |
| Attachments | Unused storage helper; B19 URLs/B20 metadata, P09 upload safeguards |
| Configuration/deployment | B13 CORS timing; P10/P12 deployment/mail behavior unknown |
| Documentation/tests | B25/B26 contracts/stale docs; no committed automated suite or deployment gates |

Potential issues must not be promoted to demonstrated incidents without evidence: project-write failure recovery, duplicate membership races/live indexes, last-admin policy, invitation semantics, global admin scope, verification gating, token races, rate limiting/gateway protections, CSRF/proxy behavior, upload exposure, query performance, and actual SMTP/DB state.

The PRD explicitly allows all roles to update subtask status, while task mutations belong to admin/project_admin. Its high-level reference to members updating task completion is less precise than the matrix/endpoints; clarify any broader member task-edit behavior before adding it. Note mutations are admin-only; notes/tasks must be project-scoped even when IDs are known.

## Checks, outcomes, and audit limitations

Executed checks:

- Git status/commit and file inventories; read the full PRD and every application source file, existing docs/config, local notes, and package/lock metadata.
- Node/npm version checks; node --check succeeded on all 25 source JS files.
- Existing node test-eval.js failed with the nonexistent nodemailer pipeline export. A separate task-controller import failed with nonexistent named User export.
- All 48 relative imports point to existing files; this does not validate exported names.
- Root index.js existence check returned false.
- In-memory express-validator/route probes reproduced: three invalid registration fields still advance; change-password middleware returns an array without calling next; one-character reset password passes its validator. An additional isolated invalid-email probe also advanced.
- In-memory Mongoose inspection reproduced MissingSchemaError for User population and discarded mimetype metadata; no membership indexes are declared. Connection readyState remained 0.
- Package/lock root agreement, direct installed versions, dependency integrity/resolution metadata.
- Documentation completeness and final file-scope verification are recorded in the closeout below.

No application server was started. No database connection/query/write, SMTP send, upload, external service call, install, migration, formatter, destructive command, or Git mutation was performed. The probes used process-local objects only. No real secrets were used to generate tokens. No HTTP/integration/security/load/production suite was run, and no such test success may be inferred.

The database topology/version/data/indexes, mail delivery, browser cookie/CORS behavior, live gateway controls, deployment status, and dependency vulnerability advisories remain unverified. A source audit cannot prove that every runtime defect has been found.

## Original audit recommendations (see current handoff for completed work)

1. Obtain a separate implementation instruction; this audit does not authorize fixes.
2. Make the existing app importable (B01), align start entry to the existing file (B02), then repair shared validation enforcement (B03) with focused regressions. Preserve all identifiers.
3. Close member-list authorization and session/data-integrity gaps before exposing a service.
4. Restore auth/project/member functionality and clarify invitation/admin/verification policies.
5. Finish scoped task/subtask/note/attachment functionality and associated validation.
6. Complete isolated integration/security tests, deployment checks, and accurate API/setup documentation; update the audit statuses using executed evidence.

## Instructions for Future Codex Sessions

- **Read prd.md, history.md, and task.md before starting work.** In this repository, the PRD is actually named **PRD.md**; read that existing file and preserve its case/name.
- **Inspect existing code before proposing changes.** Check Git status and applicable AGENTS.md/skills first; preserve any user changes.
- **Never rename files, controllers, functions, routes, models, or other identifiers without explicit permission.** This includes existing misspellings, model registration strings, schema fields, response keys, and capitalization.
- **Preserve the existing project structure, naming conventions, and API contracts.** Propose compatible changes where a bug affects a contract; get explicit authorization for renames/removals or migrations.
- **Update the documentation after authorized implementation work.** Keep useful prior information, mark resolved issue IDs only after verifying them, and record actual checks and limitations.
- **Never claim tests passed unless they were actually executed successfully.** Distinguish parsing, imports, isolated probes, mocked tests, integration tests, and deployment checks.
- The original audit was strictly read-only. The later authentication implementation was explicitly authorized; preserve that authorization and the user's chosen verification policy when continuing within this scope.
- Do not install dependencies, start database-connected entrypoints, send mail, mutate services/data, run migrations, or change Git history under an audit-only instruction.
- Never reproduce .env values or secrets in docs, logs, tool output, or test artifacts.
- Resolve PRD ambiguity explicitly rather than inventing global roles, invitation flows, file-visibility rules, or member mutation permissions.
- Preserve `auth.controler.js`, `project.controlers.js`, `task.controler.js`, `validtor.middleware.js`, `index.validatorts.js`, `ApiRespones`, `statuscode`, `genrateTemporaryToken`, `UpdateSubTask`, and existing persistence/API keys unless the user expressly permits a change.

## Audit closeout

- Created task.md and history.md; there was no pre-existing content in either to overwrite.
- Preserved PRD.md, README.md, requiredThings.md, application/config/package/environment files, local learning notes, and test-eval.js.
- Final SHA-256 comparison verified all 41 pre-existing non-dependency/non-Git project files unchanged; only task.md and history.md were added. Both tracked and staged Git diffs were empty, git diff --check reported no errors, and final Git status listed only these two untracked documentation files.
- Documentation checks verified 64 unique PRD rows with counts 8/25/29/2, 27 confirmed bug IDs, 12 potential-issue IDs, six missing-feature groups, no duplicate finding IDs or unresolved finding references, and the required future-session instructions. A direct installed-versus-lock version comparison found no mismatches.
- No bugs were fixed, no identifiers renamed, and no application or external state changed.

