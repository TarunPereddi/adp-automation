import type { ElementHandle, Page } from 'puppeteer';

export async function deepQuery(
  page: Page,
  selector: string,
): Promise<ElementHandle<Element> | null> {
  const handle = await page.evaluateHandle((target) => {
    const visit = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(target);
      if (direct) return direct;
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot) {
          const nested = visit(element.shadowRoot);
          if (nested) return nested;
        }
      }
      return null;
    };
    return visit(document);
  }, selector);
  return handle.asElement() as ElementHandle<Element> | null;
}

export async function waitForDeep(
  page: Page,
  selector: string,
  timeoutMs = 30_000,
): Promise<ElementHandle<Element>> {
  await page.waitForFunction(
    (target) => {
      const visit = (root: Document | ShadowRoot): boolean => {
        if (root.querySelector(target)) return true;
        return [...root.querySelectorAll('*')].some(
          (element) => element.shadowRoot && visit(element.shadowRoot),
        );
      };
      return visit(document);
    },
    { timeout: timeoutMs },
    selector,
  );
  const element = await deepQuery(page, selector);
  if (!element) throw new Error(`Selector disappeared after wait: ${selector}`);
  return element;
}

export async function typeDeep(page: Page, selector: string, value: string): Promise<void> {
  const element = await waitForDeep(page, selector);
  await element.click({ count: 3 });
  await element.type(value, { delay: 25 });
}

export async function deepValue(page: Page, selector: string): Promise<string | undefined> {
  const element = await deepQuery(page, selector);
  if (!element) return undefined;
  return element.evaluate((target) =>
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target.value
      : undefined,
  );
}
