---
name: study-review
description: |
  Review a study for correctness and coding patterns, run a server-optional
  adversarial pass (parallel agents hunting technical, design-fidelity, and
  idiomatic bugs), then test it and document the review. When the project has
  a Playwright test suite, the review runs test-first and lands as a PR;
  otherwise it runs a checklist review plus upload and manual test. Use when
  the user wants to review, verify, or QA a study.
argument-hint: "[study-file]"
allowed-tools: Bash(raco congame *)
---

Review a conscript study for correctness and design fidelity, then test
it and make the review trail easy to follow. The review has three layers:
a static **checklist** (step 3), a **server-optional adversarial pass**
that fans out parallel agents to hunt for bugs the checklist and the
compiler both miss (step 3b), and a **live test** (Playwright PR pipeline
or manual). Compiling and passing the checklist are necessary but not
sufficient — the adversarial pass is what catches a study that compiles
yet is wrong or non-fieldable.

How the review is delivered depends on the project's setup, read from
`study-config.md` (schema in the `study-config` skill):

- **PR pipeline (Playwright)** — if the project has a Playwright test
  suite configured (a test directory + helpers), run the full test-first
  pipeline (steps 4–9): write the test first, commit it, open a PR,
  then fix the code. This makes it visible to a reader that the test
  encodes the study **design**, not something bent retroactively to make
  the existing code pass.
- **congame bots** — if there is no Playwright suite but the study has a
  `-with-admin` bot variant (or you can add one), a live bot run is the
  preferred automated test: it exercises the real study end-to-end and
  catches runtime bugs the compiler misses. See **"Getting congame bots
  working"** below for what it requires. Deliver as checklist + a live
  bot run (no PR machinery unless the project wants it).
- **Checklist + manual test** — if neither a Playwright suite nor a
  working bot setup is available, do the code review (steps 1–3 + 3b) and
  either upload and hand off for manual testing (step 10) **or, if the
  study cannot be run at all, deliver a source-only review** and say
  plainly that no live test was performed. Skip the PR machinery.

### Getting congame bots working
The framework's bot runner drives the study through a real browser via
**marionette + Firefox** (`raco congame simulate <slug>`, or the admin
"Manage Bots → Spawn" on a study instance). To use it you need:
- a **`-with-admin` variant** built with `make-admin-study #:models`, and a
  **bot model** with a clause per step (`bot:autofill` for forms,
  `bot:completer` for terminal steps) plus `make-autofill-meta` presets on
  every form (see "Bot testing" in the checklist);
- a running **congame server** (Docker) with the study **uploaded** and an
  **instance created**;
- **Firefox + geckodriver** reachable by the server, and — because the
  spawn path runs Firefox non-headless — a display (e.g. **Xvfb** in a
  container). NB: on Apple-Silicon hosts an amd64 Firefox image crashes
  under Rosetta (`ld-linux-x86-64.so.2`); use an arm64 Firefox or run the
  bots from an arm64/native environment.
If Firefox/marionette cannot be made to run in the environment, an
**HTTP walkthrough** (drive each step by reading its `formular-autofill`
meta and POSTing the values) is a browserless equivalent that exercises
the same steps; note in the review that this substitute was used.

Before starting, load the `coding`, `racket-coding`, and
`conscript-coding` skills for reference. If the PR pipeline applies,
also load `playwright-test`.

If `study-config.md` is missing, load the `study-config` skill and run
its first-run setup — for a review you need only whether the project has
a Playwright test suite and where the study/test/design-doc directories
are, so ask just those and offer the full setup rather than forcing it —
then proceed with the matching path.

## 1. Identify the study

- If a file path is provided as `$ARGUMENTS`, use that.
- Otherwise, check conversation context for a recently discussed or
  edited study.
- If still unclear, ask the user which study to review.

Read the study file fully before proceeding.

## 2. Understand the study design

If the project keeps design documents (per `study-config.md`), the
canonical source is the design document for this study (e.g.
`design/<study>.md` or `.pdf`). Read it in full. Extract the
experimental task, treatments, payment structure, outcome variable,
group structure, and information-timing rules. The design doc — not the
existing code — is what the review and test encode.

If there is no design document, or it is missing or ambiguous, ask the
user:

- What is the experimental task? (e.g. matrix task, die roll, public
  goods game)
- What are the treatments? (e.g. competition vs. control)
- What is the outcome measure? (e.g. claimed score minus true score)
- What is the payment structure?

Use their answers to verify that the code matches the intended design.

## 3. Code review

Review the study code against the following checklist. Every item is
a **review** check — note any failures as findings, but do **not**
modify the file at this stage. Code changes happen later, only if
needed and only as separate commits (PR pipeline) or after user
approval (checklist path).

### The bug ledger — every recorded conscript bug, every review (Marc, 2026-08-15)

Before the checklist below, read `~/projects/worklog/bugs/bugs.jsonl`
(one JSON record per line) and select every record whose `project` is a
conscript study repo (e.g. `climate-heat-beliefs`, or `component`
mentioning conscript/congame). Treat that whole set as an additional
checklist against this study — not only the entries with a greppable
`anti_pattern`; the semantic ones (served-elicitation-with-nothing-behind-it,
wave-window classes, export/manifest classes) are the ones that recur.
Report a hit as "known bug class — ledger `<id>`".

Two graduated rules apply as findings in their own right:
1. **vacuous-test** — any assertion or test this review relies on that
   has not been shown able to fail (a green suite is evidence only if
   you have seen it red).
2. **repair-introduced** — a fix applied in the final round with no
   fresh pass over it is a finding. (This inherits the standing
   fix→review→fix invariant.)

**Dismissals.** A class the study demonstrably handles is not a
finding. Dismiss explicitly — one line saying why — only the genuine
close calls (the anti_pattern's shape appears in this study but is
handled). For everything else one summary line suffices: "Checked all
N conscript ledger entries; besides the findings and close calls
above, none apply."

### Structure
- [ ] File starts with `#lang conscript`
- [ ] `(provide ...)` exports the study and its `-with-admin` variant
- [ ] `(require ...)` only uses whitelisted modules (see
  `conscript-coding` skill)
- [ ] Shared CSS is applied via the study's `#:wrapper` (`@add-css` /
  `@add-css-resource`); any page-specific CSS uses a `@style{...}` block
  in that step

### Variables
- [ ] All participant state uses `defvar`
- [ ] All shared state uses `defvar/instance`
- [ ] Every mutation of a `defvar/instance` variable is inside
  `with-study-transaction`

### Treatment assignment (if the study has treatments)
Skip this whole section for a solo survey or any study with a single arm.
- [ ] Uses balanced shuffle pattern (groups of 2 or 4) or
  `assigning-treatments`
- [ ] Treatment assignment step calls `(skip)` at the end
- [ ] `competition?` or equivalent flag is a `defvar`, not
  `defvar/instance`

### Study flow
- [ ] `defstudy` forms a connected graph — no orphaned steps
- [ ] Study terminates with `,(lambda () done)`
- [ ] Branching on treatment uses `,(lambda () (if competition? ...))`
- [ ] Looping patterns reset the counter when exiting the loop
- [ ] Computation-only steps (init, assign) call `(skip)`

### Forms
- [ ] All required fields use `(ensure binding/... (required))`
- [ ] Form render functions use `@md*{...}` (fragment), not `@md{...}`
- [ ] `@|submit-button|` is present in every form render function

### Data capture (graduated 2026-08-15 from ledger category `data-loss`, 6 entries)
- [ ] Every per-wave / per-round collected value survives to durable
  storage: where waves reuse `defvar`s, audit the snapshot call's field
  list against every wave-body form field. (The
  2026-07-08 panel lost every non-final wave's weather-merge inputs to
  exactly this drift — silent, discovered at analysis, unrecoverable.)
- [ ] If the design needs per-wave timing (weather merges, attrition),
  a per-wave timestamp is stored — wave answers cannot be dated
  afterwards (ledger `no-per-wave-timestamp`: waves 2–3 unrecoverable).
- [ ] Where the project keeps a design-derived manifest (e.g.
  `check_manifest.py`), run it against a live export; on the
  source-only path do the field-set audit and state that the live check
  was skipped. A derived or ephemeral field deliberately not stored
  gets one line saying so.

### Matchmaking (if applicable)
- [ ] `make-matchmaker` is called once at module level, not inside a
  step
- [ ] Wait page uses `@refresh-every[...]`
- [ ] Opponent data retrieval checks for `#f` before displaying results
- [ ] Wait page includes `@meta[#:name "wait"]` for bot detection

### Bot testing
- [ ] `make-admin-study` wraps the main study with `#:models`
- [ ] Bot model has a clause for every step in the study
- [ ] Wait/refresh steps use `(void)` in the bot model
- [ ] Final step uses `(bot:completer)`
- [ ] Forms have `make-autofill-meta` with presets matching bot model
  kinds

If the `-with-admin` variant or any of the above is missing, record it
as a **Note** in the findings. The study can be reviewed and tested
without it. (In the checklist path, offer to add it — see step 10.)

### Content
- [ ] Instructions match the intended experimental design (verify
  against the design document — and the user's answers if you asked)
- [ ] Payment amounts and descriptions are consistent throughout
- [ ] Attention check text and expected answer are correct
- [ ] Covariates: only flag if a covariate is *necessary for defining
  treatment or control*. Covariates that exist only as regression
  controls are out of scope for this review. A placeholder stub for
  such fields may be a known project-wide interim state rather than a
  per-study finding — check the project's convention in
  `study-config.md`.

---

## 3b. Adversarial pass — parallel agents (server-optional)

The checklist catches known-shape issues, but **compiling and passing the
checklist is not evidence of correctness** — a study can do both and still be
wrong or non-fieldable (real case: a study compiled and passed review yet never
collected the location/timestamp its own identification strategy depended on).
Run **three adversarial agents in parallel**, each told to *assume bugs exist
and hunt for them*. This pass reads and reasons only — it needs **no server**,
so run it in **both** delivery paths, before the live test. Fold every finding
into the step-3 findings list under the same labels (Bug / Note / Question).

Give every agent: the study file; the design document (or the design answers
from step 2); the `conscript-coding`, `coding`, `racket-coding`, and `examples`
skills; and, from `study-config.md`, the congame examples directory plus a
known-good reference study. Require a **structured, ranked** report — each
finding `SEVERITY | file:line | issue | why it breaks | concrete fix`, tagged
**CONFIRMED** (provable against the reference API or an example) or
**PLAUSIBLE** (suspicious, needs a live run) — and **no file dumps** (a short
word cap keeps them synthesizable).

- **Agent 1 — technical bugs** (runtime/framework errors the compiler misses).
  Hunt: mismatches between `form*`/`form+submit` field names, the
  `@rw["field" …]` keys, and `make-autofill-meta` keys; bot-autofill values
  that are not valid options; `defvar` vs `defvar/instance` misuse and any
  `defvar/instance` mutation outside `with-study-transaction` (and whether it
  is safe under transaction retry); study-graph connectivity/reachability and
  loop-counter resets; reads of possibly-undefined vars before they are set;
  xexpr hazards (void nodes; **widgets pre-wrapped in `@md*` so `rw` cannot
  bind them**; conditional rendering); whitelist-only `require`s; a bot model
  clause for every step with a terminal `(bot:completer)`. Verify against the
  reference API — do not invent framework behavior.
- **Agent 2 — design-fidelity gaps** (design document ↔ implementation).
  Enumerate **every** design decision — measures, scales, treatments, the
  randomization scheme, order/timing rules, sampling and covariates, incentive
  structure, flow/branching — and check each is implemented faithfully. Hunt
  hardest for **silent omissions**: inputs the identification strategy depends
  on that the code never collects (the variable an outcome or treatment is
  defined on; a merge key; a screening gate). Classify each gap **MUST-FIX**
  (breaks the study or its identification), **acceptable-for-pilot**, or
  **panel/infrastructure-level** (cannot live in this one file — say where it
  belongs).
- **Agent 3 — idiomatic & simplicity.** Compare against the congame examples
  and the reference study. Flag over-engineering, reinvention of framework
  helpers (`assigning-treatments`, `form+submit`, the round-loop idiom),
  non-idiomatic patterns, **config that does nothing** (dead lists), and
  missing house conventions (e.g. the CSS-resource wrapper). Cite the example
  file that shows each idiom. Favor **removing** complexity, never adding it;
  separate should-fix from nice-to-have.

**Models.** Run agents 1 and 2 on the strongest reasoning model available
(bug-finding is subtle and high-value); agent 3 can use a lighter, faster
model. Model choice is the reviewer's call.

**Synthesis.** Collect all three reports, dedupe overlapping findings, and merge
them into the step-3 findings list under the Bug / Note / Question labels. Treat
a **PLAUSIBLE** finding as a Question (checklist path) or a soft assertion (PR
path), never a silent pass. When an adversary finds a Bug and you fix it, the
fix is **not** "verified" by the fixer alone — re-read the corrected code, or in
the PR path encode the fix as a test assertion, before calling it resolved. Then
continue into the delivery path below.

---

**Branch point.** If the project has a Playwright test suite, continue
to step 4 (PR pipeline). Otherwise, jump to step 10 (checklist +
manual test).

---

## 4. Write the Playwright test (PR pipeline)

Invoke the `playwright-test` skill to write a design-faithful test in
the project's test directory (e.g.
`tests/studies/{study-id-lowercase}.spec.ts`). Per that skill, the test
encodes the **design**, not the current code's behavior. Soft
assertions (`expect.soft(...)`) are used for design-fidelity checks so
that divergences from the design surface in red without aborting the
run.

When picking inputs per participant, think about **branch coverage** —
the conditional branches inside steps (win vs. loss legs of a
`did-win?` results page, check vs. no-check paths, treatment routing,
first-time vs. subsequent rendering). Choose inputs so as many branches
as possible are exercised by at least one participant. See "Branch
coverage" in the `playwright-test` skill for details.

## 5. Verify compile and test status

Before committing the test, upload the study and run the test to make
sure it works correctly — meaning it executes the study end-to-end
without infrastructure errors and produces meaningful pass/fail signals
against the design assertions. Soft assertions failing on real findings
are expected and welcome; what's not OK is silent wedges (e.g., a
form-submit that doesn't navigate), null-match throws because a regex
is wrong, or timeouts because a step was missed.

```
raco congame upload {STUDY-ID} {study-dir}/{path}
cd tests && npx playwright test studies/{lowercase}.spec.ts
```

(Substitute the study file location and test directory from
`study-config.md`.)

Note: on first upload the user may need to create a study instance via
the admin UI at `<server>/admin`. The test's `ensureFreshInstance`
helper will then create per-run instances automatically.

If the test errors for infrastructure reasons (helper bug, regex
wrong, missed step, etc.), fix the test in the working tree and re-run
until it produces clean results. Do not commit yet — the goal is for
the PR's commit history to reflect intent and process (test-first,
then fixes), not the step-by-step debugging of the test itself.

Record:

- **Compiles:** does `raco congame upload` succeed? The upload command
  resolves module dependencies (which forces a parse) before
  transmitting, so a non-zero exit means the study did not compile
  and the printed Racket error is the cause. A successful upload (exit
  0) is sufficient evidence that the study compiles.
- **Test status:** capture which assertions passed and which failed.
  Distinguish hard from soft failures. Map each soft failure to the
  finding number it surfaces.

## 6. Commit the test

Once the test runs cleanly, stage and commit it as the **first** commit
on the review branch. The commit must contain only the new test file —
no changes to the study code.

Follow the project's commit-trailer convention (see `study-config.md`).
If the project attributes AI-assisted commits with a `Co-Authored-By`
trailer, include it, and pass the message via a HEREDOC so the trailer
survives shell quoting:

```
git commit -m "$(cat <<'EOF'
Add Playwright test for {STUDY-ID}

{1–3 sentences: what the test verifies, including the key
design-fidelity assertions.}

{Co-Authored-By trailer(s), per study-config.md}
EOF
)"
```

If a required trailer is missed, fix it before pushing with
`git commit --amend` (the same HEREDOC pattern works there).

Do not push yet.

## 7. Open the PR

Push the branch:
```
git push -u origin {branch}
```

`origin` is the default. If you are contributing from a **fork** (you
don't have push access to the canonical repo), push to your fork's remote
instead (e.g. `git push -u fork {branch}`) and open the PR from there.

Open the PR against the project's PR base branch (the "PR base branch"
field in `study-config.md`; default: the repo's default branch). Pass it
explicitly with `--base {base}` if it differs from the default.

Decide whether to open as draft or ready:

- **Ready (`gh pr create --base {base}` without `--draft`)** — only if
  the study compiles, all hard assertions pass, all soft assertions
  pass, and there are no Bug findings to fix in this PR.
- **Draft (`gh pr create --base {base} --draft`)** — in any other case
  (compile failure, test failure, or any Bug finding that will be fixed
  in this PR).

Use this opening-comment template:

```
## Summary
{1–3 sentences: what the PR adds/changes — at this point, just the
test, plus any fixes that will follow.}

## Review findings
{Numbered list. Every finding gets exactly one label prefix:}
1. **Bug — short title.** Longer explanation...
2. **Note — short title.** ...
3. **Question — short title.** ...

## Compile and test status (initial)
- **Compiles:** yes / no — {if no, paste the relevant raco output}
- **Test:** `cd tests && npx playwright test studies/{lowercase}.spec.ts`
  - Hard assertions: pass / N failures
  - Soft assertions: pass / N failures
  - {If any soft failures: list each with the finding it surfaces:
    "soft failure on tied bonus → finding 3" (use a bare number, not
    `#3` — GitHub auto-links `#N` to issues/PRs in the repo, which
    will be wrong)}

## Faithful to design
{Bullet list of what the code gets right vs. the design.}

## Test plan
- [{x or space}] `cd tests && npx playwright test studies/{lowercase}.spec.ts` — {status}

{Optional: "Related to #N" to link a tracking issue, if the project
uses one — see study-config.md}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### Referring to findings inside the PR body

When the opening comment, commit messages, or summary comment cite a
finding, write it as a bare number (e.g. "finding 3", "finding 1 +
finding 2"). Do **not** write "#3" — GitHub auto-links `#N` in PR
bodies and comments to issues or pull requests in the repo, which
will be wrong here. The exception is a trailing "Related to #N"
line, which intentionally links a tracking issue.

### Finding labels

Every numbered finding in "Review findings" MUST be prefixed with
exactly one of these labels:

- **Bug** — code diverges from the design or produces incorrect
  results. A bug means something is *wrong* and needs to be fixed.
- **Note** — observation, not a defect. Covers placeholders, naming
  choices, tech debt, missing `@meta` tags, missing `-with-admin`,
  cosmetic issues. The reader should understand this is informational,
  not actionable in this PR.
- **Question** — ambiguity between the design and the code that needs
  the study author's clarification before it can be classified as a
  Bug or a Note.

### Draft review

Show the full opening comment to the user before posting. The user
may adjust labels, reorder findings, or revise wording.

If the PR was opened as **ready**, the workflow ends here. No further
commits or comments are needed.

## 8. Apply fixes (only if PR opened as draft)

Apply fixes in this order:

**(a) Compile fixes first.** If `raco congame upload` failed,
identify the minimum correction needed for the study to load and run.
Avoid stupid shortcuts — do not silence errors by stubbing or
deleting valid code, do not paper over a missing function or step.
Make the corrections meaningful (e.g. rename a misspelled identifier,
insert a missing step into the flow, fix a malformed at-expression).
One commit per logical fix.

**(b) Design-fidelity fixes next.** For each test failure that
surfaces a Bug we will fix in this PR, add a separate commit with a
narrowly scoped change. One commit per logical fix.

Each fix commit follows the same commit-trailer convention as the test
commit (see step 6). Use the HEREDOC pattern.

After each fix commit:
1. Re-upload (`raco congame upload ...`).
2. Re-run the test (`cd tests && npx playwright test ...`).
3. Push the commit (`git push`).

### Out-of-scope findings — leave soft assertions red

If a soft assertion remains red because the underlying finding is
structural or otherwise out of scope for this PR (e.g., a divergence
that requires substantial redesign of the study), **leave it red**.
Do **not** disable, comment-skip, or rewrite the assertion to make
the test green. The red soft assertion is the durable record of the
open finding; the summary comment in step 9 will explicitly flag it.

## 9. Mark PR ready and post the summary comment (only if PR opened as draft)

After all fix commits have been pushed:

1. Run the test one final time to confirm the current state:
   ```
   cd tests && npx playwright test studies/{lowercase}.spec.ts
   ```

2. Mark the PR ready for review:
   ```
   gh pr ready {PR-number}
   ```

3. Post **one** summary comment to the PR using
   `gh pr comment {PR-number} --body "..."`. Use this template:

   ```
   ## Fixes applied

   - {short hash} — {short description, e.g. "addresses finding 1"}
   - {short hash} — ...

   ## Test status after fixes

   `cd tests && npx playwright test studies/{lowercase}.spec.ts`:
   {result, including any remaining soft failures}

   {If any soft assertions remain red, list them here:}
   The following soft assertions remain red because the underlying
   finding is out of scope for this PR:
   - finding 4 — {one-line context}

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   ```

   Use bare numbers ("finding 1", "finding 4") — not "#1" or "#4" —
   so GitHub does not auto-link to issues or PRs.

   Show the comment body to the user before posting.

The PR is now ready for review. The reader can follow the work in
order: test commit (the design spec) → fix commits (study code
brought into line with the design) → opening comment (review
findings + initial status) → summary comment (fixes + final status).

## 10. Checklist path: report, upload, manual test

(Only when the project has no Playwright test suite.)

### Report findings

Present the review as a checklist with pass/fail status. For any
failures, explain the issue and suggest a fix. Ask the user if they
want you to apply the fixes before proceeding to upload.

### Ensure `-with-admin` variant exists

If the study is missing a `-with-admin` variant with bot models, add
one before uploading — this is required infrastructure for testing,
not optional. See the `coding` and `conscript-coding` skills for the
exact patterns (requires `conscript/admin` and `racket/match`; add the
`-with-admin` identifier to `(provide ...)`; add `@meta[#:name "wait"]`
to every wait/refresh page; add `make-autofill-meta` to every form;
define a `(make-bot-model kind)` that dispatches on step path with
`match`; register both bot kinds via `make-admin-study`).

### Upload

After the review passes (or fixes are applied), upload the study using
the `upload` skill. Read the `(provide ...)` form to determine the
study ID; prefer the `-with-admin` variant.

### Test

**Important:** Before running simulations, remind the user that if this
is the first time the study has been uploaded, they need to create a
study instance on the server first (via the admin UI at
`<server>/admin`). The simulation will fail without an active instance.
Wait for the user to confirm before proceeding.

After the instance is ready, ask the user to manually test the study.
Provide the test URL: `<server>/_anon-login/<instance-slug>` (default
server: `http://127.0.0.1:5100`, or per `study-config.md`).

The `<instance-slug>` is the slug the user chose when creating the
instance in the admin UI — **not** the study ID. The congame anon-login
route resolves its argument as an instance slug
(`lookup-study-instance/by-slug`), so passing the study ID only works if
the instance was deliberately given a slug equal to the study ID.

**Note:** `raco congame simulate -n <N> <instance-slug>` opens browser
windows (pointed at `/_anon-login/<instance-slug>`) but still requires
manual interaction — it does NOT run bots automatically. Do not use it
for unattended testing.

For studies with matchmaking, remind the user to open multiple
sessions (one per group size) to test the pairing flow.
