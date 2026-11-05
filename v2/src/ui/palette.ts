// Categorical colours for products, stable by product order: Tableau 10, then the lighter and
// darker companions from Tableau 20, so the 20-product demo has no repeats.
const PRODUCT_COLORS = [
  '#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#8cd17d',
  '#a0cbe8', '#ffbe7d', '#499894', '#f1ce63', '#d4a6c8', '#b6992d', '#86bcb6', '#d37295', '#d7b5a6', '#79706e',
];

export function productColor(index: number): string {
  return PRODUCT_COLORS[index % PRODUCT_COLORS.length];
}

export const siteColor = (siteId: string) => (siteId === 'B' ? 'var(--site-b)' : 'var(--site-a)');

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const fmt = (n: number) => nf.format(n);
