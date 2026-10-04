// Categorical colours for products (Tableau 10), stable by product order.
const PRODUCT_COLORS = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#8cd17d'];

export function productColor(index: number): string {
  return PRODUCT_COLORS[index % PRODUCT_COLORS.length];
}

export const siteColor = (siteId: string) => (siteId === 'B' ? 'var(--site-b)' : 'var(--site-a)');

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const fmt = (n: number) => nf.format(n);
