import { expect, test } from '@playwright/test';

test('solves a draft plan for the demo data in the browser', async ({ page }) => {
  await page.goto('/#plan');
  const summary = page.getByTestId('plan-summary');
  await expect(summary).toContainText('Optimal', { timeout: 20_000 });
  await expect(summary).toContainText('Unmet demand0 units');
  await expect(page.getByTestId('plan-row-B1')).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/plan.png', fullPage: true });

  // Demand beyond capacity shows up as unmet demand after a re-solve.
  await page.getByRole('link', { name: 'Demand' }).click();
  await page.getByLabel('P10 yearly demand').fill('8000000');
  await page.getByLabel('P10 yearly demand').press('Enter');
  await page.getByRole('link', { name: 'Plan' }).click();
  await expect(summary).toContainText('Optimal', { timeout: 20_000 });
  await expect(summary).not.toContainText('Unmet demand0 units');
});
