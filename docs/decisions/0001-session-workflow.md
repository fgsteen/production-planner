# 0001 — Session-based workflow with git-timed sessions

- **Status:** accepted
- **Date:** 2026-10-04
- **Session:** S01

## Context
The project is built together with Claude in short working sessions. We want each session to
have a clear goal, a clean handoff to the next one, and measurable cost (time and tokens).

## Decision
- Sessions of ~1 hour with one agreed goal; protocol in `CLAUDE.md`.
- Documentation as Markdown in `docs/`; `docs/NEXT_SESSION.md` is the handoff.
- Session start/end are marked by git commits (`session(SNN): start|end — …`). Their commit
  timestamps define wall time.
- Token usage is summed from Claude Code's local transcripts
  (`~/.claude/projects/<project-slug>/**/*.jsonl`) for all model calls between start and end,
  deduped per message, including subagents. Active time is estimated from transcript activity,
  excluding idle gaps > 10 min.
- Results are stored in `docs/sessions/stats.json` and rendered to `docs/sessions/STATS.md`.

## Consequences
- Stats are reproducible from git + transcripts; no manual bookkeeping.
- Token counts only cover Claude Code sessions run on this machine in this folder. Override the
  transcript location with `CLAUDE_TRANSCRIPTS_DIR` if needed.
- Two Claude sessions running in the folder at the same time would both be counted.

## Alternatives considered
- Manual time logging — error-prone, easily forgotten.
- Usage from the Anthropic console — not per-session, not per-project.
