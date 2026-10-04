# 0003 — Planning engine: mathematical optimisation (MILP), not ML or an agent

- **Status:** accepted (S04, after a working spike)
- **Date:** 2026-10-04
- **Session:** S01

## Context
The system must turn a yearly forecast per product into a plan: which product on which machine,
how many lots, within shift capacity. The priorities (changeovers, transport, load balance, spare
capacity) are chosen per run. There is no historical data.

## Decision (proposed)
Model it as a **mixed-integer linear program (MILP)** and solve it in the browser with **HiGHS**
(open-source solver, compiled to WebAssembly).

This is a variant of the well-studied **capacitated lot-sizing problem (CLSP)** with parallel
machines, setup times and inventory limits.

- **Period:** ISO week (52/53 per year) — changed from month in S04, see [ADR 0004](0004-weekly-demand-iso-weeks.md).
- **Variables:**
  - lots of product *p* on machine *m* in month *t* (integer);
  - whether *p* runs on *m* in *t* (binary → drives large line clears);
  - quantity produced;
  - stock per product at month end.
- **Constraints:**
  - **inventory balance per location:**
    - B warehouse: stock(t−1) + B production(t) − shipped(t) = stock(t);
    - A in-factory: stock(t−1) + A production(t) − drawn(t) = stock(t);
    - A warehouse: stock(t−1) + shipped(t) − drawn(t) = stock(t);
    - drawn from in-factory + warehouse = monthly demand(t); shortfall is tracked and penalised;
  - **storage:** total pallets per storage location ≤ its capacity;
  - **trucks:** pallets shipped B → A per month ≤ max trucks/week × weeks × size.
    Trucks needed = ⌈pallets shipped ÷ size⌉ is reported. Truck days follow the weekend/holiday toggle;
  - **max campaign length:** one global limit in shifts. Enforced in the shift-level sequencing; the
    monthly level counts the large line clears this forces;
  - only capable machine–product pairs;
  - lot size ≤ one shift's output, and the line clear eats into that shift;
  - lots ≤ available shifts (calendar − holidays − maintenance).
- **Objective:** weighted sum of the chosen priorities: line clear time, units transported B → A,
  load imbalance, spare capacity. The UI exposes the weights or a priority ranking.
- **Two levels:** (1) allocation per week with the MILP; (2) shift-level sequencing within a
  week by a heuristic, grouping lots of the same product into campaigns of reasonable length to
  avoid large line clears. If needed, the MILP can be applied to sequencing later.
- **How HiGHS solves it:** LP relaxation (dual simplex / interior point), then branch-and-bound
  with cutting planes and primal heuristics for the integer variables. It reports the optimality
  gap, so we can show how close to optimal a plan is. All of this goes on the About page (R50).

## Why not machine learning
ML learns patterns from historical data. We have none, and allocation under hard capacity
constraints is exactly what optimisation solvers are built for. A solver gives a provably feasible
plan that can be explained and reproduced.

ML could be added later for *inputs*, e.g. predicting OEE or demand.

## Why not an AI agent
The engine is deterministic and needs no API key, server or running costs. An LLM could be added
later as an optional extra, e.g. "explain this plan" or "what if site B loses machine B3?". That
would need a small backend to keep the API key secret.

## Spike result (S04)
- Package `highs` (npm, WASM, ~3.5 MB) runs in a **Web Worker** (`src/plan/plan.worker.ts`), loaded
  only when the Plan page opens. The model is written as CPLEX LP text (`src/plan/lp.ts`).
- First model is a **continuous LP**: machine-hours per product × machine × week, one stock per
  product, penalised unmet demand; objective = machine-hours + tiny holding cost. The demo data
  (10 products, 8 machines, 52 weeks, ~2,300 columns) solves in ~65 ms.
- Least machine-hours alone loads the fastest machines (site A) to 100 % and leaves B1 nearly idle:
  the priority weights (R22) and transport costs are needed for sensible plans.
- Next: integer lots and line clears (MILP), storage locations, trucks, priority weights.

## Consequences
- Period granularity: ISO weeks (ADR 0004).
- Solve times must stay interactive (seconds). Keep the model size in check: periods × machines × products.
- The engine is a pure module with unit tests on small hand-checkable cases.
