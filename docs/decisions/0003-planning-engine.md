# 0003 — Planning engine: mathematical optimisation (MILP), not ML or an agent

- **Status:** proposed
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
- **Two levels:** (1) allocation per month with the MILP; (2) shift-level sequencing within a
  month by a heuristic, grouping lots of the same product into campaigns of reasonable length to
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

## Consequences
- Needs a period granularity decision: how evenly must the yearly demand be spread? This drives how
  many large line clears are needed. See open questions.
- Solve times must stay interactive (seconds). Keep the model size in check: periods × machines × products.
- The engine is a pure module with unit tests on small hand-checkable cases.
