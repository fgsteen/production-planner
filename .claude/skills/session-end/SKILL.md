---
name: session-end
description: Wrap up and close the open production-planner work session (tests, log, handoff, stats). Use when the user says to end, close or wrap up the session, or when session:status says time is nearly used.
---

# End a session

Do the steps in order. Keep every doc short and say each thing in one place.

1. **Tests.** Run `npm run test:quiet`, the full suite with short output. If it fails, report
   the failures honestly. Don't hide or skip tests to make it pass.
2. **Session log** `docs/sessions/SNN.md`. Fill the template sections and keep the log to
   ≤ 30 lines.
   - Link to commits, ADRs and requirement IDs instead of retelling them.
   - **Decisions:** what the user decided and where it's recorded.
   - **Found:** bugs and surprises.
   - **Outcome:** the goal and stretch items done vs. not done, and the test counts.
3. **Measurements.** If solve times were measured, add a row to `docs/perf.md`.
4. **Requirements.** Update the statuses in `docs/requirements.md`. A new requirement's
   Source is the session that agreed it (`SNN`).
5. **Rewrite `docs/NEXT_SESSION.md`** with these sections:
   - **Changed in SNN:** only what changed. The overall state lives in README and requirements.
   - **Known weak spots.**
   - **Proposed goal + stretch.**
   - **First steps.**
   - **Questions for the user.**
   - **Later:** the todo list, in rough order.

   The date at the top is the session's date.
6. **Close.** Run `npm run session:end`. It notes long pauses in STATS by itself. It stages only
   `docs`, `CLAUDE.md` and `.claude/skills`, so commit anything else first.
7. **Report** the outcome, the tests and the stats to the user in ≤ 10 lines.
