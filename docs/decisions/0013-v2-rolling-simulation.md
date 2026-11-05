# 0013 — v2: one factory, rolling shift simulation, greedy replanner

- **Status:** accepted
- **Date:** 2026-11-05
- **Session:** S11 (planning only)

## Context
New information from the user: the business needs a **dynamic** system, not a yearly plan. Stock
is kept between a **min** and a **max** per product. Time is stepped forward one shift at a time,
and the schedule is corrected with as few changes as possible. Transport between sites isn't
needed. v1 (two sites, trucks, yearly MILP) stays available but is no longer developed.

## Decision
- **Keep v1, build v2 next to it.** Tag `v1-yearly` on the last v1 commit. Copy the app into a
  `v2/` folder in this repo and rework the copy. The root app stays as v1 and gets no further
  work.
- **Deploy:** v2 at the Pages root, v1 at `/v1/`. Both are built by the one workflow.
- **Same stack** as v1 (React, Vite, TypeScript, Vitest, Playwright; [ADR 0002](0002-stack.md)).
  The session tooling and docs stay at the repo root.
- **Replanner:** a deterministic **greedy heuristic**, not the v1 MILP (HiGHS). It's fast and
  every change can be explained in one line, and "as few changes as possible" maps to a fixed
  preference order (see requirements R80–R83). A solver can come later if the heuristic falls
  short.
- **Simulation core is pure functions:** `step(state, usageModel) → { state, changes, warnings }`.
  It's unit-tested without the UI. Usage sits behind an interface so that constant, seeded random
  and replayed-file models can plug in.

## Consequences
- **Duplicated code** between the root and `v2/` until v1 is retired. Fixes to v1 are not planned.
- **v1-only parts are deleted from v2:** sites, trucks, storage, pallets, demand, HiGHS, the
  Overview map and Sankey.
- **The live URL switches to v2** once its first build ships. v1 users need the `/v1/` link.
