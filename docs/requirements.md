# Requirements

Priority: **M** must · **S** should · **C** could. Status: idea → agreed → building → done.
Source: the session in which the requirement was agreed (ideas raised between sessions count for the next one).
Covers v2 only; v1 requirements (R1–R66) are at git tag `v1-yearly`. Terms: see the glossary in [domain.md](domain.md).

## Carried over from v1
Kept for v2 (IDs unchanged). Anything about sites, trucks, storage, demand or the MILP was dropped (S11).

| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R3 | Register semi-finished goods (products). | M | done | S01 |
| R4 | Define per machine which products it can produce, with rate (units/h) and OEE per machine–product pair. | M | done | S01 |
| R5 | Define small and large line clear time per machine. | M | done | S01 |
| R8 | Export/import the whole dataset as JSON (scenarios). | S | done | S01 |
| R14 | Edit all master data in the app (inline tables), saved in the browser; reset to demo data. | M | done | S03 |
| R17 | Product characteristics X, Y, Z, each with 3–8 editable variants. A product is one existing combination; its name defaults to `X-Y-Z`. Characteristic and variant names are editable. Characteristics are labels only: demand and capabilities stay per product (S06). | M | done | S05 |
| R18 | Demo data at a realistic scale: ~20 products picked from the X × Y × Z combinations (X letters K–N, Y numbers, Z tree names). | M | done | S05 |
| R36 | High visual quality: polished charts and diagrams are a core goal, not decoration. | M | agreed | S01 |
| R44 | Scale to 20–50 products: tables and charts (demand grid, plan tables, weekly views) stay usable without wide sideways scrolling. Group or filter by characteristic X/Y/Z, or expand and collapse groups. S07: "Group by" product/X/Y/Z in the demand grid (read-only sums) and the shifts table. S10: also in the weekly machine plan, warehouse and transport views (a selector per panel). | M | done | S05 |
| R45 | Every panel with a chart or table has a small icon to download it as a PNG for presentations (2× resolution, in the page's current light or dark theme: user, after S08). Wide tables export whole; panel controls are left out. | M | done | S05 |
| R40 | Reachable by URL from any browser, with nothing to install. Hosted on GitHub Pages (public repo is fine: placeholder data only). | M | done | S01 |
| R41 | Auto-deploy on push to `main` (GitHub Actions). | S | done | S01 |
| R60 | Downloadable, user-friendly Excel template: a separate tab per entity (machines, products with min/max/initial stock/usage, capabilities, settings; v2 list, S11), with dropdown menus for references (site, product, machine, characteristic variants) and instructions. User, S09: dropdowns wherever the choices are fixed, e.g. factory location. | M | agreed | S05 |
| R61 | Import a filled-in workbook; problems are reported per tab and row. | M | agreed | S05 |
| R62 | Export the current data to the same workbook format, so it can be edited in Excel and imported again. | M | agreed | S05 |

## v2 — rolling simulation (S11, [ADR 0013](decisions/0013-v2-rolling-simulation.md))
v2 lives in `v2/`; v1 is the root app (tag `v1-yearly`). The model for v2 is in
[domain.md](domain.md#v2-rolling-simulation).

| ID | Requirement | Prio | Status | Source |
| --- | --- | --- | --- | --- |
| R70 | Save v1: tag `v1-yearly`, copy the app to `v2/`, deploy v2 at the root and v1 at `/v1/`. | M | agreed | S11 |
| R71 | One factory. No sites, transport, storage locations, pallets or yearly demand. | M | agreed | S11 |
| R72 | Master data: machines (small/large line clear), products (X-Y-Z), capabilities (rate × OEE). Per product: **min**, **max**, **initial stock** and **usage per shift**. Not kept: maintenance, holidays, max campaign length. | M | agreed | S11 |
| R73 | Demo data includes a **seeded schedule** for the first 9 shifts. | M | agreed | S11 |
| R74 | **Step +1 shift** runs the chain in R75–R79 and shows the result. | M | agreed | S11 |
| R75 | Step, part 1: stock = previous stock + what each machine actually made in the shift − usage. | M | agreed | S11 |
| R76 | Step, part 2: the window rolls forward one shift and gets a new empty shift at the end. | M | agreed | S11 |
| R77 | Step, part 3: project stock shift by shift over the 9-shift window from the scheduled runs and expected usage. Find each product's first shift below min or above max. | M | agreed | S11 |
| R78 | Run output = rate × OEE × (shift length − clear time). A large clear applies when the product changes on the machine, a small clear otherwise. | M | agreed | S11 |
| R79 | Step, part 4: replan (R80–R83), then display (R84–R86). | M | agreed | S11 |
| R80 | **Frozen:** the next shift can't be changed. | M | agreed | S11 |
| R81 | **Below min:** the earliest breach goes first, then the deepest shortfall. Fixes are tried in the order add a run in an empty shift → move a run → swap a run's product. Fix just enough to stay ≥ min across the window. | M | agreed | S11 |
| R82 | **Above max:** fixes are tried in the order move the run later (or out of the window) → swap it to a product that needs it → cancel it. | M | agreed | S11 |
| R83 | A change is accepted only if it doesn't create a new or earlier breach for another product. If nothing works, the breach is reported as unfixable. | M | agreed | S11 |
| R84 | **Timeline:** one row per machine, 9 shift rectangles (3 days). Green = planned, unchanged. Yellow = newly added. Red = replanned (moved or swapped). Dashed red outline = cancelled this step. Colours reset at each step. | M | agreed | S11 |
| R85 | **Tables under the timeline:** stock per product (start, produced, consumed, end, against min/max, flagged if outside); changes with a one-line reason; unfixable breaches; projected stock per product as a sparkline over 9 shifts against min/max. | M | agreed | S11 |
| R86 | Controls: Step +1, **Run N steps / autoplay**, **Reset** to the seeded start. | M | agreed | S11 |
| R87 | Usage model behind an interface. Constant per product first (placeholder). | M | agreed | S11 |
| R88 | Usage later: seeded random noise ±% per product (reproducible). | S | idea | S11 |
| R89 | Usage later: replay a usage series from a file (CSV/Excel). | C | idea | S11 |
| R90 | About page explains the step loop, the model (small-bucket DLSP inside a model-predictive control loop), the replanner, the timeline colours and the assumptions. | M | building | S11 |
