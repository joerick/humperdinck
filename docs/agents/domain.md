# Domain docs

This repo uses a single-context layout:
- `GLOSSARY.md` at the repo root.
- Architecture decision records in `docs/adr/`.

## Before exploring

Read the glossary and ADRs relevant to the area being explored.

If these files do not exist, proceed silently. Domain modeling creates
them lazily when terms or decisions are resolved.

## Vocabulary

Use the glossary's terms in issue titles, proposals, hypotheses,
and test names. If a concept is missing, reconsider whether it belongs
to the domain or note the gap for domain modeling.

## ADR conflicts

Explicitly flag proposals that contradict an existing ADR, identifying
the decision and explaining why it may warrant reopening.
