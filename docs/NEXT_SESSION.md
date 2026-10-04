# Next session

_Written at the end of S07 (2026-10-04)._

## Where we are
- **Live:** https://fgsteen.github.io/production-planner/. It redeploys on every push to `main`.
- **Plan** (`src/plan/`, [ADR 0007](decisions/0007-line-clear-milp-and-warm-start.md)): a weekly
  MILP.
  - **Line clears:** each run (product × machine × week) costs a large line clear, each further
    lot a small one.
  - **Goals:** four priority weights (sliders on the Plan page): balance 8, line clears 4,
    transport 2, spare 1.
  - **Pre-SFGs and lanes:** pre-SFGs are consumed 1:1 where their SFG is made; there are lanes
    B → A and A → B.
  - **Solve:** a 3-stage warm start (relax and drop small runs → fix runs → MIP, gap 1 %, 6 s).
  - **Demo result:** about 6 s, 0 unmet, busiest machine about 80 %, about 1,040 large line
    clears, gap shown as about 21 %. The HiGHS bound is weak.
- **Demo:**
  - 20 SFGs and 2 pre-SFGs (P21 → P12, P22 → P17; P22 is made only at A, so it is trucked);
  - demand of about 34 M units, cut by a fifth in S07.
- **Plan page panels:**
  - priorities;
  - summary;
  - shifts per machine and product, with group-by and line clear columns;
  - weekly machine plan;
  - warehouses (new, R46);
  - transport per lane.
- `npm test` is green: 5 tooling tests, typecheck, 72 unit tests and 23 e2e tests.

## Known weak spots (from S07)
1. **The line clear weight barely moves the demo plan.** There are about 1,040 large line clears
   at weight 4 and at 10. Within 6 s the MIP stage rarely improves on the heuristic start, so the
   heuristic (`src/plan/solve.ts`) decides the plan.
2. **Line clears are counted per week.** A product running in consecutive weeks pays a large
   clear each week, so campaigns across weeks look worse than they are.
3. **Week 1 starts without stock** in the demo, which squeezes the first weeks.
4. **Each solve takes about 6 s**, and every slider move or data edit waits for it.
5. **Demand beyond capacity** (checked after S07, by scaling the demo's demand). A what-if like
   "what if demand grows, where do we need machines?" is a core use, and the model stays
   solvable: unmet demand is a penalised slack. Its answers are poor, though:
   - **×1.3:** 0.2 % unmet, all of it P10. The solve took 12 s: the warm-start stages have no
     time limit, only the MIP does.
   - **×2:** 23 % unmet, as whole products. P07, P10, P11, P13 and P17 get **nothing**, because
     every unit costs the same. The cheapest units to drop are on slow machines, so whole slow
     products go.
   - **The pre-SFG chain hides the real bottleneck.** P17 is fully unmet while its machine B3 has
     spare time: its pre-SFG P22 can only be made on A4, which is full.
   - **The UI shows only total unmet units.** It doesn't break them down by product or week, and
     doesn't show which constraint binds (R39). `PlanResult.unmet` already has the data per
     product and week.
   - The reported gap is meaningless here (100 %).

## Proposed goal for S08
**Make the plan respond to priorities and count line clears properly.**
- Model a run as continuing into the next week without a new large clear. Add a binary
  `cont[p,m,w]` or a changeover variable `start[p,m,w] ≥ run[w] − run[w−1]`, and charge the clear
  only on starts. This also makes R19 (max campaign length) expressible.
- Rework the warm start so the weights steer it:
  - e.g. rounding driven by the weighted relaxation, or a cyclic "every k weeks" schedule per
    product–machine pair;
  - measure line clears, utilisation and transport at weights 0, 4 and 10.
- An e2e test that a higher line clear weight gives fewer line clears on the demo.
- Show the solve progress or cancel it, since solves take seconds now.

### First steps
1. Put the measurement script back. It solves the seed at several weights and prints the large
   clears, U, unmet and the time per stage. The S07 version was a throwaway vitest file in the
   scratchpad. Keep it out of `src/` or the build's typecheck fails, because `process` is
   untyped.
2. Add the start variables and compare the counts.
3. Then tune the warm start.

### Questions for the user
See [open-questions.md](open-questions.md):
- may an SFG with a pre-SFG also be made at A?
- should the demo start with some stock?
- is counting campaigns per week acceptable?
- transit time;
- whole pallets;
- weekend consumption at A;
- Excel dropdowns.

## Later sessions (rough order, to be confirmed with the user)
- **Group-by everywhere (rest of R44):** the weekly machine plan, transport and warehouse views
  (sum products per X/Y/Z variant).
- **Excel (R60–R63):**
  - a template with one tab per entity, including characteristics and the pre-SFG flag, with
    dropdowns;
  - import with per-row errors;
  - export of data and of plan results;
  - ExcelJS, recorded in an ADR.
- **Visualisation (R30, R33, R37–R39):**
  - Sankey;
  - utilisation heatmap;
  - bottlenecks (shadow prices from the fixed-run LP).
  - New panels should use `Panel`.
- **About page (R50, `#about`):** condensed from ADRs 0003, 0005 and 0007.
- **Further features:** shift-level timeline (R34); compare plans (R25).
