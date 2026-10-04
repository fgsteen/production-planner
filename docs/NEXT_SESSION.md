# Next session

_Written at the end of S06 (2026-10-04)._

## Where we are
- **Live:** https://fgsteen.github.io/production-planner/. It redeploys on every push to `main`.
- **Pages:** Overview, Master data (`#data`), Demand (`#demand`) and Plan (`#plan`).
  - Master data tabs: Machines, **Characteristics** (new in S06), Products, Capabilities, Sites &
    logistics, Initial stock, Settings.
- **Products (S06, [ADR 0006](decisions/0006-product-characteristics-and-png-export.md)):**
  - every product is one X-Y-Z combination, named after it unless it has a custom name;
  - characteristics are labels only: demand and capabilities stay per product;
  - the demo has 20 products (X K–N, Y 1–3, Z six tree names) on 8 machines, ~42 M units a year.
- **Plan** (`src/plan/`): a continuous HiGHS LP in a Web Worker
  ([ADR 0005](decisions/0005-storage-pools-and-weekly-trucks.md)):
  - stock per storage pool;
  - a weekly truck limit B → A;
  - initial stock;
  - penalised unmet demand.
  - It has no line clears and no priorities yet.
  - The 20-product demo solves to optimal in ~120 ms. A1 and A2 run at 100 % and B1 at 4 %, because
    the only goal is least machine time.
- **PNG download (R45):** every chart or table panel uses `src/ui/Panel.tsx` and has a download
  icon (2×, light theme, wide tables whole).
- `npm test` is green: 5 tooling tests, typecheck, 66 unit tests and 22 e2e tests.

## Proposed goal for S07
**Line clears and priorities.** Make the plan a MILP with line clears, and add priority weights with
a small control panel. This covers R28, R23, R22 and R31, and moves R21 towards done.

**Ask first: line clears, or grouping (R44)?**
- With 20 products the demand grid and plan tables scroll sideways on narrow screens.
- If that bothers the user more, do R44 first. Ask the grouping UX question in
  [open-questions.md](open-questions.md).

### First steps (line clears)
1. Ask the user for the default priority ranking (open question).
2. Line clears (ADR 0003):
   - a binary `run[p,m,w]` with `hours ≤ available × run`;
   - each run costs one large line clear (hours lost on that machine);
   - integer lots ≤ one shift's output (R23).
   - The demo now has 45 capabilities × 52 weeks ≈ 2.3k binaries. Measure the solve time. Set
     `mip_rel_gap` (e.g. 1 %) and `time_limit` (e.g. 10 s), and show the gap on the Plan page.
3. Priority weights (R22): line clear time, transport, load balance, spare capacity.
   - Show sliders or a ranking on the Plan page and re-solve on change, debounced.
4. Show line clears per machine (R31) in the shifts table or the weekly chart.
5. Tests:
   - LP: a line clear makes campaigns longer; the transport weight moves production to A;
   - e2e: change a weight and the plan changes.

### Questions for the user
See [open-questions.md](open-questions.md):
- default priorities;
- grouping UX;
- transit time;
- whole pallets;
- weekend consumption at A;
- Excel dropdowns.

## Later sessions (rough order, to be confirmed with the user)
- **Grouping (R44):**
  - group, filter or expand by X/Y/Z in the demand grid and the plan views;
  - `productName` and `Dataset.characteristics` are the building blocks.
- **Excel (R60–R63):**
  - a template with one tab per entity, including characteristics, and dropdowns;
  - import with per-row errors;
  - export of data and of plan results.
  - ExcelJS, since writing dropdowns needs data validation (record it in an ADR).
- Visualisation (R30–R33, R37–R39): Sankey, utilisation heatmap, line clear time, stock vs storage
  (the data is in `PlanResult.storage`), bottlenecks. New panels should use `Panel` so they get the
  PNG download.
- **About page (R50, `#about`):** condensed from ADRs 0003 and 0005.
- Shift-level timeline (R34); compare plans (R25).
