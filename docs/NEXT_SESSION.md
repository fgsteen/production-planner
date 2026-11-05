# Next session

_Written in S11 (2026-11-05), a planning-only session._

Start with `/session-start`. **The project is now v2:** one factory and a rolling shift
simulation that keeps stock between min and max. Read [ADR 0013](decisions/0013-v2-rolling-simulation.md),
then requirements R70–R90 and [domain.md](domain.md).
v1 (S01–S10) is tagged `v1-yearly`.

## v2 roadmap (one goal per session)
| Session | Goal | Reqs |
| --- | --- | --- |
| **S12** | (Copy to `v2/` done in S11.) Strip the v1-only parts: sites, trucks, storage, demand, HiGHS, Overview map. Build the new master data with min/max/initial stock/usage and a seeded schedule. Deploy v2 at the root and v1 at `/v1/`. Tests green. | R70–R73 |
| S13 | Simulation core: a pure `step()` with run output including clears, stock update, window roll, projection and breach detection. A constant usage model. Unit tests. | R74–R78, R87 |
| S14 | Greedy replanner: frozen shift, below-min and above-max order, no new breaches, a reason per change, unfixable list. Unit tests. | R79–R83 |
| S15 | UI: machine × 9-shift timeline in green/yellow/red/dashed, the tables with sparklines, Step/Run N/autoplay/Reset. e2e. | R84–R86 |
| S16 | Seeded random usage ±%, plus polish from using it. | R88 |

## Proposed goal for S12
**Goal:** R70–R73. `v2/` is already a copy (S11, with the new About page, R90). Strip it down to one factory, add the new product
fields and the seeded schedule, and deploy at the root with v1 at `/v1/`.

**Stretch:** start S13's `step()` types and the output-per-run function with tests.

### First steps
1. Make the workflow build both: v2 to `dist/`, v1 to `dist/v1/` (Vite `base` is `./`).
2. Delete the v1-only modules in `v2/` and fix the types.
3. Product fields min/max/initialStock/usagePerShift, and a demo schedule.

## Later
- Replay usage from a file (R89).
- Machine breakdowns or scrap (production ≠ plan).
- A step-back/history control (the user didn't pick it in S11).
- MILP replanner (DLSP) to compare against greedy: same steps, count the changes (ADR 0013).
- Excel master data (R60–R62) is carried over to v2, to be confirmed. The rest of the v1 backlog (Sankey, 2× solve time) is **frozen**.
