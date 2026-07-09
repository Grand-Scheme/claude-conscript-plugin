import { type Browser, type BrowserContext, type Page } from '@playwright/test';

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:5100';

// Default credentials for the local Docker congame server (see congame-web/local.rkt); override via
// env for a server with different admin creds (SKILL.md documents these).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@congame.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

/**
 * Log in as the admin user on the local Docker congame server.
 * After login, the page will be on the /dashboard.
 */
export async function adminLogin(page: Page): Promise<void> {
  await page.goto(`${SERVER_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="username"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState('networkidle');
}

/**
 * Enroll the logged-in admin in a study instance via the /dashboard page.
 *
 * The dashboard lists study instances as `<li>` elements:
 *   "{instance-name} — <a>Enroll</a>" (or "Resume")
 *
 * This function finds the `<li>` matching the slug, clicks its Enroll/Resume
 * link, and follows the redirect into the study. For studies with a check-role
 * step, the admin (study owner) will be routed to the admin interface.
 */
export async function adminEnrollInStudy(page: Page, slug: string): Promise<void> {
  await page.goto(`${SERVER_URL}/dashboard`);
  await page.waitForLoadState('networkidle');

  // Match exactly: each <li> contains "{instance-name} — Enroll/Resume".
  // Use the slug followed by " —" to avoid partial matches (e.g., "study" vs "study-0329").
  const studyItem = page.locator('li', { hasText: new RegExp(`^\\s*${slug}\\s*\u2014`, 'i') });
  const enrollLink = studyItem.locator('a', { hasText: /Enroll|Resume/ });
  await enrollLink.click();
  await page.waitForLoadState('networkidle');

  // The enrollment redirect should land on /study/{slug}. If not (e.g., the
  // dashboard stayed open), navigate directly — the admin is now enrolled.
  if (!page.url().includes(`/study/${slug}`)) {
    await page.goto(`${SERVER_URL}/study/${slug}`);
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Create a new browser context, log in as admin, and enroll in the study.
 * Returns the context and page, ready to interact with the study's admin interface.
 */
export async function createAdminParticipant(
  browser: Browser,
  slug: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await adminLogin(page);
  await adminEnrollInStudy(page, slug);
  return { context, page };
}

/**
 * Get the study content text from a logged-in page.
 *
 * Logged-in congame pages have two `div.container` elements:
 *   [0] = navigation bar ("Dashboard", "Log out", "Admin", "Jobs")
 *   [1] = study content
 *
 * The regular `getPageText()` helper grabs `.first()`, which returns the nav.
 * This function grabs `.last()` to get the actual study content.
 */
export async function getLoggedInPageText(page: Page): Promise<string> {
  return (await page.locator('div.container').last().textContent()) ?? '';
}

/**
 * Find a study's numeric ID from the admin studies list.
 * Navigates to /admin and looks for a link whose text matches studyName.
 * Returns the numeric ID extracted from the link's href.
 */
export async function findStudyId(page: Page, studyName: string): Promise<number> {
  await page.goto(`${SERVER_URL}/admin`);
  await page.waitForLoadState('networkidle');

  // Study links look like: <a href="/admin/studies/42">Study Name</a>
  const studyLink = page.locator('a', { hasText: studyName });
  const href = await studyLink.getAttribute('href');
  if (!href) {
    throw new Error(`findStudyId: could not find study "${studyName}" on /admin`);
  }
  const match = href.match(/\/admin\/studies\/(\d+)/);
  if (!match) {
    throw new Error(`findStudyId: unexpected href format "${href}" for study "${studyName}"`);
  }
  return parseInt(match[1], 10);
}

/**
 * Create a new study instance via the admin dashboard.
 * Assumes the page is already logged in as admin.
 *
 * @param page - Playwright page (already admin-logged-in)
 * @param studyName - the study name as shown in /admin
 * @param slug - URL slug for the new instance
 * @returns the slug
 */
export async function createStudyInstance(
  page: Page,
  studyName: string,
  slug: string,
): Promise<string> {
  const studyId = await findStudyId(page, studyName);
  await page.goto(`${SERVER_URL}/admin/studies/${studyId}/instances/new`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="name"]', slug);
  await page.fill('input[name="slug"]', slug);

  // Check "no enrollment code" so participants can access without a code (guard on presence — the
  // field may be absent on some server versions).
  const noCodeCheckbox = page.locator('input[name="no-enrollment-code?"]');
  if ((await noCodeCheckbox.count()) && !(await noCodeCheckbox.isChecked())) {
    await noCodeCheckbox.check();
  }

  // Ensure status is "active"
  await page.selectOption('select[name="status"]', 'active');

  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState('networkidle');

  return slug;
}

/**
 * Create a fresh study instance with a unique slug, guaranteeing clean state.
 * Opens a temporary browser context, logs in as admin, creates the instance,
 * and closes the context.
 *
 * @param browser - Playwright Browser instance
 * @param studyName - the study name as shown in /admin
 * @param slug - optional slug; if omitted, generates "{studyName}-{timestamp}"
 * @returns the slug of the newly created instance
 */
export async function ensureFreshInstance(
  browser: Browser,
  studyName: string,
  slug?: string,
): Promise<string> {
  const instanceSlug = slug ?? `${studyName.toLowerCase()}-${Date.now()}`;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await adminLogin(page);
    await createStudyInstance(page, studyName, instanceSlug);
  } finally {
    await context.close();
  }
  return instanceSlug;
}
