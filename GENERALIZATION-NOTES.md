# Generalization notes — veto list for Marc

**Review artifact.** This file records every Many-Designs-specific (MD)
detail found while generalizing the plugin, where it lives, and its
disposition. Default disposition is **generalize away**; anything kept
MD-flavored is kept only as an *illustrative example* and says so.

Each entry: `location — what was there — disposition — veto?`. The
**disposition** is what I decided to do (usually "generalize away" = strip
the Many-Designs-specific bit). **Mark any entry whose disposition you
disagree with** — i.e. where you want a *different* outcome than written
(most often: "no, KEEP this, don't strip it"). Marking = flag it as
wrong, not "approve it".

You do **not** need to edit this branch yourself: just tell me (here in
chat, or as a PR review comment) which entries to change, and I apply the
change and push. If you'd rather do it by hand: `gh pr checkout <n>`, edit,
commit, push. **Delete this file before merge.**

---

## 1. Huber / replication / paper references

- **(whole tree)** — grep for `huber`, `replicat`, `many.designs`,
  `many designs` — **none found** in the plugin (only in PLAN.md, which
  is not committed). MD's `docs` skill carried the "Many Designs
  Replication" framing and was deliberately **not ported** (see §5).
  Disposition: nothing to generalize. Veto? n/a.

## 2. Study slugs (PCS27 / TEQ73 / ACH91 / NJJ10 / SBL89 / GWP43 / TVX41)

- **skills/coding/SKILL.md — Naming Conventions** — previously asserted
  "Study IDs are 5-character alphanumeric codes: `PCS27`, `TEQ73`,
  `ACH91`" and "Study variables: `(provide PCS27 PCS27-with-admin)`" as
  universal facts. Disposition: **generalized** — now "follow the
  project's conventions in `study-config.md`; absent one, these defaults
  work well: short unique alphanumeric IDs (e.g. `PCS27`) …". `PCS27`
  survives only as one example of a default. Veto? no (recommend keep).
- **skills/coding/SKILL.md — CSS** — "Copy from an existing study (e.g.,
  `PCS27.rkt`)" pointed at an MD file. Disposition: **generalized** to
  "copy from an existing study in the project or the congame examples".
  Veto? no.
- **skills/create-study/SKILL.md** — the inlined schema's
  "Study ID convention: … (e.g. 5-char codes like PCS27 …)". Disposition:
  the whole schema **moved** to the new `study-config` skill; the `PCS27`
  mention remains there as an illustrative example of the field. Veto? no.
- **skills/study-config/SKILL.md** — inherits the `PCS27` example in the
  "Study ID convention" schema line. **Kept as illustrative example.**
  Veto? no.
- **skills/upload/SKILL.md** — examples `pcs27`, `teq73`, `/upload PCS27`,
  `PCS27-with-admin`. **Kept as illustrative examples** of argument
  shapes; no MD file paths are asserted. Veto? no (could swap to neutral
  slugs if you prefer — free change).
- Other slugs (`NJJ10`, `SBL89`, `GWP43`, `TVX41`): **no occurrences**
  remain in the tree. Veto? n/a.

## 3. MD directory paths (experiments/, study designs/, tests/studies/, tests/helpers/)

- **skills/{study-config, create-study, coding, upload, playwright-test,
  study-review}** — all four paths appear. In every case they are behind
  a named `study-config.md` field and marked "e.g. …" with a stated
  default (repo root for study files) — none is asserted as *the*
  location. Disposition: **already generalized** (config-driven with
  defaults). Veto? no.
- `study designs/{STUDY-ID}.md` (MD's design-doc convention) appears in
  the `study-config` schema and in `study-review`/`playwright-test` as an
  "e.g." example of the Design-documents field, always with a "none"
  fallback. **Kept as illustrative example.** Veto? no.

## 4. MD-only review logic

- **Sociodemo/covariate placeholder stub carve-out**
  (study-review step 3 Content; playwright-test §5 "What NOT to assert") —
  MD keeps placeholder sociodemo fields as a project-wide interim state.
  Disposition: **generalized** to "check the project's convention in
  `study-config.md`". Kept as a documented consideration, not an
  assertion. Veto? no.
- **Co-Authored-By commit trailer** (study-review steps 6, 8;
  study-config "Commit trailers" field) — MD attributes AI commits to a
  specific co-author (Joel). Disposition: **generalized** to a config
  field ("any `Co-Authored-By` or attribution convention … 'none' if not
  used"); no specific name is hard-coded. Veto? no.
- **"Related to #N" tracking-issue link** (study-review step 7;
  study-config "Issue linking" field) — MD links a tracking issue.
  Disposition: **generalized** to a config field ("no" if not used).
  Veto? no.
- **competition-vs-control framing** (coding patterns/checklist;
  study-review checklist "`competition?` or equivalent"; examples search
  table; conscript-coding example) — MD's canonical two-arm design.
  Disposition: **kept only inside code examples** and always as
  "`competition?` or equivalent" / "e.g. competition vs. control". Not
  asserted as the only design shape. Veto? no (recommend keep as example).
- **`isCompetition` template variable** (playwright-test §4 template,
  key patterns, balance assertion) — MD-flavored variable name in the
  example TypeScript. **Kept as example code**; the surrounding prose
  says "unique treatment-arm phrase" generically. Veto? no.
- **"balanced shuffle (groups of 2 or 4)"** (coding checklist;
  study-review "Uses balanced shuffle pattern (groups of 2 or 4) or
  `assigning-treatments`") — MD's matchmaking group sizes. Kept as an
  example within a checklist item that offers `assigning-treatments` as
  the alternative; not asserted as the only valid structure. Veto?
  no (flag if you want it softened further).

## 5. MD server / infrastructure pointers

- **`totalinsightmanagement.com`** — appears in
  create-study and usage-guide as links to the **congame framework
  documentation** (`docs.totalinsightmanagement.com/congame/…`) and the
  Conscript reference. These are congame-project docs, not MD
  infrastructure, and are the canonical public doc URLs. Disposition:
  **kept** as framework documentation links. No MD staging/production
  deploy URL appears anywhere as a default. Veto? no.
- **Staging/production URLs** — MD's deploy targets are **not** hard-coded
  anywhere. They are config fields under the new `## Servers` section
  ("Staging: … / Production: …", or "none"). `upload` reads them from
  there. Disposition: **generalized**. Veto? no.
- **"Docker server" phrasing** (study-config + playwright-test admin
  credentials) — kept as "for a local Docker server the congame default
  is `admin@congame.local` / `admin`", framed as an example default to
  confirm against the project's config, not a requirement. The
  `admin@congame.local`/`admin` pair is congame's framework default
  (from `congame-web/local.rkt`), not MD-specific. Veto? no.
- **`docs` skill NOT ported** — MD's `docs` skill (MD overview, its
  server URLs, repo layout) is intentionally excluded; project docs
  belong to the project, and `study-config.md` is the plugin's channel
  for them. Its portable content already landed elsewhere (server URLs →
  `## Servers` + `upload`; anon-login URL → study-review step 10; doc
  links → create-study/usage-guide). No dangling reference to a `docs`
  skill remains. Veto? no.

## 6. MD example-repo pointers

- **Named spec files (`sbl89.spec.ts`, etc.)** — the three MD example
  spec files are **gone**; playwright-test §9 now says "read the existing
  spec files in the project's test directory". grep for `sbl89.spec`
  returns nothing in the tree. Disposition: **generalized**. Veto? no.
- **`joeldueck.com` doc link** (conscript-coding) — this is the public
  congame/Conscript documentation URL authored by Joel Dueck (framework
  maintainer docs), not an MD pointer. **Kept.** Veto? no.

---

## Summary for Marc

Nothing MD-specific is asserted as a universal fact anymore. What remains
MD-flavored is confined to illustrative examples (`PCS27` slugs,
`experiments/` paths, `competition?`, `isCompetition`) that always sit
behind a `study-config.md` field with a default, or to congame *framework*
defaults (`admin@congame.local`, the `totalinsightmanagement.com` doc
links) that are not MD-specific. Strike any example you would rather see
swapped for a neutral placeholder and I will change it.
