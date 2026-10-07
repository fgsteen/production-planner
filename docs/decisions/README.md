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
| [0001](0001-session-workflow.md) | Session-based workflow with git-timed sessions | accepted (refined by 0011) |
| [0002](0002-stack.md) | Tech stack: client-only TypeScript app, static hosting | accepted |
| [0003](0003-planning-engine.md) | Planning engine: MILP optimisation (lot-sizing), not ML or an agent | accepted |
| [0004](0004-weekly-demand-iso-weeks.md) | Weekly time grid (ISO weeks) and demand as a yearly total with pinned weeks | accepted |
| [0005](0005-storage-pools-and-weekly-trucks.md) | Stock per storage pool, weekly truck limit, initial stock, demand by open days | accepted |
| [0006](0006-product-characteristics-and-png-export.md) | Product characteristics as data (default X-Y-Z names); PNG export of panels | accepted |
| [0007](0007-line-clear-milp-and-warm-start.md) | Line clears as a weekly MILP, weighted priorities, warm-started solve | accepted (refined by 0008) |
| [0008](0008-campaigns-across-weeks.md) | Campaigns across weeks (one large clear each), cycle-based warm start | accepted |
| [0009](0009-fair-share-unmet-demand.md) | Fair-share unmet demand (worst share first, doubling slices), warm-start time budgets | accepted |
| [0010](0010-max-campaign-length.md) | Max campaign length: forced clean-downs (same product may go on), length counted across weeks | accepted |
| [0011](0011-session-skills-and-lean-docs.md) | Session protocol as project skills, lean session docs, token hygiene | accepted |
