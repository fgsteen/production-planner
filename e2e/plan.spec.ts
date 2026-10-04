import { expect, test } from '@playwright/test';

test('solves a draft plan for the demo data in the browser', async ({ page }) => {
  await page.goto('/#plan');
  const summary = page.getByTestId('plan-summary');
  await expect(summary).toContainText('Gap to optimum', { timeout: 30_000 });
  await expect(summary).toContainText('Unmet demand0 units');
  await expect(page.getByTestId('plan-row-B1')).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/plan.png', fullPage: true });

  // Demand beyond capacity shows up as unmet demand after a re-solve.
  await page.getByRole('link', { name: 'Demand' }).click();
  await page.getByLabel('P10 yearly demand').fill('8000000');
  await page.getByLabel('P10 yearly demand').press('Enter');
  await page.getByRole('link', { name: 'Plan' }).click();
  await expect(summary).toContainText('Gap to optimum', { timeout: 30_000 });
  await expect(summary).not.toContainText('Unmet demand0 units');
});

test('shows the weekly machine plan and the B → A transport breakdown', async ({ page }) => {
  await page.goto('/#plan');
  await expect(page.getByTestId('plan-summary')).toContainText('Gap to optimum', { timeout: 30_000 });

  // R42: one row per machine; the table view lists the weeks of the chosen machine.
  const weekly = page.getByTestId('machine-week-plan');
  await expect(weekly.getByTestId('machine-week-A1')).toContainText('% used');
  await weekly.getByRole('button', { name: 'Table' }).click();
  await weekly.getByRole('combobox', { name: 'Machine' }).selectOption('B2');
  await expect(weekly.getByTestId('machine-week-table').locator('tbody tr')).toHaveCount(52);

  // R43: trucks used vs the limit per week; Midsummer (Thu 24 June, week 25) costs A one weekday.
  const transport = page.getByTestId('transport-B-A');
  await expect(transport.getByTestId('transport-week-1')).toContainText('/ 10');
  await expect(transport.getByTestId('transport-week-25')).toContainText('/ 8');
  await transport.getByRole('button', { name: 'Units' }).click();
  await expect(transport.getByTestId('transport-summary')).toContainText('Units shipped');
  await transport.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/screens/plan-details.png', fullPage: true });
});

test('initial stock is editable and counted in pallets against capacity', async ({ page }) => {
  await page.goto('/#data');
  await page.getByRole('tab', { name: 'Initial stock' }).click();
  // P07: 48 units/crate × 32 crates/pallet = 1536 units/pallet → 100,000 units = 65.1 → 66 pallets.
  const cell = page.getByLabel('P07 initial stock at A-IF');
  await cell.fill('100000');
  await cell.press('Enter');
  await expect(page.getByText('66 / 250')).toBeVisible();

  await page.getByRole('link', { name: 'Plan' }).click();
  await expect(page.getByTestId('plan-summary')).toContainText('Gap to optimum', { timeout: 30_000 });
  await expect(page.getByTestId('plan-summary')).toContainText('Unmet demand0 units');
});

test('priorities, line clears, warehouses and group-by (R22, R31, R44, R46, R48)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/#plan');
  const summary = page.getByTestId('plan-summary');
  await expect(summary).toContainText('Gap to optimum', { timeout: 30_000 });
  await expect(summary).toContainText('Unmet demand0 units');
  await expect(summary).toContainText('Trucks A → B');
  await expect(page.getByTestId('line-clears-A1')).toContainText(/\d+ \/ \d+/);
  await expect(page.getByTestId('transport-A-B')).toBeVisible();

  // R46: one section per storage location.
  const warehouses = page.getByTestId('warehouse-panel');
  await expect(warehouses.getByTestId('warehouse-B-local')).toContainText('B warehouse');
  await expect(warehouses.getByTestId('warehouse-A-inbound')).toContainText('A warehouse');
  await warehouses.getByRole('button', { name: 'Table' }).click();
  await expect(warehouses.getByTestId('warehouse-table')).toBeVisible();

  // R44: group the shifts table by X.
  await page.getByLabel('Group by').first().selectOption('X');
  await expect(page.getByTestId('plan-table').locator('thead')).toContainText('X K');

  // R22: a weight change is saved and re-solved; demand stays met, and a higher line clear weight
  // gives less line clear time (ADR 0008).
  const clearHours = async (weight: string) => {
    await page.getByLabel('Few line clears weight').fill(weight);
    await expect(page.getByTestId('plan-status')).toContainText('Solving', { timeout: 5_000 });
    await expect(summary).toContainText('Gap to optimum', { timeout: 30_000 });
    await expect(summary).toContainText('Unmet demand0 units');
    return Number((await summary.locator('div', { hasText: 'Line clear hours' }).locator('dd').innerText()).replace(/\D/g, ''));
  };
  const loose = await clearHours('0');
  const strict = await clearHours('10');
  expect(strict).toBeLessThan(loose * 0.95);
  await expect(page.getByTestId('priorities')).toContainText('10');
  await page.reload();
  await expect(page.getByLabel('Few line clears weight')).toHaveValue('10');
});

test('shows solve progress, cancels, and re-solves on the next change', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/#plan');
  const status = page.getByTestId('plan-status');
  await expect(status).toContainText(/step \d of 3/, { timeout: 10_000 });
  await status.getByRole('button', { name: 'Cancel' }).click();
  await expect(status).toContainText('Solve cancelled');
  await page.getByLabel('Few line clears weight').fill('5');
  await expect(page.getByTestId('plan-summary')).toContainText('Gap to optimum', { timeout: 30_000 });
});
