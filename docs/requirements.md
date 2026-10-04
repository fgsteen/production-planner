# Requirements

Priority: **M** must · **S** should · **C** could. Status: idea → agreed → building → done.
Terms: see the glossary in [domain.md](domain.md).

## Master data
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R1 | Register sites: B (production only) and A (production + demand). | M | done | S01 |
| R2 | Register machines, each belonging to one site, with shift calendar (default 3 shifts × 7 days). | M | done | S01 |
| R3 | Register semi-finished goods (products). | M | done | S01 |
| R4 | Define per machine which products it can produce, with rate (units/h) and OEE per machine–product pair. | M | done | S01 |
| R5 | Define small and large line clear time per machine. | M | done | S01 |
| R7 | Seed the app with generic demo data (sites B and A, a set of machines and products, overlapping capabilities). | M | done | S01 |
| R6 | Packaging per product: units per crate, crates per pallet. | M | done | S01 |
| R8 | Export/import the whole dataset as JSON (scenarios). | S | done | S01 |
| R9 | Configurable holidays (per site) and planned maintenance (per machine), as lists of whole-day dates. They reduce available shifts. They **repeat every year** (month and day only; S03). | M | done | S01 |
| R11 | Storage locations with capacity in total pallets: A in-factory (A-produced only), A warehouse (from B), B warehouse. | M | done | S01 |
| R12 | Trucks B → A: max trucks per week, size in pallets (default 30), toggle for running on weekends/holidays. Default 5 trucks/week. | M | done | S01 |
| R13 | Global max campaign length in shifts. | M | done | S01 |
| R14 | Edit all master data in the app (inline tables), saved in the browser; reset to demo data. | M | done | S03 |
| R15 | Planning year setting (the plan covers 1 Jan – 31 Dec of that year). | M | done | S03 |

## Overview
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R10 | Visual overview: machines grouped by site, showing which products each one can make. | M | done | S01 |

## Planning
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R20 | Input a yearly forecast: required quantity per product, in units. | M | done | S01 |
| R26 | Optional **per-week** requirement per product (ISO weeks; pinned weeks, the rest spread evenly — S04, ADR 0004). Demand is not even through the year; prevents oversized campaigns. | M | done | S01 |
| R27 | Producing ahead of demand is allowed, limited only by storage capacity (pallets) per location. | M | agreed | S01 |
| R29 | Transport B → A limited by truck frequency × size; output from B waits in the B warehouse. | M | agreed | S01 |
| R19 | Respect max campaign length. | M | agreed | S01 |
| R28 | Line clear time reduces the producing time of the shift it occurs in. | M | agreed | S01 |
| R21 | Generate a suggested plan distributing the forecast across capable machines, within shift capacity. | M | agreed | S01 |
| R22 | Choose priorities per plan run: changeover time, transport, load balance, spare capacity. | M | agreed | S01 |
| R23 | Lots are at most one shift's output (configurable later). | M | agreed | S01 |
| R24 | Plan is per shift (3/day, 7 days/week). | S | agreed | S01 |
| R25 | Compare plans generated with different priorities. | C | idea | S01 |

## Plan visualisation
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R30 | Load/utilisation per machine. | M | agreed | S01 |
| R31 | Number of small/large line clears and total line clear time per machine. | M | agreed | S01 |
| R32 | Transport volume B → A in units and pallets. | M | agreed | S01 |
| R37 | Stock level (pallets) per storage location per month vs capacity. | S | agreed | S01 |
| R38 | Trucks needed B → A per week/month vs allowed truck capacity. | M | agreed | S01 |
| R39 | Show which constraints are the bottleneck (e.g. A in-factory storage full, trucks maxed out, machine capacity), and what relaxing them would gain (solver shadow prices / what-if). | S | agreed | S01 |
| R33 | Flow diagram (Sankey) with numbers: product → machine → site → A. | M | agreed | S01 |
| R34 | Shift-level timeline of the plan per machine. | S | idea | S01 |
| R35 | Flag forecast that cannot be fulfilled (insufficient capacity). Solver-free check done in S04 (shortfall, peak weeks, estimated machine load); the solver will refine it. | S | building | S01 |
| R36 | High visual quality: polished charts and diagrams are a core goal, not decoration. | M | agreed | S01 |

## Hosting
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R40 | Reachable by URL from any browser, with nothing to install. Hosted on GitHub Pages (public repo is fine: placeholder data only). | M | done | S01 |
| R41 | Auto-deploy on push to `main` (GitHub Actions). | S | done | S01 |

## About
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R50 | About page explaining the optimisation: the solver (HiGHS), how it runs in the browser, the model (variables, constraints, objective) and methods used (e.g. LP relaxation, branch and bound). | M | agreed | S01 |
