---
name: examples
description: |
  Where to find example conscript studies by pattern. Reads repo paths
  from study-config.md.
user-invocable: false
---

Read `study-config.md` in the project root for example repo paths. That
file is created on first use by whichever skill needs it (see the
`study-config` skill for its schema and first-run setup).

## Built-in congame examples

In the congame repo:

| Location | Contents |
|----------|----------|
| `conscript/examples/` | Small focused examples: `kitchen-sink.rkt` (full flow, forms, consent branching, nested study), `form.rkt` (minimal form), `with-require.rkt` (external modules) |
| `congame-example-study/` | Larger examples including conscript studies — look for files/folders starting with `conscript-` or files using `#lang conscript` |
| `congame-doc/conscript-examples/` | `tutorial.rkt` (simple survey with variable interpolation) |

## Search heuristics

When you need one of these specific patterns, grep the example repos
for these strings to find reference implementations:

| Pattern | Search for |
|---------|-----------|
| Looping over rounds | `add1 rounds` |
| Treatment assignment | `shuffle` or `assigning-treatments` |
| Branching on treatment | `if competition?` |
| Matchmaking | `make-matchmaker` |
| Wait pages | `refresh-every` |
| Bot testing | `make-bot-model` |
| Autofill metadata | `make-autofill-meta` |

Search in congame examples first, then project-specific studies, then
other repos listed in `study-config.md`. These greps also hit library
internals (files under `conscript/`, e.g. `base.rkt`, `form0.rkt`,
`survey-tools.rkt`) — those are framework source, not example studies.
Restrict the search to example/study directories
(`congame-example-study/`, `studies/`, and any study dir from
`study-config.md`) to keep hits to real reference studies.

## If a congame source checkout isn't available (degrade + inform)

The tables above assume a local **congame source checkout** (its path in
`study-config.md` under "Example repos"). A newcomer who only
package-installed congame won't have that tree. Degrade in this order, and
**tell the user what happened** rather than silently finding nothing:

1. **Configured source / example repos** (`study-config.md` → "Example
   repos") — use these if present.
2. **Installed package examples** — fall back to the `conscript/examples/`
   directory inside the installed `conscript` package (locate it with
   `racket -e '(collection-path "conscript")'` — *if installed*). Caveat
   that a couple of these (e.g. `kitchen-sink.rkt`, `form.rkt`) can be
   stale relative to the current framework.
3. **Nothing found** — say so, and proceed from the `conscript-coding`
   skill's inline patterns instead of example files.

Whenever you fall back or find nothing, **be informative**: name what was
missing (no source checkout / no example path configured / package not
installed) and suggest the fix — e.g. "add your congame checkout path to
`study-config.md` → Example repos for richer, current examples." A one-line
suggestion to improve the project's `study-config.md` (or its docs) makes
the next run better instead of hitting the same gap silently.
