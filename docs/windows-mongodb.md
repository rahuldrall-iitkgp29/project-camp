# PCB local MongoDB on Windows

This project uses an isolated MongoDB Community **8.0.34** single-member replica set for development and integration tests. Production Atlas configuration remains separate: application startup still uses `MONGO_URI`; tests never fall back to it. No application dependency versions changed.

For interactive local development, use `npm.cmd run dev:local`: it verifies this
replica set and overrides MONGO_URI only in that process to use **pcb_development**.
The .env application URI is preserved; integration tests still use only **pcb_test**.
`node scripts/dev-local.js --check` validates configuration/topology without starting
the app. See [frontend-integration.md](frontend-integration.md) for client URLs,
cookie/token contracts and measured readiness. Latest suites: **57 unit/mocked and
6 integration tests passed, zero failures/skips**, including real onboarding,
invitations, all-role collaboration, attachments, rollback and session recovery.

The existing staged deletion of the root `README.md` was preserved during setup. This guide contains the Windows setup and test commands instead.

## Install and start

Use Windows 11 x64 or Windows Server 2022 x64, a MongoDB-supported CPU with AVX, and the Microsoft Visual C++ x64 runtime. This machine was verified as Windows 11 build 26200, AMD Ryzen 7 7840HS, with `vcruntime140.dll`, `vcruntime140_1.dll` and `msvcp140.dll` version 14.50.35719.0 present. Tested Node: 24.14.0; installed Mongoose: 9.7.3; MongoDB driver: 7.2.0.

From the project root in PowerShell:

```powershell
npm run mongodb:install   # Already installed here; retains an existing installation
npm run mongodb:start    # Starts, initializes only if needed, waits for PRIMARY
npm run mongodb:status   # Version, PID, paths, rs0 PRIMARY and listening socket
```

The installer uses the official Community ZIP, without an MSI, service, package manager, Database Tools or mongosh. It checks the official SHA-256 before extraction. It refuses to overwrite a partial installation or extract an archive whose checksum differs.

- [Official Windows platform requirements](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows/)
- [Official release metadata](https://downloads.mongodb.org/full.json)
- [Pinned Windows ZIP](https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-8.0.34.zip)
- [Official SHA-256](https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-8.0.34.zip.sha256)
- Verified SHA-256: `6b021a0864494e4decf278b36477a29eb36072432773e4e62c2f42c302630db0`

All paths resolve relative to the script's project root, including when called from another directory:

```powershell
# Replace the path with this checkout's absolute path.
powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\path\to\PCB\scripts\mongodb.ps1' Status
```

The npm commands use that same **process-only** execution-policy override because Windows PowerShell's default policy on this machine blocks scripts. They do not alter the system execution policy, registry, PATH or global environment variables. Start launches a hidden background process; no service is installed.

## Configuration and files

| Item                            | Project-local value                                                |
| ------------------------------- | ------------------------------------------------------------------ |
| Executable                      | `tools/mongodb/mongodb-win32-x86_64-windows-8.0.34/bin/mongod.exe` |
| Archive and checksum            | `tools/mongodb/mongodb-windows-x86_64-8.0.34.zip[.sha256]`         |
| Data                            | `.local/mongodb-data/`                                             |
| MongoDB log                     | `.local/mongodb-logs/mongod.log`                                   |
| Process output/errors           | `.local/mongodb-logs/stdout.log`, `stderr.log`                     |
| Generated runtime configuration | `.local/mongodb-runtime/mongod.cfg` (JSON-compatible YAML)         |
| Ownership record                | `.local/mongodb-runtime/instance.json`                             |
| Bind address / port             | `127.0.0.1:27018` only                                             |
| Replica set / member            | `rs0` / `127.0.0.1:27018`                                          |
| Test database                   | `pcb_test`                                                         |
| WiredTiger cache                | 0.25 GB                                                            |

Add this non-secret test variable to the ignored project-root `.env` (already configured in this checkout):

```dotenv
MONGODB_TEST_URI=mongodb://127.0.0.1:27018/pcb_test?replicaSet=rs0&directConnection=true
```

Preserve the existing `MONGO_URI` and other environment settings. Only `MONGODB_TEST_URI` is read from `.env` by the test helper. A process-level `MONGODB_TEST_URI` takes precedence; an empty or unsafe override fails. The old `MONGO_TEST_URI` is no longer consumed. `.env`, MongoDB binaries, data, logs and runtime state have narrow Git exclusions; `.env.example`, source, tests and docs remain eligible for version control.

This unauthenticated instance is for this machine's local tests. Other local processes can access it. Do not use it to store secrets or as a production deployment.

## Verify and test

```powershell
npm test                       # Unit/mocked HTTP suite; MongoDB can be stopped
npm run test:unit              # Alias for npm test
npm run mongodb:smoke          # Verify server, Mongoose connect, insert/read/delete
npm run test:integration       # Real MongoDB indexes, transactions, races and HTTP
```

Integration fails clearly when the test URI is missing or unsafe. It accepts only literal `127.0.0.1:27018`, database `pcb_test`, `replicaSet=rs0` and `directConnection=true`, with no credentials or extra options. Remote/SRV URLs, DNS aliases, other ports/databases and discovery/proxy options are rejected before connecting. Actual server data/log paths, bind address, port, replica-set membership and PRIMARY state are verified before fixture writes or cleanup.

The fixture uses the existing application collection names within `pcb_test`. It first refuses any existing application collection, even if empty, preventing accidental loss of manual local data. It creates its own collections and indexes, and drops only those collections in `finally`. Unrelated collections remain intact. There is no `dropDatabase` operation. The integration lock prevents concurrent fixture runs; connections and the HTTP server close on completion. SMTP stays mocked and `src/index.js` is never started by the test commands.

The smoke command uses a unique temporary collection and removes it after insert/read/delete verification. Replica-set administration uses the project's installed driver, so no separate MongoDB shell is required.

## Stop and troubleshoot

```powershell
npm run mongodb:stop
Get-Content .\.local\mongodb-logs\mongod.log -Tail 60
Get-Content .\.local\mongodb-logs\stderr.log -Tail 30
```

Stop checks the recorded PID, creation time, executable path, command line and the server's actual configuration/PID before requesting graceful shutdown. It never kills arbitrary MongoDB processes or deletes data. Repeated Start/Stop calls are safe. Restart retains the replica-set configuration; `replSetInitiate` is sent only for MongoDB error 94 (`NotYetInitialized`). An unexpected configuration is reported without resetting or reconfiguring it.

- **Port 27018 occupied / ownership mismatch:** inspect the PID and command line. Start refuses an unowned listener; Stop refuses unverifiable ownership. Do not kill an unrelated server or edit the ownership record to take it over.
- **Startup failure:** check `stderr.log` and `mongod.log`, and run the local executable with `--version`. Exit `-1073741515` / `0xC0000135` indicates a missing DLL; verify the named Visual C++ x64 dependencies. No system prerequisites are installed automatically.
- **Election or initialization failure:** use Status and inspect the log. Keep the data directory; do not delete it, force reinitialization or reset `rs0`.
- **Connection refused:** run Start, then Status. Check the test variable's name/target without printing other `.env` values.
- **Existing application collections:** inspect `pcb_test` manually. Tests deliberately refuse to clear them. Failed/crashed runs can leave collections requiring an explicit cleanup decision.
- **Integration lock exists:** first verify the PID recorded in `.local/mongodb-runtime/integration.lock` is no longer running. Remove only that stale lock after verification; never remove it from an active run.
- **Permission errors:** Node workers and Windows process/socket inspection were blocked by the Codex sandbox in this session. Approved execution outside that sandbox passed. A script execution-policy restriction is handled by the process-only override in the npm commands.

Passing the local fixture does not verify production indexes/data, backup/restore, failover, all authentication flows against real MongoDB, real SMTP delivery, browser/proxy behavior or persistent attachment recovery. Those release gaps remain in `task.md`.
