---
name: session-start
description: Start a numbered work session in production-planner. Use when the user says to start or begin the (next) session.
---

# Start a session

1. **Read, don't explore.** Read `docs/NEXT_SESSION.md` and `docs/open-questions.md`. Open other
   docs or code only if the plan depends on them.
2. **Present the plan** in at most ~15 lines:
   - **Goal:** one, sized for ~45 min of active work. Sessions S01–S10 ran 7–43 active minutes.
   - **Stretch:** an ordered list, done only once the goal is done.
   - **Out of scope.**
   - **First steps:** 2–4.
3. **Ask with AskUserQuestion**, one call with up to 4 questions:
   - accept the goal and stretch, or change them;
   - the pending product questions from the handoff;
   - what to add to the todo list, for this session or later.
4. **Run** `npm run session:start -- "<goal>"`. It refuses if a session is still open; end that
   one first with `/session-end`.
5. **Fill the Scope section** of the new `docs/sessions/SNN.md` with the agreed goal, stretch and
   out-of-scope items. Add todo items for later to the "Later" list in `docs/NEXT_SESSION.md`.
   Commit only those two files.

## Scope rule
Anything new that comes up mid-session goes under "Later" in the handoff. It only joins the
session if the user OKs it. If so, log it under "Added mid-session".
