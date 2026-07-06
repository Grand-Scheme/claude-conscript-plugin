---
name: playwright-test
description: |
  Write a Playwright browser test for a congame study. Use when the user
  wants to create an automated end-to-end test that runs participants
  through a study on a congame server.
argument-hint: "[study-file]"
---

Write a Playwright test for a congame study. The test runs multiple
browser participants concurrently against a running congame server.
Tests should verify both that the study code runs without errors AND
that the study faithfully implements its intended experimental design.

### Project configuration

This skill reads project-specific paths and settings from
`study-config.md` in the project root (schema in the `study-config`
skill). The fields it uses:

- **Study directory** — where `.rkt` study files live (e.g.
  `experiments/`). Default: repo root.
- **Design-document location** — the path convention for design docs
  (e.g. `study designs/{STUDY-ID}.md`), or "none" if the project does
  not keep design docs.
- **Test directory** — where spec files live (e.g. `tests/studies/`).
- **Test helpers** — where the shared Playwright helper library lives
  (e.g. `tests/helpers/`).
- **Server URL** — the congame server the tests hit (default
  `http://127.0.0.1:5100`).

If `study-config.md` is missing, load the `study-config` skill and run
its first-run setup (or, since this skill needs only a few fields, fall
back to the defaults above and ask the user to confirm the test directory
and server URL before writing).

### Design-first principle

The test is derived from the study's **design** — its design document
if the project keeps one, otherwise the user's description of the
intended experiment — not from the study code. Participants submit the
answers the design says are correct; the test asserts the page responds
as the design says it should. Where the code diverges from the design,
that divergence is the finding — the test stays red until the study
author fixes the code.

Use `expect.soft()` for design-fidelity assertions so the test
continues past the first failure and surfaces every divergence in one
report. A red soft assertion on a design-fidelity check is the intended
deliverable, not a test bug. (See "Soft assertions for design fidelity"
in Section 4.)

Before starting, read the study source file, the corresponding design
document (if any), and the existing test helpers in the project's test
helpers directory.

## 1. Identify the study

- If a file path is provided as `$ARGUMENTS`, use that.
- Otherwise, check conversation context for a recently discussed study.
- If still unclear, ask the user which study to test.

Read the full study `.rkt` file before proceeding.

## 2. Read the design document

If the project keeps design documents (per `study-config.md`), read the
one for this study in full. Extract:

- **Task description:** What participants actually do (e.g., report a
  number, make an investment, answer questions)
- **Treatment conditions:** Exactly how the treatment arms differ
- **Payment structure:** Show-up fee, bonus formulas, who gets paid
  what and when
- **Outcome variable:** What the experiment measures (e.g., proportion
  of "yes" reports, amount claimed vs. actual)
- **Group structure:** How many per group, roles, matching rules
- **Information timing:** What participants should/shouldn't know and
  when (e.g., "rank revealed only after all finish")

If the project has no design documents, or the document is missing or
ambiguous, ask the user to describe the study's intended design in these
same terms. The test encodes that intended design.

## 3. Analyze the study flow

Trace the `defstudy` graph to determine:

- **Total participants needed:** Count how many participants are required
  for all matchmaking groups to fill. Use `2 × group-size` for studies
  with treatment/control branching where only one arm enters the
  matchmaker (e.g., `make-matchmaker 2` with only one arm matched →
  need 4 total for 2 matched + 2 unmatched). For studies where all
  participants enter the matchmaker, use just the group size.
- **Treatment detection:** Find a text string unique to one arm's
  instructions page that can distinguish it from the other. Read the
  actual instruction step bodies to pick the string.
- **Step sequence for each path:** List every step a participant visits,
  noting for each:
  - `click` — page has a `@button{...}` → use `clickButton(page, label)`
  - `form` — page has a form → use `selectRadio`/`fillNumber`/
    `selectDropdown` + `submitForm`
  - `skip` — step calls `(skip)` → invisible, browser follows redirect
  - `wait` — page has `@refresh-every[...]` → use `waitForAdvance(page)`
- **Form field values:** For each form, determine valid input values
  from the step code. Radio values are the first element of each pair
  in the choices list (e.g., `("3" . "80 pence")` → value `"3"`).
  Number inputs need a value within `min`/`max` range. Select dropdowns
  need a valid option value.

### Branch coverage

While listing step sequences, also enumerate the **conditional
branches** inside steps — e.g., the win vs. loss legs of a `did-win?`
results page, the check vs. no-check path off a results step,
treatment-vs-control routing, "first-time" vs. "subsequent" rendering.
When picking input values per participant, deliberately choose them so
that as many branches as possible are exercised by at least one
participant. A test where every participant submits the same value, or
all four take the same control branch, is a thinner test than one where
participants take different paths.

When a branch is structurally unreachable from the test's input set —
e.g., a tiebreaker only fires on equal reports but the test uses unique
reports, or admin-only steps that no participant exercises — say so in
a test comment so a future reader knows the gap is intentional rather
than an oversight.

## 4. Write the test

Create a spec file in the project's test directory (e.g.
`tests/studies/{study-name}.spec.ts`).

### Read the project's helpers first

The patterns below assume a shared Playwright helper library in the
project's test helpers directory. Helper names and behavior vary by
project, so **read the actual helpers before writing** and import from
the project's helper module. Section 8 documents the helper *interface*
these skills assume; treat it as the contract to look for, not a
guarantee of exact names. If the project has existing spec files, read
one as a working reference for its conventions.

### Narrative header

Start the file with a block comment explaining the test in plain
language. This comment should be readable by someone unfamiliar with
the code and should cover:

- What the study measures experimentally (from the design)
- How the treatment arms differ
- What specific input values the test uses and why
- What outcomes are expected given those inputs (e.g., "participant 0
  reports 70, participant 1 reports 30, so participant 0 should win")
- What each assertion is checking and why it matters for design fidelity

This narrative is the most important part of the test file — it turns
the test from "does the code crash?" into "does the study work as the
researchers intended?"

### Template

Follow this template after the narrative comment (adjust helper names
to match the project's helper library):

```typescript
import { test, expect } from '@playwright/test';
import {
  clickButton,
  submitForm,
  fillNumber,
  selectRadio,
  selectDropdown,
  getPageText,
  createParticipants,
  waitForAdvance,
  cleanupParticipants,
  ensureFreshInstance,
  type Participant,
} from '../helpers';

let SLUG: string;

test.beforeAll(async ({ browser }) => {
  SLUG = await ensureFreshInstance(browser, '{StudyName}');
});

async function runParticipant(p: Participant): Promise<{ isCompetition: boolean }> {
  const { page, id } = p;

  // ... step-by-step navigation ...

  return { isCompetition };
}

test('{STUDY}: N participants complete study', async ({ browser }) => {
  const participants = await createParticipants(browser, N, SLUG);
  try {
    const results = await Promise.all(participants.map(runParticipant));
    // ... assertions ...
  } finally {
    await cleanupParticipants(participants);
  }
});
```

### Key patterns

**Treatment detection** — after the welcome click, `(skip)` steps
redirect through to the instructions page. Read page text to detect
which treatment path:

```typescript
const text = await getPageText(page);
const isCompetition = text.includes('unique treatment-arm phrase');
```

**Matchmaking waits** — for each `@refresh-every` step, call
`waitForAdvance`. Chain multiple calls if there are consecutive wait
steps (e.g., matchmaking wait → opponent score wait):

```typescript
await waitForAdvance(page, 90_000);  // matchmaking
await waitForAdvance(page, 30_000);  // opponent score
```

**Form values per participant** — spread values across participants
using `p.id` so different participants submit different data. This
isn't just stylistic — it's how branch coverage gets exercised: with
unique values per participant, within-pair comparisons take the strict
inequality (`>` or `<`) branches; with shared values they take the
equality / tiebreaker branch. Mix the two only if you need both
branches in one test (it doubles the number of pairings to reason
about).

```typescript
await fillNumber(page, 30 + p.id * 20);  // 30, 50, 70, 90
```

**Radio ambiguity** — `selectRadio(page, value)` uses a global
`input[type="radio"][value="..."]` selector. If multiple radio groups
on the same page share option values (e.g., two questions both have
value `"a"`), use a name-qualified selector instead:

```typescript
await page.locator('input[type="radio"][name="gender"][value="a"]').click();
await page.locator('input[type="radio"][name="education"][value="c"]').click();
```

Similarly, to fill all radios in multiple groups that share values
(e.g., four Likert-scale groups each with options "1"/"2"/"3"), use
nth-based iteration:

```typescript
const radios = page.locator('input[type="radio"][value="3"]');
const count = await radios.count();
for (let i = 0; i < count; i++) {
  await radios.nth(i).click();
}
```

**Treatment balance assertion** — for balanced-shuffle studies:

```typescript
const competitionCount = results.filter(r => r.isCompetition).length;
expect(competitionCount).toBe(expectedCount);
```

**Soft assertions for design fidelity** — when the test submits
design-correct inputs and checks design-expected outcomes, use
`expect.soft()` so the test keeps running and surfaces every
divergence in one report. Include a message string explaining the
design expectation:

```typescript
// Design says Q6 correct answer is "c", so submitting "c" should
// produce a clean comprehension result
expect.soft(text, 'Q6 graded correctly per design').toContain('0 question(s) incorrectly');
```

Reserve hard `expect()` for navigation and structural assertions that
the test can't continue past (e.g., page loaded, form submitted,
matchmaker filled).

### Admin interface testing

Some studies have admin-only steps (e.g., triggering score computation,
advancing phases). These use `current-participant-owner?` to route the
study owner to an admin interface while regular participants see the
normal study flow.

To test admin functionality:

1. Run participants through the study first (using `createParticipants`)
2. Create an admin session with `createAdminParticipant(browser, slug)`
3. Read admin page content with `getLoggedInPageText(page)` (NOT
   `getPageText` — see note below)
4. Interact with admin buttons using `clickButton`
5. Have participants reload to verify post-admin changes

```typescript
// After participants complete the study...
const admin = await createAdminParticipant(browser, SLUG);
try {
  const adminText = await getLoggedInPageText(admin.page);
  expect(adminText).toContain('Admin Interface');

  await clickButton(admin.page, 'Compute Scores');

  const postText = await getLoggedInPageText(admin.page);
  expect(postText).toContain('Scored');
} finally {
  await admin.context.close();
}
```

**Critical: `getPageText` vs `getLoggedInPageText`** — Logged-in
congame pages have two `div.container` elements: the first is the
navigation bar, the second is the study content. `getPageText` grabs
`.first()` (the nav), so it returns text like "DashboardLog outAdmin".
Use `getLoggedInPageText` for logged-in pages — it grabs `.last()`
to get the actual study content. Anonymous participant pages only have
one `div.container`, so `getPageText` works fine for them.

**Admin enrollment** — The admin must be enrolled in the study instance
before they can access it. A helper like `createAdminParticipant`
typically handles this by visiting `/dashboard`, finding the study by
slug, and clicking Enroll/Resume. The admin credentials are the
project's local congame server credentials (for a local Docker server
the congame default is `admin@congame.local` / `admin`, created by
`congame-web/local.rkt`); confirm the project's actual credentials in
`study-config.md` or the test helpers.

## 5. Design-based assertions

Beyond verifying the study runs without errors, derive assertions from
the design that verify the study implements the experiment correctly.
Use `expect.soft()` for these design-fidelity checks (see "Soft
assertions for design fidelity" in Section 4).

### Payment correctness

The test chooses specific input values, so expected payments are
deterministic. Compute them from the design's payment formulas and
assert the results page shows matching amounts. For example, if a
participant reports 70 and the bonus is `number * £0.01`, the results
page should show `£0.70`.

### Treatment-specific content

Use text matching to **detect** which treatment arm a participant
landed in (e.g., `text.includes('unique treatment phrase')`). Then
assert that the treatment produces the correct *behavioral outcomes*
— payment formulas, matchmaking, result displays — not that the
instruction prose matches specific wording. The study author may
adapt phrasing from the design; what matters is that the treatment
arms produce structurally different experiences as the design intends.

### Outcome logic

If the design specifies who wins (e.g., higher number wins), verify
the results page correctly identifies the winner and loser given the
test's known inputs. If there's a tiebreaker rule, consider testing
a tie scenario.

### Information timing

If the design says participants shouldn't learn certain information
until later (e.g., "rank revealed only after all participants finish"),
assert that intermediate pages do NOT contain that information. Use
`expect(text).not.toContain(...)`.

### Group structure

Verify the correct number of participants are matched (e.g., pairs
vs groups of 4). For matchmaking studies, the test's participant count
and the assertions on group results implicitly test this — make it
explicit with a comment.

### What NOT to assert

- **Exact instruction wording.** The study author may adapt phrasing
  from the design document. Test behavioral outcomes (payments,
  matchmaking, treatment branching), not prose.
- **Covariate/sociodemo fields** that exist only as regression
  controls. Only assert on them if a covariate is necessary for
  defining treatment or control. A placeholder stub for such fields is
  often a known interim state, not a per-study finding — confirm the
  project's convention in `study-config.md`.
- **Randomized outcomes the test can't predict** (e.g., a coin flip
  result, a shuffled order). Focus on deterministic logic that follows
  from the test's chosen inputs.

## 6. Congame HTML behavior (critical)

These are framework-level behaviors of congame's rendered HTML. They
hold across projects. Do NOT deviate from these patterns:

### Unpoly AJAX interception

Congame buttons render as
`<a class="button next-button" up-follow=".step">`. The `up-follow`
attribute causes the Unpoly framework to intercept clicks and do AJAX
partial page replacement instead of full navigation. **This breaks
Playwright's navigation detection.**

**Fix:** a `clickButton` helper should read the button's `href` and
navigate via `page.goto(href)` instead of clicking. Always use the
`clickButton` helper for navigation buttons, never `locator.click()`.

### Form submission is NOT intercepted

Forms (`<form method="POST">`) do NOT have Unpoly attributes, so a
`submitForm` helper uses a normal `locator.click()` on the submit
button. This triggers a standard form POST + full page navigation.

### Anonymous login redirect page

`/_anon-login/{slug}` does NOT redirect automatically. It renders a
"Redirecting..." page with a "click here" link. An `anonLogin` helper
handles this by navigating to `/study/{slug}` after hitting the login
endpoint. The session cookie persists across both requests.

### Waiting pages use setTimeout

`@refresh-every[N]` renders as
`setTimeout(() => document.location.reload(), N*1000)`. This is real
navigation that Playwright can detect. A `waitForAdvance` helper polls
by checking whether any `<script>` tag contains
`document.location.reload`.

### Skip steps are invisible

Steps that call `(skip)` return a server redirect. The browser follows
the redirect chain transparently. After a button click or form submit,
you may pass through multiple skip steps before landing on a visible
page.

## 7. Running the test

The study must be uploaded to the congame server before running (see the
`upload` skill). If the test uses `ensureFreshInstance` in `beforeAll`,
it will create its own study instance automatically — no manual instance
creation needed.

```bash
cd tests
npx playwright test studies/{study-name}.spec.ts
```

For visual debugging: `npx playwright test --headed`

The server URL defaults to `http://127.0.0.1:5100` (override with the
`SERVER_URL` env var, or set it in `study-config.md`).

## 8. Reference: assumed helper interface

These skills assume a shared helper library in the project's test
helpers directory exposing roughly the following interface. Read the
project's actual helpers and adapt names as needed; if the project has
no such library yet, these are the helpers a congame Playwright suite
typically needs.

| Function | Purpose |
|---|---|
| `anonLogin(page, slug)` | Create anonymous participant, navigate to study |
| `clickButton(page, label?)` | Click `@button{...}` via href (bypasses Unpoly) |
| `submitForm(page)` | Click form submit button |
| `fillNumber(page, value, nth?)` | Fill `input[type=number]` |
| `selectRadio(page, value)` | Click `input[type=radio]` by value |
| `selectDropdown(page, value, nth?)` | Select `<option>` by value |
| `getPageText(page)` | Get text content of `div.container` (anon pages) |
| `pageContains(page, text)` | Boolean text check |
| `createParticipants(browser, count, slug)` | Create N isolated browser contexts |
| `waitForAdvance(page, timeout?)` | Wait for matchmaking/refresh page to advance |
| `cleanupParticipants(participants)` | Close all browser contexts |
| `adminLogin(page)` | Log in as the local admin user |
| `adminEnrollInStudy(page, slug)` | Enroll admin in a study via `/dashboard` |
| `createAdminParticipant(browser, slug)` | Login + enroll in one call; returns `{ context, page }` |
| `getLoggedInPageText(page)` | Get study content from logged-in page (last `div.container`) |
| `findStudyId(page, studyName)` | Find a study's numeric ID from the `/admin` page |
| `createStudyInstance(page, studyName, slug)` | Create a new instance via admin dashboard (page must be logged in) |
| `ensureFreshInstance(browser, studyName, slug?)` | Create a fresh instance with a unique slug; handles login/cleanup automatically. Use in `test.beforeAll` for clean test state. |

## 9. Working examples

Read the existing spec files in the project's test directory for
working, project-specific examples (matchmaking with opponent-score
exchange, admin-triggered scoring, cross-treatment score pools, and
name-qualified radio selectors for forms with ambiguous values are all
common patterns worth copying from a neighbor).
