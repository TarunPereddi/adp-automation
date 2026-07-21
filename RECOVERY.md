# Recovery runbook

## First response: stop automation

```powershell
gh variable set AUTOMATION_ENABLED --body false
gh variable set DRY_RUN --body true
gh workflow disable attendance-in.yml
gh workflow disable attendance-out.yml
```

Confirm that no attendance or rotation job is still running. The external inactivity watcher must never re-enable workflows in `disabled_manually` state.

## Authentication challenge or account lock

1. Stop automated retries.
2. Resolve the challenge through the supported ADP flow.
3. Do not bypass CAPTCHA, OTP, MFA, email verification, security questions, or device verification.
4. Confirm the account is not locked.
5. Run `VERIFY_SESSION` once.
6. Restore production only after a successful login and calendar check.

## Password rotation interruption

Rotation stages the generated candidate encrypted in MongoDB before submitting it to ADP.

1. Keep attendance disabled.
2. Run `npm.cmd run credential:status` and inspect `rotationStatus` without displaying a password.
3. If the first rotation ended ambiguously after submission, do **not** overwrite MongoDB with another password.
4. Re-run the confirmed `ROTATE_PASSWORD` action once. It tests the current credential and then the staged candidate in fresh browser sessions; a valid staged candidate is promoted automatically.
5. Run `VERIFY_SESSION` after `COMPLETED`.
6. If the recovery retry returns `MANUAL_INTERVENTION_REQUIRED`, stop and inspect the sanitized rotation history before another login attempt.

## Forgot Password temporary credential

Follow Section 10 of [SETUP.md](SETUP.md). `ADP_TEMP_PASSWORD` must exist only long enough to run `SYNC_CREDENTIAL`; delete it after the rotation attempt. Never leave a changing password in GitHub Secrets.

## MongoDB unavailable

Do not punch without MongoDB locks, idempotency, and credential state. Check:

- Atlas service and cluster availability;
- Atlas IP access list;
- database-user `readWrite` permission for the configured database;
- connection URI and TLS;
- whether `ADP_STORE_KEY` matches the key used to encrypt the stored credential.

Never fall back to a plaintext password in the workflow.

## Selector or portal-flow change

1. Set `PORTAL_SELECTORS_VERIFIED=false` and keep automation disabled.
2. Capture sanitized page evidence through the normal account flow.
3. Update the central selector registry and relevant fixtures/tests.
4. Run `npm.cmd run validate`.
5. Run `CHECK_ATTENDANCE` without a live punch.
6. Re-enable only after positive authentication, leave, location, and portal-state evidence.

## Missed attendance run

Check GitHub workflow state, recent MongoDB run records, current ADP attendance state, calendar evidence, and the configured time window. Never backfill outside the allowed application window. A manual action still requires `I_UNDERSTAND` and passes all safety gates.

## Workflow disabled for inactivity

If state is `disabled_inactivity`, the external watcher or an operator may enable it. If state is `disabled_manually`, investigate why it was stopped before enabling it.

```powershell
gh workflow list --all
gh workflow enable attendance-in.yml
gh workflow enable attendance-out.yml
```

## Suspected secret exposure

1. Disable workflows and production variables.
2. Rotate the Atlas database-user password.
3. Revoke exposed portal sessions or trigger the supported password-reset flow.
4. If `ADP_STORE_KEY` was exposed, decrypt and re-encrypt the credential through a reviewed migration before replacing the key.
5. Review GitHub and Atlas audit history.
6. Remove exposed artifacts and rotate every value they may contain.
