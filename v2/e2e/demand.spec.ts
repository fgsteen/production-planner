import { expect, test } from '@playwright/test';

test.describe('demand', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#demand');
  });

  test('demo demand passes the capacity check', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Demand 2027' })).toBeVisible();
    await expect(page.getByLabel('P01 yearly demand')).toHaveValue('2 800 000');
    await expect(page.getByLabel('P01 week 1', { exact: true })).toHaveValue('55 211'); // 2 800 000 × 7 / 355 open days at A in 2027
    await expect(page.getByLabel('P07 week 22', { exact: true })).toHaveValue('60 000'); // pinned summer peak
    await expect(page.getByTestId('demand-summary')).toContainText('Products short0');
    await expect(page.getByTestId('demand-summary')).toContainText('Machines over 100 %0');
    await page.screenshot({ path: 'test-results/screens/demand.png', fullPage: true });
  });

  test('pinning a week respreads the rest; too much demand is flagged', async ({ page }) => {
    // P10: 1 200 000 / year. Pin week 10 at 200 000 → over that week's max (~138k).
    await page.getByLabel('P10 week 10', { exact: true }).fill('200 000');
    await page.getByLabel('P10 week 10', { exact: true }).press('Enter');
    await expect(page.getByLabel('P10 week 1', { exact: true })).toHaveValue('20 115'); // 1 000 000 × 7 / (355 − 7)
    await expect(page.getByTestId('check-P10')).toContainText('peak in 1 wk');

    // Unpin it again by clearing the cell.
    await page.getByLabel('P10 week 10', { exact: true }).fill('');
    await page.getByLabel('P10 week 10', { exact: true }).press('Enter');
    await expect(page.getByLabel('P10 week 10', { exact: true })).toHaveValue('23 662'); // 1 200 000 × 7 / 355
    await expect(page.getByTestId('check-P10')).toContainText('ok');

    // More than the machines can make in a year.
    await page.getByLabel('P10 yearly demand').fill('8000000');
    await page.getByLabel('P10 yearly demand').press('Enter');
    await expect(page.getByTestId('check-P10')).toContainText('short');
    await expect(page.getByTestId('demand-summary')).toContainText('Products short1');
    await expect(page.getByTestId('load-A3')).toContainText(/1\d\d %/);

    // Pinned weeks above the yearly total are reported here, not only on the master data page.
    await page.getByLabel('P10 week 2', { exact: true }).fill('9000000');
    await page.getByLabel('P10 week 2', { exact: true }).press('Enter');
    await expect(page.getByTestId('demand-problems')).toContainText('Demand P10: weekly overrides (9000000) exceed the yearly total (8000000)');
    await page.getByLabel('P10 week 2', { exact: true }).fill('');
    await page.getByLabel('P10 week 2', { exact: true }).press('Enter');
    await expect(page.getByTestId('demand-problems')).toHaveCount(0);

    // Survives a reload.
    await page.reload();
    await expect(page.getByLabel('P10 yearly demand')).toHaveValue('8 000 000');
  });
});
