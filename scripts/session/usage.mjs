// Pure helpers for session stats: token usage from Claude Code transcripts
// (JSONL) and active-time estimation. No I/O here so it is easy to test.

const ZERO = () => ({
  input: 0,
  cacheWrite: 0,
  cacheRead: 0,
  output: 0,
  calls: 0,
});

/**
 * Parse JSONL text into assistant usage records.
 * Claude Code writes one line per content block, so the same message (and its
 * usage) appears several times - we dedupe on message id.
 */
export function parseUsageRecords(jsonlText) {
  const records = [];
  for (const line of jsonlText.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    const usage = rec?.message?.usage;
    if (rec.type !== 'assistant' || !usage || !rec.timestamp) continue;
    records.push({
      id: rec.message.id ?? rec.requestId ?? rec.uuid,
      timestamp: rec.timestamp,
      model: rec.message.model ?? 'unknown',
      usage,
    });
  }
  return records;
}

/** Collect every event timestamp (any record type) - used for active time. */
export function parseTimestamps(jsonlText) {
  const out = [];
  for (const line of jsonlText.split(/\r?\n/)) {
    const m = line.match(/"timestamp":"([^"]+)"/);
    if (m) out.push(m[1]);
  }
  return out;
}

/** Context size (input + cache read + cache write) of the most recent call, or 0. */
export function latestContext(records) {
  let last = null;
  for (const r of records) if (!last || r.timestamp > last.timestamp) last = r;
  const u = last?.usage ?? {};
  return (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
}

/** Sum usage of records inside [startMs, endMs], deduped by id, split per model. */
export function summarizeUsage(records, startMs, endMs) {
  const seen = new Set();
  const total = ZERO();
  const byModel = {};
  for (const r of records) {
    const t = Date.parse(r.timestamp);
    if (t < startMs || t > endMs || seen.has(r.id)) continue;
    seen.add(r.id);
    const m = (byModel[r.model] ??= ZERO());
    for (const bucket of [total, m]) {
      bucket.input += r.usage.input_tokens ?? 0;
      bucket.cacheWrite += r.usage.cache_creation_input_tokens ?? 0;
      bucket.cacheRead += r.usage.cache_read_input_tokens ?? 0;
      bucket.output += r.usage.output_tokens ?? 0;
      bucket.calls += 1;
    }
  }
  return { total, byModel };
}

/**
 * Active minutes: sum of gaps between consecutive events, ignoring gaps longer
 * than idleMinutes (user away). Complements git wall-clock time.
 */
export function activeMinutes(timestamps, startMs, endMs, idleMinutes = 10) {
  const ts = timestamps
    .map((t) => Date.parse(t))
    .filter((t) => t >= startMs && t <= endMs)
    .sort((a, b) => a - b);
  let ms = 0;
  for (let i = 1; i < ts.length; i++) {
    const gap = ts[i] - ts[i - 1];
    if (gap <= idleMinutes * 60_000) ms += gap;
  }
  return Math.round(ms / 60_000);
}

export const totalTokens = (u) => u.input + u.cacheWrite + u.cacheRead + u.output;

/** Latest timestamp within [startMs, endMs], in ms, or null. */
export function lastActivity(timestamps, startMs, endMs) {
  let last = null;
  for (const t of timestamps.map((x) => Date.parse(x))) {
    if (t >= startMs && t <= endMs && (last === null || t > last)) last = t;
  }
  return last;
}

/** Longest gap between consecutive timestamps in [startMs, endMs]: { minutes, fromMs, toMs }. */
export function longestGap(timestamps, startMs, endMs) {
  const ts = timestamps
    .map((t) => Date.parse(t))
    .filter((t) => t >= startMs && t <= endMs)
    .sort((a, b) => a - b);
  let best = { minutes: 0, fromMs: null, toMs: null };
  for (let i = 1; i < ts.length; i++) {
    const minutes = (ts[i] - ts[i - 1]) / 60_000;
    if (minutes > best.minutes) best = { minutes, fromMs: ts[i - 1], toMs: ts[i] };
  }
  return best;
}

const normPath = (p) =>
  p.replace(/\\/g, '/').replace(/^\/([a-z])\//i, '$1:/').toLowerCase().replace(/\/+$/, '');

/**
 * Keep only transcript lines whose `cwd` is `root`. Used for conversations opened in another
 * project folder that worked in this one (S10 ran from a conversation opened in `struktur`).
 */
export function linesInCwd(jsonlText, root) {
  const want = normPath(root);
  return jsonlText
    .split(/\r?\n/)
    .filter((line) => {
      const m = line.match(/"cwd":"((?:[^"\\]|\\.)*)"/);
      return m && normPath(JSON.parse(`"${m[1]}"`)) === want;
    })
    .join('\n');
}

/** Average context per model call (input + cache read + cache write), the main driver of cost. */
export function avgContext(t) {
  return t.calls ? Math.round((t.input + t.cacheRead + t.cacheWrite) / t.calls) : 0;
}

export function fmtTokens(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

/** Turn a cwd into Claude Code's transcript folder name (C:\a\b -> C--a-b). */
export function projectSlug(cwd) {
  return cwd.replace(/[^A-Za-z0-9]/g, '-');
}

/** Context per call at which to checkpoint and resume in a fresh conversation (ADR 0012). */
export const CONTEXT_LIMIT = 130_000;
