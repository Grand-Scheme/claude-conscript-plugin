# Claude Conscript Plugin — Usage Guide

[Conscript](https://docs.totalinsightmanagement.com/congame/Conscript.html) is
a DSL for authoring online experiments, built on the
[congame](https://github.com/MarcKaufmann/congame) framework. This
plugin teaches Claude how to write, review, and deploy Conscript studies.

## Prerequisites

- **Racket** installed with congame packages (see
  [congame docs](https://docs.totalinsightmanagement.com/congame/))
- **A project directory** with study `.rkt` files (or an empty one to
  start)
- **Claude Code** — CLI, VS Code extension, or desktop app
- **A running congame server** — only needed for `/upload` and for
  testing (`/study-review`, `/playwright-test`). Writing and
  code-reviewing studies works without one. Running a server locally
  currently needs Docker (see the congame docs).

## Setup

### CLI

```bash
cd ~/projects/your-study-project
claude --plugin-dir ~/projects/claude-conscript-plugin
```

### VS Code

1. Install the [Claude Code extension](https://marketplace.visualstudio.com/items?itemName=anthropics.claude-code) from the VS Code marketplace
2. Open your study project folder in VS Code
3. Add the plugin path to your project's `.claude/settings.json`:
   ```json
   {
     "plugins": ["~/projects/claude-conscript-plugin"]
   }
   ```
4. Open the Claude Code panel in VS Code and use skills as normal

VS Code is recommended for users who prefer a GUI — it provides an
editor for `.rkt` files alongside Claude's output.

## Skills

| Skill | What it does |
|-------|-------------|
| `/create-study` | Generate a new study. On first run, asks about your project to create a `study-config.md` that persists your answers for all future runs. Then generates a `.rkt` file. |
| `/study-review` | QA an existing study. When your project has a Playwright suite, runs a test-first review that lands as a PR; otherwise runs a checklist review plus a manual test. |
| `/playwright-test` | Write a design-faithful Playwright end-to-end test that runs participants through a study on a congame server. |
| `/upload` | Deploy a study to a congame server |

## Creating your first study

```
/create-study Participants see draws from an urn and report beliefs
```

On first run, Claude asks setup questions (research domain, typical
structure, where your congame repo is). This is one-time — answers are
saved to `study-config.md` so future runs skip straight to generation.

After setup, Claude generates a `.rkt` file with all required parts:
steps, forms, variables, study flow, CSS, and a `-with-admin` variant
(a wrapper that adds bot models for automated testing).

## Reviewing and uploading

```
/study-review studies/my-study.rkt
/upload my-study
```

## Key concepts for newcomers

- **Study:** A sequence of steps (pages) participants go through
- **Step:** One page — can show content, collect form input, or run logic
- **Instance:** A running deployment of a study on a server, identified
  by a **slug** you choose when you create it in the admin UI
  (`<server>/admin`). Participants join an instance at
  `<server>/_anon-login/<slug>`. You must create an instance before
  anyone (or any test) can run the study.
- **`-with-admin` variant:** Every study needs one. It wraps the study
  with bot models so you can test it without clicking through manually.
- **Bot models:** Automated test actors that drive a headless Firefox
  browser via Marionette, filling forms and clicking buttons to verify
  the study works.
- **`study-config.md`:** The project configuration file, created on
  first use by whichever skill needs it (not only `/create-study`), and
  hand-editable thereafter. Stores your project's domain, study patterns,
  naming and design-doc conventions, servers, and Playwright setup. Read
  by every skill so their behavior matches your project. The schema and
  first-run setup live in the `study-config` skill.
