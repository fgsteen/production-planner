# Next session

_Written at the end of S09 (2026-10-04)._

## Start with the plan
Open by presenting the session plan (goal, in/out of scope, first steps, questions) and asking the
user what to add to the todo list, for this session or later (CLAUDE.md, user S09).

## Where we are
- **Live:** https://fgsteen.github.io/production-planner/. It redeploys on every push to `main`.
- **Plan** (`src/plan/`; ADRs [0007](decisions/0007-line-clear-milp-and-warm-start.md),
  [0008](decisions/0008-campaigns-across-weeks.md) and
  [0009](decisions/0009-fair-share-unmet-demand.md)): a weekly MILP.
  - **Line clears:** one large clear per campaign, which may span weeks.
  - **Goals:** four priority weights: balance 8, line clears 4, transport 2, spare 1.
  - **Unmet demand:** a fair share (R64, S09). The worst product's yearly share F comes first. Then
    10 slices of each product's share, each costing twice the last.
    - At 2× demand every demo product is 33–34 % short, 36 % of demand in total.
    - Before S09: 24 % in total, with five products at 100 %.
  - **Warm start:**
    1. relaxation, then campaign cycles;
    2. fix runs;
    3. MIP.

    The optional extra solves stop at 40 % / 60 % of the time limit (S09).
- **Solve times** (`npm run measure:plan`, line clear weight 4):

  | Demand | Solve time | Large clears |
  | --- | --- | --- |
  | 1× | 6.0 s | 629 |
  | 1.3× | 6.4 s | 762 |
  | 2× | 10.1 s | 592 |

  - With `MEASURE_DEMAND`, the measure script also prints unmet % per product.
- **Plan page:**
  - an "Unmet demand" panel (only when demand is unmet): share, units and a 52-week strip per product;
  - fully used machines are red in the shifts table.
- **Validation (R66):** an SFG with a pre-SFG can't have a capability at the demand site.
- **Open questions:** none open ([open-questions.md](open-questions.md) is empty).
- **Tests:** `npm test` is green: 5 tooling tests, typecheck, 79 unit tests and 25 e2e tests.

## Known weak spots
1. **Fairness costs units.** An equal share moves machine time to slow products, so at 2× demand
   12 % more of total demand goes unmet. The user may want a middle way, e.g. a fairness weight.
2. **Levelling is only exact for the worst group.** Products on a less-overloaded machine are
   levelled to within a slice or two. Example: a fair 20/20 came out as 10/22.5 with a 4× rate gap.
3. **The relax stage is a single LP.** At 2× demand it alone takes 5.6 s, beyond the 6 s target.
4. **The MIP stage rarely improves the start**, and the gap shows as "not proven".
5. **PNG export of the Overview map** leaves out the machine → store connector lines.

## Proposed goal for S10
**Bottleneck view (R39): a ranked list of what limits the plan** (user S09: a ranked list, not
shadow prices).
- **Candidates to rank:**
  - fully used machines (weeks at 100 %, and the share of the year);
  - full storage pools (weeks at capacity);
  - truck lanes at their limit (weeks maxed);
  - unmet demand per product, with the machines that could make it.
- **Order:** rank by impact, e.g. weeks binding × the units affected, or unmet units on the
  machines involved. Read it straight from the `PlanResult` (no extra solve).
- **If time is left:** R65, a line clear panel per machine (small and large counts, total hours).
  `PlanResult.lineClears` already has the data.

### First steps
1. Sketch the ranking from `PlanResult`, as a pure function in `src/plan/` with unit tests.
2. Add a "What limits the plan" panel (use `Panel`), near the summary.
3. Add an e2e test at raised demand: the first entry is a machine at 100 %.

### Questions for the user
- **Fairness vs total:** keep a strict fair share, or add a "fairness" slider that trades the
  equal share against total units met?
- **Bottleneck list:** what should the top entry say? Examples: "A4 full in 38 weeks" or "A4 full;
  P10 and P13 are 30 % short".

## Later sessions (rough order, to be confirmed with the user)
- **R65:** a line clear panel per machine (user S09), if S10 doesn't get to it.
- **R19:** a max campaign length, as a limit on consecutive weeks with `cont`.
- **Group-by everywhere (rest of R44):** the weekly machine plan, transport and warehouse views.
- **Excel (R60–R63):**
  - a template with dropdowns wherever the choices are fixed, e.g. factory location (user S09);
  - import with per-row errors;
  - export;
  - ExcelJS, recorded in an ADR.
- **Visualisation (R30, R33, R37, R38):** Sankey, utilisation heatmap.
- **About page (R50, `#about`):** condensed from ADRs 0003, 0005, 0007, 0008 and 0009.
- **Further features:** shift-level timeline (R34); compare plans (R25); transit time (much later,
  user S09).
