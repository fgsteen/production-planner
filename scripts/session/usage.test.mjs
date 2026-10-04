import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activeMinutes,
  fmtTokens,
  parseUsageRecords,
  projectSlug,
  summarizeUsage,
  totalTokens,
} from './usage.mjs';

const line = (id, ts, usage, model = 'claude-opus-5-5') =>
  JSON.stringify({ type: 'assistant', timestamp: ts, message: { id, model, usage } });

const U = { input_tokens: 2, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 50 };

test('dedupes repeated lines of the same message', () => {
  const text = [line('m1', '2026-10-04T10:00:00Z', U), line('m1', '2026-10-04T10:00:01Z', U), 'not json', ''].join('\n');
  const recs = parseUsageRecords(text);
  const { total } = summarizeUsage(recs, 0, Infinity);
  assert.equal(total.calls, 1);
  assert.equal(totalTokens(total), 1152);
});

test('only counts records inside the session window, split per model', () => {
  const text = [
    line('a', '2026-10-04T09:00:00Z', U),
    line('b', '2026-10-04T10:30:00Z', U),
    line('c', '2026-10-04T10:45:00Z', U, 'claude-haiku-4-5'),
    line('d', '2026-10-04T12:00:00Z', U),
  ].join('\n');
  const { total, byModel } = summarizeUsage(
    parseUsageRecords(text),
    Date.parse('2026-10-04T10:00:00Z'),
    Date.parse('2026-10-04T11:00:00Z'),
  );
  assert.equal(total.calls, 2);
  assert.deepEqual(Object.keys(byModel).sort(), ['claude-haiku-4-5', 'claude-opus-5-5']);
});

test('ignores user records and records without usage', () => {
  const text = [
    JSON.stringify({ type: 'user', timestamp: '2026-10-04T10:00:00Z', message: { content: 'hi' } }),
    JSON.stringify({ type: 'assistant', timestamp: '2026-10-04T10:00:00Z', message: { id: 'x' } }),
  ].join('\n');
  assert.equal(parseUsageRecords(text).length, 0);
});

test('active minutes skip idle gaps', () => {
  const ts = ['10:00', '10:05', '10:08', '11:00', '11:02'].map((t) => `2026-10-04T${t}:00Z`);
  // 5 + 3 counted, 52 idle skipped, 2 counted
  assert.equal(activeMinutes(ts, 0, Infinity, 10), 10);
});

test('formatting and slug', () => {
  assert.equal(fmtTokens(950), '950');
  assert.equal(fmtTokens(12_345), '12.3k');
  assert.equal(fmtTokens(2_500_000), '2.50M');
  assert.equal(projectSlug('C:\\Users\\me\\code\\production-planner'), 'C--Users-me-code-production-planner');
});
