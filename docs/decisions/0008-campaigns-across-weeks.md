# 0008 — Campaigns across weeks, cycle-based warm start

- **Status:** accepted (refines [0007](0007-line-clear-milp-and-warm-start.md))
- **Date:** 2026-10-04 (S08)

## Context
In ADR 0007 a product running on a machine in two weeks in a row paid two large line clears, and
the warm start barely reacted to the line clear weight: the demo had about 1,040 large clears at
weights 4 and 10. The user wants one large clear per campaign (S08).

## Decision
**Model** (`src/plan/lp.ts`):
- `cont[p,m,w] ∈ [0,1]` means p's run on m continues from week w−1: p was the last product in
  w−1 and is the first in w. The large clear is charged on `run − cont`, in both machine time and
  the line clear goal.
- `cont ≤ run[w]` and `cont ≤ run[w−1]`. Only one product per machine crosses a week boundary:
  `Σ_p cont ≤ 1`.
- **Running through a week.** A product continuing into and out of week w must run alone on m in w:
  `cont[w] + cont[w+1] ≤ 1 + alone[m,w]` and `n·alone + Σ_p run ≤ n + 1`, with `alone` binary.
  With whole runs, the line clear counts are then whole. A per-pair version is equally exact but
  needed 11,600 rows; this one needs about 2,800.
- **Weeks without machine time** (e.g. holidays) break a campaign.
- **Small clears.** The first lot of a continued run still counts a small clear (lots are
  continuous anyway).

**Warm start** (`src/plan/solve.ts`). The old "forbid small weekly runs" rule broke campaigns, and
it made a higher weight give *more* clears. It is replaced by campaign cycles:
1. **Relaxation without `cont`.** `cont` makes the LP 3–4× slower, about 7 s instead of 2 s.
2. **Cycles.** A product–machine pair whose average weekly production is below a campaign worth its
   line clear may run only every k-th week:
   - campaign = weight × `CAMPAIGN_LOTS_PER_WEIGHT` (1) lots;
   - k = ⌈campaign ÷ weekly average⌉, at most 8;
   - offsets are staggered per machine.
   - If the cycled relaxation leaves more than 0.1 % of demand unmet, the campaigns are halved,
     twice at most, then dropped.
3. **Fixed runs** as before, with all runs open so leftover work can move. `cont` is back on, and
   `alone` is set exactly from the fixed runs.
4. **MIP** from that start (runs and `alone` binary).

## Consequences
Demo, measured with `npm run measure:plan`:

| Line clear weight | Large clears | Clear hours | Busiest machine | Time |
| --- | --- | --- | --- | --- |
| 0 | 754 | 3,121 | 70 % | 6.0 s |
| 4 | 635 | 2,811 | 77 % | 6.0 s |
| 10 | 676 | 2,691 | 91 % | 7.2 s |

- **With initial stock.** After S08 the demo starts with half a week of demand in stock: 753, 623
  and 527 large clears and 3,100, 2,774 and 2,503 hours at weights 0, 4 and 10.
- The goal weighs line clear **hours**, so hours fall steadily with the weight. Counts need not:
  large clears differ per machine.
- With a high weight the plan gives up balance: the busiest machine reaches 91 %.
- The MIP stage gets about 1 s and rarely improves the start, so the gap is shown as "not
  proven" when HiGHS has no useful bound.
- R19 (max campaign length) can now be written as a limit on consecutive `cont`; not done yet.
