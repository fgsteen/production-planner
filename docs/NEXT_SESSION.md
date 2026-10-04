# Next session

_Written at the end of S04 (2026-10-04)._

## Where we are
- **Live:** https://fgsteen.github.io/production-planner/. It redeploys on every push to `main`.
- **Pages:** Overview, Master data (`#data`), Demand (`#demand`) and Plan (`#plan`).
- **Time grid:** ISO weeks; the planning year is the ISO week-year
  ([ADR 0004](decisions/0004-weekly-demand-iso-weeks.md)).
- **Holidays and maintenance** are recurring `MM-DD`.
- **Demand:** a yearly total per product plus pinned weeks (`Dataset.demand`). The rest of the
  total spreads evenly.
- **Capacity check** (`src/model/demand.ts`):
  - shortfall per product;
  - peak weeks that need stock built earlier;
  - estimated machine load.
- **Plan** (`src/plan/`): a continuous HiGHS LP in a Web Worker, with hours per
  product × machine × week, one stock per product and penalised unmet demand. It has no line
  clears, storage locations, trucks or priorities yet. The demo data solves in ~65 ms.
- ADR 0003 (MILP with HiGHS) is accepted.
- `npm test` is green: 5 tooling tests, typecheck, 51 unit tests and 17 e2e tests.

## Proposed goal for S05
**Make the plan realistic: line clears, storage locations and trucks in the model, plus priority
weights.** This covers R22, R27–R29 and R19, and moves R21 towards done.

### First steps
1. Ask the user the open questions below, especially the default priorities and initial stock.
2. Model the stock per location (ADR 0003 balance equations):
   - B warehouse, A in-factory and A warehouse;
   - shipped B → A per week ≤ trucks/week × pallets/truck. Truck days follow the
     weekend/holiday toggle; whether that needs per-day detail or a weekly cap is enough is an
     open question;
   - storage in pallets ≤ capacity. Products convert via units per pallet.
3. Line clears:
   - each week a binary `run[p,m,w]` says whether p runs on m in w, and
     `hours ≤ available × run`;
   - each run costs one large line clear;
   - the number of lots is an integer, with lot size ≤ one shift's output (R23);
   - check solve time on the demo data and keep it interactive. Use a gap limit or time limit if
     needed.
4. Priority weights (R22): line clear time, transport, load balance, spare capacity. Add a small
   control panel on the Plan page and re-solve on change.
5. Plan page output:
   - utilisation per machine per week (a heatmap, as a first step towards R30);
   - line clears per machine (R31);
   - trucks per week (R38).
6. Tests:
   - LP unit tests on tiny cases: storage cap forces just-in-time; truck cap forces A production;
     a line clear makes campaigns longer;
   - e2e: change a weight and see the plan change.

### Questions for the user
See [open-questions.md](open-questions.md):
- initial stock;
- default priorities;
- whether demand should follow A's working days;
- truck granularity.

## Later sessions (rough order)
- S06: plan visualisation (R30–R33, R37–R39): Sankey, utilisation heatmap, line clear time, stock
  vs storage, trucks. About page v1 (R50).
- S07: shift-level timeline (R34); compare plans (R25).
