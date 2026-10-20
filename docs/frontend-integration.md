# Local frontend integration

The backend API and isolated persistence regressions pass as of 2026-10-18. Start
local frontend integration using this contract; actual browser acceptance and
production security/operations still need verification (task.md P08–P12/D04–D06).

## Windows startup and tests

From the repository root in PowerShell:

```powershell
npm.cmd run mongodb:status
npm.cmd run mongodb:start  # Only if the project instance is stopped
node scripts/dev-local.js --check
npm.cmd run dev:local
```

Stop the API with Ctrl+C. Stop MongoDB separately with `npm.cmd run mongodb:stop`
when finished; its data is retained. No new installation is needed here.

`dev:local` validates the real local configuration, verifies the project-local
replica set, overrides MONGO_URI **only in that process** to use `pcb_development`,
then runs the normal src/index.js entrypoint. The original .env MONGO_URI remains
unchanged. Ordinary `npm start` / `npm run dev` still use that original URI; use
the explicit local launcher for this workflow. Tests use only `pcb_test` through
MONGODB_TEST_URI and never use the development database or Atlas.

```powershell
npm.cmd test
npm.cmd run test:integration
```

Latest results: **57 unit/mocked passed; 6 integration passed; zero failed/skipped**.
The integration count is one parent fixture plus five lifecycle subtests, not six
independent databases. Both use mocked SMTP. The integration fixture owns its
collections and temporary upload filenames and cleans only those resources.

## Client configuration and transport

The user selected `http://localhost:5173` as the frontend origin. The configured
local API is `http://localhost:8000` (SERVER_URL follows PORT). Use localhost on
both sides for this cookie workflow. API paths start with `/api/v1`.

- For cookies, use `credentials: "include"` on login, refresh and subsequent API
  fetches. Cookies are HttpOnly, SameSite=Lax; Secure is added in production mode.
  CORS allows the selected origin with credentials and Authorization/Content-Type
  headers. Approved-origin parser-error responses now carry CORS headers too.
- Alternatively send `Authorization: Bearer <accessToken>`; scheme casing is
  accepted. A nonempty access cookie takes precedence over the header, including
  an invalid/expired cookie. Avoid accidentally mixing stale cookie and header sessions.
- Refresh uses the refresh cookie first, otherwise JSON `refreshToken`. It returns
  accessToken, refreshToken and the retained refrershToken alias. Serialize client
  refresh attempts: rotation has one winner and rejects reuse. Store new tokens
  only after a successful response; no frontend storage mechanism is prescribed.
- Logout, password reset and password change revoke prior access/refresh sessions.
  Later logins replace the saved refresh session; earlier access JWTs otherwise
  remain valid until expiry/revocation. Missing/invalid/expired credentials give 401.

HTTP cookie/CORS/preflight behavior is tested, including denied Origins. No actual
browser harness ran. Verify the chosen browser's credential handling, refresh
coordination and logout before frontend sign-off; HTTPS/proxy and pre-login CSRF
policy remain deployment checks. CORS is not authorization for arbitrary clients.

## Onboarding routes

- Register → receive email → GET `/api/v1/auth/verify-email/:verficationToken`.
  The API returns JSON verification success; it does not redirect to a frontend
  success page. Login/account actions work before verification, project access does not.
- The reset email opens the selected client route `/reset-password/:token`.
  That page submits `{ newPassword }` to POST
  `/api/v1/auth/reset-password/:resetToken`. Expired/reused tokens fail with 400.
- The invitation email opens `/invitations/:projectId/:token`. The page preserves
  both parameters through registration/login/verification, then submits an
  authenticated POST to
  `/api/v1/projects/:projectId/invitations/:invitationToken/accept`.
  Clicking a link alone does not grant membership. Both existing and newly
  registered users must accept with the invited, verified email account.
- Invitation creation returns 201 with `data.invitation` pending details, not an
  immediate membership. Re-inviting rotates the token; existing members change
  roles through PUT `/projects/:projectId/members/:userId` using `newRole`.

Live SMTP/inbox delivery was not tested. Sending from the interactive local app
uses the configured SMTP service; automated tests always mock it. Local development
secrets were generated independently and are kept only in ignored .env.

## Response, roles and uploads

Success: `{ statuscode, data, message, success }`. Error:
`{ statusCode, data: null, success: false, message, errors }`. Preserve that casing.
Handle 400 malformed input/token, 401 session, 403 permission/verification,
404 missing resource, 409 duplicate/invariant, 413 limits, 415 encoding/file type,
422 field validation, 429 throttling, 502 mail acceptance failure and 503
transaction availability/uncertain outcome. Internal failures remain sanitized 500.

Roles are per project. Verified creators become Admin. Admin manages the project,
members and notes. Admin/Project Admin mutate tasks and create/delete subtasks.
All three roles read project resources and change subtask completion; Member
cannot change its title. Cross-project child IDs do not confer access.

Tasks accept JSON fields or multipart uploads named **attachements**. Up to five
files per task, each at most 1,000,000 bytes: PNG/JPEG/GIF/WebP/PDF with matching
signatures. Metadata is `{ url, mimeTypes, size }`. Updates append files; JSON null
assignedTo clears assignment. Task/project deletion removes their files through
the deletion queue. Downloads are intentionally public, with attachment
disposition/nosniff/sandbox headers; URLs are not a confidentiality boundary.

The complete 33-route handler/request table is in [history.md](../history.md).
Remaining acceptance criteria are in [task.md](../task.md); MongoDB details are
in [windows-mongodb.md](windows-mongodb.md). The staged README deletion is preserved.
