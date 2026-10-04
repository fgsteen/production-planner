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
