export interface SelectorDefinition {
  selector: string;
  verified: boolean;
  evidence: string;
}

// Every live selector remains blocked until validated against the real portal.
// Fixture selectors are stable and intentionally separate from live evidence.
export const selectors = {
  username: {
    selector: 'input[placeholder="Enter your email or username"]',
    verified: true,
    evidence: 'Live shadow input verified 2026-07-21 at /ng/login',
  },
  password: {
    selector: 'input[placeholder="Password"]',
    verified: true,
    evidence: 'Live shadow input verified 2026-07-21 at /ng/login',
  },
  loginButton: {
    selector: '.login-page__primary-button',
    verified: true,
    evidence: 'Live Sign In button verified 2026-07-21 at /ng/login',
  },
  authenticatedMarker: {
    selector: 'sdf-button[aria-label="Punch"]',
    verified: true,
    evidence: 'Live dashboard verified 2026-07-21 at /ng/dashboard',
  },
  punchButton: {
    selector: 'sdf-button[aria-label="Punch"]',
    verified: true,
    evidence: 'Live dashboard Punch control verified 2026-07-22',
  },
  confirmPunchButton: {
    selector: 'sdf-button[aria-label="Confirm punch"]',
    verified: true,
    evidence: 'Live Punch dialog confirmation control verified 2026-07-22',
  },
  punchInTime: {
    selector: 'sdf-quick-stat[label="Punch In Time"]',
    verified: true,
    evidence: 'Live Punch Information stat verified 2026-07-22',
  },
  punchOutTime: {
    selector: 'sdf-quick-stat[label="Punch Out Time"]',
    verified: true,
    evidence: 'Live Punch Information stat verified 2026-07-22',
  },
  punchLocation: {
    selector:
      'sdf-flag-layout:has(sdf-icon[icon="location"]) .punch-dialog-row-value[slot="supporting-content"]',
    verified: true,
    evidence: 'Live Punch dialog Location row verified 2026-07-22',
  },
} satisfies Record<string, SelectorDefinition>;
