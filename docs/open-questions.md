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
- **Characteristics and the model** (after S05): do the characteristics mean anything to the
  planner?
  - Is a line clear between products of the same X (or Y) smaller?
  - Can a machine make all products of one X, so capabilities could be entered per characteristic?
  - Does demand get entered per group?
- **Excel and characteristics** (after S05): which dropdowns matter most in the template? Is it
  fine if a product is picked by its `X-Y-Z` name?
