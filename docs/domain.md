# Domain model

Updated in S01. Items marked _(?)_ are unconfirmed — see [open-questions.md](open-questions.md).

```
Site 1───* Machine 1───* Capability *───1 Product 1───1 Demand (yearly + pinned weeks)
  │           │           (rate, OEE)        │
  │           └── Downtime (maintenance)     └── Packaging (units/crate, crates/pallet)
  └── Holidays
Site B ──transport──▶ Site A (next process step; all demand lands here)
```

## Glossary
| Term | Meaning |
| --- | --- |
| **Semi-finished good / product** | What machines produce. |
| **Lot** | One manufacturing order: started, produced and finished as a unit. For now, max one shift's output per lot (may be relaxed later). |
| **Small line clear** | Changeover between two lots of the **same** product. |
| **Large line clear** | Changeover when the machine switches to a **different** product. |
| **Shift** | Planning time unit. 3 shifts/day, 7 days/week. |
| **Campaign** | A run of consecutive lots of the same product on a machine. Very large campaigns are not practical for personnel or quality. |
| **Crate / pallet** | Packaging: units per crate and crates per pallet (per product). Used for storage and transport. |

## Sites
- **The network is fixed** (user decision, S03): exactly two sites, B and A, and one truck lane
  B → A. Their properties are editable; sites and lanes can't be added or removed.
  A second lane **A → B** carries pre-SMG products (S07, R48).
- **Site B:** produces semi-finished goods only. Everything made at B is transported to A.
- **Site A:** produces them too and hosts the next process step. Demand is consumed here.

## Master data
| Entity | Meaning | Fields |
| --- | --- | --- |
| **Site** | Geographical location (B, A). | name, is demand site, holidays (recurring `MM-DD` days) |
| **StorageLocation** | Pallet storage at a site. | name, site, capacity (pallets), accepts (goods produced locally / goods arriving by truck) |
| **TruckLane** | Transport B → A, and A → B for pre-SMGs (S07). | from, to, max trucks per week, size (pallets/truck, default 30), runs on weekends/holidays (toggle) |
| **Settings** | Global planning settings. | planning year (ISO week-year), max campaign length (shifts), shift length |
| **Machine** | Self-contained machine at one site: raw material in → semi-finished good out. | name, site, shift calendar (default 3×8 h, 7 days/week), small line clear time, large line clear time, planned maintenance (recurring `MM-DD` days) |
| **Product** | A semi-finished good (SMG), or a pre-SMG: an input consumed 1:1 where the SMGs that use it are made (S07). | custom name (empty = `X-Y-Z`), a variant of each characteristic, units per crate, crates per pallet, is pre-SMG, uses pre-SMG |
| **Characteristic** | One of three product dimensions, X, Y and Z, each with up to 8 variants. Names of characteristics and variants are editable. | name, variants |
| **Capability** | Machine *can produce* product. Many-to-many. Some products are possible at both sites, some at only one. | machine, product, rate (units/h), OEE (%) |

Line clear times don't depend on the product for now; they are set per machine.

**Product characteristics** (user, after S05; built in S06, [ADR 0006](decisions/0006-product-characteristics-and-png-export.md)):
- every product is one combination **X-Y-Z**, and no two products share one. Its name is that
  combination unless it has a custom name;
- only some combinations exist (the demo has 20 of the 72);
- demo placeholders: X = letters K–N, Y = numbers, Z = tree names (e.g. `L-2-Birch`);
- characteristics are **labels only**: demand, capabilities and line clears stay per product (S06);
- views can group or filter products by a characteristic (R44, not built yet).

## Capacity
- Available shifts per machine = calendar shifts − site holidays − machine maintenance.
- **Holidays and maintenance days repeat every year** (user decision, S03, "for now"): only month
  and day count, so they apply to whatever planning year is set. Moveable feasts (Easter,
  Ascension) must be re-entered if the year changes.
- Effective output per hour = rate × OEE (per machine–product pair).
- A line clear **eats into the shift**: lot output = (shift length − line clear time) × rate × OEE.
- Max lot size = one shift's output.

## Demand, storage and transport
- **Demand** per product, in **units**: a yearly total, spread over the ISO weeks of the
  planning year in proportion to the days A is open (not a holiday), so holiday weeks get less (S05). Chosen weeks can be **pinned** to a quantity; the rest of the total spreads over
  the other weeks (S04, [ADR 0004](decisions/0004-weekly-demand-iso-weeks.md)). Demand is what A
  consumes that week; it isn't even through the year.
- **Time grid:** ISO 8601 weeks (as in Sweden). The planning year runs from Monday of week 1 to
  Sunday of week 52/53.
- Producing earlier is fine. The only limit on producing ahead is **storage space**.
- **Initial stock:** units per product per storage location at the start of week 1. Editable;
  the default is zero (S05).
- Storage is counted in **pallets**, as a total across products (not per product), per storage location:

| Location | Site | Role |
| --- | --- | --- |
| **A in-factory storage** | A | Only goods **produced at A**. |
| **A warehouse** | A | Goods **arriving from B** by truck. |
| **B warehouse** | B | Goods produced at B, awaiting loading on a truck to A, and pre-SMGs trucked in from A (shared capacity, S07). |

A-produced goods can't overflow into the A warehouse. The plan must make it visible when this
limit is the bottleneck (R39).

- **Trucks B → A:**
  - **size:** pallets per truck, default **30**, editable;
  - **frequency:** max trucks per week, default **5**, editable. The plan
    also reports **how many trucks are actually needed**;
  - **toggle:** whether trucks run on weekends and holidays. If not, the weekly maximum is for a
    five-day week and drops with weekday holidays at either site, e.g. 10 → 8 in Midsummer week
    (weekly cap, not per-day trucks; S05, [ADR 0005](decisions/0005-storage-pools-and-weekly-trucks.md));
  - the **demo data** uses 10 trucks/week: its B-only products need about 7.4.
- Pallets per product = units ÷ (units per crate × crates per pallet).

```
B machines → B warehouse ──truck (≤ freq/week × 30 pallets)──▶ A warehouse  ─┐
A machines ─────────────────────────────────────────────────▶ A in-factory ─┴→ consumption at A
```

**Pre-SMG products** (user, after S06; not built yet; R47, R48):
- a few products are inputs to SMGs: they are made on the same machine types, at A or B;
- they are **consumed at B** to make SMGs that are already in the mix. Their demand at B follows
  B's production of those SMGs;
- those made at A travel **A → B** on a separate truck lane with its own limits;
- quantities are much smaller than the SMGs'.
- Open: the ratio per SMG, storage at B, timing, and the demo data (see open-questions.md).

## Campaigns
- **Max campaign length:** one **global** limit, in **shifts**: max consecutive shifts of one product
  on a machine (personnel and quality).

## Planning
- **Input:** demand per product per week, and the **priorities** chosen for this run:
  least changeover time, least transport, balanced load, keep spare capacity.
- **Output (plan):**
  - lots per product per machine per week (→ quantity, shifts used, utilisation);
  - number of small/large line clears, and total line clear time per machine;
  - **transport:** units (and pallets) moved B → A;
  - stock level in pallets per storage location per month vs capacity;
  - trucks needed/used B → A;
  - later: shift-level sequence.
- Approach: [ADR 0003](decisions/0003-planning-engine.md). Explained to users on the site's **About page**.

## Not modelled (now)
- Finished goods, the next process step.
- Raw material availability. Truck scheduling beyond frequency × size.
