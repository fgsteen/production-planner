import { expect, test } from '@playwright/test';

test.describe('master data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#data');
  });

  test('editing a capability survives a reload', async ({ page }) => {
    const oee = page.getByLabel('M1-P01 OEE');
    await oee.fill('50');
    await oee.press('Enter');
    await expect(page.getByTestId('cap-row-M1-P01')).toContainText('600/h'); // 1,200 × 50 %

    await page.reload();
    await expect(page.getByTestId('cap-row-M1-P01')).toContainText('600/h');
    await expect(page.getByText('Your data (saved in this browser)')).toBeVisible();
  });

  test('Escape reverts a half-typed value', async ({ page }) => {
    const rate = page.getByLabel('M1-P01 rate');
    await rate.fill('9999');
    await rate.press('Escape');
    await expect(rate).toHaveValue('1200');
    await expect(page.getByTestId('cap-row-M1-P01')).toContainText('936/h');
  });

  test('a new product is flagged until a machine can make it', async ({ page }) => {
    await page.getByRole('tab', { name: 'Products' }).click();
    await page.getByRole('button', { name: '+ Product' }).click();
    await expect(page.getByTestId('problems')).toContainText('Product P21: no machine can produce it');

    await page.getByRole('tab', { name: 'Capabilities' }).click();
    await page.getByLabel('New capability machine').selectOption('M5');
    await page.getByLabel('New capability product').selectOption('P21');
    await page.getByRole('button', { name: '+ Capability' }).click();
    await expect(page.getByTestId('cap-row-M5-P21')).toBeVisible();
    await expect(page.getByTestId('problems')).toHaveCount(0);
  });

  test('products have min, max, initial stock and usage (R72); min above max is flagged', async ({ page }) => {
    await page.getByRole('tab', { name: 'Products' }).click();
    await expect(page.getByLabel('P01 usage per shift')).toHaveValue('2560');
    const min = page.getByLabel('P01 min');
    await min.fill('999999');
    await min.press('Enter');
    await expect(page.getByTestId('problems')).toContainText('Product P01: min is above max');
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

    // A custom name shows in the schedule too.
    await page.getByLabel('P01 name').fill('Flagship');
    await page.getByLabel('P01 name').press('Enter');
    await page.getByRole('tab', { name: 'Seed schedule' }).click();
    await expect(page.getByLabel('M1 shift 1').locator('option:checked')).toHaveText('Flagship');
  });

  test('the seed schedule offers only capable products; edits are kept (R73)', async ({ page }) => {
    await page.getByRole('tab', { name: 'Seed schedule' }).click();
    const slot = page.getByLabel('M3 shift 8');
    await expect(slot).toHaveValue('');
    await expect(slot.locator('option')).toHaveCount(6); // empty + 5 products M3 can make
    await slot.selectOption('P12');
    await page.reload();
    await page.getByRole('tab', { name: 'Seed schedule' }).click();
    await expect(page.getByLabel('M3 shift 8')).toHaveValue('P12');
    await page.screenshot({ path: 'test-results/screens/master-data-schedule.png', fullPage: true });
  });

  test('reset restores the demo data', async ({ page }) => {
    await page.getByRole('tab', { name: 'Machines' }).click();
    await page.getByLabel('M5 large line clear').fill('200');
    await page.getByLabel('M5 large line clear').press('Enter');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Reset to demo data' }).click();
    await expect(page.getByLabel('M5 large line clear')).toHaveValue('100');
    await expect(page.getByText('Demo data', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/master-data-machines.png', fullPage: true });
  });

  test('export then import round-trips a scenario', async ({ page }) => {
    await page.getByLabel('M6-P09 rate').fill('777');
    await page.getByLabel('M6-P09 rate').press('Enter');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const file = await (await download).path();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Reset to demo data' }).click();
    await expect(page.getByLabel('M6-P09 rate')).toHaveValue('1100');

    page.once('dialog', (d) => d.accept());
    await page.getByTestId('import-file').setInputFiles(file);
    await expect(page.getByLabel('M6-P09 rate')).toHaveValue('777');
    await expect(page.getByRole('status')).toContainText('Imported');
  });

  test('rejects an invalid import file and a v1 file', async ({ page }) => {
    // Build the file in the page (no Node Buffer types in this project).
    const upload = (text: string) =>
      page.getByTestId('import-file').evaluate((input: HTMLInputElement, text) => {
        const dt = new DataTransfer();
        dt.items.add(new File([text], 'bad.json', { type: 'application/json' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, text);
    await upload('{"version":3}');
    await expect(page.getByRole('status')).toHaveText('Could not import bad.json: Unsupported version 3 (expected 2).');
    await upload('{"version":1}');
    await expect(page.getByRole('status')).toHaveText('Could not import bad.json: This is a v1 (yearly plan) file: open it in v1 at /v1/.');
    await page.screenshot({ path: 'test-results/screens/master-data-capabilities.png', fullPage: true });
  });
});
