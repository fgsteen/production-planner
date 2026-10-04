# Next session

_Written at the end of S08 (2026-10-04)._

## Where we are
- **Live:** https://fgsteen.github.io/production-planner/. It redeploys on every push to `main`.
- **Plan** (`src/plan/`; ADRs [0007](decisions/0007-line-clear-milp-and-warm-start.md) and
  [0008](decisions/0008-campaigns-across-weeks.md)): a weekly MILP.
  - **Line clears:** one large clear per **campaign**, which may span consecutive weeks (`cont`,
    `alone`); each further lot costs a small clear.
  - **Goals:** four priority weights: balance 8, line clears 4, transport 2, spare 1.
  - **Warm start:**
    1. relaxation without `cont`;
    2. campaign cycles (low-volume pairs run every k-th week, k from the weight);
    3. fix runs;
    4. MIP with about 1 s left.
- **Demo results** (`npm run measure:plan`):

  | Line clear weight | Large clears | Clear hours | Busiest machine |
  | --- | --- | --- | --- |
  | 0 | 754 | 3,121 | 70 % |
  | 4 | 635 | 2,811 | 77 % |
  | 10 | 676 | 2,691 | 91 % |

  - About 6–7 s per solve. The gap shows "not proven", because the HiGHS bound is useless here.
- **Plan page:**
  - solve progress (step x of 3, with a timer) and a Cancel button;
  - a change during a solve restarts it;
  - "Line clear hours" in the summary.
- `npm test` is green: tooling tests, typecheck, 77 unit tests and 24 e2e tests.

## Known weak spots
1. **Demand beyond capacity** (R64, user S08: fair share).
   - At 2× demand 24 % is unmet, as whole products (P07, P10, P11, P13, P17 got nothing in S07),
     because every unit costs the same.
   - The UI shows only the total unmet units.
2. **The warm-start stages have no time limit.** At 1.3× demand the fix stage alone took 9 s
   (14 s in total).
3. **The MIP stage rarely improves the start.** Plan quality comes from the cycle heuristic, tuned
   by `CAMPAIGN_LOTS_PER_WEIGHT = 1` and `MAX_CYCLE = 8` in `solve.ts`.
4. **Line clear counts don't always fall with the weight** (754 → 635 → 676); hours do. The goal
   weighs hours.
5. **Week 1 starts without stock** in the demo (fix 3 above).

## Priority first in S09: three small fixes (user, after S08)
1. **A → B transport line on the Overview** (`src/overview/SiteMap.tsx`, `buildGraph`, the
   truck-lane edges at about line 132). It is drawn across the machine and store nodes. Route it
   around them, e.g.:
   - other handles (bottom/top) or an offset `smoothstep` path;
   - or a custom edge that runs below the site groups.
   Check it in the browser pane with a screenshot.
2. **Downloaded PNGs follow the site's theme** (R45, [ADR 0006](decisions/0006-product-characteristics-and-png-export.md)).
   - Today `downloadPng` in `src/ui/Panel.tsx` forces `.light-theme`. Drop that, and give
     `toPng` the panel's computed background colour so dark exports aren't transparent.
   - Update R45 ("light theme" → "the current theme") and ADR 0006: a short note, or a new ADR.
   - The e2e export test may assert the light theme: check `e2e/export.spec.ts`.
3. **Initial stock in the demo by default** (answers the open question; user, after S08).
   - `seed.ts` has `initialStock: []`. Add some stock at A, e.g. half a week of demand per SFG in
     the A warehouse: the earlier proposal, not a confirmed amount.
   - Check it fits the storage capacity, re-measure (`npm run measure:plan`), and update test
     expectations that assume no stock.
   - Existing users keep their saved data. Check whether a stored dataset should pick up the new
     default (probably not; "reset to demo" would).

## Then: proposed goal for S09
**What-if for growing demand: fair-share unmet demand, and show where it falls short.**
- **R64, the model:**
  - add `F ≥ Σ_w short[p,w] ÷ demand_p` for each SFG;
  - weight `F` well above the per-unit short cost, so the worst product's shortfall is minimised
    first and the total second.
  - Check at 1.3× and 2×: every product short by about the same percentage.
- **The UI:**
  - unmet demand per product, as a percentage and in units, and per week (`PlanResult.unmet`
    already has the data);
  - highlight machines at 100 %.
- **Time limits** on the warm-start stages, e.g. a budget per stage, or capping the fix-stage
  rounds.

### First steps
1. Run `MEASURE_DEMAND=2 npm run measure:plan` and add unmet-per-product output to the script.
2. Add `F` to `lp.ts`, then a unit test: two products on one overloaded machine, both short by
   the same percentage.
3. Add an unmet panel (use `Panel`), with an e2e test that raises demand.

### Questions for the user
- **Fair share:** the same percentage over the year, or per week too? A product short in one peak
  week vs. spread out.
- **Bottleneck view (R39):** shadow prices ("one more shift on A4 is worth X units") or a ranked
  list. See [open-questions.md](open-questions.md).
- **Still open from earlier:**
  - may an SFG with a pre-SFG be made at A?
  - how much initial stock (if half a week of demand doesn't suit)?
  - transit time;
  - whole pallets;
  - weekend consumption at A;
  - Excel dropdowns.

## Later sessions (rough order, to be confirmed with the user)
- **R19:** a max campaign length, as a limit on consecutive weeks with `cont`.
- **Group-by everywhere (rest of R44):** the weekly machine plan, transport and warehouse views.
- **Excel (R60–R63):**
  - a template with dropdowns;
  - import with per-row errors;
  - export;
  - ExcelJS, recorded in an ADR.
- **Visualisation (R30, R33, R37–R39):** Sankey, utilisation heatmap, bottlenecks. New panels
  should use `Panel`.
- **About page (R50, `#about`):** condensed from ADRs 0003, 0005, 0007 and 0008. Include the
  warm-start explanation given to the user in S08.
- **Further features:** shift-level timeline (R34); compare plans (R25).
