# 0007 — Line clears as a weekly MILP, weighted priorities, warm-started solve

- **Status:** accepted
- **Date:** 2026-10-04 (S07)

## Context
The S04–S06 LP had no line clears and only one goal, least machine time. S07 adds the following:
- line clears (R23, R28, R31);
- priority weights (R22);
- pre-SFGs consumed at B (R47) and an A → B lane (R48).

## Decision
**Model** (`src/plan/lp.ts`):
- **Runs:** a binary `run[p,m,w]` says "machine m makes p in week w" and costs one large line
  clear.
- **Lots** are at most one shift. Each further lot costs a small line clear. The lot count is
  continuous (hours ÷ producing hours per lot), so it needs no integer variables.
- **Machine time** = (1 + small ÷ (shift − small)) × hours + (large − small) × run.
  Reported times match it. Reported counts round lots up.
- **Run cost:** a product that runs in two weeks in a row pays two large line clears. This
  approximation counts changeovers per week, not across week boundaries.
- **Goals** are weighted 0–10 each and scaled to about 0–1:
  - balanced load: the busiest machine's yearly utilisation U, a min-max;
  - line clear time;
  - pallets trucked;
  - machine time ("spare capacity").
  - Unmet demand costs 100 per unit, far above any goal. A small holding cost keeps production
    just in time.
  - Defaults (user, S07): balance 8, line clears 4, transport 2, spare 1. They are stored in
    `settings.priorities`.
- **Pre-SFGs:**
  - a product flagged `isPreSfg` has no demand of its own;
  - an SFG with `preSfgId` consumes one unit of it per unit made, in the same week, at the site
    that makes the SFG.
  - Goods trucked to a site without an inbound store go into its local store, so pre-SFGs share
    the B warehouse (user).
  - A lane into a non-demand site carries pre-SFGs only.

**Solve** (`src/plan/solve.ts`). HiGHS alone found only very poor plans within 20 s, with millions
of units unmet, because the relaxation is weak. So the solve is warm-started:
1. **LP relaxation.** Runs smaller than (line clear weight ÷ 2) lots are forbidden in rounds,
   at most half per product–machine pair per round. A round that raises unmet demand is undone.
2. **Fixed runs.** Runs are fixed to 1 where the relaxation produced. Other allowed runs stay
   open, and any that get used are fixed in turn. Finally everything is fixed and empty runs are
   dropped. This is the start plan.
3. **MIP.** The MIP runs from the start plan, with a gap of 1 % and a time limit of 6 s. If its
   incumbent is worse than the start plan, the start plan is used.

Implementation notes:
- Solutions are copied out of Wasm memory: `getSolution().colValue` is overwritten by the next
  solve.
- `clearSolver()` runs before each LP re-solve. A warm basis once took 143 s, a fresh solve 1 s.

## Consequences
- The demo (22 products, 2,444 binaries) solves in about 6 s with no unmet demand. The busiest
  machine is at about 80 %. The gap shown is the HiGHS bound, often 20 %; the bound is weak, so
  this is pessimistic.
- On the demo the MIP stage rarely improves on the start plan, so the plan quality comes from the
  heuristic. The line clear weight works on small cases (unit test), but barely changes the
  demo's count of about 1,040 large line clears. That is open for S08.
- Demo demand was cut by a fifth to about 34 M units (user: placeholders). With line clears the
  old 42 M was at about 97 % load.
