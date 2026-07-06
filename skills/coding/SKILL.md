---
name: coding
description: |
  Coding conventions and patterns for conscript studies. Use when
  writing, modifying, or reviewing any Racket/conscript study code.
user-invocable: false
---

Before writing or modifying study code, also load these reference skills:
- [Racket language reference](../racket-coding/SKILL.md) for at-expression syntax, data types, control flow, and idioms
- [Conscript framework reference](../conscript-coding/SKILL.md) for study structure, variables, forms, widgets, matchmaking, and all framework APIs

## Study File Template

Study files (kept in the project's study directory — see the "Study file
location" field in `study-config.md`, e.g. `experiments/`) follow this
structure:

```racket
#lang conscript

(require conscript/admin
         conscript/form0
         conscript/survey-tools
         racket/match)

(provide study-name study-name-with-admin)

;; CSS
(define common-styles @style{ ... })

;; Variables
(defvar answer)
(defvar/instance treatments)
(defvar competition?)

;; Steps
(defstep (welcome) ...)
(define (assign-treatments) ...)
(defstep (instructions) ...)
(defstep (task) ...)
(defstep (sociodemo) ...)
(defstep (the-end) ...)

;; Study flow
(defstudy study-name
  [welcome --> assign-treatments --> ...])

;; Bot testing
(define study-name-with-admin
  (make-admin-study
   #:models `((liar . ,bot-model) (honest . ,bot-model))
   study-name))
```

## Naming Conventions

Follow the project's conventions, recorded in the "Study ID convention"
field of `study-config.md` (schema in the `study-config` skill). Absent
a stated convention, these defaults work well:

- Study IDs are short unique alphanumeric codes (e.g. `PCS27`), used as
  the study variable name: `(provide PCS27 PCS27-with-admin)`
- Steps named descriptively: `welcome`, `instructions`, `game-control`, `final-result-competition`
- A boolean treatment flag (e.g. `competition?`)
- Treatment list: `treatments` (instance variable)

## Common Patterns

**Treatment assignment** — every study uses balanced randomization:
```racket
(defvar/instance treatments)
(defvar competition?)
(define (assign-treatments)
  (with-study-transaction
    (when (null? (if-undefined treatments null))
      (set! treatments (shuffle '(#t #t #f #f))))
    (set! competition? (first treatments))
    (set! treatments (rest treatments)))
  (skip))
```

**Branching on treatment** — in defstudy flow:
```racket
[assign-treatments --> ,(lambda ()
                          (if competition?
                              'instructions-competition
                              'instructions-control))]
```

**Looping a task N times**:
```racket
[task-step --> ,(lambda ()
                  (cond [(< rounds max-rounds)
                         (set! rounds (add1 rounds))
                         'task-step]
                        [else
                         (set! rounds 0)
                         'next-section]))]
```

**Conditional content** — inline in markdown:
```racket
@md{# Instructions
    @(if competition? instructions-competition instructions-control)
    @button{Continue}}
```

## CSS

Every study defines `common-styles` with the same base CSS block. Copy from an existing study in the project or the congame examples when creating new ones. Include `@common-styles` in every `@md{...}` step body.

## Bot Models

Studies should provide a `*-with-admin` variant. Bot models dispatch on step path:
```racket
(define ((make-bot-model kind) id bot)
  (match id
    ['(*root* form-step)  (bot:autofill kind)]
    ['(*root* the-end)    (bot:completer)]
    [_                    (bot)]))
```
Use `make-autofill-meta` in forms to define autofill values for each bot kind.

## Checklist

When writing or reviewing a study:
- Every `defvar/instance` mutation is inside `with-study-transaction`
- Forms use `(required)` validation on all fields
- Treatment assignment uses balanced shuffle (groups of 2 or 4)
- `(skip)` is called at end of computation-only steps
- Study ends with `,(lambda () done)` not `∅`
- Bot model handles all steps (especially wait/refresh steps with `(void)`)
