# Project Camp API ⛺️

A RESTful backend for collaborative projects, hierarchical tasks and subtasks, notes, invitations, attachments, and account authentication.

**Verified locally, 2026-10-18:** 50 automated tests passed; one real MongoDB integration test was skipped because no isolated database is configured. All 33 [PRD.md](PRD.md) method/path contracts are registered. See [task.md](task.md) for remaining release checks and [history.md](history.md) for the implementation handoff.

## Tech stack and features

Node.js ES modules, Express 5, MongoDB/Mongoose 9, JWT, bcrypt, express-validator, Nodemailer/Mailgen, and Multer. The repository retains its existing names, including `auth.controler.js`, `ApiRespones`, and `attachements`.

- Registration, verification, login, rotating refresh tokens, logout, and password change/reset.
- Project CRUD, member counts, per-project roles, invitations and membership management.
- Task CRUD, project-member assignment, `todo` / `in_progress` / `done`, subtasks and completion.
- Admin-managed notes and multiple public task attachments.

## Getting started

Use Node **24 LTS** (tested with 24.14.0 and npm 11.9.0). Installed Mongoose dependencies require at least Node 20.19.0. MongoDB must be a **replica set or sharded cluster** supporting transactions; a single-node replica set is suitable for development. Standalone MongoDB is rejected at startup.

```sh
git clone https://github.com/rahuldrall-iitkgp29/project-camp-backend.git
cd project-camp-backend
npm ci
```

Create a local, ignored `.env` in the repository root. Set these variables using your own service configuration; never commit credentials.

| Variable | Purpose |
| --- | --- |
| MONGO_URI | Application MongoDB URI, replica-set transaction support required |
| ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET | Different signing secrets; at least 32 characters each in production |
| ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY | Explicit positive durations, e.g. `15m` and `7d`; bare numeric strings rejected |
| SERVER_URL | Public HTTP(S) server URL, used for verification links and attachment URLs |
| FORGOT_PASSWORD_REDIRECT_URL | Frontend reset page prefix; token is appended |
| MAILTRAP_SMTP_HOST, MAILTRAP_SMTP_PORT | SMTP host and port |
| MAILTRAP_SMTP_USER, MAILTRAP_SMTP_PASS | SMTP credentials |
| CORS_ORIGIN | Comma-separated exact frontend origins; default `http://localhost:5173` |
| PORT | Optional listening port, default 3000 |
| NODE_ENV | Set `production` behind HTTPS to enable Secure cookies |
| MAIL_FROM | Optional authorized sender; configure for your SMTP service instead of relying on the legacy fallback |
| PROJECT_INVITATION_REDIRECT_URL | Optional frontend invitation prefix; projectId/token are appended. Without it, mail contains the API POST acceptance URL |

Link URLs must not contain credentials, query strings, or fragments. A SERVER_URL path prefix must be routed by your proxy to the same public files; verification links use the origin plus the documented auth path. Configure the invitation frontend before expecting a browser button to complete onboarding.

```sh
npm run dev
# or, with production configuration:
npm start
```

Both commands run `src/index.js`, which loads dotenv, validates configuration, connects to MongoDB, checks topology and initializes indexes, then listens. Existing duplicate memberships can prevent the new unique index from building: review/deduplicate existing data deliberately before deployment. No migration or live database cleanup was performed by this implementation.

## Authentication and authorization

Login accepts `email` and `password`. Supply the access token as `Authorization: Bearer <accessToken>` or use the HttpOnly cookie. Refresh uses a refresh cookie or JSON `{"refreshToken":"<refreshToken>"}`; it does not require an access token. The refresh response includes both `refreshToken` and the retained `refrershToken` alias.

Passwords are never trimmed. New passwords require at least six characters and at most 72 UTF-8 bytes. Verification/reset tokens expire after 20 minutes and are single-use. Logout/password reset/change revoke existing access and refresh sessions through `tokenVersion`; clients must log in again after password changes. One refresh session is stored per account.

Unverified users can log in and use account actions, including resend verification. All project, task, subtask, note and invitation acceptance endpoints require verified email. Cookies are SameSite=Lax and Secure in production; cookie writes with an Origin header must match CORS_ORIGIN. Configure HTTPS/proxy behavior and shared gateway abuse controls for deployment. Auth endpoints have a bounded, per-process limit of 100 requests per endpoint per IP/account per 15 minutes; 429 includes Retry-After.

Roles live in **ProjectMember**, not globally on User. By the user's explicit decision, any verified user can create a project and becomes its Admin. Existing-project permissions are:

| Action | admin | project_admin | member |
| --- | --- | --- | --- |
| Read project, members, tasks and notes | yes | yes | yes |
| Update/delete project; invite/manage members | yes | no | no |
| Create/update/delete tasks; create/delete subtasks | yes | yes | no |
| Change subtask completion | yes | yes | yes |
| Edit subtask title | yes | yes | no |
| Create/update/delete notes | yes | no | no |

A project must retain at least one Admin. Removing a member clears their assignments in that project, preserving historical authorship. Mutations recheck membership inside a transaction and serialize on the project to protect parent/child consistency.

## API reference

The complete 33-endpoint method/path list is in [PRD.md §4.1](PRD.md). All routes below use `/api/v1`.

| Module | Routes | Request fields |
| --- | --- | --- |
| Auth | POST `/auth/register`, POST `/auth/login` | register: email, username, password; login: email, password |
| Auth | POST `/auth/logout`, GET `/auth/current-user`, POST `/auth/resend-email-verification` | access token |
| Auth | POST `/auth/change-password` | oldPassword, newPassword |
| Auth | POST `/auth/refresh-token` | refreshToken, or refresh cookie |
| Auth | GET `/auth/verify-email/:verficationToken` | token from email; existing parameter spelling retained |
| Auth | POST `/auth/forgot-password`, POST `/auth/reset-password/:resetToken` | email; newPassword respectively |
| Projects | GET/POST `/projects`; GET/PUT/DELETE `/projects/:projectId` | create: name, optional description; update: one or both |
| Members | GET/POST `/projects/:projectId/members` | invite: email, role |
| Members | PUT/DELETE `/projects/:projectId/members/:userId` | role update: newRole |
| Tasks | GET/POST `/tasks/:projectId`; GET/PUT/DELETE `/tasks/:projectId/t/:taskId` | create: title, optional description/assignedTo/status; update: any of these |
| Subtasks | POST `/tasks/:projectId/t/:taskId/subtasks` | title |
| Subtasks | PUT/DELETE `/tasks/:projectId/st/:subTaskId` | update: title and/or boolean isCompleted, subject to role |
| Notes | GET/POST `/notes/:projectId`; GET/PUT/DELETE `/notes/:projectId/n/:noteId` | create/update: content |
| Health | GET `/healthcheck` | public liveness; does not prove DB readiness |

The singular GET/POST `/projects/:projectId/member` aliases remain. Task/member/project/note IDs must be 24 hex characters. Names/titles are trimmed, nonempty, at most 200 characters; descriptions/content at most 10,000. Descriptions may be empty, note content may not. Empty updates, invalid types, invalid enums and client-supplied relationship fields are rejected by the new resource validators. Task `assignedTo: null` explicitly clears an assignment; omitted fields remain unchanged. Email matching remains case-sensitive for compatibility.

### Invitation acceptance

POST member collection requests now return HTTP 201 with `data.invitation` and `status: "pending"`, send email, and grant **no membership until acceptance**. This behavior change was explicitly requested. Existing members are changed with PUT, not by re-inviting.

The additional endpoint is:

```text
POST /api/v1/projects/:projectId/invitations/:invitationToken/accept
Authorization: Bearer <accessToken>
```

No body is required. The authenticated, verified account email must exactly match the invitation. New users register and verify first. Tokens expire after seven days, are stored only as hashes, and are consumed transactionally. Re-inviting replaces the pending token. SMTP failures return 502 and permit retry; transport acceptance is not a guarantee of inbox delivery. A frontend can preserve the link while the user registers/logs in, then submit the POST. A GET on the API acceptance URL does not accept an invitation.

### Attachments

Use multipart/form-data on task POST or PUT with repeated file field **`attachements`** and the normal task fields. For example, with curl:

```sh
curl -X POST http://localhost:3000/api/v1/tasks/PROJECT_ID \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -F "title=Review design" \
  -F "attachements=@design.png;type=image/png" \
  -F "attachements=@brief.pdf;type=application/pdf"
```

Up to five files total per task, each at most 1,000,000 bytes. Allowed types: PNG, JPEG, GIF, WebP, PDF. MIME signatures are checked; SVG/HTML and other types are rejected. Filenames are generated UUIDs, independent of client names. Updates append files and enforce the same total cap. Send JSON with null to unassign a task; multipart's string `"null"` is not JSON null.

Responses preserve `attachements: [{url, mimeTypes, size}]`. Files are stored under public/images and their URLs are publicly downloadable with nosniff, attachment disposition, and a sandbox CSP. These URLs are not private links. Task/project deletion queues durable deletion jobs, attempted after commit and every minute by the running server. Failed-write uploads are removed or queued; uncertain commits and crashes may need disk reconciliation. Content signatures are not antivirus scanning. Persist/share the upload directory appropriately when deploying multiple instances.

### Responses and errors

Success preserves the existing casing:

```json
{"statuscode":200,"data":[],"message":"task fetched successfully","success":true}
```

Errors use `statusCode`, `data: null`, `success: false`, `message`, and `errors`. Expected statuses: 400 malformed IDs/tokens/multipart; 401 invalid session; 403 verification/membership/role/origin denial; 404 absent resource; 409 duplicates/last-Admin conflict; 413 size/count limit; 415 unsupported/spoofed files; 422 validation; 429 throttling; 502 SMTP failure; 503 unsupported transactions or uncertain write outcome. Unexpected failures return sanitized 500. Registration mail failure leaves a recoverable account; log in and resend verification.

## Data model

User stores accounts and versioned sessions. ProjectMember links users/projects and their roles with a unique compound index. Project owns tasks, notes and invitations. Task uses the existing `attachements` field and assignee references. Subtask is a **separate collection** linked to Task. ProjectNote holds project-scoped content. ProjectInvitation stores pending hashed tokens; FileDeletion stores retryable disk deletion jobs.

## Tests and remaining release work

```sh
npm test
node --input-type=module -e "import('./src/app.js').then(() => console.log('Application import passed'))"
npm run test:integration
```

The first command uses Node's built-in test runner, real loopback HTTP, real validation/JWT/bcrypt/Multer/file I/O, and mocked MongoDB/SMTP boundaries. The integration test skips unless **MONGO_TEST_URI** is explicitly set to a URI naming a database beginning `pcb_test_`. It creates a fresh random `pcb_test_` database on that test server, checks replica-set support and indexes, runs real transaction/race checks, then drops only that generated database. It never loads .env or uses MONGO_URI. The test database account must have those permissions.

Current results: **50 passed, 0 failed, 1 skipped**. No lint/build script exists. No live database, index migration, SMTP send, deployment, dependency installation, or advisory scan was run. The sandbox initially blocked test-worker creation with EPERM; the approved run outside that restriction passed.

Before release: run isolated MongoDB integration and SMTP delivery checks; inspect existing duplicates/indexes; verify HTTPS/proxy/browser behavior, shared throttling and storage persistence; plan orphan-file reconciliation. See [task.md](task.md) for the complete backlog and [implementation decisions](docs/implementation-decisions.md).
