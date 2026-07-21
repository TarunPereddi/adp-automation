# Repository instructions for coding agents

Before substantive work, read `.agent/README.md`, then the linked architecture and operations notes.

Non-negotiable rules:

- Preserve the fail-closed behavior and the currently validated attendance, leave, geolocation, and password-rotation flows.
- Never submit a live Punch In, Punch Out, password change, credential replacement, or workflow re-enable without explicit authorization for that action.
- Never read, print, commit, or transmit `.env`, passwords, encryption keys, MongoDB URIs, coordinates, cookies, or browser session data.
- Treat MongoDB as the only source of truth for the changing ADP password.
- Keep the repository permissions read-only in GitHub Actions.
- Use `npm.cmd` in Windows PowerShell when the execution policy blocks `npm.ps1`.
- Run `npm.cmd run validate` and `git diff --check` before handing off code changes.
- For a safe deployed check, use `CHECK_ATTENDANCE`; it must not submit attendance.

Do not replace the external workflow-inactivity watcher with fake keepalive commits.
