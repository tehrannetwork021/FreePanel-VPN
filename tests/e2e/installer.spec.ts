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

test('installer pre-fills a strong auto-generated admin password', async ({ page }) => {
  await page.route('**/api/token/verify', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, accounts: [{ id: 'acc-1', name: 'Tehran Account' }] }),
    }),
  );
  await page.goto('http://127.0.0.1:4174/');
  await page.getByLabel('Cloudflare API Token').fill('t'.repeat(40));
  await page.getByRole('button', { name: 'بررسی کلید' }).click();

  const password = page.getByLabel('رمز مدیریت');
  await expect(password).toBeVisible();
  const first = await password.inputValue();
  expect(first.length).toBeGreaterThanOrEqual(16);
  expect(first).toMatch(/^[A-Za-z0-9]+$/);
  await expect(page.getByText(/رمز قوی خودکار/)).toBeVisible();

  await page.getByRole('button', { name: 'رمز جدید' }).click();
  const second = await password.inputValue();
  expect(second).not.toBe(first);
  expect(second.length).toBeGreaterThanOrEqual(16);
});
