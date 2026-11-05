import { expect, test } from '@playwright/test';

test('the About page explains the rolling simulation and the replanner (R90)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/#about$/);
  await expect(page.getByTestId('about-loop').locator('li')).toHaveCount(5);
  await expect(page.getByTestId('about-model')).toContainText('DLSP');
  await expect(page.getByTestId('about-model')).toContainText('model predictive control');
  await expect(page.getByTestId('about-replanner')).toContainText('Frozen');
  await expect(page.getByTestId('about-assumptions')).toContainText('One factory');
  await page.screenshot({ path: 'test-results/screens/about.png', fullPage: true });
});
