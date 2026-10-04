import { expect, test } from '@playwright/test';

test.describe('master data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#data');
  });

  test('editing a capability updates the overview and survives a reload', async ({ page }) => {
    const oee = page.getByLabel('B1-P01 OEE');
    await oee.fill('50');
    await oee.press('Enter');
    await expect(page.getByTestId('cap-row-B1-P01')).toContainText('600/h'); // 1,200 × 50 %

    await page.getByRole('link', { name: 'Overview' }).click();
    await expect(page.getByTestId('machine-B1')).toContainText('1,200 × 50%');

    await page.reload();
    await expect(page.getByTestId('machine-B1')).toContainText('600/h');
    await expect(page.getByText('Your data (saved in this browser)')).toBeVisible();
  });

  test('Escape reverts a half-typed value', async ({ page }) => {
    const rate = page.getByLabel('B1-P01 rate');
    await rate.fill('9999');
    await rate.press('Escape');
    await expect(rate).toHaveValue('1200');
    await expect(page.getByTestId('cap-row-B1-P01')).toContainText('936/h');
  });

  test('a new product is flagged until a machine can make it', async ({ page }) => {
    await page.getByRole('tab', { name: 'Products' }).click();
    await page.getByRole('button', { name: '+ Product' }).click();
    await expect(page.getByTestId('problems')).toContainText('Product P23: no machine can produce it');

    await page.getByRole('tab', { name: 'Capabilities' }).click();
    await page.getByLabel('New capability machine').selectOption('A1');
    await page.getByLabel('New capability product').selectOption('P23');
    await page.getByRole('button', { name: '+ Capability' }).click();
    await expect(page.getByTestId('cap-row-A1-P23')).toBeVisible();
    await expect(page.getByTestId('problems')).toHaveCount(0);
  });

  test('products are X-Y-Z combinations; renamed variants carry through, duplicates are flagged', async ({ page }) => {
    await page.getByRole('tab', { name: 'Characteristics' }).click();
    await expect(page.getByTestId('characteristic-X')).toContainText('5 products'); // K
    await page.getByLabel('X variant X1').fill('Q');
    await page.getByLabel('X variant X1').press('Enter');
    await expect(page.getByRole('button', { name: 'Remove Y variant Y1' })).toHaveCount(0); // in use: can't be removed

    await page.getByRole('tab', { name: 'Products' }).click();
    await expect(page.getByLabel('P01 name')).toHaveAttribute('placeholder', 'Q-1-Alder');
    await page.getByLabel('P02 Z').selectOption({ label: 'Alder' });
    await expect(page.getByTestId('problems')).toContainText('Products P01 and P02 are both Q-1-Alder');
    await page.getByLabel('P02 Z').selectOption({ label: 'Birch' });
    await expect(page.getByTestId('problems')).toHaveCount(0);

    // A custom name shows everywhere; clearing it goes back to the combination.
    await page.getByLabel('P01 name').fill('Flagship');
    await page.getByLabel('P01 name').press('Enter');
    await page.goto('/#');
    await expect(page.getByTestId('machine-B1')).toContainText('Flagship');
    await page.goto('/#data');
    await page.getByRole('tab', { name: 'Products' }).click();
    await page.getByLabel('P01 name').fill('');
    await page.getByLabel('P01 name').press('Enter');
    await page.goto('/#');
    await expect(page.getByTestId('machine-B1')).toContainText('Q-1-Alder');
  });

  test('reset restores the demo data', async ({ page }) => {
    await page.getByRole('tab', { name: 'Machines' }).click();
    await page.getByLabel('A1 large line clear').fill('200');
    await page.getByLabel('A1 large line clear').press('Enter');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Reset to demo data' }).click();
    await expect(page.getByLabel('A1 large line clear')).toHaveValue('100');
    await expect(page.getByText('Demo data', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/master-data-machines.png', fullPage: true });
  });

  test('export then import round-trips a scenario', async ({ page }) => {
    await page.getByLabel('A2-P09 rate').fill('777');
    await page.getByLabel('A2-P09 rate').press('Enter');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const file = await (await download).path();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Reset to demo data' }).click();
    await expect(page.getByLabel('A2-P09 rate')).toHaveValue('1100');

    page.once('dialog', (d) => d.accept());
    await page.getByTestId('import-file').setInputFiles(file);
    await expect(page.getByLabel('A2-P09 rate')).toHaveValue('777');
    await expect(page.getByRole('status')).toContainText('Imported');
  });

  test('planning year and truck lane edits reach the overview', async ({ page }) => {
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByLabel('Planning year').fill('2028');
    await page.getByLabel('Planning year').press('Enter');

    await page.getByRole('tab', { name: 'Sites & logistics' }).click();
    await page.getByLabel('B-A max trucks per week').fill('7');
    await page.getByLabel('B-A max trucks per week').press('Enter');
    await expect(page.getByTestId('truck-row-B-A')).toContainText('210 pallets');
    await page.getByLabel('B is the demand site').check();
    await expect(page.getByLabel('A is the demand site')).not.toBeChecked();
    // R66: the SFGs with a pre-SFG are made at B, which is now the demand site.
    await expect(page.getByTestId('problems')).toContainText("uses a pre-SFG, so it can't be made at Site B");
    await page.screenshot({ path: 'test-results/screens/master-data-sites.png', fullPage: true });

    await page.getByRole('link', { name: 'Overview' }).click();
    await expect(page.getByText('Available shifts in 2028')).toBeVisible();
    await expect(page.getByText('B→A 210 · A→B 90')).toBeVisible();
  });

  test('holidays recur as MM-DD; full dates lose their year; invalid days are reported', async ({ page }) => {
    await page.getByRole('tab', { name: 'Sites & logistics' }).click();
    await page.getByLabel('A holidays').fill('2027-12-25, 13-01');
    await page.getByLabel('A holidays').press('Enter');
    await expect(page.getByLabel('A holidays')).toHaveValue('12-25, 13-01');
    await expect(page.getByTestId('problems')).toContainText('Site A: invalid holiday "13-01" (expected MM-DD)');
  });

  test('rejects an invalid import file', async ({ page }) => {
    // Build the file in the page (no Node Buffer types in this project).
    await page.getByTestId('import-file').evaluate((input: HTMLInputElement) => {
      const dt = new DataTransfer();
      dt.items.add(new File(['{"version":2}'], 'bad.json', { type: 'application/json' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.getByRole('status')).toHaveText('Could not import bad.json: Unsupported version 2 (expected 1).');
    await page.screenshot({ path: 'test-results/screens/master-data-capabilities.png', fullPage: true });
  });
});
