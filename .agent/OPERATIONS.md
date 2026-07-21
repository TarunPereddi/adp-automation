# Production operations and evidence

## Safe status audit

```powershell
git status --short
git rev-parse HEAD
git ls-remote origin refs/heads/main
gh workflow list --all
gh variable list
npm.cmd run credential:verify
```

Expected production state:

```text
Attendance In    active
Attendance Out   active
Manual Automation active
AUTOMATION_ENABLED=true
DRY_RUN=false
PORTAL_SELECTORS_VERIFIED=true
```

## Safe deployed diagnostic

```powershell
gh workflow run manual-automation.yml -f action=CHECK_ATTENDANCE
```

This is safe-disabled inside the manual workflow. A result such as `OUTSIDE_TIME_WINDOW` is acceptable only after logs show a verified live leave result. It must never submit a punch.

## Live actions

Do not dispatch these without explicit contemporaneous operator authorization:

```powershell
gh workflow run manual-automation.yml -f action=PUNCH_IN -f confirmation=I_UNDERSTAND
gh workflow run manual-automation.yml -f action=PUNCH_OUT -f confirmation=I_UNDERSTAND
gh workflow run manual-automation.yml -f action=ROTATE_PASSWORD -f confirmation=I_UNDERSTAND
gh workflow run manual-automation.yml -f action=SYNC_CREDENTIAL -f confirmation=I_UNDERSTAND
```

## Pause and resume

Pause before password reset, selector investigation, or account recovery:

```powershell
gh variable set AUTOMATION_ENABLED --body false
gh variable set DRY_RUN --body true
gh workflow disable attendance-in.yml
gh workflow disable attendance-out.yml
```

Resume only after safe verification:

```powershell
gh variable set AUTOMATION_ENABLED --body true
gh variable set DRY_RUN --body false
gh workflow enable attendance-in.yml
gh workflow enable attendance-out.yml
```

## Credential operations

```powershell
npm.cmd run credential:status
npm.cmd run credential:verify
npm.cmd run credential:copy
```

`credential:copy` clears the clipboard after 30 seconds. Do not use `credential:show` during routine work.

## Holiday maintenance

`MANUAL_HOLIDAYS` contains only mandatory dates, comma-separated as `YYYY-MM-DD`. Optional holidays must stay out of this list. Live ADP leave status remains authoritative for employee leave.

## Password reset

Use the exact pause, temporary-secret, sync, rotate, verify, delete, and resume sequence in root `SETUP.md`. Never write a temporary password directly into source, `.env`, a workflow input, or logs.

## Inactivity watcher

The external Codex automation is named `ADP workflow inactivity watchdog`. It runs weekly Monday at 08:00 local time and may re-enable only `disabled_inactivity`. It must leave `disabled_manually` untouched and must not create keepalive commits.

## Live validation evidence

- Punch In: https://github.com/TarunPereddi/adp-automation/actions/runs/29859742729
- Punch Out: https://github.com/TarunPereddi/adp-automation/actions/runs/29861868446
- Full leave-table workday verification: https://github.com/TarunPereddi/adp-automation/actions/runs/29865053121
- Completed password rotation: https://github.com/TarunPereddi/adp-automation/actions/runs/29866514221
- Independent new-password session verification: https://github.com/TarunPereddi/adp-automation/actions/runs/29866720686
- Post-cleanup Linux install/build/live diagnostic: https://github.com/TarunPereddi/adp-automation/actions/runs/29868676585

These runs prove the 2026-07-22 baseline; they do not waive revalidation after a portal redesign.
