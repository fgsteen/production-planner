# Documentation index

| Doc | What it holds |
| --- | --- |
| [NEXT_SESSION.md](NEXT_SESSION.md) | Handoff: where we are and the goal for the next session. **Read first.** |
| [vision.md](vision.md) | Why the system exists, who uses it, goals and non-goals. |
| [domain.md](domain.md) | Domain model: sites, machines, products, capabilities. |
| [requirements.md](requirements.md) | Functions/features with priority and status. |
| [open-questions.md](open-questions.md) | Questions waiting for a decision. |
| [decisions/](decisions/) | Architecture/design decision records (ADRs). |
| [sessions/](sessions/) | One log per session + [STATS.md](sessions/STATS.md) (time & tokens). |

Working agreement for Claude: [../CLAUDE.md](../CLAUDE.md).

## Live app
https://fgsteen.github.io/production-planner/ — deployed by `.github/workflows/pages.yml` on every
push to `main`. Data lives in each viewer's browser (localStorage); export JSON to share it.

## Run locally
- `npm install`, then `npx playwright install chromium` (once).
- `npm run dev`: app at http://localhost:5173.
- `npm test`: session tooling tests, typecheck, unit tests (Vitest) and e2e tests (Playwright).
  The e2e run writes screenshots to `test-results/screens/`.

## Code map
| Path | What |
| --- | --- |
| `src/model/` | Master data types, capacity helpers, `validateDataset`, seed (demo) data. |
| `src/store/` | Dataset reducer, JSON import/export, localStorage persistence, React context. |
| `src/data/` | Master data page: inline-edit tables, export/import/reset. |
| `src/overview/` | Overview screen and React Flow network map. |
| `src/plan/` | Plan page and engine: MILP (`lp.ts`), warm-started solve (`solve.ts`), Web Worker, what limits the plan (`limits.ts`). |
| `src/about/` | About page: how the plan is made (R50). |
| `src/ui/` | Inline-edit cells, error boundary, palette/number formatting. Design tokens are in `src/index.css`. |
| `e2e/` | Playwright tests. |
