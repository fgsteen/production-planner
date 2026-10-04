# 0009 — Fair-share unmet demand, time budgets for the warm start

- **Status:** accepted
- **Date:** 2026-10-04 (S09)

## Context
Every unmet unit used to cost the same (100 per unit). When demand exceeded capacity, the plan
starved whole products whose units take the most machine time. At 2× demand, 24 % of demand was
unmet, all of it on P01, P07, P10, P11, P13, P17 and P20 (five of them at 100 %). The user wants
every product short by about the same share (R64, S08), **over the year**, not per week (S09).

## Decision
**Model** (`src/plan/lp.ts`). Unmet demand is costed per SFG as a share of its yearly demand:
- `Σ_w short[p,w] = demand_p · Σ_k g[p,k]`, where the 10 slices `g[p,k] ∈ [0, 0.1]` cost
  `SHORT · 2^k · demand_p / Dᵤ` (Dᵤ is total yearly SFG demand). Each 10 % of shortfall costs
  twice the last. The first slice costs the same per unit for every product (SHORT = 1000 for all
  demand, ≈ 0.3 per lot in the demo, still far above any goal).
- `F ≥ Σ_k g[p,k]` for each SFG: F is the worst share. Its cost `FAIR = 10 · 2^10 · SHORT`
  outweighs the dearest slice even when the products on a machine differ in rate by 10×. So the
  most-short products are levelled exactly (max-min).
- The slices level the products on other overloaded machines, which F doesn't reach, but only
  approximately. With a 4× rate difference, a fair 20 % came out as 10 % and 22.5 % (no slices:
  0 % and 40 %).

**Time budgets** (`src/plan/solve.ts`). The warm start skips its optional LP solves after 40 % of the
time limit (shorter campaign cycles in step 1) and 60 % (more rounds of opening runs in step 2).
Each LP still runs to the end; a time limit on an LP can stop it without a feasible plan.

**UI.** An "Unmet demand" panel appears when demand is unmet: per product, the share, units and a
52-week strip. Machines at 100 % are shown in red in the shifts table.

## Alternatives
- **F with only the linear total.** Exact for the most-short group, but products on other
  overloaded machines go back to all-or-nothing.
- **Lexicographic max-min** (solve, fix the worst group, repeat). Exact everywhere, but one full
  solve per level, and each takes 6–10 s.
- **Steeper slices (4× each).** Closer levelling, but the cost range would reach about 10¹⁵.

## Consequences
- **Demo at 2× demand.** Every product is 33–34 % short. In total that is 36 % of demand, against
  24 % before: an equal share sends more machine time to products that are slow to make.
- **Weekly pattern.** Within a product the shortfall falls in whole weeks, because the share is
  counted over the year.
- **Solve time.** The large F cost made the fix stage slower: 25 s at 2×. With the budgets the full
  solve takes 10.1 s at 2× (31.6 s without them), 6.4 s at 1.3× (11.9 s) and 6.0 s at 1×, with
  about the same number of line clears.
