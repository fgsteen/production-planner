# Next session

_Written at the end of S03 (2026-10-04)._

## Where we are
- **Live:** https://fgsteen.github.io/production-planner/. It redeploys on every push to `main`
  (`.github/workflows/pages.yml`).
- **Master data is fully editable** on the "Master data" page (`#data`), with five tabs: Machines,
  Products, Capabilities, Sites & logistics, Settings.
  - Edits are saved to localStorage and validated live (problems banner + nav badge).
  - Export/import as JSON; reset to demo data.
- Store: `src/store/` (pure reducer + context). Edit cells: `src/ui/cells.tsx`.
- `settings.planningYear` (default 2027) drives the overview's available shifts.
- An `ErrorBoundary` lets the user recover from saved data that crashes rendering.
- `npm test` is green: 5 tooling tests, typecheck, 32 unit tests and 14 e2e tests.

## Proposed goal for S04
**Demand input + capacity check + first HiGHS plan (no line clears yet).**
Covers R20 and R26, the start of R21, and R35.

### First steps
1. Ask the user:
   - Demand entry: yearly total per product with an optional monthly split (12 columns), or
     monthly only?
   - Demand units: units, crates or pallets?
   - The two open questions in [open-questions.md](open-questions.md): holidays vs planning year,
     and a fixed B/A network.
2. Add `demand` to `Dataset` (per product per month), with editing on a new "Demand" page and
   validation. Old JSON files without `demand` get an empty default in `parseDataset`.
3. Capacity check, before any solver: per product, demand vs the max output of its capable
   machines; per machine, the load if spread evenly. Flag demand that can't be met (R35).
4. Spike HiGHS in the browser (`highs` npm package, WASM):
   - a tiny LP (product × machine × month shifts, capacity per machine-month, meet demand);
   - run it in a Web Worker;
   - write ADR 0003 (planning engine) as accepted, or amend it.
5. Tests: unit tests for the capacity check and the LP builder (tiny instance, known optimum);
   e2e: enter demand, see the plan summary.

### Done when
- The user can enter demand and see which products/months are infeasible.
- A first LP plan (shifts per product per machine per month) is computed in the browser and shown
  as a simple table.
- `npm test` is green.

## Later sessions (rough order)
- S05: line clears, storage, transport, priority weights (R22, R26–R29, R19). About page v1 (R50).
- S06: plan visualisation (R30–R33, R37–R39): Sankey, utilisation heatmap, line clear time, stock
  vs storage, trucks.
- S07: shift-level timeline (R34); compare plans (R25).
