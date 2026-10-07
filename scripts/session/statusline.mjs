#!/usr/bin/env node
// Claude Code status line: the current conversation's context size against the checkpoint
// limit (ADR 0012). Claude Code passes JSON with `transcript_path` on stdin.

import fs from 'node:fs';
import { CONTEXT_LIMIT, fmtTokens, latestContext, parseUsageRecords } from './usage.mjs';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let ctx = 0;
  try {
    const { transcript_path } = JSON.parse(input.replace(/^﻿/, ''));
    ctx = latestContext(parseUsageRecords(fs.readFileSync(transcript_path, 'utf8')));
  } catch {
    // No transcript yet: show 0.
  }
  const flag = ctx >= CONTEXT_LIMIT ? ' ⚠ checkpoint + fresh conversation' : '';
  console.log(`ctx ${fmtTokens(ctx)} / ${fmtTokens(CONTEXT_LIMIT)}${flag}`);
});
