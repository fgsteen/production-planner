# Vision

## Purpose
A web-based production planner for a **manufacturing** operation. Given a **yearly forecast**, it
proposes how to distribute production across the machines at two sites, and visualises the plan:
machine load, changeover time and transport between sites.

## Context (from the user, S01)
- A **machine lineup** across **two geographical sites**; each site has different machines.
- A lineup of **semi-finished goods**. Each machine can produce its own list of goods, at its own
  **rate** and **OEE**.
- Machines are **self-contained**: raw material in → semi-finished good out. One step, one machine.
  Converting semi-finished goods into finished products is **out of scope** for now.
- Production happens in **lots** (one manufacturing order each). Changeovers: a **large line clear**
  between different products, and a faster **small line clear** between lots of the same product.
- **Site B** only produces semi-finished goods. **Site A** produces them too and hosts the next
  process step, so all demand lands at A and everything made at B is **transported B → A**.
- Some products can be made at both sites, some only at one.
- **Pre-SMG products** (after S06): a few products, made on the same machine types, are inputs
  consumed at **B** to make SMGs already in the mix. Those made at A are trucked **A → B** on their
  own lane. The quantities are much smaller than the SMGs' (R47, R48).
- Demand is a **yearly forecast** of required quantity **per product**.
- In reality there are **20–50 products** (after S05). Each product is a combination of three
  **characteristics** (X, Y, Z); not every combination exists. Tables and charts must stay usable
  at that scale, e.g. by grouping on a characteristic.
- Every chart and table can be **downloaded as an image** for presentations.
- When generating a plan, the user **chooses the priorities** (changeover time, transport, load balance, spare capacity).
- **High-quality graphics** (flow diagrams with numbers, charts) are a core goal.
- Hosted in the cloud, used through a URL; nothing to install.
- Planning granularity: **shifts**. 3 shifts/day, 7 days/week.

## Users
For now only the user (single user). It will be **shown in demos**. It is **not** an
enterprise system: no multi-tenant setup, no complex roles, no ERP integration.

## Goals (v1)
1. **Overview:** see which machines are at which site and which products each one can make.
2. **Forecast input:** enter how much of each category should be produced in a year.
3. **Suggested plan:** the system distributes the forecast across capable machines.
4. **Plan visualisation:** load per machine, total changeover time per machine, transport volume
   between sites, and so on.

## Non-goals (for now)
- Finished-goods production and multi-step routings.
- System integration (ERP etc.). The demo data uses generic names and fictional numbers. File
  exchange via **Excel** (template, import, export) *is* in scope (user, after S05).
- Enterprise features: user management, permissions, audit.
- Real-time shop-floor tracking.
