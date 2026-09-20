import { expect, test } from '@playwright/test';

test('free key installer stays simple and responsive', async ({ page }) => {
  await page.goto('http://127.0.0.1:43174/');
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
  await page.goto('http://127.0.0.1:43174/');
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

test('token-to-result provisioning clears the Cloudflare key and exposes admin handoff', async ({
  page,
}) => {
  const installToken = `cf-test-${'x'.repeat(40)}`;
  let installRequest: Record<string, unknown> | null = null;
  await page.route('**/api/token/verify', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
    expect(body.token).toBe(installToken);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, accounts: [{ id: 'acc-1', name: 'Primary account' }] }),
    });
  });
  await page.route('**/api/install', async (route) => {
    installRequest = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        workerUrl: 'https://browser-e2e.example.workers.dev',
        adminUrl: 'https://browser-e2e.example.workers.dev/admin',
        workerName: 'browser-e2e',
        version: '0.3.0',
        schemaVersion: 1,
      }),
    });
  });

  await page.goto('http://127.0.0.1:43174/');
  await page.getByLabel('Cloudflare API Token').fill(installToken);
  await page.getByRole('button', { name: 'بررسی کلید' }).click();
  await expect(page.getByLabel('حساب Cloudflare')).toHaveValue('acc-1');
  await expect(page.getByLabel('Cloudflare API Token')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(installToken);

  await page.getByLabel('نام Worker').fill('browser-e2e');
  await page.getByLabel('رمز مدیریت').fill('browser-admin-pass');
  await page.getByRole('button', { name: 'نصب پنل' }).click();
  await expect(page.getByText('پنل شما آماده است')).toBeVisible();
  await expect(page.getByRole('link', { name: 'باز کردن پنل مدیریت' })).toHaveAttribute(
    'href',
    'https://browser-e2e.example.workers.dev/admin',
  );
  await expect(page.getByRole('link', { name: 'باز کردن Worker' })).toHaveAttribute(
    'href',
    'https://browser-e2e.example.workers.dev',
  );
  await expect(page.locator('.result-password code')).toHaveText('browser-admin-pass');
  await expect(page.locator('body')).not.toContainText(installToken);

  expect(installRequest).toMatchObject({
    token: installToken,
    accountId: 'acc-1',
    workerName: 'browser-e2e',
    adminPassword: 'browser-admin-pass',
  });
  const storage = await page.evaluate(() => ({ ...localStorage, ...sessionStorage }));
  expect(JSON.stringify(storage)).not.toContain(installToken);
});
