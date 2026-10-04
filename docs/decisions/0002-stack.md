# 0002 — Tech stack: client-only TypeScript app, static hosting

- **Status:** accepted
- **Date:** 2026-10-04
- **Session:** S01

## Context
Single user, shown in demos, not an enterprise system ([vision](../vision.md)). The app must be
reachable by URL with nothing to install, hosted in the cloud.
The core value is a planning engine ([ADR 0003](0003-planning-engine.md)) plus **high-quality
visualisation**. Claude must be able to test as much as possible itself.

## Decision
- **TypeScript + React + Vite**, running fully in the browser. No backend.
- **Persistence:** browser storage (IndexedDB/localStorage), plus **JSON export/import** of the
  whole dataset (scenarios).
- **Planning engine:** a pure TypeScript module; HiGHS (WebAssembly) as the solver.
- **UI:** Tailwind CSS + a component kit (shadcn/ui).
- **Visualisation:**
  - **Apache ECharts:** Sankey flow diagrams with numbers (product → machine → site → A),
    utilisation heatmaps (machine × week), stacked bars for line clear time, and a custom Gantt
    series for the shift timeline. Animated, polished, handles large data.
  - **React Flow (xyflow):** the interactive site/machine map with labelled edges
    (e.g. B → A transport with unit counts).
  - Consistent palette and design tokens across all charts; light and dark mode.
- **Tests:** Vitest for the model and engine; Playwright for end-to-end flows and screenshot
  comparison; visual review in the Claude browser pane.
- **Hosting:** **GitHub Pages** from a **public** repo (account `fgsteen`), deployed by GitHub Actions on every push to `main`. Public is fine: only placeholder products and numbers (user decision, S01).

## Hosting options
| Option | Private code | Restrict who can view | Cost | Notes |
| --- | --- | --- | --- | --- |
| Cloudflare Pages + Cloudflare Access | yes | yes, by email login (free up to 50 users) | free | Builds from a private GitHub repo. |
| **GitHub Pages** _(chosen)_ | public repo only (free plan) | no | free | Simplest; the URL is public. |
| Netlify / Vercel | yes | password protection is a paid feature | free tier | Similar to Cloudflare. |

The host only serves static files. Planning data stays in each viewer's browser; nothing is sent
to a server.

## Consequences
- No server to run; a demo is just a URL.
- Data lives per browser. Sharing a scenario = export/import JSON (or a built-in demo dataset).
- A future multi-user version would add an API + database; the engine module stays the same.

## Alternatives considered
- Node API + SQLite: more moving parts; nothing in v1 needs a server.
- Python backend for optimisation: HiGHS in WebAssembly covers the solver need in the browser.
- Recharts / Nivo: nice for simple charts, but weaker on Sankey/Gantt/heatmap than ECharts.
  D3 directly: maximum control, but much slower to build.
