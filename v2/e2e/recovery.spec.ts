import { expect, test } from '@playwright/test';

test('saved data that crashes the app can be reset', async ({ page }) => {
  // Structurally a v2 dataset, but a machine entry is null: rendering it throws.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const broken = { version: 2, settings: {}, characteristics: [], machines: [null], products: [], capabilities: [], schedule: [] };
    localStorage.setItem('production-planner/dataset/v2', JSON.stringify(broken));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download saved data' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset to demo data' }).click();
  await expect(page.getByTestId('cap-row-M1-P01')).toBeVisible();
  await expect(page.getByText('Demo data', { exact: true })).toBeVisible();
});
