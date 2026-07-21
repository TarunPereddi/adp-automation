# Security model

## Assets

- Portal credential and previous recovery credential
- Encryption key
- MongoDB connection credential
- Portal session state, if supported later
- Security answers
- Attendance state and employee metadata
- Fixed authorized coordinates

## Trust boundaries

GitHub Actions receives static bootstrap secrets and connects over TLS to Atlas and the attendance portal. MongoDB stores only application-encrypted portal credentials. The encryption key remains in GitHub secrets and the operator’s local secret environment, never in MongoDB or Git.

## Controls

- Versioned AES-256-GCM with a fresh 96-bit IV and authentication tag per encryption.
- Least-privilege MongoDB user and unique account/database indexes.
- Atomic expiring MongoDB locks and idempotency keys.
- Maximum two authentication attempts by configuration.
- Typed challenge outcomes; no retry for security challenges.
- Recursive redaction for secrets, tokens, URIs, email addresses, and coordinates.
- Screenshot DOM blurring before failure capture and seven-day artifact retention.
- Read-only workflow repository permissions.
- Local dashboard bound to `127.0.0.1`.
- Secret display disabled in CI and explicit locally.

## Known residual risks

- A broad Atlas access-list entry may be required for changing GitHub runner IPs. Strong database authentication and application encryption reduce impact but do not replace network restriction.
- DOM-based screenshot redaction cannot guarantee removal of every new portal field. Failure artifacts must be reviewed after selector/UI changes.
- GitHub administrators and anyone with Actions-secret access remain trusted.
- Attendance and leave APIs/selectors are not yet live-validated; production is blocked by configuration.
- Supported encrypted session reuse is reserved in the schema but disabled until portal permission and expiry behavior are proven.

## Secret handling

Never paste secrets into issues, workflow inputs, logs, screenshots, commits, or chat. Rotate a database password or encryption key if exposure is suspected. Do not store mailbox passwords. Verification codes are one-use data and must not be persisted.

## Reporting

Disable all workflows first for a suspected security problem, preserve sanitized run IDs, then follow [RECOVERY.md](RECOVERY.md). Do not repeatedly test authentication during an incident.
