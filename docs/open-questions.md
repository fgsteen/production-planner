# Open questions

Answered questions move into the relevant doc (vision, domain, requirements, ADR) and are deleted here.

- **Initial stock** (S04): does the year start with stock on hand (per product, per location), or
  from zero? The plan and capacity check currently assume zero.
- **Default priorities** (S04): with only "least machine time", the plan fills the faster A machines
  to 100 % and leaves B1 at about 15 %. What should the default ranking be?
  - least line clears;
  - least transport;
  - balanced load;
  - spare capacity.
- **Demand in holiday weeks** (S04): the yearly total spreads evenly over all weeks, including
  Christmas week. Should the spread follow the days A actually consumes, e.g. its working days
  minus A's holidays?
- **Truck granularity** (S04): is a weekly cap (max trucks/week × pallets) enough, or must trucks be
  planned per day? Per-day planning would honour the weekend/holiday toggle exactly.
