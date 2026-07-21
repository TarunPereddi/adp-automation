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
