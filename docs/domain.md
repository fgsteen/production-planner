# Domain model

_v2, from S11 ([ADR 0013](decisions/0013-v2-rolling-simulation.md), R70–R90). v1's model (two
sites, trucks, storage, yearly demand) is at git tag `v1-yearly`._

```
Machine 1───* Capability *───1 Product (min, max, initial stock, usage/shift)
 (small/large clear)  (rate, OEE)        └── characteristics X-Y-Z
Schedule: Run = machine × shift × product        Window = next 9 shifts (3 days)
```

## Glossary
| Term | Meaning |
| --- | --- |
| **Product** | A semi-finished good that machines make and usage draws from stock. |
| **Shift** | 8 h; 3 per day, 7 days a week. The time unit of the simulation. |
| **Run** | One machine making one product for one whole shift. It is one lot, all or nothing. |
| **Small line clear** | Changeover when a machine runs the **same** product as in its previous shift. |
| **Large line clear** | Changeover when a machine switches to a **different** product. |
| **Step** | Advance one shift: update stock, roll the window, project, replan, show. |
| **Window** | The next 9 shifts. Shift 1 is **frozen**. |
| **Breach** | A product's projected stock below min or above max in some shift of the window. |
| **Change** | Add, move, swap or cancel of a run, each with a one-line reason. |

## Master data
| Entity | Meaning | Fields |
| --- | --- | --- |
| **Machine** | Self-contained: raw material in → product out. | name, small line clear time, large line clear time |
| **Product** | One existing X-Y-Z combination. | custom name (empty = `X-Y-Z`), a variant of each characteristic, **min**, **max**, **initial stock**, **usage per shift** (all in units) |
| **Characteristic** | X, Y or Z, each with up to 8 editable variants. Labels only. | name, variants |
| **Capability** | Machine *can make* product. Many-to-many. | machine, product, rate (units/h), OEE (%) |
| **Settings** | Global. | shift length (h) |
| **Seed schedule** | The demo's runs for the first 9 shifts. | per machine and shift: product or empty |

Demo placeholders: X = letters K–N, Y = numbers, Z = tree names (e.g. `L-2-Birch`); about 20 of
the 72 combinations exist ([ADR 0006](decisions/0006-product-characteristics-and-png-export.md)).

## Production
- Run output = rate × OEE × (shift length − line clear time). The clear is large when the product
  differs from the machine's previous shift, small otherwise. After an idle shift, and in the
  very first shift, the clear is large (S12 default).
- A machine makes exactly its planned output: no breakdowns or scrap (yet).

## Planning model
- **Planning model:** a small-bucket lot-sizing and scheduling problem, closest to the
  **DLSP** (discrete lot-sizing and scheduling) on parallel machines with setup carry-over. Not
  the big-bucket CLSP of v1: here each bucket holds one product, and the order of runs matters
  because of the clears.
- **Control loop:** model predictive control (rolling-horizon rescheduling). Measure stock,
  predict 9 shifts, correct, carry out shift 1, repeat. Few changes keep plan nervousness low.
- **Replanner:** greedy, with the rules in R80–R83. A MILP that minimises breaches, then weighted
  changes, then clears, could be plugged in later to compare.
- Explained to users on v2's **About page** (R90).

## Not modelled (now)
- Sites, transport, storage capacity, demand forecasts.
- Raw material availability, staffing, maintenance and holidays.
- Finished goods and the next process step.
