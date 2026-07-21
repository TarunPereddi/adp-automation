import type { Page } from 'puppeteer';
import type { AppConfig } from '../../config/config.js';
import { BrowserManager } from '../browser/browserManager.js';
import { PortalAdapter } from '../portal/portalAdapter.js';
import { deepQueryVisible, deepValue, typeDeep, waitForDeepVisible } from '../portal/shadowDom.js';
import { selectors } from '../portal/selectors.js';
import type { PasswordPolicy } from './passwordPolicy.js';
import type { PasswordPortal } from './service.js';

type RuntimeConfig = AppConfig & {
  portal: AppConfig['portal'] & { username: string; accountId: string };
  attendanceLocation: NonNullable<AppConfig['attendanceLocation']>;
};

export class LivePasswordPortal implements PasswordPortal {
  private manager?: BrowserManager;
  private page?: Page;
  private portal?: PortalAdapter;
  private passwordChangeRequired = false;

  constructor(private readonly config: RuntimeConfig) {}

  rotationRequired(): boolean {
    return this.passwordChangeRequired;
  }

  async verifyPassword(password: string): Promise<boolean> {
    await this.resetBrowser();
    this.manager = new BrowserManager(this.config);
    this.page = await this.manager.open();
    this.portal = new PortalAdapter(this.page, this.config);
    await this.portal.openLogin();
    if (!(await this.manager.verifyConfiguredLocation(this.page))) {
      throw new Error('Browser location verification failed during password verification');
    }
    const login = await this.portal.login(password);
    if (login.ok && login.value?.authenticated) {
      this.passwordChangeRequired = false;
      return true;
    }
    const changeForm = await deepQueryVisible(this.page, selectors.currentPassword.selector);
    this.passwordChangeRequired =
      this.page.url().includes('/ng/changepassword') && Boolean(changeForm);
    return this.passwordChangeRequired;
  }

  async discoverPasswordPolicy(): Promise<PasswordPolicy | null> {
    if (!this.page || !this.passwordChangeRequired) return null;
    const controls = await Promise.all([
      deepQueryVisible(this.page, selectors.currentPassword.selector),
      deepQueryVisible(this.page, selectors.newPassword.selector),
      deepQueryVisible(this.page, selectors.confirmPassword.selector),
      deepQueryVisible(this.page, selectors.updatePasswordButton.selector),
    ]);
    if (controls.some((control) => !control)) return null;
    return {
      minLength: 12,
      maxLength: 16,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: true,
      allowedSpecial: '@',
      disallowedSubstrings: [
        this.config.portal.username.split('@')[0] ?? '',
        'infoservices',
        'securtime',
      ],
    };
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    if (!this.page || !this.passwordChangeRequired) return false;
    await typeDeep(this.page, selectors.currentPassword.selector, oldPassword);
    await typeDeep(this.page, selectors.newPassword.selector, newPassword);
    await typeDeep(this.page, selectors.confirmPassword.selector, newPassword);
    const valuesRetained =
      (await deepValue(this.page, selectors.currentPassword.selector)) === oldPassword &&
      (await deepValue(this.page, selectors.newPassword.selector)) === newPassword &&
      (await deepValue(this.page, selectors.confirmPassword.selector)) === newPassword;
    if (!valuesRetained) throw new Error('Password-change fields did not retain their values');
    const update = await waitForDeepVisible(
      this.page,
      selectors.updatePasswordButton.selector,
      10_000,
    );
    await update.click();
    await this.page
      .waitForFunction(
        () =>
          !window.location.pathname.includes('/changepassword') ||
          /password\s+(?:has been\s+)?(?:changed|updated)\s+successfully/i.test(
            document.body?.innerText ?? '',
          ),
        { timeout: 30_000 },
      )
      .catch(() => undefined);
    const pageText = await this.page.evaluate(() => document.body?.innerText ?? '');
    const rejected =
      /incorrect current password|password.*(?:invalid|cannot|must|should|required)|failed to (?:change|update)/i.test(
        pageText,
      );
    const confirmed =
      !this.page.url().includes('/changepassword') ||
      /password\s+(?:has been\s+)?(?:changed|updated)\s+successfully/i.test(pageText);
    if (rejected || !confirmed) return false;
    this.passwordChangeRequired = false;
    return true;
  }

  async close(): Promise<void> {
    await this.resetBrowser();
  }

  private async resetBrowser(): Promise<void> {
    await this.manager?.close().catch(() => undefined);
    this.manager = undefined;
    this.page = undefined;
    this.portal = undefined;
  }
}
