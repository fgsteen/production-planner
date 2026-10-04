# Next session

_Written at the end of S02 (2026-10-04)._

## Where we are
- The app runs locally (`npm run dev`, http://localhost:5173). See "Run locally" in
  [docs/README.md](README.md).
- Model, validation and seed data are in `src/model/`. The overview screen (R10) shows:
  - stat tiles;
  - a B → A network map (React Flow);
  - machine cards per site;
  - a product table with hover highlight.
- `npm test` is green: tooling, typecheck, Vitest (13) and Playwright (5).
- The app always uses the built-in seed. There's no persistence or editing yet.
- **No deploy yet.** After S02 the user confirmed hosting on **GitHub Pages** from a public repo
  ([ADR 0002](decisions/0002-stack.md)).
- A single-file build (one `index.html`, opens from disk) was tested and works. The user set it
  aside for now.

## Proposed goal for S03
**Deploy to GitHub Pages, then master data editing + persistence + JSON export/import**
(R40, R41; R1–R6, R8, R9, R11–R13 → done).

### First steps
1. **Deploy first (~10 min):**
   - confirm the repo name with the user (`fgsteen/production-planner`, **public**). Creating it
     publishes the code;
   - `gh repo create`, push;
   - add a GitHub Actions workflow (`npm ci`, `npm run build`, deploy `dist/` to Pages);
   - verify the live URL in the browser pane.
2. Ask the user:
   - Editing UX: inline-editable tables per entity (fast, spreadsheet-like), or a form/drawer per item?
   - Should "reset to demo data" be available? Recommend yes.
3. Add a dataset store with React context and a reducer, persisted to localStorage. Run
   `validateDataset` on every change and show the errors.
4. Add editing screens: sites (holidays), storage, trucks, machines (line clears, calendar,
   maintenance), products (packaging), capabilities (rate, OEE), settings.
5. Add JSON export/import (download/upload), with validation on import.
6. Add a planning year to settings. The overview hard-codes 2027 in `src/overview/Overview.tsx`.
7. Tests:
   - unit tests for the reducer and the JSON round trip;
   - Playwright: edit a capability, see the overview update, reload and check it persists.

### Done when
- The app is live at `https://fgsteen.github.io/<repo>/` and redeploys on push to `main`.
- The user can change any master data, reload and keep it, and export/import a JSON scenario.
- `npm test` is green.

## Later sessions (rough order)
- S04: demand input (yearly + per month) and the capacity model. First HiGHS plan, without line
  clears. About page v1 (R50).
- S05: line clears, storage, transport, priority weights (R22, R26–R28). Accept ADR 0003.
- S06: plan visualisation (R30–R37): Sankey, utilisation heatmap, line clear time, stock vs
  storage.
- S07: shift-level timeline (R34).
