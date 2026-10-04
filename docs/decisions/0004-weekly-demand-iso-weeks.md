# 0004 — Weekly time grid (ISO weeks) and demand as a yearly total with pinned weeks

- **Status:** accepted
- **Date:** 2026-10-04
- **Session:** S04

## Context
R20/R26 asked for a yearly forecast per product with an optional monthly split. In S04 the user
chose a **weekly** split instead, using **week numbering as in Sweden** (ISO 8601). Holidays and
maintenance were already decided to recur yearly (`MM-DD`, S03).

## Decision
- **Planning year = ISO week-year** `settings.planningYear`: Monday of week 1 (the week holding the
  year's first Thursday) to Sunday of week 52/53. 2027 runs 2027-01-04 … 2028-01-02 (52 weeks).
  Days outside the calendar year still count as part of their week.
- **Demand** (`Dataset.demand`): per product a `yearlyUnits` total plus `weekOverrides`
  (week number → units). Without overrides the total spreads evenly over all weeks. Pinned weeks
  keep their value; the rest of the total spreads evenly over the unpinned weeks.
  *S05: the spread now follows the demand site's open days, so holiday weeks get less
  ([ADR 0005](0005-storage-pools-and-weekly-trucks.md)).*
  Validation: pins may not exceed the total; if every week is pinned they must sum to it.
- **Units:** demand is in units (pieces), like machine rates.
- **Holidays/maintenance** are stored as `MM-DD` and matched on month-day, so a week spanning New
  Year uses both years' holidays. `02-29` only applies in leap years. Older files with
  `YYYY-MM-DD` are upgraded on load/import by dropping the year.
- **Capacity check (R35), before any solver:** per product and week, max output = sum over capable
  machines of available hours × rate × OEE. Flags weeks over that max ("build stock earlier") and a
  **shortfall** = max over weeks of (cumulative demand − cumulative max), i.e. what can't be made
  even building ahead from week 1. Machine load is an estimate: weekly demand split across capable
  machines in proportion to their output. No line clears yet.
- The solver (ADR 0003) will use **weeks as periods** instead of months.

## Consequences
- 52/53 periods instead of 12: a bigger LP, still small for HiGHS (10 products × 8 machines × 52).
- Monthly reports (R37) become weekly or are aggregated from weeks.
- Changing the planning year between 52- and 53-week years can leave a week-53 pin invalid;
  validation reports it.

## Alternatives considered
- Monthly split (original R26): user preferred weeks.
- Clipping weeks to the calendar year: partial weeks at both ends complicate capacity and trucks.
- Requiring all 52 weekly values: tedious; pins on top of an even spread cover the common case.
