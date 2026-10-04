# Production Planner — working agreement

A web-based production planner, built in ~1-hour sessions with a clear goal each.
Documentation lives in Markdown under `docs/`. Start here: [docs/README.md](docs/README.md).

## Session protocol

**Start of session**
1. Read `docs/NEXT_SESSION.md` (the handoff from last session) and skim `docs/open-questions.md`.
2. Present the session plan before any work: the goal (one, sized for ~1 hour), what's in and
   out of scope, the first steps, and the pending questions. Put the questions to the user with
   AskUserQuestion (clickable options, not plain text), including what they want to add to the
   todo list, for this session or later. Agree on it.
3. Run `npm run session:start -- "<goal>"`. This creates `docs/sessions/SNN.md` and a start commit
   whose timestamp is the official start time.

**During the session**
- Ask the user (AskUserQuestion) about product/design decisions — what the system should do,
  UX, data model, priorities. Don't silently pick answers to product questions; do pick sensible
  technical defaults and mention them.
- Record answers: product facts → `docs/vision.md` / `docs/requirements.md`;
  significant technical or design choices → a new ADR in `docs/decisions/`.
  Questions that come up but aren't urgent → `docs/open-questions.md`.
- Test everything you build yourself: unit tests, run the app and check it in the browser pane
  (screenshots, clicking through flows), e2e tests where it pays off. Report failures honestly.
- Commit in small steps with clear messages.
- Check `npm run session:status` now and then; at ~50 min start wrapping up.

**End of session**
1. Run the full test suite (`npm test`) and note the result in the session log.
2. Fill in the session log `docs/sessions/SNN.md` (Log, Outcome).
3. Rewrite `docs/NEXT_SESSION.md`: state of things, the proposed next goal, concrete first steps,
   and any questions to put to the user.
4. Update `docs/requirements.md` statuses if features moved.
5. Run `npm run session:end` — computes wall/active time from git + token usage from Claude
   transcripts, updates `docs/sessions/STATS.md`, and makes the end commit.

## Conventions
- Docs in English, concise. Prefer updating an existing doc over creating a new one.
- Session ids: `S01`, `S02`, … Commit subjects `session(SNN): start|end — …` are parsed by the
  tooling — don't use that prefix for other commits.
- Session tooling: `scripts/session/` (tested by `npm test`).
