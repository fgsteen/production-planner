# Next session

_Written at the end of S12 (2026-11-05)._

Start with `/session-start`. The project is v2: one factory, with a rolling shift simulation that
keeps stock between min and max. See [ADR 0013](decisions/0013-v2-rolling-simulation.md), R70–R90
and [domain.md](domain.md).

## Changed in S12
- **R70–R73 done.** `v2/` is one factory with the new master data and a seeded 9-shift schedule.
  v2 is live at the root, v1 at `/v1/`.
- **Tests:** the root `npm test` and `test:quiet` also run v2's suite. CI runs `test:quiet` before
  every deploy.
- **S13 prep:** `v2/src/sim/` has the `step()` types (`SimState`, `RunOutput`, `Breach`,
  `StepResult`, `UsageModel`), `constantUsage`, `initialState` and `scheduleOutputs` (R78, R87).

## Known weak spots
1. **No Excel (R60–R62):** it was never built, in v1 or v2.
2. **`Panel` (PNG download) and `GroupBy` are unused** in v2 until S15.
3. **CI is slow-ish:** it now installs Chromium and runs both e2e suites (about 1 min locally)
   before each deploy.

## v2 roadmap (one goal per session)
| Session | Goal | Reqs |
| --- | --- | --- |
| **S13** | Simulation core: a pure `step()` with stock update, window roll, projection, breaches. | R74–R78, R87 |
| S14 | Greedy replanner: frozen shift, fix order, no new breaches, reasons, unfixable list. Unit tests. | R79–R83 |
| S15 | UI: 9-shift timeline in green/yellow/red/dashed, tables with sparklines, Step/Run N/autoplay/Reset. e2e. | R84–R86 |
| S16 | Seeded random usage ±%, plus polish. | R88 |

## Proposed goal for S13
**Goal:** a pure `step(ds, state, usage) → StepResult` in `v2/src/sim/`. Run shift `state.shift`
(stock += made − usage, R75), roll the window (R76), project stock over the 9 shifts and find each
product's first breach (R77). Unit tests on a small hand-built dataset and the seed.

**Stretch:** (1) a minimal Step +1 button on a v2 page that shows the stock and breaches as text
(R74, ahead of S15's UI); (2) check how the seed behaves over 9+ steps with no replanning, and
tune the seed if every product breaches at once.

### First steps
1. Read `v2/src/sim/types.ts` and `output.ts`. `scheduleOutputs` gives the units per run.
2. Write `step()` in `v2/src/sim/step.ts`. Decide whether the stock can go negative (default: no,
   clamp at 0 and report it as a breach).
3. Write `projection` and `breaches` as their own exported functions, so S14 can reuse them.

### Questions for the user
- **Negative stock:** when usage exceeds stock, clamp at 0 (lost demand) or let it go negative
  (backlog)?
- **Breach timing:** is a breach checked on the stock at the end of a shift only, or also at its
  start?

## Later
- Excel import/export for v2 master data (R60–R62), if still wanted.
- Replay usage from a file (R89).
- MILP (DLSP) replanner to compare against greedy: same steps, count the changes.
- Machine breakdowns or scrap (production ≠ plan).
- A step-back/history control.
- v1 backlog (Sankey, 2× solve time) is **frozen** with v1.
