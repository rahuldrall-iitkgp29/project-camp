# Project Camp: Product and Codebase Reference

Project Camp is a web application for managing projects, team membership, tasks, subtasks, and shared notes. This document describes the current backend and frontend implementation. [README.md](README.md) provides the quick start and repository overview.

## Contents

- [Product scope and permissions](#product-scope-and-permissions)
- [Architecture and source layout](#architecture-and-source-layout)
- [Backend](#backend)
- [API reference](#api-reference)
- [Frontend](#frontend)
- [Environment configuration](#environment-configuration)
- [Local database setup](#local-database-setup)
- [Development commands and testing](#development-commands-and-testing)
- [Deployment and current limitations](#deployment-and-current-limitations)
- [Seed data](#seed-data)

## Product scope and permissions

Teams use Project Camp to create a workspace, invite collaborators, assign work, track tasks through `todo`, `in_progress`, and `done`, and keep project notes. Tasks can include checklist subtasks and uploaded files.

Roles belong to a user's membership in an individual project. A user can have different roles in different projects. There is no global administrator role. Any authenticated user with a verified email can create a project; creation also creates their `admin` membership.

| Action within an existing project                         | Admin | Project Admin | Member |
| --------------------------------------------------------- | ----- | ------------- | ------ |
| Read project details, members, tasks, subtasks, and notes | Yes   | Yes           | Yes    |
| Update or delete the project                              | Yes   | No            | No     |
| Invite members, change roles, or remove members           | Yes   | No            | No     |
| Create, edit, assign, change status, or delete tasks      | Yes   | Yes           | No     |
| Add task attachments                                      | Yes   | Yes           | No     |
| Create, rename, or delete subtasks                        | Yes   | Yes           | No     |
| Toggle subtask completion                                 | Yes   | Yes           | Yes    |
| Create, edit, or delete project notes                     | Yes   | No            | No     |

A project must retain at least one Admin. Admins can invite or promote another user to any of the three roles. Removing a member clears their task assignments in that project while retaining historical authorship. A Member's completion permission applies to subtasks, including those on tasks assigned to someone else; it does not permit changing a task's status.

Unverified users can log in, view their account, resend verification, change their password, and log out. Every project, task, subtask, note, and invitation-acceptance endpoint requires verified email.

## Architecture and source layout

The React single-page application calls the Express REST API through `fetch`. The API uses Mongoose to persist data in MongoDB, stores task uploads on local disk, and sends verification, reset, and invitation messages through SMTP.

| Area           | Implementation                                                                                |
| -------------- | --------------------------------------------------------------------------------------------- |
| Runtime        | Node.js ES modules; Node 20.19+ required by Mongoose 9, Node 24 LTS recommended               |
| API            | Express 5, Mongoose 9, express-validator, cookie-parser, cors                                 |
| Authentication | bcrypt with 10 rounds, jsonwebtoken, Node crypto                                              |
| Uploads        | Multer and filesystem utilities                                                               |
| Email          | Nodemailer and Mailgen                                                                        |
| Frontend       | React 18, Vite 5, React Router 6, Lucide React, plain CSS                                     |
| Tests          | `node:test`, `node:assert/strict`, mocked collection adapters, real local MongoDB integration |

Dependency versions are recorded in the root and frontend package files and lockfiles. The backend package name is `project-mangement`; the application is named Project Camp.

| Location                              | Responsibility                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/index.js`                        | Environment loading, validation, database connection, HTTP startup, cleanup worker, and shutdown             |
| `src/app.js`                          | Express app, CORS and Origin checks, parsers, public downloads, route mounts, and error handling             |
| `src/db/database.js`                  | MongoDB connection, transaction-topology check, and model/index initialization                               |
| `src/routes/`                         | Authentication, project, task/subtask, note, and health routes                                               |
| `src/controllers/`                    | Request handlers and business operations                                                                     |
| `src/middlewares/`                    | JWT authentication, project permissions, verification gate, rate limiting, validation, and uploads           |
| `src/validators/index.validatorts.js` | Body, resource ID, token, and update-field validation                                                        |
| `src/models/`                         | Eight Mongoose models and their indexes                                                                      |
| `src/utils/`                          | Responses, errors, async handling, constants, transactions, attachments, email, and configuration validation |
| `frontend/src/api/`                   | Shared HTTP client and domain-specific API wrappers                                                          |
| `frontend/src/context/`               | Authentication, project, and toast state                                                                     |
| `frontend/src/pages/`                 | Authentication pages, invitations, dashboard, project workspace, and not-found page                          |
| `frontend/src/components/`            | Navigation, dialogs, access gate, project cards, member management, tasks, and notes                         |
| `frontend/src/index.css`              | Shared colors, typography, layout, controls, and responsive styles                                           |
| `scripts/`                            | MongoDB lifecycle tools, guarded local launcher, verification helper, and demo seeder                        |
| `tests/`                              | Backend regression tests, documented-route checks, database safety tests, and integration fixtures           |
| `public/images/`                      | Task files; generated uploads are Git-ignored                                                                |

Importing `src/app.js` creates the Express app without opening a database connection or HTTP listener. Tests use that separation to control their own server and persistence setup.

## Backend

### Request processing and startup

Startup validates configuration, connects through `MONGO_URI`, checks for a replica set or sharded cluster, and initializes all registered model indexes before listening. `PORT` defaults to `3000`; the local configuration below uses `8000`.

Requests pass through cookie parsing, Origin/CORS handling, and JSON or URL-encoded parsing. Both body parsers have a `16kb` limit. Protected route groups authenticate the user and enforce verified email; project-specific routes then check membership and the required role. Task writes run upload middleware before validating task fields. Controllers return a common response envelope, and a central handler maps failures to JSON errors.

The server drains pending attachment deletions on startup and every 60 seconds. It handles `SIGINT` and `SIGTERM` by stopping the listener, disconnecting MongoDB, and enforcing a 10-second shutdown deadline.

### Authentication and sessions

Registration accepts `username`, `email`, and `password`. It hashes the password and saves an unverified account before sending email. Registration does not create a session. If SMTP fails after saving, the API returns `502` explaining that the account exists and the user can log in to resend verification.

Login uses email and password. It returns the public user profile and JWT access/refresh tokens, and sets `accessToken` and `refreshToken` cookies. Cookies are HttpOnly and SameSite=Lax; production adds Secure. They have no explicit persistent-cookie expiry. API clients may alternatively send `Authorization: Bearer <accessToken>`; a nonempty access cookie takes precedence over the header.

Access JWTs include the user ID and `tokenVersion`. Authentication loads the user and checks that version on every protected request. Each account stores one refresh token; every successful refresh atomically replaces it. Refresh accepts the refresh cookie first, otherwise JSON `refreshToken`, and rejects expired or reused tokens. Concurrent attempts to use the same refresh token have one winner.

Logout, password reset, and password change clear the stored refresh token and increment `tokenVersion`, revoking existing access and refresh sessions. A later login replaces the saved refresh token but does not itself revoke earlier access tokens. Password change also clears pending password-reset state.

Email-verification and password-reset tokens are random 20-byte values sent as 40 hexadecimal characters. Only SHA-256 hashes are stored; tokens expire after 20 minutes and are consumed once. Resending or requesting another reset replaces the previous token. Forgot-password requests normally return the same `200` message for existing and unknown email addresses; SMTP failures can still produce `502`.

Emails are trimmed and matched exactly as stored. The application does not lowercase account email addresses. SMTP recipient acceptance normalizes equivalent domains separately without changing account identity rules.

Public account responses omit passwords, refresh tokens, token versions, verification/reset internals, `__v`, and `avatar.localPath`. Related user profiles expose only selected fields such as ID, username, full name, and avatar URL.

### Project membership and invitations

Creating a project and its creator's Admin membership is one transaction. Project names are globally unique, rather than unique per owner.

Posting to a project's member collection creates or replaces a pending invitation. It does not immediately grant membership. Invitations can target an existing account or an email address that has not registered. They contain a SHA-256 token hash, expire after seven days, and are unique per project/email pair. Re-inviting rotates the token and can change the proposed role. Existing members must use the role-update endpoint instead.

Acceptance requires an authenticated, verified account whose email exactly matches the invitation. Creating the membership and deleting the invitation happen in one transaction. Expiry is checked during acceptance independently of MongoDB's TTL cleanup. Invitation email is sent after the pending record commits; a mail failure can leave that pending record in place for a later re-invitation.

### Transactions and integrity

`runTransaction` uses Mongoose sessions and `withTransaction`. `withProjectWrite` first increments the project's `__v` inside the transaction, then rechecks membership and permissions. Touching the same project document coordinates concurrent writers, including deletion, role changes, assignments, and invitation acceptance.

| Operation            | Work committed together                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Create project       | Project and creator membership                                                             |
| Accept invitation    | New membership and consumed invitation                                                     |
| Remove member        | Membership deletion and removal of their task assignments                                  |
| Delete task          | Task, its subtasks, and queued attachment deletions                                        |
| Delete project       | Project, memberships, invitations, tasks, subtasks, notes, and queued attachment deletions |
| Other project writes | Permission recheck and the relevant resource mutation                                      |

Task, subtask, and note operations verify the resource belongs to the project in the URL. A task assignee must be an existing user and a current member of that project. MongoDB does not enforce these references as foreign keys; the controllers and transaction helpers enforce them.

Unsupported transactions fail with `503`. An uncertain commit reported by `withProjectWrite` also returns `503` and preserves uploaded files because the database may already reference them; clients should inspect the resource before retrying. Unique-index failures map to `409`. Existing duplicate data can prevent startup index initialization and needs separate review.

### Data models

All models have `createdAt` and `updatedAt` timestamps. IDs are MongoDB ObjectIds, serialized as strings in JSON.

| Model / collection                         | Main fields and relationships                                                                                                                    | Indexes and defaults                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `user` / `users`                           | `username`, `email`, `fullName`, `avatar`, `password`, `isEmailVerified`, `refreshToken`, `tokenVersion`, verification/reset hashes and expiries | Unique username and email; username/fullName lowercase; verification defaults false; token version defaults 0 |
| `Project` / `projects`                     | `name`, `description`, `createdBy` referencing `user`                                                                                            | Globally unique trimmed name; `__v` also coordinates writes                                                   |
| `ProjectMember` / `projectmembers`         | `project`, `user`, `role`                                                                                                                        | Unique `(project, user)`; `(user, project)` lookup index; role defaults to `member`                           |
| `ProjectInvitation` / `projectinvitations` | `project`, `email`, `role`, `invitedBy`, hidden `tokenHash`, `expiresAt`                                                                         | Unique `(project, email)`; TTL on `expiresAt`                                                                 |
| `Task` / `tasks`                           | `title`, `description`, `project`, `assignedTo`, `assignedBy`, `status`, `attachements`                                                          | `(project, assignedTo)` index; status defaults to `todo`; attachments default to an empty array               |
| `Subtask` / `subtasks`                     | `title`, `task`, `isCompleted`, `createdBy`                                                                                                      | `task` index; completion defaults false                                                                       |
| `ProjectNote` / `projectnotes`             | `project`, `createdBy`, `content`                                                                                                                | `project` index                                                                                               |
| `FileDeletion` / `filedeletions`           | `filename`                                                                                                                                       | Unique filename for retryable disk deletion                                                                   |

The User schema includes `fullName` and `avatar`, but there is no profile-edit or avatar-upload endpoint. Registration saves only its documented fields. The default avatar URL is `https://placehold.co/200x200`.

### File attachments

Tasks accept JSON when no files are uploaded, or `multipart/form-data` using the field name **`attachements`**. Keep that spelling. Client-provided attachment metadata is not accepted as a task body field.

| Rule                   | Value                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| Accepted types         | PNG, JPEG, GIF, WebP, PDF                                                 |
| File size              | At most 1,000,000 bytes each                                              |
| File count             | At most five uploaded files per request and five stored files per task    |
| Storage                | `public/images/<uuid>.<extension>`                                        |
| Metadata               | `{ url, mimeTypes, size }`                                                |
| Multipart field limits | Four text fields, 16,000 bytes per field, ten parts, 100-byte field names |

The server checks the declared MIME type and corresponding file signature, and assigns a UUID filename. `SERVER_URL` supplies the base for saved download URLs. Updates append files; there is no individual attachment-removal endpoint.

Downloads under `/images/` are public and bypass project authentication. Static responses use attachment disposition, `X-Content-Type-Options: nosniff`, and a restrictive sandbox Content Security Policy. File signatures do not provide malware scanning.

Failed requests clean up their uploaded files. Task/project deletion queues filenames in the same database transaction, then attempts disk deletion after commit. The background worker processes up to 100 queued jobs per pass, removes jobs after successful deletion, and retains failed jobs for retry. Missing files count as already removed. A crash between receiving an upload and saving its task can still leave an orphan file; there is no complete disk-reconciliation process.

### Email, CORS, and rate limits

Nodemailer sends HTML and plain-text messages generated by Mailgen. Port `465` enables implicit TLS. SMTP operations use connection/greeting timeouts of 10 seconds and a socket timeout of 20 seconds. A send succeeds only if the intended recipient appears in the transport's accepted list; transport acceptance does not prove inbox delivery.

`CORS_ORIGIN` is a comma-separated allowlist with credential support. Requests can use `Authorization` and `Content-Type` headers. Browser writes carrying auth cookies and an explicit disallowed Origin receive `403`. Missing-Origin requests and pre-login requests are not covered by that check. Express proxy trust is not configured.

The auth router has a per-process rate limiter: 100 requests per 15-minute window per route/IP, plus a route/account bucket when the body contains an email. It retains at most 10,000 buckets and returns `429` with `Retry-After` when limited. The account bucket lowercases its key; account lookup itself still uses exact email matching. Other route groups do not use this limiter.

## API reference

All paths below are relative to their stated route prefix. Account routes marked **JWT** need a current access token but allow unverified email. **Verified** means authenticated with verified email. **All roles** means verified membership in the project; **Admin** and **Project Admin** are project roles.

### Response format

Successful responses use lowercase `statuscode`:

```json
{
  "statuscode": 200,
  "data": {},
  "message": "Success",
  "success": true
}
```

Errors use `statusCode`:

```json
{
  "statusCode": 422,
  "data": null,
  "success": false,
  "message": "Received data is not valid",
  "errors": []
}
```

`errors` can contain field-validation details. Clients should use the HTTP status and response fields; message wording varies by handler. Dates serialize as ISO strings. Resource documents may include timestamps and `__v`; create/update responses often contain reference IDs where read responses contain populated profiles.

| HTTP status  | Meaning                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| `200`, `201` | Successful operation; creation normally uses `201`                                       |
| `400`        | Malformed JSON, URL, identifier, multipart data, or invalid/expired token                |
| `401`        | Missing, invalid, expired, or revoked credentials                                        |
| `403`        | Unverified email, missing membership, insufficient role, or rejected cookie-write Origin |
| `404`        | Missing route or resource; a child outside the specified project is treated as missing   |
| `409`        | Duplicate account/project/membership or last-Admin conflict                              |
| `413`        | Body or multipart size/count limit exceeded                                              |
| `415`        | Unsupported encoding/charset, MIME type, or mismatched file signature                    |
| `422`        | Field validation, invalid assignee, or stored attachment-count violation                 |
| `429`        | Auth rate limit exceeded                                                                 |
| `500`        | Sanitized internal error                                                                 |
| `502`        | Email delivery attempt failed or recipient was not accepted                              |
| `503`        | Unsupported transaction topology or uncertain project-write outcome                      |

Membership checks may return `403` before looking up a missing project. Stack traces and internal database errors are not returned to clients.

### Authentication endpoints

**Authentication Routes** (`/api/v1/auth/`)

- `POST /register` — Public. Body: `{ username, email, password }`. Returns `201`, `data: { user }`.
- `POST /login` — Public. Body: `{ email, password }`. Returns `200`, `data: { user, accessToken, refreshToken }`, and both auth cookies.
- `POST /logout` — JWT. No body. Returns `200`, `data: {}`, clears cookies, and revokes sessions.
- `GET /current-user` — JWT. Returns `200` with the public user directly in `data`.
- `POST /change-password` — JWT. Body: `{ oldPassword, newPassword }`. Returns `200`, `data: {}`, and revokes sessions.
- `POST /refresh-token` — Refresh cookie or body `{ refreshToken }`. Returns `200`, `data: { accessToken, refreshToken, refrershToken }`, and replacement cookies.
- `GET /verify-email/:verficationToken` — Public token. Returns `200`, `data: { isEmailVerified: true }`.
- `POST /forgot-Password` — Public. Body: `{ email }`. Returns `200`, `data: {}`, with a generic reset-request message.
- `POST /reset-password/:resetToken` — Public token. Body: `{ newPassword }`. Returns `200`, `data: {}`, and revokes sessions.
- `POST /resend-email-verification` — JWT. No body. Returns `200`, `data: {}`; already verified accounts receive `409`.

### Project and member endpoints

**Project Routes** (`/api/v1/projects/`)

- `GET /` — Verified. Returns `200`, `data: [{ project, role }]`; each project includes ID, name, description, member count as `members`, creator ID, and creation date.
- `POST /` — Verified. Body: `{ name, description? }`. Returns `201` with the created project; creator receives Admin membership.
- `GET /:projectId` — All roles. Returns `200` with the project document.
- `PUT /:projectId` — Admin. Body: `{ name?, description? }`, at least one field. Returns `200` with the updated project.
- `DELETE /:projectId` — Admin. Returns `200` with the deleted project after its database cascade commits.
- `GET /:projectId/members` — All roles. Returns `200`, `data: [{ project, user, role, createdAt, updatedAt }]`, with a public user profile.
- `POST /:projectId/members` — Admin. Body: `{ email, role }`. Returns `201`, `data: { invitation: { email, role, project, expiresAt, status: "pending" } }`.
- `PUT /:projectId/members/:userId` — Admin. Body: `{ newRole }`. Returns `200` with the updated membership.
- `DELETE /:projectId/members/:userId` — Admin. Returns `200` with the removed membership and clears its user's assignments.

Invitation acceptance is an additional route:

| Method and full path                                                   | Access and response                                                                                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/projects/:projectId/invitations/:invitationToken/accept` | Verified account matching the invited email; no body or existing membership required. Returns `200` with the created membership. |

The singular `/:projectId/member` path remains a legacy alias for GET/POST `/:projectId/members`. There is no invitation-list or invitation-cancellation endpoint. Re-invitation replaces the pending token.

### Task and subtask endpoints

**Task Routes** (`/api/v1/tasks/`)

- `GET /:projectId` — All roles. Returns `200` with a task array and populated public `assignedTo` profiles. This list does not include subtasks.
- `POST /:projectId` — Admin or Project Admin. Body: `{ title, description?, assignedTo?, status? }`, optionally multipart files. Returns `201` with the task.
- `GET /:projectId/t/:taskId` — All roles. Returns `200` with the task, its public assignee, and `subtasks` with public creator profiles.
- `PUT /:projectId/t/:taskId` — Admin or Project Admin. Partial task fields and/or uploaded files. Returns `200` with the updated task.
- `DELETE /:projectId/t/:taskId` — Admin or Project Admin. Returns `200` with the deleted task; deletes subtasks and queues files for removal.
- `POST /:projectId/t/:taskId/subtasks` — Admin or Project Admin. Body: `{ title }`. Returns `201` with the subtask.
- `PUT /:projectId/st/:subTaskId` — All roles for `{ isCompleted }`; Admin or Project Admin may also send `{ title }`. Returns `200` with the updated subtask.
- `DELETE /:projectId/st/:subTaskId` — Admin or Project Admin. Returns `200` with the deleted subtask.

Task status can be set independently of subtask completion. Send JSON `{ "assignedTo": null }` to clear an assignee. Omit `assignedTo` to retain the existing assignment on update. Multipart text `"null"` is not JSON null and fails ObjectId validation; clear an assignment in a separate JSON request when also uploading files.

Example task update:

```http
PUT /api/v1/tasks/<projectId>/t/<taskId>
Content-Type: application/json
Authorization: Bearer <accessToken>

{ "status": "in_progress", "assignedTo": null }
```

### Note and health endpoints

**Note Routes** (`/api/v1/notes/`)

- `GET /:projectId` — All roles. Returns `200` with notes and populated public creator profiles.
- `POST /:projectId` — Admin. Body: `{ content }`. Returns `201` with the note.
- `GET /:projectId/n/:noteId` — All roles. Returns `200` with the note and public creator profile.
- `PUT /:projectId/n/:noteId` — Admin. Body: `{ content }`. Returns `200` with the updated note.
- `DELETE /:projectId/n/:noteId` — Admin. Returns `200` with the deleted note.

**Health Check** (`/api/v1/healthcheck/`)

- `GET /` — Public. Returns `200`, `data: { message: "server is runing" }`. This is HTTP liveness only; it does not check database or SMTP readiness.

The API root `/` still returns a text placeholder. Use `/api/v1/healthcheck` for liveness and the frontend origin for the application.

### Validation and compatibility

| Input                            | Rules                                                          |
| -------------------------------- | -------------------------------------------------------------- |
| Registration username            | String, trimmed, lowercase, 3–20 characters                    |
| Email                            | String, trimmed, valid email syntax; exact stored matching     |
| New password                     | At least six characters, at most 72 UTF-8 bytes; never trimmed |
| Login/old password               | Nonempty string, at most 72 UTF-8 bytes                        |
| Project name, task/subtask title | Trimmed, nonempty, at most 200 characters                      |
| Description                      | Optional string, at most 10,000 characters; may be empty       |
| Note content                     | Trimmed, nonempty string, at most 10,000 characters            |
| Role                             | `admin`, `project_admin`, or `member`                          |
| Task status                      | `todo`, `in_progress`, or `done`                               |
| Subtask completion               | JSON boolean `true` or `false`                                 |
| Resource IDs                     | 24 hexadecimal characters                                      |
| Invitation token                 | 40 lowercase hexadecimal characters                            |

Project updates, task bodies, subtask bodies, and note bodies enforce field allowlists. Empty updates are rejected; a task update containing only new files is valid. Whole-request body limits can apply before individual field limits.

Existing public spellings are part of the contract: `statuscode`, `attachements`, `mimeTypes`, `refrershToken`, and `verficationToken`. Source names also retain spellings such as `ApiRespones`, `UpdateSubTask`, `auth.controler.js`, and `index.validatorts.js`. Express currently uses case-insensitive routing, so lowercase `/forgot-password` also reaches the registered `/forgot-Password` route.

## Frontend

### Routes and navigation

The frontend is a React single-page application using `BrowserRouter`. `main.jsx` mounts it under React StrictMode. The provider order is Toast, Auth, then Project, with the shared Navbar above route content.

| Browser route                    | Page and behavior                                                              |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `/`                              | Redirects to `/dashboard`                                                      |
| `/login`                         | Email/password login; returns to a saved route when available                  |
| `/register`                      | Username/email/password registration and email-sent confirmation               |
| `/forgot-password`               | Requests a password-reset email                                                |
| `/reset-password/:token`         | Submits and confirms a new password                                            |
| `/verify-email/:token?`          | Verifies a URL token or accepts manual token entry                             |
| `/invitations/:projectId/:token` | Guides the recipient through authentication and explicit invitation acceptance |
| `/dashboard`                     | Verified users' project list and project creation                              |
| `/projects/:projectId`           | Verified project workspace with Tasks, Notes, Team, and Admin-only Settings    |
| Any other path                   | Not-found page                                                                 |

`ProtectedRoute` waits for the initial account check, redirects signed-out users to login, and displays a verification gate for unverified users. The gate provides resend and status-check actions. Navbar provides account information, password change, logout, and verification reminders.

### Screens and components

| Area              | Current functionality                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard         | Project cards with description, role, member count, and creation date; manual refresh; new-project dialog; loading and empty states  |
| Project workspace | Project header, member count, role, tab navigation, and missing/inaccessible-project state                                           |
| Task board        | Three status columns, counts, title/assignee-username search, task cards, and privileged creation actions                            |
| Task dialog       | Create/edit title, description, status, and assignee; load full task details; select new files; download existing files; delete task |
| Subtasks          | Create/delete for Admin and Project Admin, completion toggles for every member, completion count inside task details                 |
| Notes             | Plain-text note cards with author/date, Admin-only create/edit/delete dialogs                                                        |
| Team              | Member list with roles and join dates; Admin invitation form, role changes, and removal                                              |
| Settings          | Admin-only project name/description editing and project deletion requiring the exact project name                                    |
| Shared UI         | Toast feedback, reusable modal, change-password dialog, keyboard-operable cards, and responsive layouts                              |

Task status changes use the task dialog. The board does not implement drag and drop. The subtask API supports renaming for privileged users, but the frontend does not expose a rename control. Notes preserve line breaks and render as text, without a Markdown or rich-text editor.

The interface uses a light theme, neutral surfaces, a blue accent, system fonts, and shared CSS custom properties. Dialogs close through Escape, the close button, or overlay click and lock background scrolling. Toasts use a polite live region. These features are not a complete accessibility certification; focus trapping and focus restoration are not implemented in the shared modal.

### Client state and API integration

`AuthContext` loads `/auth/current-user` at startup, stores the public user in memory, and exposes login, registration, logout, password change, verification resend, and account refresh. `ProjectContext` stores the project list, selected project, members, and current project role. It derives that role from the member response. Tasks and notes use component-local state and reload their collections after mutations. `ToastContext` supplies notifications, normally dismissed after 4.5 seconds.

The shared client reads `VITE_API_BASE_URL`, defaulting to `http://localhost:8000/api/v1`. Every request uses `credentials: "include"`. It sets JSON content type for JSON bodies and lets the browser set multipart boundaries for `FormData`. Domain wrappers in `auth.api.js`, `projects.api.js`, `tasks.api.js`, and `notes.api.js` preserve backend paths and field names; `health.api.js` exposes liveness.

On an eligible `401`, the client attempts refresh using the HttpOnly cookie. A shared in-memory queue coordinates concurrent requests within the page. A successful refresh retries waiting requests; failure clears AuthContext through a callback. Login, registration, and refresh calls are excluded from automatic refresh. Tokens are not saved to localStorage or sessionStorage by this frontend.

UI permissions hide or disable unavailable controls, while the backend checks every protected operation. REST calls happen on view loading and user actions; there is no WebSocket connection, background polling, or cross-tab state synchronization.

### Email-link flows

| Flow           | Generated link and frontend behavior                                                                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verification   | Email points to `SERVER_URL/api/v1/auth/verify-email/<token>`. Opening it returns API JSON. Return to the app and use the verification status check. `/verify-email/:token?` can also submit a token, but email generation does not currently target that page. |
| Password reset | Email appends the token to `FORGOT_PASSWORD_REDIRECT_URL`, normally `/reset-password/<token>` on the frontend. The page submits `{ newPassword }` to the API.                                                                                                   |
| Invitation     | Email appends project ID/token to `PROJECT_INVITATION_REDIRECT_URL`, normally `/invitations/<projectId>/<token>`. The user explicitly accepts with the invited, verified account.                                                                               |

Invitation-to-login navigation preserves the invitation path in router state. Registration and the dashboard verification detour do not preserve that return path end to end; reopen the original invitation after completing either flow. If the invitation redirect setting is omitted, the backend generates an API acceptance URL, which requires an authenticated POST and is unsuitable as a normal browser landing page.

### Known client limitations

- When editing a task with new files and an empty assignee, the dialog sends multipart text `"null"`, which the backend rejects. Save the unassignment separately as JSON; uploading files to an already unassigned task through this dialog also needs correction.
- An empty description is omitted from multipart updates, so clearing a description while uploading does not clear its stored value. Save the text change separately.
- Task cards can render subtask counts, but the task-list endpoint omits subtasks. Full completion details are available in the task dialog.
- Refresh coordination is limited to one page and has no explicit retry cap after a successful refresh. Cross-tab rotation and logout/refresh races need browser coverage. Logout clears local state even if the server request fails, so failed logout does not prove server-side revocation.
- ProjectContext is not reset on every account switch or failed project load. Stale project/role state may remain visible until refreshed; server authorization still applies.
- In development, React StrictMode may repeat the verification page's mount effect and submit a single-use URL token twice. That path needs an idempotent client guard and browser verification.

## Environment configuration

Create `.env` at the repository root. The following values target the included local database and frontend; replace the secret and SMTP placeholders before running the API.

```dotenv
NODE_ENV=development
PORT=8000
SERVER_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:5173

MONGO_URI=mongodb://127.0.0.1:27018/pcb_development?replicaSet=rs0&directConnection=true
MONGODB_TEST_URI=mongodb://127.0.0.1:27018/pcb_test?replicaSet=rs0&directConnection=true

ACCESS_TOKEN_SECRET=replace-with-an-independent-random-secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_SECRET=replace-with-a-different-random-secret
REFRESH_TOKEN_EXPIRY=10d

MAILTRAP_SMTP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_SMTP_PORT=2525
MAILTRAP_SMTP_USER=replace-with-your-smtp-user
MAILTRAP_SMTP_PASS=replace-with-your-smtp-password
MAIL_FROM=Project Camp <no-reply@example.com>

FORGOT_PASSWORD_REDIRECT_URL=http://localhost:5173/reset-password
PROJECT_INVITATION_REDIRECT_URL=http://localhost:5173/invitations
```

| Variable                                                                               | Purpose and requirements                                                                                                         |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `MONGO_URI`                                                                            | Required application connection string; `mongodb://` or `mongodb+srv://`; transactional topology required                        |
| `MONGODB_TEST_URI`                                                                     | Required only for local integration/smoke tests; exact guarded target shown above                                                |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`                                          | Required, different secrets; production requires at least 32 characters each                                                     |
| `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY`                                          | Required positive duration strings such as `15m`, `1d`, or `10d`; unitless numeric strings are rejected                          |
| `SERVER_URL`                                                                           | Required public API base used in verification links and attachment URLs                                                          |
| `FORGOT_PASSWORD_REDIRECT_URL`                                                         | Required frontend reset-page base, without the token                                                                             |
| `PROJECT_INVITATION_REDIRECT_URL`                                                      | Optional to the backend, needed for the normal frontend invitation flow                                                          |
| `MAILTRAP_SMTP_HOST`, `MAILTRAP_SMTP_PORT`, `MAILTRAP_SMTP_USER`, `MAILTRAP_SMTP_PASS` | Required SMTP settings, including in local development; the variable names also work with a compatible non-Mailtrap SMTP service |
| `MAIL_FROM`                                                                            | Optional sender override; configure a sender accepted by your SMTP provider, otherwise the source-defined fallback is used       |
| `CORS_ORIGIN`                                                                          | Comma-separated frontend origins; defaults to `http://localhost:5173`                                                            |
| `PORT`                                                                                 | API port, defaults to `3000`                                                                                                     |
| `NODE_ENV`                                                                             | `production` enables Secure cookies and minimum JWT-secret length checks                                                         |

Public URL settings must use HTTP(S), without embedded credentials, query strings, or fragments. Port values must be valid. Configuration validation checks syntax and required values; it does not test SMTP connectivity or secret entropy.

For a different API origin, create `frontend/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Include `/api/v1` and omit a trailing slash. Vite embeds this setting at build time. Server secrets belong only in the backend environment; `VITE_` values are public client configuration. Restart Vite after changing local environment files. Both `.env` files are Git-ignored.

## Local database setup

### Windows runner

The repository includes a project-local MongoDB Community 8.0.34 runner for Windows x64. The installer checks for Windows 11 or Windows Server 2022 and the required Visual C++ x64 runtime DLLs. MongoDB also requires a supported CPU. The runner installs no Windows service and makes no system PATH change.

```powershell
npm run mongodb:install
npm run mongodb:start
npm run mongodb:status
npm run mongodb:stop
```

Run commands from the repository root. In PowerShell, `npm.cmd` avoids restrictions on `npm.ps1`. The npm MongoDB commands use a process-only execution-policy override for `scripts/mongodb.ps1`.

Installation downloads the pinned [official MongoDB ZIP](https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-8.0.34.zip), checks its official SHA-256 against the pinned checksum in the script, and refuses mismatches or partial installations. See [MongoDB Windows requirements](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows/) for platform prerequisites.

| Item                 | Local setting                                                      |
| -------------------- | ------------------------------------------------------------------ |
| Server               | `127.0.0.1:27018`, replica set `rs0`, one member                   |
| Development database | `pcb_development`                                                  |
| Integration database | `pcb_test`                                                         |
| Executable           | `tools/mongodb/mongodb-win32-x86_64-windows-8.0.34/bin/mongod.exe` |
| Data                 | `.local/mongodb-data/`                                             |
| Logs                 | `.local/mongodb-logs/mongod.log`, `stdout.log`, `stderr.log`       |
| Config and ownership | `.local/mongodb-runtime/mongod.cfg`, `instance.json`               |
| WiredTiger cache     | 0.25 GB                                                            |

Start launches a hidden background process, initializes only an unconfigured replica set, and waits for PRIMARY. Existing replica configuration and data are retained. Stop verifies the recorded process identity, executable, start time, and server configuration before graceful shutdown. An ownership or port mismatch causes a refusal rather than terminating an unrelated process. Management operations are serialized by a lock.

This local instance binds to loopback and has no authentication. Binaries, database files, logs, and runtime records are Git-ignored.

### Development and test targets

`npm run dev:local` loads the root environment, selects local `pcb_development` and development mode in its process, verifies the project's actual MongoDB paths/topology, then starts `src/index.js`. It does not rewrite `.env`. `node scripts/dev-local.js --check` performs the configuration/server check without starting the app or initializing its models.

`npm run dev` uses nodemon with the configured `MONGO_URI`; `npm start` uses Node with the same configured URI. The local launcher does not provide automatic reload.

Integration tests read only `MONGODB_TEST_URI`, with a process-level value taking precedence over the root `.env`. They never fall back to `MONGO_URI` or the old `MONGO_TEST_URI` name. The guard allows only `127.0.0.1:27018/pcb_test` with `replicaSet=rs0` and `directConnection=true` (either option order). Credentials, extra options, alternate hosts, and other databases are rejected. It also verifies the actual server's data/log paths, loopback binding, single-member configuration, and PRIMARY state.

On macOS/Linux or with another replica set, configure `MONGO_URI` and use `npm run dev`/`npm start`. The included Windows lifecycle commands do not apply there. The guarded integration suite and `dev:local` additionally require the project-specific local server configuration; they are not general remote-database tools.

### Troubleshooting

| Problem                                   | Check                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Connection refused                        | Start the local database, then run `mongodb:status`                                              |
| Port 27018 occupied or ownership mismatch | Inspect the listener/process; do not reuse the ownership file for another MongoDB instance       |
| Missing DLL / `0xC0000135`                | Check the Visual C++ x64 runtime and `stderr.log`; prerequisites are not installed automatically |
| Replica election/configuration failure    | Inspect status and `mongod.log`; retain the data directory and existing replica configuration    |
| Integration refuses existing collections  | Inspect `pcb_test`; tests intentionally refuse existing application collections, even empty ones |
| Integration lock remains after a crash    | Check the PID in `.local/mongodb-runtime/integration.lock` before removing a stale lock          |
| API fails configuration validation        | Correct the named missing/invalid variables without printing credentials                         |
| Browser cookies do not work locally       | Use `localhost` for both frontend and API; check the exact CORS origin and frontend API URL      |

## Development commands and testing

| Command from the root                 | Purpose                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `npm ci` / `npm --prefix frontend ci` | Install locked backend/frontend dependencies                               |
| `npm run dev:local`                   | Start the API against guarded local development MongoDB                    |
| `npm run dev`                         | Start the API with nodemon using `MONGO_URI`                               |
| `npm start`                           | Start the API without nodemon                                              |
| `npm --prefix frontend run dev`       | Vite development server on `localhost:5173`; exits if the port is occupied |
| `npm --prefix frontend run build`     | Build static frontend assets into `frontend/dist`                          |
| `npm --prefix frontend run preview`   | Preview the frontend build; this does not start the API                    |
| `npm test` / `npm run test:unit`      | Backend regression, route-contract, and MongoDB safety suites              |
| `npm run test:integration`            | Real local MongoDB lifecycle and HTTP integration suite                    |
| `npm run mongodb:smoke`               | Guarded temporary insert/read/delete database check                        |
| `npm run dev:verify -- <email>`       | Mark one local development account verified without email                  |
| `npm run seed:demo`                   | Confirmed reset and recreation of demo documents                           |
| `npm run format`                      | Run Prettier across the repository, respecting its ignore file             |

`dev:verify` is a development-only database helper. It targets `pcb_development` directly and clears verification-token state. **With no email argument, it verifies every unverified local account.** It does not use the normal API verification flow or the stricter server-ownership check used by `dev:local`.

`seed:demo` asks for confirmation before clearing documents from `users`, `projects`, `projectmembers`, `projectinvitations`, `tasks`, `subtasks`, `projectnotes`, and `filedeletions` in local `pcb_development`. It inserts fixtures directly, outside API permission checks and without a single transaction. It does not delete disk uploads or send email. Sample invitation tokens are not exposed; create a usable invitation through the Admin's invite action.

### Test coverage and isolation

| Suite                                                                    | Coverage                                                                                                                                                    |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/auth.test.js`                                                     | Auth lifecycle, tokens, cookies, validation, CORS, parser errors, mail acceptance, and throttling using mocked database/SMTP boundaries                     |
| `tests/project.test.js`                                                  | Project/member/task/subtask/note behavior, role and parent isolation, rollback intent, invitations, and real temporary upload files with mocked persistence |
| `tests/contracts.test.js`                                                | Mounted route contracts, configuration validation, limiter behavior, and transaction error handling                                                         |
| `tests/mongodb-safety.test.js`                                           | Dedicated test-target validation and refusal of unsafe cleanup                                                                                              |
| `tests/integration.test.js` and `tests/helpers/integration-lifecycle.js` | Real indexes, transactions, concurrent operations, onboarding, invitations, resources/files, rollback, cookies, and session recovery                        |

The route test reads the 33 original endpoint bullets in this document under the route-prefix labels; it separately checks invitation acceptance and both singular member aliases. Maintain that structure when updating contracts, or update the test deliberately with an API change.

Integration takes an exclusive lock, disables automatic collection/index creation until the server is verified, and refuses pre-existing application collections in `pcb_test`. It creates its own collections/indexes and drops only those it created. Upload cleanup tracks fixture-owned filenames. HTTP listeners, database connections, and the lock are closed during cleanup; the fixture never calls `dropDatabase`. SMTP is mocked in all automated suites.

The frontend currently has build/preview scripts but no automated component or browser test suite. Browser validation should cover all three roles, email-link flows, refresh/logout behavior, file uploads, responsive layouts, and keyboard navigation. A passing backend suite or frontend build does not verify those interactions or live SMTP delivery.

## Deployment and current limitations

Build and host `frontend/dist` as a static SPA with fallback to `index.html` for client routes. Run the API separately with `npm start`; Express does not serve the frontend build. Set the frontend API URL before building and configure the backend's public URL, client redirects, allowed origin, SMTP sender, and production secrets for the deployed hosts.

Production cookies require HTTPS. The current SameSite=Lax setting works with a same-site deployment; unrelated frontend/API sites need a deliberate cookie and CSRF design change. Reverse-proxy trust, pre-login/missing-Origin CSRF behavior, and shared rate limits need validation for the chosen deployment.

The following limits remain relevant beyond the client issues listed above:

- Lists are unpaginated, and project cascades load related tasks into memory. Large projects and sustained concurrent writes need workload testing.
- Uploads use local disk and public URLs. Persistent storage, backups, malware scanning, private-file requirements, crash reconciliation, and deletion-queue recovery need deployment decisions and testing.
- Real SMTP sender/TLS/inbox delivery, database failover, uncertain commits, backup/restore, shutdown recovery, and existing production indexes/data are not established by local mocked or fixture tests.
- Registration conflicts and SMTP timing/failure responses can distinguish accounts. The auth limiter is in memory and resets with each process; it does not provide shared enforcement across instances.
- Health is liveness only. There are no readiness checks, structured request logs, metrics, or shipped CI/deployment configuration. Review dependency advisories separately from functional tests.
- The product has no task priorities/due dates, comments, audit feed, notification inbox, global search, invitation listing/cancellation, profile editing, or individual attachment deletion.

Sample task and note text may mention CI, monitoring, or other systems as fictional project content; it does not indicate those systems are implemented in this repository.

## Seed data

The local demo seed creates eight verified users in **Project Apollo**: one Admin, three Project Admins, and four Members, with 12 tasks, 33 subtasks, five notes, and two expiring sample invitations. All eight accounts use `Demo@12345`; their emails are listed in the [README](README.md#local-demo-accounts). These are local test accounts; counts change as the app is used.
