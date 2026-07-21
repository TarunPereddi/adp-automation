import puppeteer, { type Browser, type Page } from 'puppeteer';
import type { AppConfig } from '../../config/config.js';

export class BrowserManager {
  private browser?: Browser;

  constructor(
    private readonly config: AppConfig & {
      attendanceLocation: NonNullable<AppConfig['attendanceLocation']>;
    },
  ) {}

  async open(): Promise<Page> {
    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    const page = await this.browser.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1366, height: 768 });
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions(this.config.portal.origin, ['geolocation']);
    await page.setGeolocation({
      latitude: this.config.attendanceLocation.latitude,
      longitude: this.config.attendanceLocation.longitude,
      accuracy: this.config.attendanceLocation.accuracyMeters,
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    return page;
  }

  async verifyConfiguredLocation(page: Page): Promise<boolean> {
    const expected = this.config.attendanceLocation;
    const actual = await page.evaluate(
      () =>
        new Promise<{ latitude: number; longitude: number; accuracy: number }>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (position) =>
                resolve({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                }),
              reject,
              { timeout: 10_000 },
            );
          },
        ),
    );
    const tolerance = 0.00001;
    return (
      Math.abs(actual.latitude - expected.latitude) <= tolerance &&
      Math.abs(actual.longitude - expected.longitude) <= tolerance
    );
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = undefined;
  }
}
