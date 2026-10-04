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
