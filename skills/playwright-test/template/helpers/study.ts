import { type Page } from '@playwright/test';

/**
 * Create an anonymous participant and enroll them in a study.
 * The /_anon-login endpoint shows a "Redirecting..." page with a
 * "click here" link. We follow it to reach the actual study page.
 */
export async function anonLogin(page: Page, slug: string): Promise<void> {
  await page.goto(`/_anon-login/${slug}`);
  await page.waitForLoadState('networkidle');
  // The login page renders a redirect page — follow the link to the study
  if (page.url().includes('_anon-login')) {
    await page.goto(`/study/${slug}`);
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Click a navigation button (rendered as <a class="button next-button">).
 *
 * Congame uses the Unpoly framework: buttons have `up-follow=".step"` which
 * makes clicks do AJAX partial page replacement instead of full navigation.
 * This breaks Playwright's navigation detection. We bypass Unpoly entirely
 * by reading the button's href and navigating directly.
 */
export async function clickButton(page: Page, label?: string): Promise<void> {
  const locator = label
    ? page.locator('a.button.next-button', { hasText: label })
    : page.locator('a.button.next-button').first();
  const href = await locator.getAttribute('href');
  if (!href) {
    throw new Error(`clickButton: button has no href${label ? ` (label: "${label}")` : ''}`);
  }
  await page.goto(href);
  await page.waitForLoadState('networkidle');
}

/**
 * Submit the current form and wait for navigation.
 *
 * Some conscript forms render with Unpoly attributes (e.g.
 * `up-follow=".step"`) that intercept the submit event and do an
 * in-place AJAX swap instead of a real navigation. Playwright's
 * `waitForLoadState('networkidle')` returns before the swap settles,
 * so reading the page right after a button click yields stale content.
 *
 * To avoid that, when the form carries Unpoly attributes we bypass
 * Unpoly entirely by calling `form.submit()` — the low-level DOM
 * method that does NOT fire the submit event, so Unpoly's listener
 * never runs and the browser performs a normal POST + navigation.
 *
 * For forms without Unpoly attributes we keep the original behavior
 * (click the submit button) so client-side `submit` listeners on
 * other forms still run.
 */
export async function submitForm(page: Page): Promise<void> {
  const form = page.locator('form').first();
  const usesUnpoly =
    (await form.getAttribute('up-follow')) !== null ||
    (await form.getAttribute('up-submit')) !== null ||
    (await form.getAttribute('up-target')) !== null;

  if (usesUnpoly) {
    // Strip Unpoly attributes so its submit-event listener no-ops,
    // then click the submit button as normal. This sends the form's
    // current data via a real browser POST + navigation, which
    // Playwright's `waitForLoadState('networkidle')` handles cleanly.
    await form.evaluate((f) => {
      f.removeAttribute('up-follow');
      f.removeAttribute('up-submit');
      f.removeAttribute('up-target');
      f.removeAttribute('up-transition');
    });
  }
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState('networkidle');
}

/**
 * Fill a number input field. If multiple number inputs exist, use nth (0-based).
 */
export async function fillNumber(page: Page, value: number, nth = 0): Promise<void> {
  await page.locator('input[type="number"]').nth(nth).fill(String(value));
}

/**
 * Click a radio button by its value attribute.
 */
export async function selectRadio(page: Page, value: string): Promise<void> {
  await page.locator(`input[type="radio"][value="${value}"]`).click();
}

/**
 * Select a dropdown option by value.
 */
export async function selectDropdown(page: Page, value: string, nth = 0): Promise<void> {
  await page.locator('select').nth(nth).selectOption(value);
}

/**
 * Get the text content of the study step container.
 */
export async function getPageText(page: Page): Promise<string> {
  return (await page.locator('div.container').first().textContent()) ?? '';
}

/**
 * Check whether the page text contains a given string.
 */
export async function pageContains(page: Page, text: string): Promise<boolean> {
  const content = await getPageText(page);
  return content.includes(text);
}
