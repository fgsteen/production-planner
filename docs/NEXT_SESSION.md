# Next session

_Written at the end of S10 (2026-10-05)._

## Start with the plan
Open by presenting the session plan (goal, in/out of scope, first steps, questions) and asking the
user what to add to the todo list, for this session or later (CLAUDE.md, user S09).

## Where we are
- **Live:** https://fgsteen.github.io/production-planner/. It redeploys on every push to `main`.
- **Pages:** Overview, Master data, Demand, Plan and **About** (new in S10: the solver, model,
  constraints, goals and assumptions).
- **Plan page:**
  - summary;
  - **What limits the plan** (R39): machines, storage and lanes at their limit, ranked by the unmet
    units they touch;
  - unmet demand;
  - shifts table;
  - **Line clears per machine** (R65);
  - weekly machine plan, warehouses, transport.
  - "Group by" X/Y/Z works in every plan view (R44 done).
- **Model** (ADRs 0007–0010):
  - a weekly MILP;
  - campaigns across weeks;
  - fair-share unmet demand;
  - **max campaign length** (R19, ADR 0010): past the max a forced large clear, and the same product
    may go on. Clean-downs are continuous. The cap is lifted until the runs are fixed.
- **Solve times** (`npm run measure:plan`, line clear weight 4):

  | Demand | Solve time | Large clears |
  | --- | --- | --- |
  | 1× | 6.0 s | 625 |
  | 2× | 13.1 s | 601 |

  - At 1.3×: not measured in S10.
- **Tests:** `npm test` is green: 5 tooling tests, typecheck, 87 unit tests and 26 e2e tests.
- **Open question:** fairness vs total units ([open-questions.md](open-questions.md)). The user
  said keep strict for now.

## Known weak spots
1. **Solve time at 2×:** 13.1 s, well over the 6 s target. The relax LP alone is 5–6 s, and step 2
   is about 5 s.
2. **Clean-downs are continuous.** Reported large clears can be fractional (e.g. 16.4). The warm
   start picks runs without the campaign cap.
3. **Fairness costs units.** 36 % of demand is unmet at 2× against 24 % before R64. Levelling is
   only exact for the worst group.
4. **The MIP stage rarely improves the start**, and the gap shows as "not proven".
5. **Group-by is per panel.** Each panel has its own selector; a page-wide one may be nicer.

## Proposed goal for S11
**Excel import/export (R60–R63):**
- a template with dropdowns wherever the choices are fixed (e.g. factory location);
- import with per-row errors;
- export;
- ExcelJS, recorded in an ADR.

Alternative: solve-time work at 2× (weak spot 1), if the user prefers.

### First steps
1. ADR for ExcelJS (bundle size, lazy-load like HiGHS), sheet layout per master-data table.
2. Export first (round-trip test: export → import gives the same dataset).
3. Import with per-row errors shown on the Master data page.

### Questions for the user
- **Excel:** one workbook with a sheet per table, or one per area? Should demand be in the same
  file?
- **Group-by:** keep one selector per panel, or one for the whole Plan page?
- **2× solve time:** is 13 s acceptable for overloaded what-ifs, or should S11 work on it first?

## Later sessions (rough order, to be confirmed with the user)
- **Excel (R60–R63)**, if not S11.
- **Visualisation (R30, R33, R37, R38):** Sankey, utilisation heatmap.
- **Further features:** shift-level timeline (R34); compare plans (R25); transit time (much later,
  user S09).
- **Fairness slider** (open question), if the user wants it.
