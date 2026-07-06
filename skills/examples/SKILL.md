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
other repos listed in `study-config.md`.
