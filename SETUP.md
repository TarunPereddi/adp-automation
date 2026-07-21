# Setup and production-readiness guide

This guide creates a new installation without placing the changing ADP password in GitHub Secrets or Git.

## 1. Prerequisites

- Node.js 22.12 or newer; GitHub Actions currently uses Node.js 24.
- Git and GitHub CLI (`gh`).
- A MongoDB Atlas project with MFA enabled.
- Administrator access to the target GitHub repository.
- Authorized ADP SecurTime credentials and an employer-approved attendance location.
- Windows PowerShell for the local credential tools described here.

```powershell
git clone <repository-url>
Set-Location adp-automation
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run validate
```

Never place the ADP password in `.env`, source files, workflow inputs, issues, or logs.

## 2. Create MongoDB Atlas state storage

Create a free Atlas cluster, database `adp_automation`, and a database user restricted to `readWrite` on that database. Enable TLS and MFA.

GitHub-hosted runners use changing outbound IP addresses. If a narrow Atlas IP allowlist is not practical, a broad entry such as `0.0.0.0/0` exposes the database endpoint to connection attempts. Compensate with a long unique database password, least-privilege database user, application-layer credential encryption, and regular access review.

The application creates these collections and indexes:

| Collection         | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `credentials`      | Encrypted current, previous, and in-progress password candidates |
| `automation_runs`  | Attendance decisions and outcomes                                |
| `automation_locks` | Expiring distributed locks                                       |
| `rotation_runs`    | Password-rotation state history                                  |
| `system_events`    | Audited credential access events with TTL cleanup                |

## 3. Configure the local environment

Generate a 32-byte encryption key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Fill these values in the ignored `.env` file:

```text
ADP_USERNAME=<authorized portal username>
ADP_ACCOUNT_ID=<stable non-sensitive alias>
ATTENDANCE_LATITUDE=<authorized latitude>
ATTENDANCE_LONGITUDE=<authorized longitude>
ATTENDANCE_LOCATION_ACCURACY_METERS=50
MONGODB_URI=<Atlas connection string>
MONGODB_DATABASE=adp_automation
ADP_STORE_KEY=<generated base64 key>
AUTOMATION_ENABLED=false
DRY_RUN=true
PORTAL_SELECTORS_VERIFIED=false
```

Protect and back up `ADP_STORE_KEY` separately. Losing it makes the encrypted password unrecoverable. On Windows, restrict `.env` to the current account:

```powershell
$account = "$env:USERDOMAIN\$env:USERNAME"
icacls .env /inheritance:r /grant:r "${account}:(M)"
```

Initialize MongoDB and enter the initial portal password interactively:

```powershell
npm.cmd run db:init
npm.cmd run credential:seed
npm.cmd run credential:verify
```

## 4. Configure GitHub Secrets

Create only these persistent repository secrets:

- `ADP_USERNAME`
- `ATTENDANCE_ACCOUNT_ID`
- `ADP_STORE_KEY`
- `MONGODB_URI`
- `MONGODB_DATABASE`
- `ATTENDANCE_LATITUDE`
- `ATTENDANCE_LONGITUDE`
- `ATTENDANCE_LOCATION_ACCURACY_METERS`

Use the same account alias, MongoDB database, and encryption key as the local `.env`. The changing ADP password remains encrypted in MongoDB and is not a persistent GitHub Secret.

Example secret entry:

```powershell
gh secret set ADP_USERNAME
gh secret set ATTENDANCE_ACCOUNT_ID
gh secret set ADP_STORE_KEY
gh secret set MONGODB_URI
gh secret set MONGODB_DATABASE
gh secret set ATTENDANCE_LATITUDE
gh secret set ATTENDANCE_LONGITUDE
gh secret set ATTENDANCE_LOCATION_ACCURACY_METERS
```

## 5. Configure safe repository variables

Start safe-disabled:

```powershell
gh variable set AUTOMATION_ENABLED --body false
gh variable set DRY_RUN --body true
gh variable set PORTAL_SELECTORS_VERIFIED --body false
gh variable set MANUAL_HOLIDAYS --body ""
```

`MANUAL_HOLIDAYS` is a comma-separated list of mandatory dates in `YYYY-MM-DD` format. Do not add optional holidays. `MANUAL_LEAVE_DATES` is an optional emergency override; normal leave decisions come from ADP's live full leave table.

## 6. Validate this ADP tenant

Tenant UI versions can differ. Before enabling production, verify every selector in `src/automation/portal/selectors.ts` through the normal supported portal flow:

1. Login inputs and Sign In control.
2. Authenticated Punch marker and Punch Information state.
3. Punch In, Punch Out, location, and confirmation controls.
4. Dashboard `View leave details`, `View all`, full leave grid, page-size control, date columns, and status column.
5. Forced password-change current/new/confirm fields and Update control.
6. Fresh-session verification after a password change.

Do not bypass CAPTCHA, OTP, MFA, email verification, security questions, or unknown-device checks. Any such state must remain fail-closed.

## 7. Run safe diagnostics

Set `PORTAL_SELECTORS_VERIFIED=true` only after the tenant validation above, while leaving automation disabled and dry-run enabled:

```powershell
gh variable set PORTAL_SELECTORS_VERIFIED --body true
gh workflow run manual-automation.yml -f action=CHECK_ATTENDANCE
gh run list --workflow manual-automation.yml --limit 3
```

The check may end with `OUTSIDE_TIME_WINDOW`; that is a safe success if login, leave, and calendar evidence were verified first.

## 8. Test explicit live actions

Perform each test during its valid time window and confirm the resulting portal state manually:

```powershell
gh workflow run manual-automation.yml -f action=PUNCH_IN -f confirmation=I_UNDERSTAND
gh workflow run manual-automation.yml -f action=PUNCH_OUT -f confirmation=I_UNDERSTAND
```

The application still enforces calendar, location, current attendance state, time window, credential consistency, and idempotency.

## 9. Enable production

The workflows schedule Punch In at `03:30 UTC` / `09:00 IST` and Punch Out at `12:30 UTC` / `18:00 IST`, Monday through Friday.

```powershell
gh variable set AUTOMATION_ENABLED --body true
gh variable set DRY_RUN --body false
gh workflow enable attendance-in.yml
gh workflow enable attendance-out.yml
gh workflow list --all
gh variable list
```

Production requires all of the following:

```text
Attendance In=active
Attendance Out=active
PORTAL_SELECTORS_VERIFIED=true
AUTOMATION_ENABLED=true
DRY_RUN=false
```

## 10. Password reset and forced rotation

Normal production runs check for the forced change-password screen and rotate only when ADP requires it. If Forgot Password was used and ADP issued a temporary credential:

1. Disable both attendance workflows.
2. Set `AUTOMATION_ENABLED=false` and `DRY_RUN=true`.
3. Create temporary secret `ADP_TEMP_PASSWORD`.
4. Run `SYNC_CREDENTIAL` with confirmation.
5. Run `ROTATE_PASSWORD` with confirmation.
6. Run `VERIFY_SESSION`.
7. Delete `ADP_TEMP_PASSWORD` immediately.
8. Restore production only after successful fresh-session verification.

```powershell
gh secret set ADP_TEMP_PASSWORD
gh workflow run manual-automation.yml -f action=SYNC_CREDENTIAL -f confirmation=I_UNDERSTAND
gh workflow run manual-automation.yml -f action=ROTATE_PASSWORD -f confirmation=I_UNDERSTAND
gh workflow run manual-automation.yml -f action=VERIFY_SESSION
gh secret delete ADP_TEMP_PASSWORD
```

## 11. Scheduled-workflow inactivity

GitHub can disable scheduled workflows in public repositories after 60 days without repository activity. A repository workflow cannot revive itself once disabled. Use an external weekly monitor that:

- checks `Attendance In` and `Attendance Out` workflow state;
- re-enables only workflows whose state is exactly `disabled_inactivity`;
- never re-enables `disabled_manually` workflows;
- never creates fake keepalive commits.

Without an external monitor, check periodically and use:

```powershell
gh workflow enable attendance-in.yml
gh workflow enable attendance-out.yml
```

## 12. Local operations

```powershell
npm.cmd run credential:status
npm.cmd run credential:verify
npm.cmd run credential:copy
npm.cmd run dashboard
Start-Process http://127.0.0.1:3000
```

The dashboard never displays credentials or exact coordinates and binds only to `127.0.0.1`.
