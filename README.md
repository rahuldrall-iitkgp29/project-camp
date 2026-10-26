# Project Camp

Project Camp is a project management app for teams to organize work, assign tasks, and share notes. It includes a React frontend and an Express API backed by MongoDB.

## Features

- Registration, email verification, login, and password recovery.
- Projects with email invitations and three project roles: Admin, Project Admin, and Member.
- A Kanban board with To Do, In Progress, and Done columns, plus task and assignee search.
- Task assignments, checklist subtasks, and file attachments.
- Shared project notes and team management.
- MongoDB transactions for project changes, member removal, and cascading deletes.

Any verified user can create a project and becomes its Admin. Admins manage the project, members, and notes; Admins and Project Admins manage tasks. All project members can read project resources and toggle subtask completion.

## Stack

| Layer           | Technology                                              |
| --------------- | ------------------------------------------------------- |
| Frontend        | React 18, Vite 5, React Router 6, Lucide icons, CSS     |
| Backend         | Node.js, Express 5, Mongoose 9                          |
| Database        | MongoDB replica set                                     |
| Authentication  | JWT access and refresh tokens, HttpOnly cookies, bcrypt |
| Files and email | Multer, Nodemailer, Mailgen                             |
| Tests           | Node.js built-in test runner                            |

## Getting started

Use Node.js **20.19+**; Node 24 LTS is recommended. MongoDB must run as a replica set or sharded cluster because project writes use transactions. The included Windows setup installs MongoDB Community 8.0.34 locally.

Install dependencies from the repository root:

```sh
npm ci
npm --prefix frontend ci
```

Create a root `.env` using the [configuration example in PRD.md](PRD.md#environment-configuration). Set separate JWT secrets, your SMTP credentials, and the local URLs shown there. The frontend defaults to `http://localhost:8000/api/v1`.

On Windows, install and start the project-local database:

```powershell
npm run mongodb:install
npm run mongodb:start
npm run mongodb:status
```

Start the API:

```sh
npm run dev:local
```

In a second terminal, start the frontend:

```sh
npm --prefix frontend run dev
```

Open **http://localhost:5173**. With the example configuration, the API runs at **http://localhost:8000**. Use `localhost` for both browser URLs so the cookie setup stays consistent.

`dev:local` uses the local `pcb_development` database and leaves `.env` unchanged. For a separately configured MongoDB replica set, use `npm run dev` or `npm start`; both use `MONGO_URI`. See [local database setup](PRD.md#local-database-setup) for platform details and troubleshooting. In PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

## Repository layout

```text
frontend/src/    React pages, components, contexts, and API client
src/            Express routes, controllers, middleware, models, and utilities
scripts/        Local MongoDB setup, development launcher, and demo seeder
tests/          Backend regression, contract, and integration tests
public/images/  Uploaded task attachments
PRD.md          Detailed backend and frontend reference
README.md       Repository overview and quick start
```

## Checks and build

```sh
npm test
npm run test:integration
npm --prefix frontend run build
```

The integration suite needs the project-local replica set and `MONGODB_TEST_URI` configured as described in the PRD. It uses `pcb_test`, separate from development data. Email delivery is mocked in automated tests.

The frontend build is written to `frontend/dist`. The API runs with `npm start`. See [deployment notes](PRD.md#deployment-and-current-limitations) before hosting them.

## API and documentation

API routes use `/api/v1`, grouped under `/auth`, `/projects`, `/tasks`, `/notes`, and `/healthcheck`. The [PRD](PRD.md) documents requests, responses, permissions, storage, frontend behavior, and known limitations.

Task attachments support PNG, JPEG, GIF, WebP, and PDF, up to five files per task and 1,000,000 bytes per file. Downloads are public URLs. The frontend loads data through REST requests; updates from other users appear after reloading the relevant view.

The package declares the ISC license.

## Local demo accounts

The local demo dataset contains eight verified users in **Project Apollo**, with sample tasks, subtasks, and notes. Sign in with an email below. **The password for all eight accounts is `Demo@12345`.**

| Email                       | Project role  |
| --------------------------- | ------------- |
| aarav@demo.projectcamp.dev  | Admin         |
| priya@demo.projectcamp.dev  | Project Admin |
| rohan@demo.projectcamp.dev  | Project Admin |
| ananya@demo.projectcamp.dev | Project Admin |
| kabir@demo.projectcamp.dev  | Member        |
| isha@demo.projectcamp.dev   | Member        |
| dev@demo.projectcamp.dev    | Member        |
| meera@demo.projectcamp.dev  | Member        |

To recreate this local test dataset, run `npm run seed:demo`. After confirmation, it **replaces existing documents in the eight application collections in `pcb_development`**. See [seed data](PRD.md#seed-data) for details.
