# Decision records

One file per significant decision: `NNNN-short-title.md`. Never rewrite an accepted decision —
supersede it with a new one and link both ways.

Template:

```markdown
# NNNN — Title

- **Status:** proposed | accepted | superseded by NNNN
- **Date:** YYYY-MM-DD
- **Session:** SNN

## Context
What problem / forces are at play.

## Decision
What we chose.

## Consequences
What becomes easier/harder; follow-ups.

## Alternatives considered
- Option — why not.
```

| # | Title | Status |
| --- | --- | --- |
| [0001](0001-session-workflow.md) | Session-based workflow with git-timed sessions | accepted |
| [0002](0002-stack.md) | Tech stack: client-only TypeScript app, static hosting | accepted |
| [0003](0003-planning-engine.md) | Planning engine: MILP optimisation (lot-sizing), not ML or an agent | proposed |
