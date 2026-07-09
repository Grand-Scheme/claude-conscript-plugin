import { type Browser, type BrowserContext, type Page } from '@playwright/test';
import { anonLogin } from './study';

export interface Participant {
  id: number;
  context: BrowserContext;
  page: Page;
}

/**
 * Create N anonymous participants, each in their own browser context.
 * Each participant is enrolled in the study via anonymous login.
 */
export async function createParticipants(
  browser: Browser,
  count: number,
  slug: string,
): Promise<Participant[]> {
  const participants: Participant[] = [];
  for (let i = 0; i < count; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await anonLogin(page, slug);
    participants.push({ id: i, context, page });
  }
  return participants;
}

/**
 * Wait for the current page to advance past a waiting/matchmaking step.
 *
 * Congame waiting pages inject a setTimeout that reloads the page.
 * This function passively monitors reloads until the page no longer
 * contains a reload script, meaning the server has advanced the
 * participant past the waiting step.
 */
export async function waitForAdvance(page: Page, timeout = 60_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    await page.waitForLoadState('domcontentloaded');
    const hasRefresh = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      return Array.from(scripts).some(
        (s) => s.textContent?.includes('document.location.reload') ?? false,
      );
    });
    if (!hasRefresh) return;
    // Wait for the page's own setTimeout to trigger a reload
    try {
      await page.waitForNavigation({ timeout: 15_000 });
    } catch {
      // Navigation may have already happened; loop and re-check
    }
  }
  throw new Error(`Timed out after ${timeout}ms waiting for page to advance`);
}

/**
 * Close all participant browser contexts.
 */
export async function cleanupParticipants(participants: Participant[]): Promise<void> {
  await Promise.all(participants.map((p) => p.context.close()));
}
