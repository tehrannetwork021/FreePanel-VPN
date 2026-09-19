import { expect, test } from '@playwright/test';

test('OAuth-first installer stays simple and responsive', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/');
  await expect(page.getByRole('button', { name: 'نصب با Cloudflare' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'نصب پیشرفته' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.getByLabel('Cloudflare API Token')).toHaveCount(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: 'Install with Cloudflare' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('dir', 'ltr');
});
