import { type Browser, type Page } from '@playwright/test';
import { submitForm, clickButton } from './study';

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:5100';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@congame.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

/**
 * Log in as admin and create an active, enrollment-code-free instance of study #studyId with the
 * given slug. Uses the numeric study id (from /admin/studies/<id>) rather than the name, because
 * study names are often substrings of one another (e.g. `foo` vs `foo-with-admin`) and match
 * ambiguously. Returns the slug.
 */
export async function createInstanceById(browser: Browser, studyId: number, slug: string): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${SERVER_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="username"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    await page.goto(`${SERVER_URL}/admin/studies/${studyId}/instances/new`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="name"]', slug);
    await page.fill('input[name="slug"]', slug);
    const noCode = page.locator('input[name="no-enrollment-code?"]');
    if ((await noCode.count()) && !(await noCode.isChecked())) await noCode.check();
    await page.selectOption('select[name="status"]', 'active');
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
  } finally {
    await context.close();
  }
  return slug;
}

/**
 * Fill every form field on the current page from the study's OWN autofill answers.
 *
 * Conscript's `make-autofill-meta` embeds the bot answers as a Racket-written hash in
 * `<meta name="formular-autofill" content="…">`, e.g.
 *   #hasheq((bot . #hasheq((age . "34") (country . "LU"))))
 * We pull every `(field . "value")` pair out of it and fill the matching input by name, dispatching
 * on select / radio / text-or-number. Fields present in the meta but not rendered on this page
 * (e.g. a conditional item) are skipped. Returns the field names it actually filled.
 *
 * This means the driver needs NO per-page knowledge — any study that annotates its steps with
 * `make-autofill-meta` (the same metadata the marionette bots use) can be walked automatically.
 */
export async function autofillFromMeta(page: Page): Promise<string[]> {
  const content = (await page.locator('meta[name="formular-autofill"]').first().getAttribute('content')) ?? '';
  // Field names may be DOTTED (`b-invest.n`, `pol-lr.n`): the "prefer not to answer" idiom makes a
  // sensitive item a composite of `.n` + `.pna` sub-fields, so the dot is part of the input name.
  // The name class must admit `.` (lazily), and the pair separator is anchored by REQUIRED
  // whitespace — with optional whitespace the engine eats the name-internal dot as the separator
  // and silently drops (or mangles) every dotted field, so the form re-renders and the driver
  // loops to maxSteps blaming the study. Ported verbatim from climate-heat dc23430 (2026-08-12),
  // where the unported version cost a day of bot testing; ledger 2026-08-12-playwright-dotted-field-regex.
  // Control: on `((pol-lr.n . "5") (b-cool . "40"))` the old pattern returns only b-cool; this one both.
  const pairs = [...content.matchAll(/\(([a-zA-Z][\w?%.-]*?)\s+\.\s+"([^"]*)"\)/g)];
  const filled: string[] = [];
  for (const [, name, val] of pairs) {
    if (await page.locator(`select[name="${name}"]`).count()) {
      await page.selectOption(`select[name="${name}"]`, val);
    } else if (await page.locator(`input[type="radio"][name="${name}"]`).count()) {
      await page.locator(`input[type="radio"][name="${name}"][value="${val}"]`).first().click();
    } else if (await page.locator(`input[name="${name}"], textarea[name="${name}"]`).count()) {
      await page.locator(`input[name="${name}"], textarea[name="${name}"]`).first().fill(val);
    } else {
      continue;
    }
    filled.push(name);
  }
  return filled;
}

/** Is the current page a congame auto-refreshing "waiting" page (matchmaking / time-gate)? Detected
 *  generically: a page-RELOAD script (or a meta-refresh) with no form to submit and no next-button.
 *  NB this assumes the `refresh-every`-style pattern (a setTimeout that reloads the SAME url). We match
 *  `location.reload` specifically — NOT a `location.href = …` redirect, because a completion page that
 *  redirects out (e.g. back to Prolific) also has no form/button and must be treated as terminal, not
 *  as a wait page. A study that polls via Unpoly `up-poll` (no reload script) won't match here. */
async function isWaitingPage(page: Page): Promise<boolean> {
  if ((await page.locator('form').count()) || (await page.locator('a.button.next-button').count())) return false;
  return page.evaluate(() => {
    const reloadScript = Array.from(document.querySelectorAll('script')).some(
      (s) => (s.textContent ?? '').includes('location.reload'),
    );
    // A same-page meta-refresh (content="3") is a wait; a meta-refresh that carries `url=` is a
    // redirect OUT (a completion bounce) — NOT a wait page, so exclude it.
    const metaEl = document.querySelector('meta[http-equiv="refresh" i]');
    const metaRefresh = !!metaEl && !/url=/i.test(metaEl.getAttribute('content') ?? '');
    return reloadScript || metaRefresh;
  });
}

/** Reload a waiting page until it advances (the server routes the participant onward). Throws if it
 *  never advances within `timeout` — the decisive check for a stuck matchmaking / time-gate. */
async function waitPastGate(page: Page, timeout = 60_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    if (!(await isWaitingPage(page))) return;
  }
  throw new Error('STUCK on a waiting page (never advanced)');
}

export interface DriveResult {
  steps: number;
  sawWaitingPage: boolean;
  filledFields: string[]; // union of every field the driver filled, in order — assert on these
  finalText: string;
}

/**
 * Drive one participant all the way through a study: fill+submit any form (from its autofill meta),
 * click any next-button, wait through any refreshing/matchmaking/time-gate page, and stop at the
 * terminal page. Throws on a server error page or if it exceeds the step budget.
 *
 * This is a generic SMOKE test — it proves the study runs end-to-end without a runtime error and that
 * every reached page renders + accepts the study's own bot answers. Design-fidelity assertions (that
 * the study implements the intended experiment) belong in per-study specs; see SKILL.md.
 */
export async function driveParticipant(page: Page, maxSteps = 200): Promise<DriveResult> {
  const res: DriveResult = { steps: 0, sawWaitingPage: false, filledFields: [], finalText: '' };
  for (let i = 0; i < maxSteps; i++) {
    res.steps = i + 1;
    const body = (await page.locator('body').textContent()) ?? '';
    // Racket/congame server-error framing — kept specific so ordinary page copy ("Expected: yes")
    // doesn't false-trip. `expected:.*given:` is the contract-violation shape, not a bare "expected:".
    if (/Internal Server Error|contract violation|hash-ref: no value|exn:fail|expected:[^]*given:/i.test(body)) {
      throw new Error(`SERVER ERROR page reached at step ${i + 1}: ${body.replace(/\s+/g, ' ').slice(0, 300)}`);
    }
    const hasMeta = (await page.locator('meta[name="formular-autofill"]').count()) > 0;
    const hasForm = (await page.locator('form').count()) > 0;
    const hasNext = (await page.locator('a.button.next-button').count()) > 0;

    if (await isWaitingPage(page)) {
      res.sawWaitingPage = true;
      await waitPastGate(page);
    } else if (hasMeta) {
      res.filledFields.push(...(await autofillFromMeta(page)));
      await submitForm(page);
    } else if (hasForm) {
      await submitForm(page); // info/continue form with nothing to fill
    } else if (hasNext) {
      await clickButton(page);
    } else {
      res.finalText = body.replace(/\s+/g, ' ').trim().slice(0, 400);
      return res; // terminal page
    }
  }
  throw new Error(`driveParticipant exceeded ${maxSteps} steps without reaching a terminal page`);
}
