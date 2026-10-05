import { expect, test } from '@playwright/test';

test('the About page explains the solver, constraints and assumptions (R50)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/#about$/);
  await expect(page.getByTestId('about-solver')).toContainText('HiGHS');
  await expect(page.getByTestId('about-solver')).toContainText('within 1 % of the optimum, or after 6 s');
  await expect(page.getByTestId('about-constraints').locator('li')).toHaveCount(9);
  await expect(page.getByTestId('about-objective')).toContainText('Balanced load (8)');
  await expect(page.getByTestId('about-assumptions')).toContainText('No transit time');
  await page.screenshot({ path: 'test-results/screens/about.png', fullPage: true });
});
