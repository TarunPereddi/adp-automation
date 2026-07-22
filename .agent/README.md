# Future-agent context

This folder is the durable, secret-free handoff for agents working on `adp-automation`.

Read in this order:

1. [ARCHITECTURE.md](ARCHITECTURE.md) for runtime flows and file ownership.
2. [OPERATIONS.md](OPERATIONS.md) for production state, safe commands, and live evidence.
3. Root [SETUP.md](../SETUP.md), [RECOVERY.md](../RECOVERY.md), and [SECURITY.md](../SECURITY.md) before changing infrastructure or credential behavior.

## Objective

Automate one authorized ADP SecurTime account's weekday Punch In and Punch Out while refusing to act on weekends, mandatory holidays, Approved/Submitted leave, invalid time windows, uncertain portal state, failed geolocation, security challenges, or inconsistent credentials.

## Validated baseline

As of 2026-07-22:

- Punch In and Punch Out were submitted and positively verified against the live tenant.
- Browser timezone is `Asia/Kolkata`; configured geolocation was verified before portal actions.
- The dashboard-to-full-leave flow and `Approved`/`Submitted`/`Withdrawn` status behavior were verified live.
- The forced password-change screen, encrypted staging, portal update, fresh login, MongoDB promotion, and interrupted-confirmation recovery were verified live.
- Production schedules were active with `AUTOMATION_ENABLED=true`, `DRY_RUN=false`, and `PORTAL_SELECTORS_VERIFIED=true`.
- An external Codex automation named `ADP workflow inactivity watchdog` checks weekly for GitHub's `disabled_inactivity` state. It does not re-enable manually disabled workflows.

## Preserve these invariants

- Unknown means no punch.
- Calendar and weekend preflight runs before loading credentials or opening a browser when possible.
- Live leave lookup must succeed before a workday can be confirmed.
- A portal action is successful only when a fresh portal reload exposes a persisted, parseable attendance time; button-label transitions never count as success.
- Attendance idempotency is scoped to one GitHub workflow attempt, so a failed attempt cannot block a later attempt for the same day.
- Password rotation occurs only when ADP requires it, never on calendar dates.
- A generated password is encrypted and staged before portal submission.
- MongoDB promotion occurs only after fresh-session verification.
- Temporary reset credentials never remain in GitHub Secrets.
- Manual workflow actions that mutate portal or credential state require `I_UNDERSTAND`.
- External workflow monitoring may repair only `disabled_inactivity`, never `disabled_manually`.

## Secret boundaries

The ignored local `.env` may contain the Atlas URI, encryption key, account alias, username, and coordinates. Do not inspect or reproduce its contents. The current ADP password is encrypted in MongoDB and can be accessed only through the audited local credential CLI.
