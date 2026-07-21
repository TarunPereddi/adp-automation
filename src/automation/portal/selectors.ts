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
    verified: false,
    evidence: 'Migrated from unfinished Claude implementation; live verification required',
  },
  password: {
    selector: 'input[placeholder="Password"]',
    verified: false,
    evidence: 'Migrated from unfinished Claude implementation; live verification required',
  },
  loginButton: {
    selector: '.login-page__primary-button',
    verified: false,
    evidence: 'Migrated from unfinished Claude implementation; live verification required',
  },
  authenticatedMarker: {
    selector: 'sdf-button[aria-label="Punch"]',
    verified: true,
    evidence: 'Live dashboard verified 2026-07-21 at /ng/dashboard',
  },
  punchInButton: {
    selector: '[data-testid="punch-in"], button[aria-label="Punch In"]',
    verified: false,
    evidence: 'Requires live portal validation',
  },
  punchOutButton: {
    selector: '[data-testid="punch-out"], button[aria-label="Punch Out"]',
    verified: false,
    evidence: 'Requires live portal validation',
  },
  attendanceState: {
    selector: '[data-testid="attendance-state"]',
    verified: false,
    evidence: 'Requires live portal validation',
  },
} satisfies Record<string, SelectorDefinition>;
