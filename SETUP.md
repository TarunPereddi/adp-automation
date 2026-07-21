# Setup and production-readiness guide

## 1. Local prerequisites

- Node.js 20.19 or newer
- Git
- A MongoDB Atlas account with MFA enabled
- Access to repository settings and Actions secrets
- Windows PowerShell for the local tooling

```powershell
Copy-Item .env.example .env
npm ci
npm run validate
```

Do not place a portal password in `.env`. `.env` is ignored, but the changing password belongs only in the encrypted MongoDB record.

## 2. MongoDB Atlas Free

Create the Atlas account interactively with the authorized work email, enable MFA, and select only the no-cost Free cluster option. Do not enable paid backups, dedicated nodes, support, or billing.

Create database `adp_automation` and a database user with `readWrite` access only to that database. The application creates these collections and indexes:

| Collection         | Purpose                                    | Important index              |
| ------------------ | ------------------------------------------ | ---------------------------- |
| `credentials`      | Encrypted current and previous password    | unique `accountId`           |
| `portal_sessions`  | Reserved encrypted supported-session state | unique account, TTL expiry   |
| `automation_runs`  | Idempotency and run history                | unique `idempotencyKey`      |
| `automation_locks` | Distributed leases                         | unique `lockKey`, TTL expiry |
| `calendar_checks`  | Verified calendar cache                    | account/date, TTL expiry     |
| `rotation_runs`    | Persistent rotation state history          | unique idempotency key       |
| `system_events`    | Sanitized audit events                     | date and TTL indexes         |

Atlas only accepts clients on its project IP access list. GitHub-hosted runners use changing addresses, so a static `/32` entry is not durable. The zero-cost practical option is often `0.0.0.0/0`, but that exposes the database endpoint to connection attempts. If used, compensate with a long random database password, least-privilege database user, TLS, application-layer encryption, Atlas MFA, and regular access review. MongoDB recommends the smallest possible network ranges; this is a documented tradeoff, not a preferred security posture. See [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/) and [Atlas network-security guidance](https://www.mongodb.com/docs/atlas/architecture/current/network-security/).

Set local `MONGODB_URI`, `MONGODB_DATABASE`, and a new 32-byte `ADP_STORE_KEY`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npm run db:init
npm run credential:seed
npm run credential:verify
```

Store the generated key securely. Losing it makes the encrypted credential unrecoverable.

## 3. GitHub secrets and variables

Create these static repository secrets:

- `ADP_USERNAME`
- `ATTENDANCE_ACCOUNT_ID` (a non-sensitive stable alias, not an employee ID when avoidable)
- `ADP_STORE_KEY`
- `MONGODB_URI`
- `MONGODB_DATABASE`
- `ADP_SECURITY_ANSWERS_JSON` only if organizational policy permits automation of those supported questions
- `ATTENDANCE_LATITUDE`
- `ATTENDANCE_LONGITUDE`
- `ATTENDANCE_LOCATION_ACCURACY_METERS`

Do not create `ADP_PASSWORD`, `GH_TOKEN`, or a changing-password secret. MongoDB is the encrypted source of truth.

Create variables with safe defaults:

```text
AUTOMATION_ENABLED=false
DRY_RUN=true
PORTAL_SELECTORS_VERIFIED=false
MANUAL_HOLIDAYS=
MANUAL_LEAVE_DATES=
```

## 4. Portal validation

Validation must be performed through the normal supported account flow. Do not bypass CAPTCHA, OTP, MFA, or device verification.

For each selector in `src/automation/portal/selectors.ts`, capture sanitized evidence and verify:

1. Login URL and Shadow DOM host hierarchy.
2. Username/password fields and disabled/enabled submit state.
3. A positive authenticated marker that cannot appear on the login page.
4. Security challenge classification.
5. Attendance-state representation and existing timestamps.
6. Punch In and Punch Out controls in every valid state.
7. Positive post-action state evidence.
8. Authoritative holiday and leave source.
9. Password settings route, policy, submission, and fresh-login verification.
10. Whether the portal officially permits remembered/trusted sessions.

Do not set `PORTAL_SELECTORS_VERIFIED=true` until all attendance selectors and positive-state checks are proven. The password-rotation adapter is deliberately not wired to a live route until its flow is proven.

## 5. Dry run and activation

Run `CHECK_LOGIN` and `CHECK_ATTENDANCE` manually while safe-disabled. Review sanitized logs, MongoDB run records, and failure artifacts. Then test a real action only when the current portal state and policy window make it valid.

Production activation requires all three values:

```text
PORTAL_SELECTORS_VERIFIED=true
AUTOMATION_ENABLED=true
DRY_RUN=false
```

Enable them one at a time, re-run diagnostics, and inspect portal state after the first action. A manual live workflow additionally requires `confirmation=I_UNDERSTAND`.

## 6. Scheduled-workflow maintenance

GitHub documents that scheduled workflows in **public repositories** can be disabled after 60 days without repository activity. This project does not create fake commits. Re-enable a disabled workflow from Actions or with `gh workflow enable <workflow-file>`. Keep manual dispatch available and use the dashboard’s missed-run indication. See [GitHub’s schedule event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) and [workflow enable/disable guidance](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows).

## 7. Local dashboard

Set the local environment values, then:

```powershell
npm run dashboard
Start-Process http://127.0.0.1:3000
```

Set a random `DASHBOARD_AUTH_SECRET` if other local processes are not trusted, and send it as a Bearer token to the JSON endpoint. The dashboard never displays secrets or exact coordinates.
