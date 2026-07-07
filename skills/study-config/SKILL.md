---
name: study-config
description: |
  Schema and first-run setup for study-config.md, the project
  configuration file every conscript skill reads to match a project's
  conventions. Loaded by other skills; not user-invocable.
user-invocable: false
---

`study-config.md` is a plain-Markdown file in the project root that
records a project's conventions — where its studies live, how they are
named, whether it keeps design documents or a Playwright test suite, and
which servers it deploys to. The `create-study`, `examples`,
`study-review`, `playwright-test`, and `upload` skills read it so their
behavior matches the project at hand instead of assuming one lab's
layout.

Every field and every section is **optional**. When a field or section
is absent, the consuming skill falls back to the documented default
(noted inline in the schema below) or asks the user. A hand-written or
partial file is perfectly valid — the interview in "First-run setup" is
only a convenience for producing one, never a gate.

## Schema

```markdown
# Study config

## Project
- Research domain: ...
- Typical study structure: ... (rounds, treatments, measurements)
- Constraints: ... (consent, payment, CSS conventions)
- Study ID convention: ... (the project's naming rule for study IDs, if
  any; leave blank for none — a descriptive slug of the study title is
  then used, and the user can override)
- Study file location: ... (directory/glob where .rkt studies live,
  e.g. `experiments/`; default: repo root)

## Example repos
- congame: <path>
- <other repos with example studies>: <path>

## Design documents
- Location: ... (path convention, e.g. `design/<study>.md`,
  or "none" if the project does not keep design docs)

## Servers
- Local: ... (default `http://127.0.0.1:5100`)
- Staging: ... (URL, or "none")
- Production: ... (URL, or "none")

## Review pipeline
(Omit this whole section if the project has no Playwright test suite —
`study-review` then falls back to a checklist review + manual test.)
- Playwright tests: yes / no
- Test directory: ... (e.g. `tests/studies/`)
- Test helpers: ... (e.g. `tests/helpers/`)
- Server URL: ... (the server the tests hit; default: the `Local`
  entry under `## Servers`)
- Local admin credentials: ... (e.g. `admin@congame.local` / `admin`
  for a local Docker server; the congame default)
- PR base branch: ... (e.g. `main`)
- Commit trailers: ... (any `Co-Authored-By` or attribution convention
  the repo uses for AI-assisted commits; "none" if not used)
- Issue linking: ... (whether to add "Related to #N" linking a tracking
  issue; "no" if not used)
```

## First-run setup

If a skill needs `study-config.md` and none exists in the project root,
create it before proceeding — then continue with the task that triggered
setup. Do not stop and ask the user to re-invoke.

Interview the user to learn enough about the project to fill in the
schema above: their research domain and typical study structure (rounds,
treatments, measurements), constraints (consent, payment, CSS
conventions), naming conventions, where the congame repo and any
example-study repos live, whether they keep design documents, whether
they have a Playwright test suite and where its tests and helpers live,
and which servers they deploy to. If they already have a `.md` file
describing their study patterns, read it and use it instead of asking.

State the intent behind each area and let the user answer in their own
terms; do not march through a fixed questionnaire — the intent draws out
better answers than a rigid script. Write the answers to
`study-config.md`, omitting fields the user does not know (their defaults
apply) and whole sections that do not apply (e.g. the Review-pipeline
section when there is no Playwright suite).

A skill that needs only one or two fields — e.g. `upload` resolving a
study path, or `study-review` checking only whether a Playwright suite
exists — may ask just those questions and offer to run the full setup,
rather than forcing the whole interview on the user.
