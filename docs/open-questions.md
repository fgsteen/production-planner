# Open questions

Answered questions move into the relevant doc (vision, domain, requirements, ADR) and are deleted here.

- **Transit time** (S05): goods shipped B → A arrive in the same week. Is that right, or should a
  truck take a day or more, so it ships a week earlier?
- **Whole pallets** (S05): the plan ships and stores fractional pallets. Does the plan need whole
  pallets or whole trucks? That needs integer variables and is slower.
- **Open days at A** (S05): demand counts all seven days of the week, minus A's holidays. Does A
  consume on weekends, or should only some weekdays count?
- **Excel and characteristics** (after S05): which dropdowns matter most in the template? Is it
  fine if a product is picked by its `X-Y-Z` name?
- **SFG with a pre-SFG made at A** (S07): the MILP consumes the pre-SFG wherever the SFG is
  made (at A it would come from A's stores). In the demo those SFGs are B-only. Should an SFG
  with a pre-SFG be allowed at A at all?
- **Initial stock in the demo** (S07): the demo starts with no stock, so week 1 is a crunch. Should
  the demo start with, say, half a week of demand in stock at A?
- **Bottleneck view** (after S07): what should it show when demand exceeds capacity? For example,
  the value of one more shift per machine, pallet of storage or truck per week (shadow prices), or
  a ranked "what limits the plan" list (R39). (Unmet demand itself: fair share, R64.)
