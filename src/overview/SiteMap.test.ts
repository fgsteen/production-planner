import { describe, expect, it } from 'vitest';
import { seedDataset } from '../model/seed';
import { buildGraph } from './SiteMap';

describe('buildGraph', () => {
  it('gives every edge an inline stroke, so the PNG export keeps it (R45)', () => {
    const { edges } = buildGraph(seedDataset, new Map());
    expect(edges.filter((e) => e.id.startsWith('e-B1-'))).toHaveLength(1);
    for (const e of edges) expect(e.style?.stroke, e.id).toBeTruthy();
  });
});
