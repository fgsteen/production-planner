import { expect, test, type Page } from '@playwright/test';

/** Records the href of every link the app clicks (the PNG download is a data URL). */
const recordDownloads = (page: Page) =>
  page.addInitScript(() => {
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      ((window as unknown as { hrefs: string[] }).hrefs ??= []).push(this.href);
      click.call(this);
    };
  });

/** Size of the last downloaded PNG and the colour of a pixel in its right padding, mid-height. */
async function inspectPng(page: Page) {
  return page.evaluate(async () => {
      const dataUrl = (window as unknown as { hrefs: string[] }).hrefs.at(-1)!;
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return { width: img.width, height: img.height, pixel: [...ctx.getImageData(img.width - 16, img.height >> 1, 1, 1).data] };
  });
}

test.describe('PNG download per panel (R45)', () => {
  test.use({ colorScheme: 'dark' });

  test('downloads a panel at 2×, in the page theme, with its wide table whole', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 }); // narrow enough for the 20-product table to scroll
    await recordDownloads(page);
    await page.goto('/#plan');
    await expect(page.getByTestId('plan-summary')).toContainText('Gap to optimum', { timeout: 30_000 });
    const panel = page.locator('section', { has: page.getByTestId('plan-table') });
    const shown = (await panel.boundingBox())!;

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download Shifts per machine and product as PNG' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^shifts-per-machine-and-product-\d{4}-\d{2}-\d{2}\.png$/);
    await download.saveAs('test-results/screens/export-shifts.png');

    const png = await inspectPng(page);
    // The table scrolls sideways on screen; the export shows all columns, at 2×.
    const table = await page.getByTestId('plan-table').evaluate((t) => t.parentElement!.scrollWidth);
    expect(table).toBeGreaterThan(shown.width);
    expect(png.width).toBeGreaterThanOrEqual(2 * table);
    // Dark like the page, and opaque.
    expect(png.pixel.slice(0, 3).every((c) => c < 60)).toBe(true);
    expect(png.pixel[3]).toBe(255);
    // The page itself is back to normal.
    await expect(panel).not.toHaveClass(/png-export/);
  });

  test('every chart and table panel has a download button', async ({ page }) => {
    const save = async (panel: string) => {
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: `Download ${panel} as PNG` }).click()]);
      await download.saveAs(`test-results/screens/export-${download.suggestedFilename().replace(/-\d{4}-\d{2}-\d{2}/, '')}`);
    };
    await page.goto('/#');
    await expect(page.getByRole('button', { name: /^Download .* as PNG$/ })).toHaveCount(3);
    await save('Network'); // the React Flow map
    await page.goto('/#demand');
    await expect(page.getByRole('button', { name: /^Download .* as PNG$/ })).toHaveCount(3);
    await page.goto('/#plan');
    await expect(page.getByTestId('plan-summary')).toContainText('Gap to optimum', { timeout: 30_000 });
    await expect(page.getByRole('button', { name: /^Download .* as PNG$/ })).toHaveCount(6); // priorities, shifts, weekly plan, warehouses, transport B → A and A → B
    await save('Weekly machine plan');
  });
});

test.describe('PNG download in the light theme (R45)', () => {
  test.use({ colorScheme: 'light' });

  test('a light page gives a light PNG', async ({ page }) => {
    await recordDownloads(page);
    await page.goto('/#');
    await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Network as PNG' }).click()]);
    const png = await inspectPng(page);
    expect(png.pixel.every((c) => c > 240)).toBe(true);
  });
});
