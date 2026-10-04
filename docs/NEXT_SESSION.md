# Next session

_Written at the end of S05 (2026-10-04)._

## Where we are
- **Live:** https://fgsteen.github.io/production-planner/. It redeploys on every push to `main`.
- **Pages:** Overview, Master data (`#data`, with an **Initial stock** tab since S05), Demand
  (`#demand`) and Plan (`#plan`).
- **Demand:** a yearly total per product plus pinned weeks. The rest spreads by A's open days
  (non-holiday days per ISO week).
- **Plan** (`src/plan/`): a continuous HiGHS LP in a Web Worker
  ([ADR 0005](decisions/0005-storage-pools-and-weekly-trucks.md)):
  - hours per product × machine × week;
  - stock per storage pool (B local, A local, A inbound) with pallet caps, and initial stock;
  - shipments B → A within a weekly truck limit that drops with weekday holidays;
  - penalised unmet demand.
  - It has no line clears and no priorities yet. The demo solves in ~30–90 ms.
- **Plan page:**
  - summary tiles;
  - shifts per machine × product;
  - **weekly machine plan** (R42): chart, plus a week table per machine;
  - **transport B → A** (R43): per week and product, a pallets/units toggle, trucks used vs limit.
- `PlanResult.storage` holds pallets per pool per week vs capacity. It has no UI yet (R37).
- The demo truck lane is 10 trucks/week (user decision, S05).
- `npm test` is green: 5 tooling tests, typecheck, 60 unit tests and 19 e2e tests.

## Proposed goal for S06
**Line clears and priorities: make the plan MILP with line clears, and add priority weights with a
small control panel.** This covers R28, R23, R22 and R31, and moves R21 towards done.

**Decide first: the order (new user input after S05).** The user asked for these new features:
- product characteristics X/Y/Z and a ~20-product demo (R17, R18);
- grouping so the views scale (R44);
- PNG download per panel (R45);
- Excel template, import and export (R60–R63).

Consider doing **R17 + R18 before line clears**:
- they change the data model and the demo;
- the MILP's solve time should be tuned on the realistic 20-product size;
- line clear times may depend on the characteristics (open question).

Ask the user which comes first.

### First steps
1. Ask the user for the default priority ranking (open question). It decides what the demo plan
   looks like: today B1 is ~4 % used and trucks are maxed in 34 weeks.
2. Line clears (ADR 0003):
   - a binary `run[p,m,w]` with `hours ≤ available × run`;
   - each run costs one large line clear (hours lost on that machine);
   - integer lots ≤ one shift's output (R23).
   - Measure solve time on the demo data. Set a gap or time limit (e.g. `mip_rel_gap` 1 %,
     `time_limit` 10 s) and show the gap on the Plan page.
3. Priority weights (R22): line clear time, transport, load balance, spare capacity.
   - Show sliders or a ranking on the Plan page and re-solve on change, debounced.
   - Load balance could be the max utilisation per site or a deviation term; pick a linear form.
4. Show line clears per machine (R31) in the shifts table or the weekly chart.
5. Tests:
   - LP: a line clear makes campaigns longer; the transport weight moves production to A;
   - e2e: change a weight and the plan changes.
6. If time allows: a stock vs capacity chart per pool (R37). The data is already in `PlanResult`.

### Questions for the user
See [open-questions.md](open-questions.md):
- default priorities;
- transit time;
- whole pallets;
- weekend consumption at A.

## Later sessions (rough order, to be confirmed with the user)
- **Products at scale:**
  - characteristics X/Y/Z with editable variants, products as `X-Y-Z` combinations, and a
    ~20-product demo (R17, R18);
  - grouping, filtering or expanding in the demand grid and the plan views (R44).
  - Ask the open questions on grouping UX and on what the characteristics mean for the model.
- **PNG download per panel (R45):** one shared panel wrapper with a download icon.
  - Render to PNG at 2×, light theme. A DOM-to-image library (e.g. `html-to-image`) handles tables
    and charts alike.
  - This is small, so it could ride along with another session.
- **Excel (R60–R63):**
  - a template with one tab per entity and dropdowns (data validation);
  - import with per-row errors;
  - export of data and of plan results.
  - Writing dropdowns needs a library that supports data validation (e.g. ExcelJS; SheetJS
    Community can't write it). Record that choice in an ADR.
  - Build it after R17, so the template includes the characteristics.
- Visualisation (R30–R33, R37–R39): Sankey, utilisation heatmap, line clear time, stock vs
  storage, bottlenecks.
- **About page (R50, `#about`).** Content comes from
  [ADR 0003](decisions/0003-planning-engine.md) and [ADR 0005](decisions/0005-storage-pools-and-weekly-trucks.md),
  condensed:
  - the approach: MILP, HiGHS, CLSP;
  - the model as a bullet list;
  - "Why not machine learning" and "Why not an AI agent".
  - Describe the model as built. Take the numbers from the code: `PlanResult.columnCount` and
    `rowCount` now exist.
- Shift-level timeline (R34); compare plans (R25).
