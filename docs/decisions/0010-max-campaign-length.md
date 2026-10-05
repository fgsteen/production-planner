# 0010 — Max campaign length: forced clean-downs, counted across weeks

- **Status:** accepted
- **Date:** 2026-10-05
- **Session:** S10

## Context
Settings hold one global max campaign length in shifts (R13; demo: 21, one week of 3 shifts × 7
days), but the plan ignored it (R19). With campaigns across weeks (ADR 0008), machine A3 ran one
product all year: a single campaign of 1,062 shifts. User, S10:
- past the max, the machine gets a **large line clear**, and the **same product may go on**;
- the length counts **all the campaign's shifts over the weeks it continues through**.

## Decision
**Model** (`src/plan/lp.ts`), per product × machine × week where the machine has time, on machines
with large > small clear and a max below the year's hours:
- `len[p,m,w] ∈ [0, Lmax]`: machine time of the campaign since its last large clear, at the end of
  week w (Lmax = max shifts × shift hours; small clears count, the large clear does not).
- `clean[p,m,w] ≥ 0`: forced clean-downs. Each resets Lmax of length and costs (large − small)
  hours of machine time and the line clear goal, just like a campaign start.
- `len[w] ≥ (1+f)·hours[w] − Lmax·clean[w]`, and if the run can continue from w−1,
  `len[w] ≥ (1+f)·hours[w] + len[w−1] − Lmax·clean[w] − Lmax·(1 − cont[w])`.
- `clean` is continuous, like the lot count. A fractional `cont` buys exactly as much slack as the
  same fraction of `clean` and costs the same, so the relaxation is consistent.
- Reported large clears and clear hours include the clean-downs.

**Solve** (`src/plan/solve.ts`). With `len` capped, the LPs with `cont` (step 2) were about 4×
slower: 19.6 s in total at 2× demand. The cap is lifted (`len` unbounded) in steps 1 and 2 and put
back for the fixed-run solve and the MIP.

## Consequences
- Demo, line clear weight 4: 1× takes 6.0 s with 625 large clears (629 before); 2× takes 13.1 s
  (10.1 s before), and unmet demand is unchanged.
- A product's shifts in one week are one block, as before. A block longer than the max gets
  clean-downs within the week, but their order within the week isn't planned.
- The warm start chooses runs without knowing the cap, so the final plan may pay clean-downs the
  runs could have avoided. The MIP can improve on it.

## Alternatives considered
- **Must switch product after the max:** rejected by the user. It also costs capacity on machines
  with one big product.
- **Cap the consecutive weeks with `cont`** (⌈max ÷ shifts per week⌉ + 1): simpler, but loose and not in
  shifts.
- **Binary clean-downs:** exact counts, but many more binaries for a weak relaxation.
