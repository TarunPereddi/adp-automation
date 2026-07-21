import type { Page } from 'puppeteer';
import type { VerificationChallenge } from '../../types/domain.js';

export async function classifyChallenge(page: Page): Promise<VerificationChallenge> {
  const signals = await page.evaluate(() => {
    const text = (document.body?.innerText ?? '').toLowerCase();
    const html = document.documentElement.innerHTML.toLowerCase();
    return { text: text.slice(0, 50_000), html: html.slice(0, 100_000) };
  });
  const all = `${signals.text} ${signals.html}`;
  if (/captcha|recaptcha|hcaptcha/.test(all)) return 'CAPTCHA_REQUIRED';
  if (/security question|placeholder=["']answer/.test(all)) return 'SECURITY_QUESTION';
  if (/email (?:verification )?code|code sent to your email/.test(all))
    return 'EMAIL_CODE_REQUIRED';
  if (/one[- ]time password|\botp\b/.test(all)) return 'OTP_REQUIRED';
  if (/multi[- ]factor|authenticator app|\bmfa\b/.test(all)) return 'MFA_REQUIRED';
  if (/unknown device|unrecognized (?:browser|device)|verify this device/.test(all))
    return 'UNKNOWN_DEVICE';
  return 'NONE';
}
