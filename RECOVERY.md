# Recovery runbook

## Stop automation

Set repository variable `AUTOMATION_ENABLED=false` and `DRY_RUN=true`, then disable both scheduled attendance workflows. Confirm no job is still running.

## Authentication challenge or account lock

1. Stop retries immediately.
2. Use the portal manually through the supported flow.
3. Do not bypass CAPTCHA, MFA, OTP, or unknown-device checks.
4. Confirm the account is not locked and record only the sanitized challenge category.
5. Re-run `CHECK_LOGIN` once after manual resolution.

## Credential inconsistency

The rotation design retains only current and previous encrypted candidates and caps authentication attempts at two.

1. Keep automation disabled.
2. Inspect credential metadata with `npm run credential:status`; do not display a password.
3. If rotation reached `PORTAL_PASSWORD_CHANGED`, test the confirmed new candidate once through recovery tooling when implemented.
4. Test the previous candidate only if the first failed and the account is not near lockout.
5. Reconcile MongoDB only after proving which credential works.
6. Mark `MANUAL_INTERVENTION_REQUIRED` if neither state can be proven.

The current live rotation adapter is intentionally disabled because the portal policy and change form are unverified.

## MongoDB unavailable

Do not punch without locks, idempotency, and credential state. Check Atlas status, cluster availability, IP access list, database-user permissions, and URI validity. Never fall back to a plaintext or local password in GitHub Actions.

## Selector change

Keep `PORTAL_SELECTORS_VERIFIED=false`. Capture a sanitized diagnostic, update the central registry, extend browser fixtures, run `npm run validate`, and validate the real portal without submitting attendance. Re-enable only with positive authentication and post-action evidence.

## Missed run

Check the local dashboard, GitHub workflow status, current portal state, workday evidence, and allowed time window. Never backfill outside policy windows. A manual action requires `I_UNDERSTAND` and still passes all application safety gates.

## Scheduled workflow disabled

Use the repository Actions UI or:

```powershell
gh workflow enable attendance-in.yml
gh workflow enable attendance-out.yml
```

Do not create fake keepalive commits.

## Suspected secret exposure

1. Disable workflows.
2. Rotate the MongoDB database user password.
3. Generate a new encryption key only after decrypting and re-encrypting the credential through a reviewed migration.
4. Revoke exposed portal sessions.
5. Review Atlas access history and GitHub audit/activity logs.
6. Remove any sensitive artifact and rotate every value it may contain.
