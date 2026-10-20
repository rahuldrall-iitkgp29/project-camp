# Implementation decisions — 2026-10-17

The current user authorized the full backend repair and made these decisions:

- Verified users can create projects and receive that project's `admin` membership. Roles remain per project; no global role or client-selected privilege is introduced. This resolves the PRD's project-creation ambiguity without changing `PRD.md`.
- Adding someone by email now sends an invitation requiring acceptance, including for people who have not registered yet. POST member collection requests retain their paths and fields but return pending invitation information rather than immediately granting access. Existing members use PUT to change roles. This behavior change is explicitly authorized; existing memberships are retained.
- Updated 2026-10-18: project-local MongoDB 8.0.34 runs as rs0 PRIMARY. Guarded integration tests use pcb_test; the explicit dev:local launcher uses separate pcb_development without changing .env MONGO_URI. Core real-persistence lifecycle/race tests pass; broader failover/recovery remains a release check.

## Integrity and deployment

Multi-document mutations use MongoDB transactions and serialize project writes through the existing project's `__v` field. Existing-project privileged mutations recheck membership inside the transaction; invitation acceptance checks the token and recipient instead. A replica set (including a single-node development replica set) or sharded cluster is required. Unsupported deployments fail closed with a service error instead of performing partial writes. No live migration or data cleanup is part of this change.

A project must retain at least one Admin. Removing a member clears that member's task assignments in the same transaction. Historical authorship is retained. A unique `(project, user)` membership index prevents duplicates; existing duplicates require an operator-reviewed cleanup before index creation. Index initialization must succeed before startup serves requests.

Invitations use seven-day hashed single-use tokens, are bound to a project and exact account email, and require login and verified email to accept. Re-inviting rotates the pending token. Email delivery errors are reported; a pending invitation can be retried. New recipients register and verify before accepting. No global Admin can bypass project membership.

## Files

The PRD's `public/images` location remains public. Uploads accept up to five files per task, each at most 1,000,000 bytes: PNG, JPEG, GIF, WebP and PDF with matching content signatures. UUID filenames prevent client path traversal/collisions. Public downloads force attachment disposition, `nosniff`, and a sandbox CSP to limit active content on the API origin. Public URLs are not a confidentiality boundary.

Task updates append uploaded files; task/project deletion removes attachments. Committed deletion jobs survive filesystem failures and are retried. A process crash between upload and database persistence can still leave an unreferenced file; reconciliation and malware scanning remain deployment work. Signature checks do not constitute malware scanning.

## Compatibility

Preserve existing model names, fields, exports, misspellings, response casing, singular `/member` aliases, and the uppercase `PRD.md`. New task/note routes use the PRD paths. Members can change subtask completion only; Admin and Project Admin can also change its title. Project and task updates accept partial validated fields. A null task assignee explicitly clears assignment.
