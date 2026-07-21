import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'puppeteer';
import { sanitize } from '../../security/sanitize.js';

export async function captureFailure(
  page: Page | undefined,
  summary: Record<string, unknown>,
  outputDirectory = 'failure',
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, 'run-summary.json'),
    JSON.stringify(sanitize(summary), null, 2),
    'utf8',
  );
  if (!page) return;
  await page.evaluate(() => {
    const sensitive = document.querySelectorAll(
      'input, [data-testid*="employee"], [class*="employee"], [class*="profile"], [class*="location"]',
    );
    sensitive.forEach((element) => {
      (element as HTMLElement).style.filter = 'blur(16px)';
    });
  });
  await page.screenshot({
    path: path.join(outputDirectory, 'screenshot-redacted.png'),
    fullPage: true,
  });
}
