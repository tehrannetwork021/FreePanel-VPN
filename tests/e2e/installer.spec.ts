import { expect, test } from '@playwright/test';

test('free key installer stays simple and responsive', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/');
  const generate = page.getByRole('link', { name: 'ساخت کلید Cloudflare' });
  await expect(generate).toBeVisible();
  await expect(generate).toHaveAttribute('href', /dash\.cloudflare\.com\/profile\/api-tokens/);
  await expect(page.getByLabel('Cloudflare API Token')).toHaveAttribute('type', 'password');
  await expect(page.getByText(/OAuth|Client ID|GitHub connection/i)).toHaveCount(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('link', { name: 'Generate Cloudflare Key' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify key' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('dir', 'ltr');
});
