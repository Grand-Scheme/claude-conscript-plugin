---
name: create-study
description: |
  Create a new conscript study. Initializes project config on first use,
  then generates a .rkt study file matching the project's conventions.
argument-hint: "[study-description]"
---

Create a new [Conscript](https://docs.totalinsightmanagement.com/congame/Conscript.html)
study. Conscript is a DSL for authoring online experiments, built on the
[congame](https://github.com/MarcKaufmann/congame) framework.
For setup and installation, see the
[congame docs](https://docs.totalinsightmanagement.com/congame/).

Before starting, load the `coding`, `racket-coding`, and
`conscript-coding` skills for reference.

## Initialization

This study will match the project's conventions, which live in
`study-config.md` (schema and defaults in the `study-config` skill). If
that file does not yet exist in the project root, load the `study-config`
skill and run its first-run setup to create one, then continue creating
the study — do not stop and ask the user to re-invoke.

## Create Study

1. Read `study-config.md` and the `conscript-coding` skill.
2. If `$ARGUMENTS` has a description, use it. Otherwise ask what the
   study is about and how it differs from the project's typical pattern.
3. Search example repos listed in `study-config.md` for relevant
   patterns (see the `examples` skill for search heuristics).
4. Generate a `.rkt` file following the `coding` skill conventions.
   Include the `-with-admin` variant with bot models.
5. Self-check against the `study-review` checklist. Fix issues.
6. Present to user. Iterate. Offer `/upload` when ready.
