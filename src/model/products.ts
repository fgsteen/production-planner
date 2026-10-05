// Product characteristics (R17): each product is one X-Y-Z combination, named after it by default.
import type { Characteristic, Dataset, Id, Product } from './types';

/** The variant names joined as `X-Y-Z`; `?` for a characteristic without a (known) variant. */
export function combinationName(characteristics: Characteristic[], variants: Record<Id, Id>): string {
  return characteristics.map((c) => c.variants.find((v) => v.id === variants[c.id])?.name ?? '?').join('-');
}

/** The custom name if set, else the combination. */
export function productName(ds: Pick<Dataset, 'characteristics'>, p: Product): string {
  return p.name.trim() || combinationName(ds.characteristics, p.variants);
}

/** Display name per product id. */
export function productNames(ds: Pick<Dataset, 'characteristics' | 'products'>): Map<Id, string> {
  return new Map(ds.products.map((p) => [p.id, productName(ds, p)]));
}

/** Stable key of a product's combination, for duplicate checks. */
export const combinationKey = (characteristics: Characteristic[], variants: Record<Id, Id>) =>
  characteristics.map((c) => variants[c.id] ?? '').join('|');

/** All combinations in characteristic order (first characteristic varies slowest). */
function* combinations(characteristics: Characteristic[]): Generator<Record<Id, Id>> {
  const [first, ...rest] = characteristics;
  if (!first) {
    yield {};
    return;
  }
  for (const v of first.variants) for (const tail of combinations(rest)) yield { [first.id]: v.id, ...tail };
}

/** The first combination no product in `products` uses, or `null` if all are taken. */
export function firstFreeCombination(characteristics: Characteristic[], products: Pick<Product, 'variants'>[]): Record<Id, Id> | null {
  const taken = new Set(products.map((p) => combinationKey(characteristics, p.variants)));
  for (const combo of combinations(characteristics)) if (!taken.has(combinationKey(characteristics, combo))) return combo;
  return null;
}

/** A column or row of a grouped view (R44): one product, or all products sharing a variant. */
export interface ProductGroup {
  key: Id;
  label: string;
  productIds: Id[];
  /** Index for the colour: the product's, or the variant's within its characteristic. */
  colorIndex: number;
}

/** Product id → its group, for summing per-product values into groups. */
export function groupOf(groups: ProductGroup[]): Map<Id, ProductGroup> {
  return new Map(groups.flatMap((g) => g.productIds.map((id) => [id, g] as const)));
}

/** Sums `[productId, value]` pairs per group, in group order; groups without a value are left out. */
export function sumByGroup(groups: ProductGroup[], values: Iterable<readonly [Id, number]>): [ProductGroup, number][] {
  const of = groupOf(groups);
  const sums = new Map<Id, number>();
  for (const [id, v] of values) {
    const g = of.get(id);
    if (g) sums.set(g.key, (sums.get(g.key) ?? 0) + v);
  }
  return groups.flatMap((g) => (sums.has(g.key) ? [[g, sums.get(g.key)!] as [ProductGroup, number]] : []));
}

/**
 * Groups `products` by the variant of characteristic `by`; `null` gives one group per product.
 * Groups follow the variant order and skip variants no product uses.
 */
export function groupProducts(ds: Pick<Dataset, 'characteristics' | 'products'>, products: Product[], by: Id | null): ProductGroup[] {
  const index = new Map(ds.products.map((p, i) => [p.id, i]));
  const c = by ? ds.characteristics.find((x) => x.id === by) : undefined;
  if (!c) return products.map((p) => ({ key: p.id, label: productName(ds, p), productIds: [p.id], colorIndex: index.get(p.id) ?? 0 }));
  return c.variants.flatMap((v, i) => {
    const ids = products.filter((p) => p.variants[c.id] === v.id).map((p) => p.id);
    return ids.length ? [{ key: v.id, label: `${c.name} ${v.name}`, productIds: ids, colorIndex: i }] : [];
  });
}
