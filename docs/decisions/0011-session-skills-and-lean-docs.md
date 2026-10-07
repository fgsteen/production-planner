# 0011 — Session protocol as project skills, lean session docs, token hygiene

- **Status:** accepted
- **Date:** 2026-10-07
- **Session:** between S10 and S11 (ways-of-working review)

## Context
A review of S01–S10 found these problems:
- **Tokens:** 98 % were cache reads. Total ≈ calls × context per call. Context started at about
  58k and reached a median of 115–216k per call: test output, file dumps and screenshots pile up.
- **CLAUDE.md:** the start/end protocol sat in CLAUDE.md, so it was loaded on every call.
- **Session logs:** 50–90 lines each, retelling the commits and requirements.
- **Scope:** sessions ran 7–43 active minutes, and the scope often grew mid-session.
- **Stats:** S10's end ran 7 h after the work stopped, so its wall time was 441 min against 30
  active.

The user is also considering adopting skills written by others.

## Decision
- **Session skills:** `/session-start` and `/session-end` hold the protocol, in
  `.claude/skills/`. CLAUDE.md keeps only the rules that always apply.
- **Scope:** one goal plus an ordered stretch list, agreed at the start. New ideas go to
  "Later" in the handoff unless the user OKs them, and are then logged as "Added mid-session".
- **Session log template:** Scope / Decisions / Built / Found / Outcome, ≤ 30 lines, linking
  commits and requirements instead of retelling them.
- **Handoff:** NEXT_SESSION.md covers only what changed since the last session, plus weak spots,
  the next goal, first steps, questions and a "Later" list.
- **Solve times:** recorded in `docs/perf.md`.
- **Tooling:**
  - `npm run test:quiet` for mid-session runs;
  - STATS shows context per call;
  - `session:end` refuses an end more than 30 min after the last activity unless given
    `--at`/`--now`, and stages only `docs`, `CLAUDE.md` and `.claude/skills`.
- **Outside skills:** adopted one by one after reading them. Each is copied into
  `.claude/skills/` (reviewable, versioned with the repo) and recorded in an ADR. Whole plugin
  bundles are avoided: every installed skill's description, and any session-start hook, costs
  context on every call.
- **Past docs:** only structure is aligned. The requirements Source column is normalised,
  ADR 0001 is marked refined, NEXT_SESSION is reshaped, and perf.md is backfilled from S04–S10.
  The S01–S10 logs keep their old Plan/Log/Outcome format, and ADRs are never rewritten.

## Consequences
- **Less context per call:** CLAUDE.md is smaller, and the protocol text loads only at the start
  and end.
- **Easy to compare:** the Ctx/call column shows whether this works.
- **Two log formats:** S01–S10 keep the old one, and S11 onwards use the new one.
- **Transcripts can disappear:** S10's transcript was no longer on disk two days later. Stats
  must therefore be measured at `session:end`; they can't be redone later.

## Alternatives considered
- **Install a large skill bundle** (e.g. a community "agent protocols" plugin with 25 skills, 9
  agents and a session-start hook). Rejected: it adds context on every call and overlaps with
  this protocol.
- **Rewrite S01–S10 into the new format.** Rejected: it costs tokens, and the logs are history
  that is rarely read.
