/**
 * TEMPLATE: end-to-end smoke run of a congame study.
 *
 * Copy this into your project's test directory and adapt. It drives one participant all the way
 * through a study and asserts it completes without a runtime error — every reached page renders and
 * accepts the study's own `make-autofill-meta` answers. This is the "does the code run" half of the
 * review pipeline; add design-fidelity assertions (that the study implements the intended experiment)
 * per the study's design doc — see SKILL.md sections 3-4.
 *
 * Prereqs: a running congame server (default http://127.0.0.1:5100) with the study uploaded. For a
 * study with time-gates (multi-wave panels etc.), upload a SHORT-gap test config so the gates are
 * walkable in seconds. Get the numeric study id from /admin/studies/<id>.
 */
import { test, expect } from '@playwright/test';
import { anonLogin } from '../helpers';
import { createInstanceById, driveParticipant } from '../helpers/drive';

// TODO: set to your study's numeric id (from /admin/studies/<id>).
const STUDY_ID = 1;

test('study runs end-to-end without a runtime error', async ({ browser }) => {
  const slug = `smoke-${Date.now()}`;
  await createInstanceById(browser, STUDY_ID, slug);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await anonLogin(page, slug);
    const r = await driveParticipant(page);
    console.log('drive result:', JSON.stringify(r));
    // Reaching a terminal page without a thrown error already proves the study ran. Tighten these to
    // your study: assert specific fields were filled, or a wait-gate/matchmaking step was traversed.
    expect(r.finalText.length, 'should reach a non-empty terminal page').toBeGreaterThan(0);
    // e.g. expect(r.filledFields).toContain('my-required-field');
    // AVOID asserting sawWaitingPage: whether the driver OBSERVES the wait page is a race against
    // the gate opening (a fast server clears it before the first check) — such an assertion is
    // flaky by construction unless the gate is guaranteed longer than one poll interval.
    // (Ledger 2026-08-13-sawwaitgate-race: the sibling harness's identical assertion was a logged bug.)
  } finally {
    await ctx.close();
  }
});
