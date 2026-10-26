# Frontend Architecture and Integration Plan

## 1. Overview and Objectives

This document defines the comprehensive frontend architecture, design system, route hierarchy, API transport layer, authentication/session lifecycle, and acceptance test plan for the **Project Camp** client application.

The frontend connects directly to the local backend running at `http://localhost:8000` with API prefix `/api/v1`. The frontend application will run locally at `http://localhost:5173`, adhering strictly to the contracts and product decisions documented in [frontend-integration.md](file:///c:/Users/iitkg/OneDrive/Desktop/developement/projects/project%20camp/docs/frontend-integration.md), [history.md](file:///c:/Users/iitkg/OneDrive/Desktop/developement/projects/project%20camp/docs/history.md), [task.md](file:///c:/Users/iitkg/OneDrive/Desktop/developement/projects/project%20camp/docs/task.md), and [implementation-decisions.md](file:///c:/Users/iitkg/OneDrive/Desktop/developement/projects/project%20camp/docs/implementation-decisions.md).

---

## 2. Technology Stack and Design Aesthetics

### 2.1 Core Framework & Tooling

- **Build Tool & Bundler**: Vite (configured to run on port `5173` to match CORS and redirect URL configurations).
- **UI Library**: React 18+ (SPA structure, modular components, declarative state).
- **Routing**: `react-router-dom` v6+ (client-side routing, protected routes, parameter extraction for reset/invitation tokens).
- **Styling**: **Vanilla CSS** with a comprehensive CSS Custom Properties design system in `src/index.css` and modular component styles. No Tailwind CSS, maintaining pure CSS control and performance.
- **Icons**: Lightweight SVG icons (Lucide-React or bespoke inline SVGs) for crisp, accessible UI controls.

### 2.2 Design System & Aesthetics

Following the workspace guidelines for rich, premium web applications:

- **Color Palette**: Dark-mode primary theme with refined HSL tokens:
  - Background: Deep slate/obsidian (`--bg-primary: #0a0d14`, `--bg-secondary: #121722`, `--bg-card: #182030`)
  - Accent / Primary: Vibrant Indigo-Violet gradient (`--primary: #6366f1`, `--primary-hover: #4f46e5`, `--primary-glow: rgba(99, 102, 241, 0.25)`)
  - Semantics: Emerald for Done/Success (`#10b981`), Amber for In-Progress/Pending (`#f59e0b`), Rose for High Priority/Errors/Destructive (`#ef4444`), Sky for Todo/Informational (`#0ea5e9`).
  - Text: Multi-tier high contrast (`--text-primary: #f8fafc`, `--text-secondary: #94a3b8`, `--text-muted: #64748b`).
- **Typography**: Clean modern sans-serif (`Inter`, `Plus Jakarta Sans`, system fallback).
- **Surfaces & Glassmorphism**: Subtle translucent panels with backdrop blur (`backdrop-filter: blur(12px)`), crisp 1px borders (`rgba(255, 255, 255, 0.08)`), and soft layered drop-shadows.
- **Interactivity & Micro-animations**: Smooth hover transitions (150ms ease-out), skeleton loaders, modal transitions, and responsive feedback for all click/drag interactions.

---

## 3. Architecture & Project Structure (`frontend/`)

```text
frontend/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── index.css                     # Global design tokens, typography, resets, utilities
    ├── main.jsx                      # App entry point
    ├── App.jsx                       # Root router and context providers
    ├── api/
    │   ├── client.js                 # Unified fetch/axios wrapper with credentials & refresh mutex
    │   ├── auth.api.js               # Authentication endpoints (login, register, reset, verify)
    │   ├── projects.api.js           # Project and member management endpoints
    │   ├── tasks.api.js              # Task, subtask, and multipart attachment endpoints
    │   ├── notes.api.js              # Project notes endpoints
    │   └── health.api.js             # Server healthcheck endpoint
    ├── context/
    │   ├── AuthContext.jsx           # User session, auth status, login/logout, email verification state
    │   ├── ProjectContext.jsx        # Active project state, role evaluation, current members
    │   └── ToastContext.jsx          # Notification toasts (success, warning, error)
    ├── hooks/
    │   ├── useAuth.js                # Hook to consume AuthContext
    │   ├── useProject.js             # Hook to consume ProjectContext
    │   └── useToast.js               # Hook to trigger alerts and status notifications
    ├── components/
    │   ├── common/
    │   │   ├── Navbar.jsx            # Top navigation bar with user badge and quick actions
    │   │   ├── Sidebar.jsx           # Project switcher and navigation links
    │   │   ├── Modal.jsx             # Reusable animated modal dialog
    │   │   ├── Button.jsx            # Standard button with loading states & variants
    │   │   ├── Input.jsx             # Form input with validation feedback
    │   │   ├── Badge.jsx             # Status and role badges (Admin, Project Admin, Member)
    │   │   └── ToastContainer.jsx    # Floating notification container
    │   ├── auth/
    │   │   └── ProtectedRoute.jsx    # Guards routes by authentication & email verification
    │   ├── projects/
    │   │   ├── ProjectCard.jsx       # Grid card showing project details, member count & role
    │   │   ├── CreateProjectModal.jsx# New project creation dialog
    │   │   ├── EditProjectModal.jsx  # Update project details dialog (Admin only)
    │   │   └── MemberManagement.jsx  # Member list, role changer, invitation modal
    │   ├── tasks/
    │   │   ├── TaskBoard.jsx         # Kanban columns (Todo, In Progress, Done) & list view
    │   │   ├── TaskCard.jsx          # Draggable/clickable task item with subtask counter & avatars
    │   │   ├── TaskModal.jsx         # Full task view/editor with subtask list & attachment manager
    │   │   └── AttachmentUpload.jsx  # Drag & drop file uploader with size/type validation
    │   └── notes/
    │       ├── NoteCard.jsx          # Note item with author, timestamp and Markdown/text content
    │       └── NoteModal.jsx         # Note editor modal (Admin only for create/edit)
    └── pages/
        ├── auth/
        │   ├── LoginPage.jsx         # Login form
        │   ├── RegisterPage.jsx      # Registration form
        │   ├── ForgotPasswordPage.jsx# Forgot password email request
        │   ├── ResetPasswordPage.jsx # Reset password form (route: /reset-password/:token)
        │   └── VerifyEmailPage.jsx   # Email verification status / manual trigger
        ├── invitations/
        │   └── InvitationAcceptPage.jsx # Invitation landing page (/invitations/:projectId/:token)
        ├── dashboard/
        │   └── DashboardPage.jsx     # Overview of accessible projects with role tags
        ├── projects/
        │   └── ProjectDetailPage.jsx # Main project workspace (Tabs: Tasks, Notes, Team, Settings)
        └── not-found/
            └── NotFoundPage.jsx      # 404 handler
```

---

## 4. API Integration & Contract Conformance

### 4.1 Exact Server Contracts & Idiosyncrasies

The frontend integrates against the exact backend implementation verified in `history.md` and `task.md`:

1. **Base URL**: `http://localhost:8000/api/v1`.
2. **CORS & Transport**:
   - `credentials: "include"` on all HTTP requests (allows cookies `accessToken` and `refreshToken` to be passed and set).
   - `Origin: http://localhost:5173` is validated on write operations (POST, PUT, PATCH, DELETE) when cookie-authenticated.
3. **Response Envelope Casing**:
   - Success responses use lowercase `statuscode`:
     ```json
     { "statuscode": 200, "data": { ... }, "message": "...", "success": true }
     ```
   - Error responses use camelCase `statusCode`:
     ```json
     {
       "statusCode": 400,
       "data": null,
       "message": "...",
       "errors": [],
       "success": false
     }
     ```
   The client API wrapper will normalize response data: `res.data = response.data?.data` while preserving error messages from `response.data?.message` and `response.data?.errors`.
4. **Preserved Endpoint Spellings**:
   - `POST /auth/forgot-Password` (capital 'P')
   - `GET /auth/verify-email/:verficationToken` (parameter name `verficationToken`)
   - `POST /projects/:projectId/invitations/:invitationToken/accept`
   - `POST /tasks/:projectId` and `PUT /tasks/:projectId/t/:taskId` use multipart upload field **`attachements`** (with an `e`).
   - Refresh token response returns `accessToken`, `refreshToken`, and the legacy alias `refrershToken`.
5. **Payload Restrictions**:
   - JSON Body Limit: `16kb`.
   - Resource IDs: Strict 24-character hexadecimal MongoDB ObjectId (`/^[a-f0-9]{24}$/i`).
   - Passwords: Minimum 6 characters, maximum 72 UTF-8 bytes, **not trimmed**.
   - Usernames: Trimmed, lowercase, 3 to 20 characters.
   - Text fields: Project name <= 200 chars; Task title <= 200 chars; Note content <= 10,000 chars; Descriptions <= 10,000 chars.
   - Attachments: Max 5 files total per task, max 1,000,000 bytes per file (~1 MB). Allowed types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `application/pdf`.

---

## 5. Authentication, Session & Token Refresh Architecture

### 5.1 Session Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as React App
    participant API as Backend (port 8000)

    User->>Browser: Enters email and password
    Browser->>API: POST /api/v1/auth/login { email, password } (credentials: include)
    API-->>Browser: Set-Cookie: accessToken, refreshToken + 200 { user, accessToken, refreshToken }
    Browser->>Browser: Update AuthContext with user; redirect to /dashboard

    Note over Browser,API: Subsequent API requests send HttpOnly cookies automatically

    Browser->>API: GET /api/v1/projects (with accessToken cookie)
    alt Access Token Expired (401)
        Browser->>Browser: Acquire Refresh Mutex
        Browser->>API: POST /api/v1/auth/refresh-token (credentials: include)
        API-->>Browser: Set-Cookie: new accessToken, new refreshToken + 200
        Browser->>Browser: Release Mutex & replay queued requests
        Browser->>API: Retry GET /api/v1/projects
        API-->>Browser: 200 { data: projects }
    else Refresh Token Expired or Invalid (401)
        Browser->>Browser: Clear AuthContext & redirect to /login
    end
```

### 5.2 Single-Winner Refresh Queue (Concurrency Protection)

Because the backend implements strict token rotation (a refresh token can only be consumed once, and simultaneous refresh attempts result in session revocation), the frontend client employs a **Promise Queue / Mutex**:

- If any request receives a `401 Unauthorized`:
  1. If a refresh is already in-flight, subsequent requests return a Promise that waits on the ongoing refresh operation.
  2. If no refresh is in-flight, initiate a single `POST /api/v1/auth/refresh-token`.
  3. Upon success, resolve all queued requests to retry their original API calls.
  4. Upon failure (refresh token revoked or expired), reject queued requests, clear authentication context, and route to `/login`.

### 5.3 Email Verification Gate

- Unverified accounts can register, login, view their current profile, and request password changes/resends.
- Access to projects, tasks, and notes is forbidden by the backend (`403 Verify your email before accessing projects`).
- In the frontend:
  - If `user.isEmailVerified === false`, a non-intrusive persistent banner is displayed with a **"Resend Verification Email"** action (`POST /api/v1/auth/resend-email-verification`).
  - Attempting to enter project routes directs the user to a verification holding view explaining that project collaboration requires email verification.

---

## 6. Page Specifications and Features

### 6.1 Authentication Pages

1. **Login Page (`/login`)**:
   - Inputs: Email and Password.
   - Actions: Login submit, link to Register, link to Forgot Password.
   - Preserves `redirectUrl` query parameter (essential when redirected from an invitation link).
2. **Registration Page (`/register`)**:
   - Inputs: Username (auto-lowercased, 3-20 chars), Email, Password (min 6 chars, byte-length checked).
   - Validations: Immediate client-side validation to avoid preventable 422 errors.
   - Success state: Informational screen indicating verification email has been dispatched with instructions.
3. **Forgot Password Page (`/forgot-password`)**:
   - Input: Email.
   - Action: `POST /api/v1/auth/forgot-Password`. Uniform success message even if account is not found.
4. **Reset Password Page (`/reset-password/:token`)**:
   - Matches `FORGOT_PASSWORD_REDIRECT_URL=http://localhost:5173/reset-password`.
   - Captures `:token` from URL.
   - Inputs: New Password and Confirm Password.
   - Action: `POST /api/v1/auth/reset-password/:token` with `{ newPassword }`.
5. **Verify Email Status Page (`/verify-email/:token?`)**:
   - Allows users to complete verification or view status.
   - Calls `GET /api/v1/auth/verify-email/:token` and updates user state.

### 6.2 Invitation Landing (`/invitations/:projectId/:token`)

- Matches `PROJECT_INVITATION_REDIRECT_URL=http://localhost:5173/invitations`.
- Extracts `projectId` and `token` (`invitationToken`).
- **Unauthenticated Flow**:
  - Displays invitation details summary banner.
  - Prompts user to **Log In** or **Register** using the exact invited email address.
  - Preserves invitation parameters in session storage and redirects back after authentication.
- **Authenticated Flow**:
  - Checks if active account email matches the invitation recipient.
  - Displays "Accept Project Invitation" action button.
  - On click, submits `POST /api/v1/projects/:projectId/invitations/:token/accept`.
  - On 200 success: updates member state and navigates directly into the project workspace (`/projects/:projectId`).

### 6.3 Dashboard & Project Listing (`/dashboard`)

- Displays all joined projects with:
  - Project Title & Description.
  - Member count badge (from aggregation pipeline `members`).
  - Current user's role badge (`admin`, `project_admin`, or `member`).
- **Create Project Modal**:
  - Available to all verified users.
  - Inputs: Name (required, <= 200 chars), Description (optional, <= 10,000 chars).
  - On submit: `POST /api/v1/projects`. The creator is automatically assigned the `admin` role.

### 6.4 Project Detail Workspace (`/projects/:projectId`)

Divided into clean contextual tabs:

#### Tab 1: Tasks (Kanban & List Views)

- Columns: **To Do**, **In Progress**, **Done**.
- Task Cards display:
  - Title, description preview.
  - Assignee avatar & name (if assigned).
  - Subtask progress indicator (e.g. `2/5 completed`).
  - Attachment badge (showing file count).
- Role-based capabilities:
  - **Admin / Project Admin**: "Add Task" button, edit task details, delete task, drag & drop status change, manage subtasks (create/delete/rename), upload attachments.
  - **Member**: View tasks, view attachments, toggle subtask completion checkmark (only `isCompleted: true/false`). Member cannot edit task title/description or delete tasks.
- **Task Detail & Editor Modal**:
  - Edit title, description, status, and assigned member dropdown (populated from `/projects/:projectId/members`).
  - Option to clear assignment (sends `assignedTo: null`).
  - **Subtasks Checklist**:
    - Interactive checkboxes for all roles (`PUT /tasks/:projectId/st/:subTaskId` with `{ isCompleted }`).
    - Subtask title editing and addition (`POST /tasks/:projectId/t/:taskId/subtasks`) restricted to Admins / Project Admins.
  - **Attachment Manager**:
    - Dropzone accepting PNG, JPEG, GIF, WebP, PDF (<= 1MB).
    - Up to 5 files per task enforced.
    - Previews with direct download links (`http://localhost:8000/images/<filename>`).
    - Appending uploads sends `multipart/form-data` with field name `attachements`.

#### Tab 2: Project Notes

- Notes list displaying: Note content, creator (`createdBy.username`, `avatar`), and creation date.
- Role-based capabilities:
  - **Admin**: "New Note" modal, edit note, delete note.
  - **Project Admin & Member**: Read-only access to all project notes.

#### Tab 3: Team Members & Invitations

- Table / Cards of current members:
  - Avatar, Full Name, Username, Role badge.
  - Role changer dropdown (`admin`, `project_admin`, `member`) for Admins. Enforces last-Admin protection (prevents demoting or removing the sole remaining Admin).
  - "Remove Member" button for Admins (with confirmation modal).
- **Invite Member Modal** (Admin only):
  - Input: Recipient email and assigned role.
  - Action: `POST /api/v1/projects/:projectId/members` with `{ email, role }`.
  - Explains that an invitation token has been dispatched and requires recipient acceptance.

#### Tab 4: Project Settings (Admin only)

- Edit Project Name and Description (`PUT /api/v1/projects/:projectId`).
- Danger Zone: Delete Project (`DELETE /api/v1/projects/:projectId`) with cascade warning and name-confirmation prompt.

---

## 7. Role-Based Access Control (RBAC) UI Matrix

| Feature / Action                   | Admin | Project Admin | Member | Unverified User |
| :--------------------------------- | :---: | :-----------: | :----: | :-------------: |
| View Projects & Dashboard          |  Yes  |      Yes      |  Yes   |  Denied (403)   |
| Create New Project                 |  Yes  |      Yes      |  Yes   |  Denied (403)   |
| Edit Project Name/Description      |  Yes  |      No       |   No   |  Denied (403)   |
| Delete Project                     |  Yes  |      No       |   No   |  Denied (403)   |
| Invite Members / Manage Roles      |  Yes  |      No       |   No   |  Denied (403)   |
| Remove Members                     |  Yes  |      No       |   No   |  Denied (403)   |
| Create / Edit / Delete Tasks       |  Yes  |      Yes      |   No   |  Denied (403)   |
| Assign Task to Project Member      |  Yes  |      Yes      |   No   |  Denied (403)   |
| Upload Task Attachments            |  Yes  |      Yes      |   No   |  Denied (403)   |
| View Tasks & Download Files        |  Yes  |      Yes      |  Yes   |  Denied (403)   |
| Create / Delete Subtasks           |  Yes  |      Yes      |   No   |  Denied (403)   |
| Edit Subtask Title                 |  Yes  |      Yes      |   No   |  Denied (403)   |
| Toggle Subtask Completion          |  Yes  |      Yes      |  Yes   |  Denied (403)   |
| Create / Edit / Delete Notes       |  Yes  |      No       |   No   |  Denied (403)   |
| View Notes                         |  Yes  |      Yes      |  Yes   |  Denied (403)   |
| Account Actions (Profile/Password) |  Yes  |      Yes      |  Yes   |       Yes       |

---

## 8. Frontend Testing and Verification Strategy

Once approved, implementation will proceed in `frontend/` followed by end-to-end user flow testing:

### 8.1 Verification Steps

1. **Infrastructure & Healthcheck**:
   - Start backend using `npm.cmd run dev:local` (port 8000).
   - Start Vite frontend dev server at `http://localhost:5173`.
   - Verify healthcheck connectivity via `GET /api/v1/healthcheck`.
2. **Authentication & Session Flows**:
   - Register a new account (`username`, `email`, `password`).
   - Test login with valid credentials -> verify `accessToken` and `refreshToken` cookies set and user displayed in UI.
   - Test login rejection with invalid credentials -> check user-friendly error message.
   - Test email verification gate: simulate or trigger verification and verify project access unlocked.
   - Test logout -> verify cookies cleared and state reset.
3. **Password Management Flows**:
   - Request forgot password link for test email.
   - Navigate to `/reset-password/:token` and submit new password.
   - Login with new password and verify previous sessions invalidated.
   - Test authenticated password change via profile modal.
4. **Project Collaboration & RBAC Flows**:
   - Create project "Alpha" -> verify creator becomes `admin`.
   - Invite a second user as `member` -> copy invitation link and accept as second user.
   - Verify member view: cannot create tasks, cannot edit notes, cannot invite members.
   - Promote second user to `project_admin` -> verify task creation unlocks while note editing remains restricted.
   - Verify last-Admin protection: Attempting to remove the sole Admin or demote them shows a clean 409 conflict error toast.
5. **Tasks, Subtasks & Attachments**:
   - Create task with title, description, and status `todo`.
   - Assign task to project member.
   - Upload attachment (PNG/PDF <= 1MB) -> verify public link is accessible and downloadable.
   - Add subtasks -> toggle completion status with `member` account -> verify instant UI update.
   - Move task to `in_progress` and `done`.
6. **Notes Workflow**:
   - Create note as Admin -> verify all members see the note.
   - Edit and delete note as Admin.
7. **Session Expiry & Silent Refresh**:
   - Verify that simulated token expiration triggers silent refresh without user disruption.
   - Verify that logout invalidates refresh tokens and redirects cleanly to `/login`.

---

## 9. Implementation Next Steps (Upon Approval)

1. Scaffold Vite + React in `frontend/` with vanilla CSS foundation (`package.json`, `vite.config.js`, `index.html`, `src/index.css`).
2. Implement API client transport with credential handling and single-winner refresh mutex.
3. Build Context Providers (`AuthContext`, `ProjectContext`, `ToastContext`).
4. Implement navigation and route pages (`/login`, `/register`, `/reset-password/:token`, `/invitations/:projectId/:token`, `/dashboard`, `/projects/:projectId`).
5. Wire up Task Kanban, Subtask checklists, attachment uploads, Note board, and Member management.
6. Run live end-to-end tests against `http://localhost:8000` and report test results.
