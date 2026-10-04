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
| R16 | Initial stock per product per storage location (units at the start of week 1); default zero. | M | done | S05 |
| R17 | Product characteristics X, Y, Z, each with 3–8 editable variants. A product is one existing combination; its name defaults to `X-Y-Z`. Characteristic and variant names are editable. Characteristics are labels only: demand and capabilities stay per product (S06). | M | done | S05 |
| R18 | Demo data at a realistic scale: ~20 products picked from the X × Y × Z combinations (X letters K–N, Y numbers, Z tree names). | M | done | S05 |

## Overview
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R10 | Visual overview: machines grouped by site, showing which products each one can make. | M | done | S01 |

## Planning
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R20 | Input a yearly forecast: required quantity per product, in units. | M | done | S01 |
| R26 | Optional **per-week** requirement per product (ISO weeks; pinned weeks, the rest spread by A's open days — S04/S05, ADR 0004/0005). Demand is not even through the year; prevents oversized campaigns. | M | done | S01 |
| R27 | Producing ahead of demand is allowed, limited only by storage capacity (pallets) per location. | M | done | S01 |
| R47 | **Pre-SMG products:** a few products, made on the same machine types at A or B, are inputs consumed at B to make SMGs already in the mix. Their demand at B follows B's production of those SMGs (a bill of materials). Small quantities compared with the SMGs. Details are open questions. | M | agreed | after S06 |
| R48 | Truck lane A → B for pre-SMG products: its own max trucks per week, pallets per truck and weekend/holiday toggle, edited like the B → A lane; shown in the transport breakdown. | M | agreed | after S06 |
| R29 | Transport B → A limited by truck frequency × size; output from B waits in the B warehouse. Weekly cap (S05, ADR 0005). | M | done | S01 |
| R19 | Respect max campaign length. | M | agreed | S01 |
| R28 | Line clear time reduces the producing time of the shift it occurs in. | M | agreed | S01 |
| R21 | Generate a suggested plan distributing the forecast across capable machines, within shift capacity. LP on the Plan page with storage and trucks (S04–S05); no line clears yet. | M | building | S01 |
| R22 | Choose priorities per plan run: changeover time, transport, load balance, spare capacity. | M | agreed | S01 |
| R23 | Lots are at most one shift's output (configurable later). | M | agreed | S01 |
| R24 | Plan is per shift (3/day, 7 days/week). | S | agreed | S01 |
| R25 | Compare plans generated with different priorities. | C | idea | S01 |

## Plan visualisation
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R30 | Load/utilisation per machine. | M | agreed | S01 |
| R31 | Number of small/large line clears and total line clear time per machine. | M | agreed | S01 |
| R32 | Transport volume B → A in units and pallets. | M | done | S01 |
| R37 | Stock level (pallets) per storage location per month vs capacity. Detailed by R46 (per week, with product mix). | S | agreed | S01 |
| R38 | Trucks needed B → A per week/month vs allowed truck capacity. | M | done | S01 |
| R39 | Show which constraints are the bottleneck (e.g. A in-factory storage full, trucks maxed out, machine capacity), and what relaxing them would gain (solver shadow prices / what-if). | S | agreed | S01 |
| R33 | Flow diagram (Sankey) with numbers: product → machine → site → A. | M | agreed | S01 |
| R34 | Shift-level timeline of the plan per machine. | S | idea | S01 |
| R42 | Week-by-week plan per machine: for each machine and ISO week, which products run and how many shifts each, plus utilisation. | M | done | S04 |
| R43 | Transport breakdown B → A: per ISO week and product, the quantity shipped (units, pallets) and trucks used vs the truck limit. | M | done | S04 |
| R35 | Flag forecast that cannot be fulfilled (insufficient capacity). Solver-free check done in S04 (shortfall, peak weeks, estimated machine load); the solver will refine it. | S | building | S01 |
| R36 | High visual quality: polished charts and diagrams are a core goal, not decoration. | M | agreed | S01 |
| R44 | Scale to 20–50 products: tables and charts (demand grid, plan tables, weekly views) stay usable without wide sideways scrolling. Group or filter by characteristic X/Y/Z, or expand and collapse groups. | M | agreed | S05 |
| R46 | Warehouse panel on the Plan page: one section per storage location, showing per ISO week the stock in pallets by product (the product mix) against its capacity. Stacked bars per week with a capacity line, and a toggle to a week × product table, like the weekly machine plan (R42). | M | agreed | after S06 |
| R45 | Every panel with a chart or table has a small icon to download it as a PNG for presentations (2× resolution, light theme). Wide tables export whole; panel controls are left out. | M | done | S05 |

## Excel
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R60 | Downloadable, user-friendly Excel template: a separate tab per entity (machines, products, capabilities, sites & logistics, demand, initial stock, settings), with dropdown menus for references (site, product, machine, characteristic variants) and instructions. | M | agreed | S05 |
| R61 | Import a filled-in workbook; problems are reported per tab and row. | M | agreed | S05 |
| R62 | Export the current data to the same workbook format, so it can be edited in Excel and imported again. | M | agreed | S05 |
| R63 | Export plan results to Excel: one tab per view (shifts per machine × product, weekly machine plan, transport B → A, …). | S | agreed | S05 |

## Hosting
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R40 | Reachable by URL from any browser, with nothing to install. Hosted on GitHub Pages (public repo is fine: placeholder data only). | M | done | S01 |
| R41 | Auto-deploy on push to `main` (GitHub Actions). | S | done | S01 |

## About
| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R50 | About page explaining the optimisation: the solver (HiGHS), how it runs in the browser, the model (variables, constraints, objective) and methods used (e.g. LP relaxation, branch and bound). Content from [ADR 0003](decisions/0003-planning-engine.md): MILP, HiGHS, CLSP; the model list (period, variables, constraints, objective, two levels, how HiGHS solves it); why not machine learning; why not an AI agent. Leave out the rest of the ADR (status, spike notes, consequences) (S04). | M | agreed | S01 |
