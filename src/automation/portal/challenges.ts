import type { Page } from 'puppeteer';
import type { VerificationChallenge } from '../../types/domain.js';

export async function classifyChallenge(page: Page): Promise<VerificationChallenge> {
  const signals = await page.evaluate(() => {
    const text = (document.body?.innerText ?? '').toLowerCase();
    const visibleControls = [
      ...document.querySelectorAll<HTMLElement>('iframe, [placeholder], [aria-label]'),
    ]
      .filter((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          bounds.width > 0 &&
          bounds.height > 0
        );
      })
      .map((element) =>
        [
          element.getAttribute('placeholder'),
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
          element instanceof HTMLIFrameElement ? element.src : undefined,
        ]
          .filter(Boolean)
          .join(' '),
      )
      .join(' ')
      .toLowerCase();
    return `${text.slice(0, 50_000)} ${visibleControls.slice(0, 20_000)}`;
  });
  const all = signals;
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
