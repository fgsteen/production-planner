# Documentation index

| Doc | What it holds |
| --- | --- |
| [NEXT_SESSION.md](NEXT_SESSION.md) | Handoff: where we are and the goal for the next session. **Read first.** |
| [vision.md](vision.md) | Why the system exists, who uses it, goals and non-goals. |
| [domain.md](domain.md) | Domain model: sites, machines, products, capabilities. |
| [requirements.md](requirements.md) | Functions/features with priority and status. |
| [open-questions.md](open-questions.md) | Questions waiting for a decision. |
| [perf.md](perf.md) | Plan solve times per session. |
| [decisions/](decisions/) | Architecture/design decision records (ADRs). |
| [sessions/](sessions/) | One log per session + [STATS.md](sessions/STATS.md) (time & tokens). |

Working agreement for Claude: [../CLAUDE.md](../CLAUDE.md). Session protocol: the
`/session-start` and `/session-end` skills in [../.claude/skills/](../.claude/skills/).

## Live app
https://fgsteen.github.io/production-planner/ — deployed by `.github/workflows/pages.yml` on every
push to `main`. Data lives in each viewer's browser (localStorage); export JSON to share it.
The root app is **v1** (yearly plan, tag `v1-yearly`, frozen). **v2** (rolling simulation, ADR 0013)
is being built in `v2/`. Once S12 switches the deploy, it is served at the root and v1 at `/v1/`.

## Run locally
The commands below are for v1 at the root. For v2, run the same commands inside `v2/`. Session
tooling (`session:*`, `test:scripts`) stays at the root.

- `npm install`, then `npx playwright install chromium` (once).
- `npm run dev`: app at http://localhost:5173.
- `npm test`: session tooling tests, typecheck, unit tests (Vitest) and e2e tests (Playwright).
  `npm run test:quiet` runs the same with short output.
  The e2e run writes screenshots to `test-results/screens/`.

## Code map
The paths are the same in `v2/`, which S12 strips to one factory (no overview map, no MILP).

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
