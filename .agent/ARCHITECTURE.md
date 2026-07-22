# Architecture and portal behavior

## Runtime entrypoints

- `src/jobs/automation.ts`: constructs repositories and runs Punch In or Punch Out.
- `src/jobs/passwordRotation.ts`: performs an on-demand password-expiry check and rotation.
- `src/dashboard/server.ts`: local-only status dashboard.
- `src/cli/credential.ts`: audited seed, status, verify, copy, show, and replacement operations.

## GitHub workflows

- `.github/workflows/attendance-in.yml`: Monday-Friday at `03:30 UTC` / `09:00 IST`.
- `.github/workflows/attendance-out.yml`: Monday-Friday at `12:30 UTC` / `18:00 IST`.
- `.github/workflows/manual-automation.yml`: safe diagnostics and explicitly confirmed live operations.

Each production workflow builds once, runs the password-expiry check, and then runs attendance. Password rotation skips without mutation when a normal dashboard login succeeds.

## Attendance flow

`AttendanceService` in `src/automation/attendance/service.ts` owns orchestration:

1. Acquire a MongoDB lock and create a workflow-attempt-specific idempotent run. A failed attempt cannot consume the whole day's key.
2. Skip weekends, configured mandatory holidays, and optional manual leave overrides before login.
3. Decrypt the current credential from MongoDB.
4. Launch Puppeteer with IST timezone and configured geolocation.
5. Login and require a positive dashboard Punch marker.
6. Open leave history through the dashboard's `View leave details` button, then `View all`.
7. Expand the full grid when possible and parse start date, end date, type, and status.
8. Block dates covered by `Approved` or `Submitted`; ignore `Withdrawn`.
9. Restore an authenticated dashboard through the login route because direct dashboard navigation can invalidate the ADP SPA session.
10. Apply time-window, already-punched, selector, credential, and calendar decisions.
11. Submit the correct Punch or Punch Out confirmation.
12. Reload the portal and require a persisted, parseable Punch In or Punch Out time before recording success. Button-label transitions are evidence only and never prove persistence.

## Password rotation flow

`PasswordRotationService` and `LivePasswordPortal` own rotation:

1. Fresh-login with MongoDB's current credential.
2. If the dashboard loads normally, return `SKIPPED` without changing a password.
3. If `/ng/changepassword` exposes the verified current/new/confirm fields, generate a conservative 12-16 character password using upper/lowercase, numbers, and `@`.
4. Encrypt it into `pendingPasswordEncrypted` before clicking Update.
5. Submit through the verified Shadow DOM controls.
6. Start a fresh browser and verify the candidate.
7. Promote it to current, move the former current to previous, remove pending, and mark `COMPLETED`.
8. If portal confirmation was ambiguous, a later rotation run tests the staged candidate and promotes it when valid.

Never simplify this to a portal-first/database-second write without encrypted staging; a runner crash could otherwise lose the only valid password.

## Portal-specific facts

- ADP uses nested Web Components and Shadow DOM; selectors must use `shadowDom.ts` helpers.
- The full leave route is a two-step UI flow. Direct hard navigation is unreliable for authenticated state.
- The leave table uses grid cells with `col-id` values `startDate`, `endDate`, `leaveTypeName`, and `status`.
- The page-size control is useful but optional; failure to select 100 must not discard valid visible rows.
- Punch In and Punch Out use different confirmation controls.
- The punch dialog must resolve the configured location before confirmation.
- Security challenges are classified but never automated around.

## MongoDB state

- `credentials`: AES-256-GCM current, previous, and optional pending credential plus optimistic version.
- `automation_runs`: action decisions and sanitized outcomes.
- `automation_locks`: expiring concurrency leases.
- `rotation_runs`: state-machine history for each rotation check.
- `system_events`: audited credential access events with TTL cleanup.

## Test boundaries

- `tests/decision.test.ts`: fail-closed attendance decisions.
- `tests/leaveRecords.test.ts`: inclusive ranges and status blocking.
- `tests/passwordPolicy.test.ts`: random compliant password generation.
- `tests/browserFixtures.test.ts`: fixture selector/challenge behavior.
- `tests/encryption.test.ts` and `tests/sanitize.test.ts`: secret protection.
- `tests/time.test.ts`: IST conversion and grace windows.

Run `npm.cmd run validate`; do not claim validation from partial checks.

`@emnapi/core` and `@emnapi/runtime` are intentionally pinned dev dependencies. They satisfy optional WASM peer entries that Windows npm otherwise omits from the lockfile, causing Linux GitHub Actions `npm ci` to fail. Do not remove them without proving a clean Linux install.
