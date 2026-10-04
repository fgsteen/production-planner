# Open questions

Answered questions move into the relevant doc (vision, domain, requirements, ADR) and are deleted here.

- **Holidays/maintenance vs planning year (S03).** Dates are absolute (`2027-12-25`). If the user
  changes the planning year to 2028, the 2027 dates stop counting. Options: keep absolute dates
  (user re-enters them per year); store recurring holidays as month-day; or offer "shift all dates
  to the new year" when the year changes.
- **Adding/removing sites and truck lanes (S03).** The editor only edits the two sites and the one
  B → A lane. Is the B/A network fixed for this tool, or should it support more sites/lanes?
