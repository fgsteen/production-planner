# Open questions

Answered questions move into the relevant doc (vision, domain, requirements, ADR) and are deleted here.

- **Default priorities** (S04, still open): with only "least machine time", the plan fills the
  faster A machines to 100 % and leaves B1 at about 4 %. It also runs the trucks at their limit in
  34 of 52 weeks. What should the default ranking be?
  - least line clears;
  - least transport;
  - balanced load;
  - spare capacity.
- **Transit time** (S05): goods shipped B → A arrive in the same week. Is that right, or should a
  truck take a day or more, so it ships a week earlier?
- **Whole pallets** (S05): the plan ships and stores fractional pallets. Does the plan need whole
  pallets or whole trucks? That needs integer variables and is slower.
- **Open days at A** (S05): demand counts all seven days of the week, minus A's holidays. Does A
  consume on weekends, or should only some weekdays count?
- **Grouping UX** (after S05, R44): what should the main way to handle many products be?
  - a "group by X / Y / Z" selector that sums the rows;
  - expandable groups (X → Y → Z);
  - a filter.
  Possibly a mix, per view.
- **Excel and characteristics** (after S05): which dropdowns matter most in the template? Is it
  fine if a product is picked by its `X-Y-Z` name?
- **Pre-SMG products** (after S06, R47): needed before building them.
  - Which SMGs consume which pre-SMG, and how much: units of pre-SMG per unit of SMG? Can one SMG
    use more than one pre-SMG?
  - Is there any other demand for pre-SMGs (e.g. at A), or only what B consumes?
  - Timing: must the pre-SMG be at B in the week before the SMG is made, or is the same week fine?
  - Storage at B: do trucked-in pre-SMGs go into the B warehouse (shared pallet capacity), or into a
    separate store?
  - Are pre-SMGs regular products with X-Y-Z characteristics, or a separate list?
  - Demo data: how many pre-SMGs (e.g. 2–3), and at what volume relative to the SMGs?
- **Truck lane A → B** (after S06, R48): default trucks per week and pallets per truck? Does it run
  on weekends and holidays?
