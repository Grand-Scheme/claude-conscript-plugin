---
name: compose-studies
description: |
  Set up and grow a composition framework for a project with many
  studies that run inside the same standard pages (consent, checks,
  demographics, payment, thank-you). Sets up the framework once, then
  converts existing studies into composable units and adds them. Use
  when a project wants to "plug" several studies into one common
  wrapper, or asks to convert a study for composition.
argument-hint: "[setup | convert <study> | add <study>]"
---

A **composition framework** is the project-level machinery that lets
any of a project's studies run inside one standard wrapper, with no
per-study copy of the wrapper. It has four parts:

- **Signatures**: the "plugs" every study has to fit. Typically what
  the wrapper tells a study (a fee, a condition) and what a study hands
  back (its `study`, a way to compute its payment).
- **Shared pages**: the steps every composed study runs before and
  after the study proper, in one module.
- **A compose function**: takes study units as arguments and returns a
  complete study: shared opening pages, assignment of a participant or
  group to one unit, the unit's study under its own step name, shared
  closing pages.
- **Composed studies**: short files that call the compose function with
  a list of units. These are what gets uploaded.

Each study in the project becomes a **unit** (a study packaged with
declared imports and exports) that still has a standalone version.

Before starting, load the `coding`, `racket-coding`, and
`conscript-coding` skills. The unit rules in `conscript-coding`
("Composing Studies with Units") apply throughout and are not repeated
here; read the units tutorial it links if you have not. Part 3 of the
tutorial ("A function that composes any substudies") is the minimal
generic version of what this skill builds.

## Project configuration

Read `study-config.md` (schema in the `study-config` skill; if the file
does not exist, run that skill's first-run setup, then continue). The
`## Composition` section records the framework once it exists. If the
section is present, the framework is set up: skip to **Convert** or
**Add**. If it is absent, start with **Set up**, unless the user only
wants to write one parent around one or two children, in which case
tell them a plain child study is enough (see "When to use units" in the
tutorial) and stop.

## Set up

Goal: the smallest framework that the project's real studies fit.

1. **Learn the wrapper from the studies, not from a questionnaire.**
   Read the design documents and several existing studies. Find the
   pages they share (consent, attention check, instructions,
   demographics, payment, thank-you) and what varies across them. Then
   confirm with the user what the wrapper should own and what stays in
   each study, and how participants are assigned to a study (each
   participant at random, a balanced rotation, or whole groups sent
   together). Ask about intent; let the studies answer the details.

2. **Design the signatures from what crosses the boundary.** List what
   the wrapper decides that a study must show (usually the fee) and what
   a study decides that the wrapper must show or pay. Keep the
   signatures as small as that list. Prefer exporting a payment
   *function* (a thunk) to a number: the wrapper calls it after the
   study ends, and a study whose payment depends on other participants
   can compute it late. Write every signature once, in a file apart from
   the studies, with a comment saying what each name means and when the
   parent calls it.

3. **Extract the shared pages** into one module that provides the steps
   and the few `defvar*` values the wrapper and the studies both read
   (the fee, consent answer). Keep text that mentions the fee a
   function called while the page is shown. Pages that only the
   wrapper reads can use plain `defvar`.

4. **Write the compose function** in its own module, following the
   tutorial's Part 3 and the rules in `conscript-coding`. Project
   choices that belong here, as keyword arguments with defaults: the
   fee, the group size, anything else a caller may want to vary. Give it
   the argument check (at least one unit) and a load-time check that
   each unit fits the signatures, so a bad unit fails at upload.

   Assignment is where most of the project-specific work is:
   - *Each participant at random*: a `pick` step stores a position in a
     `defvar*`; the dispatch lambda only looks it up.
   - *Balanced*: keep a shuffled queue of positions in a
     `defvar*/instance`, refilled when empty, and pop from it inside
     `with-study-transaction` so two participants cannot take the same
     slot. Every N assignments then cover each of N studies once.
   - *Whole groups*: a waiting room (`make-matchmaker` with the group
     size, created in the function body, and a wait page with
     `refresh-every`) before the pick step. The first member of a ready
     group to reach the pick step draws the study and records it in a
     `defvar*/instance` map from group id (`get-current-group`) to
     position; the others read the map. Pick, wait, and dispatch can be
     one nested `defstudy` so the top-level flow stays readable.

   **Assign after consent.** Put consent, and anything else every
   participant sees before the study proper, *before* the pick step.
   If the page before assignment already names or describes the study,
   participants can decline because of which study they drew, so each
   study keeps a different, self-selected sample, and returning the
   declined slot to the queue keeps the counts balanced but not the
   samples. Only assign first when the design requires it (an ethics
   board wants study-specific consent, for example). Wanting the consent
   page to describe the assigned study is not such a reason: describe
   what all the studies have in common on the consent page and put the
   study's own description on its first page, after assignment. When
   assignment must come first, say so to the
   user, record the reason in `study-config.md`, and store the
   declines per study so the analysis can check for differential
   dropout.

   The dispatch step runs the unit's study as `{,id study}` with `id`
   made from the stored position (`substudy-0`, ...), then a step that
   records the payment into a `defvar*`, then `done`. Put a
   `define-static-resource` and `#:wrapper` for shared CSS on the
   composed study, at module level of the compose module.

5. **Convert one study** (see **Convert**) and write the first composed
   study file. Two units are better than one: they prove the assignment
   and the separate step names.

6. **Record the framework** in `study-config.md` under
   `## Composition`, then run **Test**.

## Convert

Turn one existing study into a unit that fits the project's signatures,
without changing what a standalone participant sees.

1. Read the study, its design document, and the signatures and shared
   pages named in `study-config.md`.
2. Apply the conversion recipe in `conscript-coding`. Project-specific
   points:
   - Remove pages the wrapper now owns (consent, demographics,
     thank-you) from the unit's flow. Keep the ones the design says the
     study needs even inside the wrapper.
   - Every place that wrote the fee as a literal calls the imported
     function instead.
   - `compute-payment` reads a `defvar*` in a namespace named after the
     study (the study ID is a good name).
   - If the study assigns treatments or matches participants, check the
     runtime step name keeps its state apart from the other units (it
     does, if the compose function uses `{,id study}`), and give
     `assigning-treatments` a `#:treatments-key` if more than one unit
     uses it.
3. **Keep the standalone study identical for its participants.** Build
   it from the unit at module level inside a `let`, with the fee the
   study used before, and wrap it with the pages the wrapper now owns
   (its old thank-you page, its CSS wrapper) outside the unit.
   For a study that is new, or whose own consent and closing pages are
   the same as the shared ones, the standalone can instead be the
   compose function called with that one unit
   (`(define pta01 (compose-studies pta01@))`): no second copy of the
   shared pages, and the standalone runs exactly what the composed
   study runs. Its pages then are the shared pages, so do not use this
   form for a study whose participants must keep seeing its old pages,
   and it cannot have a working `-with-admin` variant (see **Known
   limits**). Keep the study's old provided names so existing composed files, instances,
   and tests do not break; add the unit to the `provide`.
   The pages stay the same but the step paths do not: the old steps now
   sit one level down, inside the unit's study. A participant partway
   through a live standalone instance cannot resume after the new code
   is uploaded to it. Tell the user; upload the converted study to a
   new instance, or wait until the live one has no one mid-study.
4. Update the conversion list in `study-config.md`.
5. Run **Test**: the study's existing Playwright spec (standalone) must
   still pass, changed only where a name or a helper changed, and the
   composed study must run the new unit.

## Add

Add a converted unit to a composed study: one `require` and one more
argument in the composed study file. If participants have already
started on the live instance, never insert in the middle or reorder:
positions name both the stored choice and the step. Append, or make a
new composed study file and a new instance.

## Test

Compile every changed file (`raco make`). Then, if the project has a
Playwright suite (`## Review pipeline` in `study-config.md`), load the
`playwright-test` skill and write or extend a spec for the composed
study. Assertions that are specific to composition:

- The fee the wrapper sets appears on the unit's pages.
- Each participant (or each whole group) lands in exactly one unit, and
  assignment matches the design: with a balanced queue, N groups over N
  units cover each unit once.
- Re-entering the study URL mid-unit resumes the same page of the same
  unit (the stored choice and stable step name at work).
- Treatment balance and matchmaking hold *within* each unit, not across
  units.
- The payment the unit shows equals the payment the wrapper's payment
  page shows.
- A participant who declines consent never reaches the assignment or
  waiting room.

Run enough participants to fill every unit at least once (group size ×
number of units, plus a decliner). Without a suite, give the user a
manual test with the same checks. Offer `/upload` when it passes.

## Known limits

State these to the user when they matter; do not work around them
silently:

- **No congame bots for dispatched studies.** Congame builds a bot
  (`make-admin-study`, `study->bot`) by walking the study's steps before
  any participant exists, and it cannot walk into a `defstep/study`
  whose `#:study` is a lambda: building the bot fails with
  `study-steps: contract violation`. So a composed study that picks its
  unit at run time, and a standalone built by calling the compose
  function with one unit, cannot have a working `-with-admin` variant.
  A fixed-order composition (each unit its own static step) and a
  standalone built from the unit inside a `let` with a static
  `defstudy` can. Test dispatched studies with Playwright. Do not write
  a `-with-admin` variant for them; tell the user why. If the project
  needs bots in a composed study (e.g. to fill matchmaking groups in a
  live study), that needs a change in congame, not in the study.

- A compose function that returns a study cannot be passed to another
  compose function. Nesting compositions needs it to return a unit.
- The wrapper calls `compute-payment` once, when the unit ends. A
  payment that depends on participants who have not finished yet needs
  a "not yet computable" path the project must design.
- A waiting room that never fills waits forever. Recruit in multiples of
  the group size, or add a timeout.
- A unit does not see its waiting-room cohort unless the signatures
  pass it in.
