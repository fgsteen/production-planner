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

## Run locally
- `npm install`, then `npx playwright install chromium` (once).
- `npm run dev`: app at http://localhost:5173.
- `npm test`: session tooling tests, typecheck, unit tests (Vitest) and e2e tests (Playwright).
  The e2e run writes overview screenshots to `test-results/screens/`.

## Code map
| Path | What |
| --- | --- |
| `src/model/` | Master data types, capacity helpers, `validateDataset`, seed (demo) data. |
| `src/overview/` | Overview screen and React Flow network map. |
| `src/ui/palette.ts` | Product/site colours and number formatting. Design tokens are in `src/index.css`. |
| `e2e/` | Playwright tests. |
