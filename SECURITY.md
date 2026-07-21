# Security model

## Protected assets

- Current, previous, and staged ADP credentials.
- `ADP_STORE_KEY` and MongoDB connection credentials.
- Authorized attendance coordinates.
- Attendance, leave, and rotation history.
- Browser screenshots and portal diagnostics.

## Trust boundaries

GitHub Actions receives static bootstrap secrets and connects over TLS to MongoDB Atlas and ADP SecurTime. MongoDB stores application-encrypted ADP credentials; the encryption key remains in GitHub Secrets and the authorized operator's protected local `.env`, never in MongoDB or Git.

## Controls

- AES-256-GCM with a fresh 96-bit IV and authentication tag for every encrypted value.
- A generated replacement is staged encrypted before portal submission.
- Fresh-session login verification is required before promoting a staged password.
- Current and previous credentials are retained after successful rotation; staged data is removed.
- MongoDB locks and unique idempotency keys prevent concurrent or duplicate actions.
- Portal uncertainty, calendar uncertainty, failed geolocation, and credential inconsistency fail closed.
- Security challenges are classified and never bypassed.
- Workflow repository permission is read-only.
- Failure artifacts are sanitized and retained for seven days.
- Credential display is disabled in CI; local display requires explicit confirmation and is audited.
- The local dashboard binds to `127.0.0.1` and never returns credentials or exact coordinates.

## Persistent GitHub Secrets

Only static bootstrap values belong in GitHub Secrets:

- account username and stable alias;
- MongoDB URI and database name;
- encryption key;
- authorized latitude, longitude, and accuracy.

The changing ADP password belongs only in the encrypted MongoDB credential record. `ADP_TEMP_PASSWORD` is permitted solely for a confirmed one-time reset sync and must be deleted immediately afterward.

## Known residual risks

- GitHub-hosted runners may require a broad Atlas IP allowlist because runner addresses change.
- DOM-based screenshot redaction cannot guarantee removal of every field after an unreviewed portal redesign.
- GitHub repository administrators and Atlas administrators are trusted.
- ADP selectors and behavior can change without notice; `PORTAL_SELECTORS_VERIFIED` must be disabled during revalidation.
- The configured geolocation is trusted configuration and must represent an employer-authorized attendance location.
- An external monitor is needed for GitHub's inactivity disablement because a disabled repository schedule cannot self-recover.

## Secret-handling rules

- Never commit `.env`, encryption keys, passwords, MongoDB URIs, coordinates, cookies, or downloaded failure artifacts.
- Never place a password in a workflow input, issue, PR, screenshot, or log.
- Prefer `credential:copy`; it clears an unchanged clipboard after 30 seconds.
- Treat `credential:show` as an audited recovery-only command.
- Rotate all affected values after suspected exposure.

## Incident reporting

Disable attendance first, retain only sanitized run IDs and failure categories, and follow [RECOVERY.md](RECOVERY.md). Avoid repeated authentication attempts during an incident.
