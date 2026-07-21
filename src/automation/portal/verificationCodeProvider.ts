export interface VerificationCodeResult {
  status: 'PROVIDED' | 'TIMED_OUT' | 'UNAVAILABLE';
  code?: string;
}

export interface VerificationCodeProvider {
  waitForCode(options: {
    challengeId: string;
    requestedAfter: Date;
    timeoutMs: number;
  }): Promise<VerificationCodeResult>;
}

export class ManualVerificationCodeProvider implements VerificationCodeProvider {
  async waitForCode(): Promise<VerificationCodeResult> {
    // GitHub Actions cannot securely pause for interactive input. A later manual
    // continuation job may supply a one-use code through a protected channel.
    return { status: 'UNAVAILABLE' };
  }
}
