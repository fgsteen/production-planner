# Next session

_Written at the end of S10 (2026-10-04). Reshaped on 2026-10-07 for the new workflow
([ADR 0011](decisions/0011-session-skills-and-lean-docs.md))._

Start with `/session-start`. The overall state lives in [README.md](README.md) (pages, code map)
and [requirements.md](requirements.md) (what's done).

## Changed in S10
- **Plan page:** "What limits the plan" (R39), the line clears per machine panel (R65), and
  group-by X/Y/Z in every plan view (R44 done).
- **About page** (R50): the solver, model, constraints, goals and assumptions.
- **Max campaign length** (R19, [ADR 0010](decisions/0010-max-campaign-length.md)): past the max
  comes a forced large clear, and the same product may go on.
- **Overview:** the map's PNG export keeps the machine → store lines.
- **Tests:** `npm test` green. That's 7 tooling tests, typecheck, 87 unit tests and 26 e2e tests.
- **Since S10 (ways of working):**
  - session skills;
  - a lean log template;
  - `npm run test:quiet`;
  - [perf.md](perf.md);
  - a Ctx/call column in STATS;
  - a 130k context limit per conversation, with a checkpoint and a fresh conversation
    ([ADR 0012](decisions/0012-context-budget-per-conversation.md)). The status line shows the
    size.

## Known weak spots
1. **Solve time at 2×** is 13.1 s, against a 6 s target. The relax LP alone takes 5–6 s and
   step 2 about 5 s. See [perf.md](perf.md).
2. **Clean-downs are continuous,** so reported large clears can be fractional (e.g. 16.4). The
   warm start picks runs without the campaign cap.
3. **Fairness costs units:** at 2×, 36 % of demand is unmet, against 24 % before R64. Levelling
   is exact only for the worst group.
4. **The MIP stage rarely improves the start,** and the gap shows as "not proven".
5. **Group-by is per panel.** A page-wide selector may be nicer.

## Proposed goal for S11
**Goal:** Excel export and import of master data (R60–R63):
- ExcelJS, lazy-loaded, recorded in an ADR;
- export first, with a round-trip test;
- import with per-row errors on the Master data page.

**Stretch:** a template with dropdowns where the choices are fixed (e.g. factory location).

**Alternative goal:** solve time at 2× (weak spot 1).

### First steps
1. ADR for ExcelJS: bundle size, lazy-loading like HiGHS, sheet layout per master-data table.
2. Export, plus a round-trip test (export → import gives the same dataset).
3. Import with per-row errors.

### Questions for the user
- **Excel:** one workbook with a sheet per table, or one per area? Should demand be in the same
  file?
- **Group-by:** one selector per panel, or one for the whole Plan page?
- **2× solve time:** is 13 s acceptable for overloaded what-ifs, or should S11 work on it first?

## Later (rough order, to confirm with the user)
- **Excel (R60–R63)**, if not S11.
- **Visualisation (R30, R33, R37, R38):** Sankey, utilisation heatmap.
- **Features:**
  - shift-level timeline (R34);
  - compare plans (R25);
  - transit time (much later, user S09).
- **Fairness slider** (open question), if the user wants it.
- **Outside skills:** review 1–2 (e.g. TDD, ADRs) and adopt them per ADR 0011.
