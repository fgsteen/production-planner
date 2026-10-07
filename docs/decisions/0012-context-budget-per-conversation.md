# 0012 — Context budget per conversation: checkpoint at 130k, resume fresh

- **Status:** accepted
- **Date:** 2026-10-07
- **Session:** between S10 and S11 (ways-of-working review)

## Context
Cost is roughly calls × context per call. A conversation starts at about 58k, almost all of it
Claude Code, connectors and skills; the project's own share is about 1k. S01–S10 grew to a median
of 115–216k per call. A numbered session doesn't have to be one conversation: the tooling sums
every transcript in the session's time window.

## Decision
- **The limit is 130k** (`CONTEXT_LIMIT` in `scripts/session/usage.mjs`).
  - `npm run session:status` prints the size of the latest call.
  - The project status line (`.claude/settings.json` → `scripts/session/statusline.mjs`) shows
    it live, where the client renders status lines.
- **At the limit,** finish the current step and commit. Then write a `## Checkpoint` in
  `SNN.md` (≤ 10 lines: done, next, open decisions, anything not committed) and commit it.
  Then open a fresh conversation in this folder and run `/session-start`, which resumes the
  open session from the checkpoint.
- **Fresh conversation over `/compact`:** the checkpoint is in git and reviewable, while a
  compaction summary is not.

## Consequences
- **Restarts cost about 60k once,** which a few calls at 130k+ easily pay back.
- **Checkpoints add a short handoff** inside a session. The session log template has a slot
  for it.
- **The 58k baseline remains.** Reducing it is a setting outside the repo: connectors and
  claude.ai skills switched off.

## Alternatives considered
- **`/compact` in place:** cheaper to do, but less control over what survives.
- **No limit:** S07 averaged 216k per call.
