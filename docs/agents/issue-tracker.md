# Issue tracker: Local Markdown

Issues and specs live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- Specs: `.scratch/<feature-slug>/spec.md`.
- Tickets: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`,
  numbered from 01, one file per ticket.
- Triage state: a `Status:` line near the top, using the role strings
  in `triage-labels.md`.
- Comments: append under `## Comments`.

When a skill says "publish to the issue tracker", create the appropriate
file and any missing parent directories.

When a skill says "fetch the relevant ticket", read the referenced file.

## Wayfinding operations

- Map: `.scratch/<effort>/map.md`, containing Notes, Decisions-so-far,
  and Fog.
- Child tickets: `.scratch/<effort>/issues/<NN>-<slug>.md`.
  Record the question in the body and a `Type:` line with
  research, prototype, grilling, or task.
- Blocking: `Blocked by: NN, NN` near the top. A ticket is unblocked
  when every listed ticket is resolved.
- Frontier: select the first open, unblocked, unclaimed ticket by number.
- Claim: set `Status: claimed` and save before starting work.
- Resolve: append the answer under `## Answer`, set `Status: resolved`,
  and append a gist and link to Decisions-so-far in the map.

The claimed and resolved statuses track wayfinding execution;
the five triage statuses classify work before execution.
