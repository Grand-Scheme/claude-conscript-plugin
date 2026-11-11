---
name: conscript-coding
description: |
  Conscript framework reference for coding ConGame studies. Covers study
  structure, variables, forms, widgets, navigation, matchmaking, bot
  testing, and all available APIs. Use when writing or modifying #lang
  conscript study code.
user-invocable: false
---

Complete reference for the `#lang conscript` study-authoring DSL built
on the congame framework.

Documentation: https://docs.totalinsightmanagement.com/congame/Conscript.html

## Study Structure

### `defstudy` — Define a Study

```racket
(defstudy study-name
  [step-a --> step-b --> step-c]            ;; linear chain
  [step-c --> ,(lambda () done)]            ;; terminal (ends study)

  ;; conditional branch
  [step-x --> ,(lambda ()
                 (if condition 'step-y 'step-z))]

  ;; separate flow segment (connected by step names)
  [step-y --> step-final]
  [step-z --> step-final]
  [step-final --> ,(lambda () done)])
```

- `-->` chains steps in sequence.
- `,(lambda () ...)` for conditional transitions. Must return a step symbol or `done`.
- Multiple `[step --> ...]` blocks define separate flow segments connected by step names.
- **Study must form a connected graph.** Every step must be reachable.

### `defstep` — Define a Step

```racket
(defstep (step-name)
  ;; body evaluates to page content (xexpr)
  @md{# Page Title
      Content here.
      @button{Continue}})
```

A step can also be a plain function (for computation steps like
treatment assignment):

```racket
(define (assign-treatments)
  (with-study-transaction ...)
  (skip))
```

### `defstep/study` — Nested Child Study

```racket
(defstep/study run-substep
  #:study child-study-expr)
```

Use `defvar*` / `defvar*/instance` with `with-namespace` to share data
between parent and child.

### Composing Studies with Units

Use this when one place in a parent study must accept any of several
interchangeable sub-studies, when a sub-study must not know which parent
uses it, when the parent needs a calculation back (a function, not just
a value), or when the study around the sub-studies is worth writing once
as a function. Otherwise use a plain child study with `defstep/study`
and `defvar*` (see the parent-child tutorial); units are more machinery
than most studies need.

ALWAYS read the tutorial "Advanced Study Composition with Units"
(https://docs.totalinsightmanagement.com/congame/units-tutorial.html;
`congame-doc/conscript-tutorial-units.scrbl` in the congame source)
before writing or changing a composed study. Its Guidelines section
lists each mistake with the error it produces. Most of the mistakes
below produce no error at all, only wrong or mixed-up data. For a
project-wide framework (many studies inside the same standard pages),
use the `compose-studies` skill, which builds on the rules here.

Shape: signatures name the "plugs"; each sub-study is a `unit` that
imports what it needs and exports its study; the parent invokes the
unit inside a scope and wires the exports into its flow.

```racket
;; signatures.rkt — define each signature once, apart from the studies
(provide fee^ study^ payment^)
(define-signature fee^ [get-fee])
(define-signature study^ [study])
(define-signature payment^ [compute-payment])

;; task.rkt  (#lang conscript/with-require, requires "signatures.rkt")
(provide task@)
(define-static-resource css "common.css")            ;; outside the unit
(define task@
  (unit (import fee^) (export study^ payment^)
    (with-namespace my-lab.task (defvar* task-payout))
    (define (compute-payment) task-payout)
    ;; ... steps; pages call (get-fee) while they are shown ...
    (defstudy study                                   ;; the name study^ promises
      #:wrapper @add-css-resource[css]
      [intro --> problems --> ,(lambda () done)])))

;; parent.rkt
(with-namespace my-lab.parent
  (defvar* selected-task)                             ;; a symbol, never the unit
  (defvar* task-payment))
(define tasks (list (cons 'counting counting@) (cons 'lottery lottery@)))
(defstep (pick-task)                                  ;; decide once, in a step
  (set! selected-task (car (list-ref tasks (random (length tasks)))))
  (skip))
(defstep/study run-task
  #:study (lambda ()                                  ;; only looks the choice up
            (define task@ (cdr (assq selected-task tasks)))
            (define (get-fee) participation-fee)      ;; imports are matched by name
            (define-values/invoke-unit task@ (import fee^) (export study^ payment^))
            (define (record) (set! task-payment (compute-payment)) (skip))
            (defstudy task+record
              [{,selected-task study} --> record --> ,(lambda () done)])
            task+record))
```

Rules:

- Invoke a unit only inside a `let` body or a `lambda`, never at module
  level. The exports become definitions in that scope; every unit
  exports `study`, so two invocations at module level fail with
  `identifier already defined`.
- `define-values/invoke-unit` is a definition, not an expression. Put
  it where a `define` can go; inside `(define s (begin ...))` or a
  function argument it fails with `not allowed in an expression
  position`.
- Define every imported name in the same scope, spelled exactly as the
  signature spells it, before `define-values/invoke-unit`. A missing
  import fails with `unbound identifier`; a similar name does not help.
- Decide which unit to run in its own step and store the decision in a
  `defvar*` as a symbol or a number, never the unit itself. The
  `#:study` lambda runs again every time a participant enters the step,
  including on resume; if it chose on its own it could put a returning
  participant in a different sub-study. The lambda reads stored values
  and builds a study, nothing more.
- When one step can run more than one unit, run the unit's study under
  a step name of its own: `{,selected-task study}`, not `study`. Stored
  values, `defvar/instance` state, and `make-matchmaker` state are filed
  by step path; without a distinct name every unit shares the path
  `run-task / study`, and two sub-studies silently share their
  `treatments` list and their matchmaking pool. No error is raised.
  A parent that gives each unit a separate step of its own (fixed
  order) needs nothing extra.
- The `{,expr step}` step ID must be the same every time the study is
  built, including after a server restart. Compute it from constants or
  stored variables, never with `random`, `gensym`, or the time; a
  changed ID fails with `failed to resume step in study` and orphans the
  stored data. Write the form once per step, and do not refer to that
  step by a bare name in another clause (return its ID from a
  transition lambda instead). It needs a congame server with runtime
  step IDs (`defstudy` reference, "step-spec").
- `assigning-treatments` (survey-tools) stores its list at the top of
  the study, outside any step path. Two sub-studies that both call it
  need distinct `#:treatments-key` arguments.
- Anything that crosses between a unit's study and the study around it
  is a `defvar*` inside a `with-namespace`: every study variable an
  exported function reads, a fee the parent sets, the choice of unit, a
  payment the parent records. A plain `defvar` there raises no error; the
  page shows `undefined`. Use the step name, not a namespace, to keep a
  sub-study's own state to itself.
- Call imported names only from inside steps, never at the top level of
  the unit. The unit body runs when it is invoked, which may be at
  module load with no participant present. Text that shows the fee is a
  function called from a step.
- A study that runs a unit through a `#:study` lambda cannot get a
  congame bot: `study->bot` walks the steps ahead of time and fails
  on a lambda (`study-steps: contract violation`). Test such studies
  with Playwright, not `-with-admin` bots.
- Do not keep participant data in a plain `define` inside a unit. The
  body runs again on each invocation; only `defvar` / `defvar*` values
  survive.
- A sub-study's last page has a button and its flow ends with
  `,(lambda () done)`. The parent owns consent, sociodemo, payment, and
  thank-you pages.
- When the parent is a function that takes units as arguments, keep the
  `defvar*` declarations at module level and everything else (steps,
  `defstep/study`, `defstudy`) inside the function. The function body
  runs at load time, so it may define steps and check its arguments but
  must not read a study variable. Store the choice as a position in the
  argument list and name the step from it (`substudy-0`, `substudy-1`,
  ...); once participants have started, do not reorder the arguments.
  Invoke each unit once in the body and discard the result, so a unit
  that does not fit fails at upload rather than on a participant's
  screen.
- Define each signature once, in a file apart from the studies. A
  signature defined twice is two different signatures, and a unit
  written against one will not plug into a parent written against the
  other. One file for all signatures or one file each
  (`#lang racket/signature`) is a matter of taste; follow the project.
- Keep `define-static-resource` at module level, outside the unit.
  `raco congame upload` collects resources when the module is
  instantiated, before any unit body runs; a resource defined inside
  the unit is silently left out of the upload.
- `#lang conscript/with-require` is needed for `(require
  "signatures.rkt")` (see the with-require notes on who can upload);
  `unit`, `import`, `export`, and `define-values/invoke-unit` are
  available in plain `#lang conscript` as well. The language is a
  subset of Racket (`range` is missing; use `build-list` or
  `in-range`).
- To keep a converted study runnable on its own, invoke its unit once
  at module level inside a `let` with fixed imports and `provide` both
  the unit and the resulting study:
  `(define task-alone (let () (define (get-fee) 1.30) (define-values/invoke-unit task@ (import fee^) (export study^ payment^)) study))`.

To convert an existing study: switch to `#lang conscript/with-require`
and require the signatures; wrap the body in `(unit (import ...)
(export ...) ...)` and provide the unit; replace each value the study
used to supply itself (the fee) with a call to the imported function,
made while a page is shown; make sure the unit defines each exported
name exactly (`study`, `compute-payment`); end the flow with a button
and `,(lambda () done)` and drop the pages the parent provides; turn
every variable an exported function reads into a `defvar*` in a
namespace named after the study.

## Variables

### `defvar` — Per-Participant Variable

```racket
(defvar my-answer)        ;; starts as undefined
(set! my-answer 42)       ;; set value
my-answer                 ;; read value => 42
```

Persisted in database. Survives page refreshes. Scoped to one
participant's run.

### `defvar/instance` — Shared Instance Variable

```racket
(defvar/instance treatments)    ;; shared across ALL participants in this study instance
```

Used for: treatment lists, shared coin tosses, round counters. **Always
mutate inside `with-study-transaction`** to prevent race conditions.

### `defvar*` / `defvar*/instance` — Cross-Study Sharing

```racket
(with-namespace my.experiment
  (defvar* shared-choice)
  (defvar*/instance shared-counter))
```

For sharing data between parent and child studies. Both must declare the
same namespace and variable names.

### Checking Undefined

```racket
(undefined? my-var)              ;; #t if never set
(if-undefined my-var fallback)   ;; evaluates and returns fallback if undefined, else my-var
```

## Page Content

### Markdown

```racket
@md{# Heading
    Paragraph with **bold** and @|variable|.

    - Item 1
    - Item 2

    @button{Continue}}
```

- `@md{...}` — full page with container div
- `@md*{...}` — fragment for embedding (no container wrapper)

### HTML

```racket
@html{@h1{Welcome}
      @p{Text here.}
      @ul{@li{Item 1} @li{Item 2}}}
```

### CSS

Shared across the whole study — apply once with the study's `#:wrapper`
(via `@add-css`, provided by `#lang conscript`):

```racket
(defstudy my-study
  #:wrapper @add-css{
    body { background: #f5f5f5; }
    .container { background: white; padding: 40px; }
    button { background: #007bff; color: white; }
  }
  [my-step --> the-end])
```

For a stylesheet in a file, use `@add-css-resource[css]` with a
`define-static-resource`. For CSS specific to one page, put a
`@style{...}` block in that step's `@md{...}`:

```racket
(defstep (my-step)
  @md{@style{ .highlight { color: crimson; } }
      # Title
      ...})
```

### Static Resources

```racket
(define-static-resource my-image "images/photo.png")

;; Use in HTML:
@img[#:src (resource-uri my-image) #:alt "Description"]
```

## Navigation

### `button` — Advance to Next Step

```racket
@button{Label}                              ;; simple next
@button[action-thunk]{Label}                ;; call thunk, then advance
@button[action-thunk "Label" #:to-step-id 'target]{Label}  ;; jump to specific step
```

The action thunk is called before transition. Use for saving data:
```racket
(define (save-choice)
  (set! my-choice "cooperate"))
@button[save-choice]{Cooperate}
```

### `skip` — Skip Step Without Rendering

```racket
(skip)              ;; advance to next step
(skip 'step-id)     ;; jump to specific step
```

### `done` — End Study

Used in lambda transitions: `,(lambda () done)`

## Forms

**Require `conscript/form0` in any study that uses forms.** The form
macros and widgets below — `form`, `form*`, `form+submit`, `input-text`,
`input-number`, `submit-button`, `ensure`, the `binding/…` types, and
`make-autofill-meta` — are provided by `conscript/form0`, which `#lang
conscript` does **not** export by default. A study that uses them without
`(require conscript/form0)` fails to compile with an "unbound identifier"
error (e.g. `form+submit: unbound identifier`). Add the require at the top:

```racket
#lang conscript
(require conscript/form0)
```

(`conscript/form` provides a smaller subset — `input-text`,
`submit-button`, and friends — but not `form+submit`/`form*`; prefer
`conscript/form0` for the patterns below.)

### Pattern 1: `form*` — Manual Form with Aggregated Result

```racket
(define my-form
  (form*
   ([field1 (ensure binding/text (required))]
    [field2 (ensure binding/number (required))])
   (list field1 field2)))   ;; constructor combines fields

(define (on-submit result)
  (set! answers result))

(define (render rw)
  @md*{@rw["field1" @input-text{Your name}]
       @rw["field2" @input-number{Your age}]
       @|submit-button|})

(defstep (my-form-step)
  @md{# Form
      @(form my-form on-submit render)})
```

### Pattern 2: `form+submit` — Convenience Macro

Each field auto-binds to a `defvar` on submit via `set!`:

```racket
(defvar my-name)
(defvar my-age)

(define-values (my-form on-submit)
  (form+submit
   [my-name (ensure binding/text (required))]
   [my-age  (ensure binding/number (required))]))

(define (render rw)
  @md*{@rw["my-name" @input-text{Name}]
       @rw["my-age" @input-number{Age}]
       @|submit-button|})

(defstep (my-step)
  @md{# Form
      @form[my-form on-submit render]})
```

### Pattern 3: `@form[#:action ...]` with `@binding`

Inline form with implicit bindings:

```racket
(defvar choice)

(defstep (pick)
  (define (on-submit #:choice c)
    (set! choice c))
  @md{# Choose
      @form[#:action on-submit]{
        @binding[#:choice @make-multiple-checkboxes[opts #:n 2]]
        @submit-button}})
```

## Form Widgets

### Text Inputs
```racket
@input-text{Label}                          ;; single-line text
@input-text[#:attributes '((placeholder "hint"))]{Label}
@textarea{Label}                            ;; multi-line text
@input-email{Label}                         ;; email with validation
```

### Numeric Inputs
```racket
@input-number{Label}                        ;; number input
@input-range{Label}                         ;; slider (1-100)
```

### Date/Time
```racket
@input-date{Label}
@input-time{Label}
@input-datetime{Label}
```

### Selection
```racket
;; Options format: '(("value" . "Display Label") ...)
(define choices '(("1" . "Yes") ("0" . "No")))

(radios choices "Pick one:")                ;; radio button group
(select choices "Pick one:")                ;; dropdown
(checkbox "I agree")                        ;; single checkbox
(checkboxes choices)                        ;; checkbox group
```

### Advanced Widgets
```racket
;; Multiple checkboxes with validation
(make-multiple-checkboxes options #:n 2)              ;; at least 2
(make-multiple-checkboxes options #:n 2 #:exactly-n? #t)  ;; exactly 2

;; Multiple sliders
(make-sliders 5)              ;; 5 sliders, fields named slider-0..slider-4

;; Radios with "Other" free-text option
(make-radios-with-other choices "Pick or specify:")
```

### File Upload
```racket
@input-file{Upload}
```

## Validation

Used with `ensure` in form field definitions:

```racket
(ensure binding/text (required))                    ;; required text
(ensure binding/number (required))                  ;; required number
(ensure binding/number (required) (at-least 0))     ;; >= 0
(ensure binding/number (number-in-range 1 100))     ;; 1..100
(ensure binding/text (list-longer-than 2))           ;; list with 3+ items
(ensure binding/number)                              ;; optional number
```

Binding types: `binding/text`, `binding/number`, `binding/boolean`, `binding/email`, `binding/file`.

## Treatment Assignment

Standard balanced randomization pattern, for studies that have treatment
arms (a solo survey with no treatments needs none of this):

```racket
(defvar/instance treatments)
(defvar competition?)

(define (assign-treatments)
  (with-study-transaction
    (when (null? (if-undefined treatments null))
      (set! treatments (shuffle '(#t #t #f #f))))  ;; batch of 4
    (set! competition? (first treatments))
    (set! treatments (rest treatments)))
  (skip))
```

Or use the built-in helper:
```racket
(assigning-treatments '(treatment-a treatment-b treatment-c))
```

## Transactions

**Always** wrap mutations to `defvar/instance` variables in a transaction:

```racket
(with-study-transaction
  (when (= scored-rounds rounds)
    (set! score (add1 score))
    (set! scored-rounds (add1 scored-rounds))))
```

This uses serializable isolation to prevent race conditions when
multiple participants access shared state concurrently. Automatically
retries on conflicts.

## Matchmaking

### Setup

```racket
(define matchmaker (make-matchmaker 2))   ;; pairs of 2

(defstep (pair-with-someone)
  (matchmaker wait-for-match))            ;; call matchmaker with wait page

(defstep (wait-for-match)
  @md{# Waiting for a match...
      Please wait while we find another participant.
      @refresh-every[5]})                 ;; auto-refresh every 5 seconds
```

### Exchanging Data Between Matched Participants

```racket
;; Store own result
(store-my-result-in-group! 'my-choice round-decision)

;; Retrieve opponent's result
(define other-choices
  (current-group-member-results 'my-choice))        ;; list of other members' values
(define opponent-choice (first other-choices))        ;; first (only) opponent

;; Check if opponent has submitted yet
(define other-result
  (first (current-group-member-results 'choice)))
(if other-result
    ;; show result
    ;; show waiting page with @refresh-every[2]
    )
```

### Waiting for Opponent

Common pattern: check if opponent data exists, show waiting page if not:

```racket
(defstep (result)
  (define other-score
    (first (current-group-member-results 'round-choice)))
  (cond
    [other-score
     ;; Display results
     @md{Your opponent chose: @(~a other-score)
         @button{Continue}}]
    [else
     @md{Waiting for opponent...
         @meta[#:name "wait"]          ;; marker for bots
         @refresh-every[2]}]))
```

## Timers

```racket
@timer[60]              ;; 60-second countdown, auto-submits when expired
@refresh-every[5]       ;; reload page every 5 seconds (for wait pages)
```

**Known issue:** timers restart on page refresh.

## Currency Formatting

```racket
(~pound 2.5)    ;; "£2.50"
(~$ 1.30)       ;; "$1.30"
(~euro 3.0)     ;; "€3.00"
```

## Survey Tools

```racket
;; Toggleable content
(toggleable-xexpr "Click to show" @md*{Hidden content} #:hidden? #t)

;; Dice roller JavaScript
(make-diceroll-js)   ;; inject in page, use with <div class="diceroll">

;; Slider value display JavaScript
(slider-js)          ;; shows current slider value next to slider
```

## Bot Testing

### Defining Bot Models

```racket
(define ((make-bot-model kind) id bot)
  (match id
    ['(*root* welcome)
     (bot:continuer)]                          ;; click next button

    ['(*root* form-step)
     (bot:autofill kind)]                      ;; auto-fill form with named preset

    ['(*root* wait-page)
     (if (bot:find "meta[name=wait]")
         (void)                                ;; still waiting, do nothing
         (bot:continuer))]                     ;; opponent responded, continue

    ['(*root* the-end)
     (bot:completer)]                          ;; mark study complete

    [_ (bot)]))                                ;; default action
```

### Autofill Metadata

Define fill presets in form render functions:

```racket
(define (render rw)
  @md*{
    @make-autofill-meta[
      (hasheq
       'liar   (hasheq 'field1 "1" 'field2 "1")
       'honest (hasheq 'field1 "0" 'field2 "0"))]
    @rw["field1" (radios choices "Question 1")]
    @rw["field2" (radios choices "Question 2")]
    @|submit-button|})
```

### Registering Admin Study

```racket
(define study-with-admin
  (make-admin-study
   #:models
   `((liar   . ,(make-bot-model 'liar))
     (honest . ,(make-bot-model 'honest)))
   study-name))
```

### Bot Actions Reference

| Action | Description |
|--------|-------------|
| `(bot:continuer)` | Click next/continue button |
| `(bot:completer)` | Complete/finish the study |
| `(bot:autofill kind)` | Fill form using named autofill preset |
| `(bot:click id)` | Click button with specific widget ID |
| `(bot:find selector)` | Find DOM element (returns element or `#f`) |
| `(void)` | Do nothing (used for wait/refresh pages) |

## Logging

```racket
(log-conscript-info "message")
(log-conscript-info "value is ~a" my-var)
(log-conscript-debug ...)
(log-conscript-warning ...)
(log-conscript-error ...)
```

## Step Timings

```racket
;; Only available inside button actions or form submission handlers:
(define timings (get-step-timings))
(define total-ms (car timings))
(define focus-ms (cdr timings))
```

## Low-Level Storage

Rarely needed (prefer `defvar`), but available:

```racket
(put 'key value)               ;; participant-level
(get 'key)                     ;; participant-level
(get 'key default)             ;; with default
(put/instance 'key value)      ;; instance-level
(get/instance 'key)            ;; instance-level
(get/instance 'key default)    ;; with default
```

## Allowed Imports (Whitelist)

Only these modules can be `require`d in `#lang conscript`:

```
conscript/admin         conscript/form          conscript/form0
conscript/game-theory   conscript/matchmaking   conscript/survey-tools
racket/contract/base    racket/format           racket/list
racket/match            racket/math             racket/random
racket/string           racket/unit             racket/vector
data/monocle            gregor                  hash-view
koyo/haml               math/distributions      threading
buid
```

Attempting to require anything else will fail.
