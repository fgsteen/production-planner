# Production Planner — working agreement

A web-based production planner, built in short numbered sessions, each with one agreed goal.
Docs are Markdown under `docs/`. Start at [docs/README.md](docs/README.md).

## Sessions
- **Start:** `/session-start`. **End:** `/session-end`. The steps are in `.claude/skills/`.
  Check `npm run session:status` now and then.
- **Scope:** one goal plus an ordered stretch list, agreed at the start. New ideas go to "Later"
  in `docs/NEXT_SESSION.md` unless the user OKs adding them.
- **Ask, don't assume:** ask product and design questions (behaviour, UX, data model,
  priorities) with AskUserQuestion. Pick sensible technical defaults yourself and mention them.
- **Where things go:** product facts go in `docs/vision.md` / `docs/requirements.md`.
  Significant technical choices get a new ADR in `docs/decisions/`. Non-urgent questions go in
  `docs/open-questions.md`. Solve times go in `docs/perf.md`.
- **Test what you build:** unit tests, a check in the browser pane, and e2e tests where they pay
  off. Report failures honestly.
- **Commit** in small steps. Stage explicit paths, never `git add -A`: the repo is also an
  Obsidian vault.

## Keep context small (tokens ≈ calls × context per call)
- Use `npm run test:quiet` mid-session. Grep or `sed -n` for the lines you need; don't dump
  whole files or logs.
- In the browser, prefer `read_page`/`get_page_text`. Take screenshots at `scale: 0.5` unless
  detail matters.
- Batch independent tool calls in one message.

## Conventions
- Docs in English, concise. Update an existing doc rather than creating a new one, and say each
  fact in one place.
- Session ids are `S01`, `S02`, …. The tooling parses commit subjects
  `session(SNN): start|end — …`, so don't use that prefix for other commits.
- Session tooling: `scripts/session/` (tested by `npm test`). Outside skills are adopted only
  after review, copied into `.claude/skills/` and recorded in an ADR.
