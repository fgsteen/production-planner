# Open questions

Answered questions move into the relevant doc (vision, domain, requirements, ADR) and are deleted here.

## Fairness vs total units met
A strict fair share (R64, ADR 0009) leaves 12 % more of total demand unmet at 2× demand than
maximising units met. Keep it strict, or add a "fairness" weight/slider that trades the equal share
against total units? User, S10: keep strict for now; revisit later.

## v2 replanner details (S11)
- **Autoplay:** should Run N / autoplay stop at an unfixable breach, or carry on and only list it?
- **Move (R81, R82):** prefer the same machine, or any capable machine? Default for now: the
  earliest valid slot on any capable machine, with the same machine winning ties.
