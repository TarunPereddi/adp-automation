import { readFile } from 'node:fs/promises';
import puppeteer from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classifyChallenge } from '../src/automation/portal/challenges.js';
import { normalizedPunchTime } from '../src/automation/portal/portalAdapter.js';
import { deepQuery, deepQueryVisible, typeDeep } from '../src/automation/portal/shadowDom.js';

describe('browser fixtures', () => {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  });
  afterAll(async () => browser.close());

  it('finds and types into nested Shadow DOM fields', async () => {
    const page = await browser.newPage();
    await page.setContent(await readFile('fixtures/shadow-login.html', 'utf8'));
    await typeDeep(
      page,
      'input[placeholder="Enter your email or username"]',
      'fixture@example.test',
    );
    const input = await deepQuery(page, 'input[placeholder="Enter your email or username"]');
    expect(await input?.evaluate((element) => (element as HTMLInputElement).value)).toBe(
      'fixture@example.test',
    );
    await page.close();
  });

  it('classifies CAPTCHA without attempting a bypass', async () => {
    const page = await browser.newPage();
    await page.setContent(await readFile('fixtures/challenges.html', 'utf8'));
    expect(await classifyChallenge(page)).toBe('CAPTCHA_REQUIRED');
    await page.close();
  });

  it('selects the visible portal action when a hidden stale control also exists', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <sdf-button aria-label="Punch" style="display:none">Punch</sdf-button>
      <sdf-button aria-label="Punch">Punch Out</sdf-button>
    `);
    const button = await deepQueryVisible(page, 'sdf-button[aria-label="Punch"]');
    expect(await button?.evaluate((element) => element.textContent?.trim())).toBe('Punch Out');
    await page.close();
  });

  it('does not treat labels or button transitions as persisted punch times', () => {
    expect(normalizedPunchTime('Punch In Time')).toBeUndefined();
    expect(normalizedPunchTime('Punch Out')).toBeUndefined();
    expect(normalizedPunchTime(':')).toBeUndefined();
  });

  it('extracts a real persisted portal time', () => {
    expect(normalizedPunchTime('Punch In Time 09:03 AM')).toBe('09:03 AM');
    expect(normalizedPunchTime('18:07:12')).toBe('18:07:12');
  });
});
