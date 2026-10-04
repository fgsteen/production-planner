import { expect, test } from '@playwright/test';

test.describe('overview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows both sites with their machines', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Production Planner' })).toBeVisible();
    for (const id of ['B1', 'B2', 'B3', 'B4']) await expect(page.getByTestId('site-B').getByTestId(`machine-${id}`)).toBeVisible();
    for (const id of ['A1', 'A2', 'A3', 'A4']) await expect(page.getByTestId('site-A').getByTestId(`machine-${id}`)).toBeVisible();
    await expect(page.getByTestId('machine-B1')).toContainText('SF-01 Alder');
    await expect(page.getByTestId('machine-B1')).toContainText('936/h'); // 1,200 × 78 %
  });

  test('draws the B → A network', async ({ page }) => {
    const map = page.getByTestId('site-map');
    await expect(map.locator('.react-flow__node-machine')).toHaveCount(8);
    await expect(map.locator('.react-flow__node-store')).toHaveCount(3);
    await expect(map.getByText('≤ 5 trucks/wk × 30 pallets')).toBeVisible();
    await expect(map.getByText('Next process step')).toBeVisible();
  });

  test('hovering a product dims machines that cannot make it', async ({ page }) => {
    await page.getByTestId('product-P07').hover(); // P07 runs on A1 and A2 only
    await expect(page.getByTestId('machine-A1')).toHaveCSS('opacity', '1');
    await expect(page.getByTestId('machine-A2')).toHaveCSS('opacity', '1');
    await expect(page.getByTestId('machine-B1')).toHaveCSS('opacity', '0.35');
    await page.screenshot({ path: 'test-results/screens/overview-hover.png', fullPage: true });
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`screenshot (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await expect(page.locator('.react-flow__edge')).not.toHaveCount(0);
      await page.screenshot({ path: `test-results/screens/overview-${scheme}.png`, fullPage: true });
    });
  }
});
