# Next session

_Written at the end of S11 (2026-11-05)._

Start with `/session-start`. **The project is now v2:** one factory, with a rolling shift
simulation that keeps stock between min and max. Read [ADR 0013](decisions/0013-v2-rolling-simulation.md),
requirements R70–R90 and [domain.md](domain.md). v1 (S01–S10) is the root app, tagged `v1-yearly`.

## Changed in S11 (planning only)
- **v2 spec agreed:** R70–R90, ADR 0013, and vision and domain rewritten for v2.
- **Model:** small-bucket DLSP in an MPC loop, with a greedy replanner (not a CLSP any more).
- **`v2/`** is a full copy of the app with a new About page (R90). Run it with `npm --prefix v2 run dev`
  or the `dev-v2` launch config on port 5174.
- **Docs cover v2 only.** v1-only ADRs (0003–0005, 0007–0010) are superseded.

## Known weak spots
1. **`v2/` still holds all of v1:** sites, trucks, HiGHS, Overview map. The map logs React Flow
   prop warnings.
2. **The tag `v1-yearly` is local only.** Push it with `git push origin v1-yearly` (ask first).
3. **The root `npm test` covers v1 only.** v2 has its own `npm test` inside `v2/`. CI doesn't run
   it yet.

## v2 roadmap (one goal per session)
| Session | Goal | Reqs |
| --- | --- | --- |
| **S12** | Strip `v2/` to one factory, add the new master data and seeded schedule, deploy v2 at the root and v1 at `/v1/`. | R70–R73 |
| S13 | Simulation core: a pure `step()` with output including clears, stock update, window roll, projection, breaches. Constant usage. Unit tests. | R74–R78, R87 |
| S14 | Greedy replanner: frozen shift, fix order, no new breaches, reasons, unfixable list. Unit tests. | R79–R83 |
| S15 | UI: 9-shift timeline in green/yellow/red/dashed, tables with sparklines, Step/Run N/autoplay/Reset. e2e. | R84–R86 |
| S16 | Seeded random usage ±%, plus polish. | R88 |

## Proposed goal for S12
**Goal:** R70–R73. Strip `v2/` to one factory, add the product fields min/max/initial
stock/usage and a seeded 9-shift schedule, and switch the deploy (v2 at the root, v1 at `/v1/`).

**Stretch:** (1) run v2's tests in CI and from the root `npm test`; (2) start S13's `step()` types
and the output-per-run function with tests.

### First steps
1. Delete the v1-only modules in `v2/`: sites, trucks, storage, demand, `src/plan/` MILP and
   HiGHS, `src/overview/`. Fix the types and tests.
2. Data model: Machine (clears), Product (+ min, max, initialStock, usagePerShift), Capability,
   Settings (shift length), seed schedule. Update the Master data page and JSON import.
3. Workflow: build v2 to `dist/` and v1 to `dist/v1/`, then check both URLs after the push.

### Questions for the user
- **Autoplay:** should it stop at an unfixable breach, or carry on and only list it?
- **Move:** prefer the same machine, or any capable machine (default: earliest valid slot, same
  machine wins ties)?
- **Excel (R60–R62):** still wanted for v2's master data?

## Later
- Replay usage from a file (R89).
- MILP (DLSP) replanner to compare against greedy: same steps, count the changes.
- Machine breakdowns or scrap (production ≠ plan).
- A step-back/history control.
- v1 backlog (Sankey, 2× solve time) is **frozen** with v1.
