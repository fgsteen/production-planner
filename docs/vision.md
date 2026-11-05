# Vision

_v2, from S11. v1 (two sites, yearly plan, S01–S10) is documented at git tag `v1-yearly` and served at
`/v1/`._

## Purpose
A planner for **one factory** that keeps every product's stock between a **min** and a **max**.
It simulates time one shift at a time. At each step it updates stock from what was made and used,
projects the next 3 days and **corrects the schedule with as few changes as possible**. A timeline
shows what changed and why. See [ADR 0013](decisions/0013-v2-rolling-simulation.md) and R70–R90.

## Context (from the user)
- **Machines** each make their own list of **semi-finished goods**, at their own **rate** and
  **OEE**. A machine is self-contained: raw material in, product out.
- Production happens in **lots** of one shift each. A **large line clear** is needed when the
  product changes, and a faster **small line clear** between lots of the same product.
- There are **20–50 products** in reality. Each is a combination of three **characteristics**
  (X, Y, Z), so tables must stay usable at that scale, e.g. by grouping on a characteristic.
- **Usage** draws products from stock every shift. It fluctuates in reality: a constant for now,
  with seeded random variation and replayed real data later.
- The schedule must be **stable**: change as few runs as possible, and never the shift about to
  run.
- Hosted in the cloud, used through a URL; nothing to install. **High-quality graphics** matter.
- Granularity: **shifts** of 8 h, 3 per day, 7 days a week.

## Users
For now only the user (single user). It will be **shown in demos**. It is **not** an enterprise
system: no multi-tenant setup, no complex roles, no ERP integration.

## Goals (v2)
1. **Master data:** machines, products, capabilities, and min/max/initial stock/usage per product.
2. **Simulate:** step one shift at a time, or several at once, and reset to the start.
3. **Replan:** keep projected stock inside min/max over the next 9 shifts with minimal changes,
   with each change explained.
4. **Visualise:** a machine × shift timeline coloured by change, plus stock and change tables.

## Non-goals (for now)
- Multiple sites, transport, storage locations, yearly or weekly demand.
- Finished-goods production and multi-step routings.
- System integration (ERP etc.). The demo data uses generic names and fictional numbers.
- Enterprise features: user management, permissions, audit.
- Real-time shop-floor tracking. Machine breakdowns are not simulated (yet).
