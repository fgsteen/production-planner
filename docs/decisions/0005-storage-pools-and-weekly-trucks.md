# 0005 — Stock per storage pool, weekly truck limit, initial stock

- **Status:** accepted
- **Date:** 2026-10-04
- **Session:** S05

## Context
The S04 LP held one stock per product and ignored storage and trucks. ADR 0003 asks for balances
per location, storage caps in pallets and a B → A truck limit. The user chose a **weekly truck cap**
(not per-day trucks), **editable initial stock defaulting to zero**, and **demand that follows A's
working days** (S05).

## Decision
- **Storage pools.** Each site has one *local* pool: its locations that accept local goods, with
  their capacities summed. The demand site also has an *inbound* pool: its locations that accept
  trucked goods. In a continuous LP any split of a pool's stock over its locations is as good as
  another, so pooling loses nothing. Stock per product per pool per week; `Σ units ÷ unitsPerPallet ≤
  capacity` at the end of each week. Inbound locations at a non-demand site get nothing and are
  ignored.
- **Balances.** At B: production − shipped. At A: local production feeds in-factory storage and
  shipments feed the warehouse. Demand draws from both pools, and unmet demand is penalised.
  Shipments arrive in the same week (no transit lead time).
- **Trucks.** Shipped pallets per week ≤ limit × pallets per truck. A lane that runs on weekends
  and holidays gets `maxTrucksPerWeek` every week. Otherwise that maximum is for a five-day week:
  `floor(max × open weekdays ÷ 5)`, where open weekdays are Mon–Fri that aren't holidays at either
  end (`truckLimit`, `src/model/capacity.ts`). Trucks used = ⌈pallets ÷ size⌉, reported per week.
- **Pallets are continuous.** Fractional pallets are accepted for now; whole pallets or trucks
  would need integer variables.
- **Initial stock** (`Dataset.initialStock`: location, product, units; missing = 0) is the week-0
  stock of the location's pool. Validation rejects stock above a location's capacity.
- **Demand spread.** The unpinned part of the yearly total spreads in proportion to the days in
  each ISO week that are not holidays at the demand site (`demandWeekWeights`). All seven weekdays
  count, because sites have no weekly calendar of their own. This supersedes the "evenly" in ADR 0004.
- **Objective** gains a tiny shipping cost (0.0001/unit) so goods aren't trucked for nothing.
  Priority weights (R22) are still to come.

## Consequences
- Demo data: B-only products need ~7.4 trucks/week, so the demo lane was raised from 5 to
  **10 trucks/week** (user decision). The default for new data stays 5.
- With least machine time as the only goal, the plan runs the trucks at their limit in 34 of 52
  weeks and leaves B1 nearly idle. R22 (priorities) is the next lever.
- Model size for the demo: ~4.9k columns, ~2.7k rows, solved in ~30–90 ms.
