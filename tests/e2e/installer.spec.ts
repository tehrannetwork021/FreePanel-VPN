import { expect, test } from '@playwright/test';

test('single-token installer stays simple and responsive', async ({ page }) => {
  await page.goto('http://127.0.0.1:43174/');
  const generate = page.getByRole('link', { name: 'ساخت کلید Cloudflare' });
  await expect(generate).toBeVisible();
  await expect(generate).toHaveAttribute('href', /dash\.cloudflare\.com\/profile\/api-tokens/);
  await expect(page.getByLabel('Cloudflare API Token')).toHaveAttribute('type', 'password');
  await expect(page.getByRole('button', { name: 'نصب با کلید' })).toBeVisible();
  await expect(page.getByLabel('حساب Cloudflare')).toHaveCount(0);
  await expect(page.getByLabel('نام Worker')).toHaveCount(0);
  await expect(page.getByLabel('رمز مدیریت')).toHaveCount(0);
  await expect(page.getByText(/Developer \/ Advanced install/i)).toHaveCount(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('link', { name: 'Generate Cloudflare Key' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Install with key' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('dir', 'ltr');
});

test('one token automatically provisions and returns admin handoff', async ({ page }) => {
  const installToken = `cf-test-${'x'.repeat(40)}`;
  let installRequest: Record<string, unknown> | null = null;
  await page.route('**/api/token/verify', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
    expect(body.token).toBe(installToken);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        accounts: [
          { id: 'acc-1', name: 'Primary account' },
          { id: 'acc-2', name: 'Secondary account' },
        ],
      }),
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
        workerName: 'tehran-network-edge',
        version: '0.3.0',
        schemaVersion: 1,
      }),
    });
  });

  await page.goto('http://127.0.0.1:43174/');
  await page.getByLabel('Cloudflare API Token').fill(installToken);
  await page.getByRole('button', { name: 'نصب با کلید' }).click();

  await expect(page.getByText('پنل شما آماده است')).toBeVisible();
  await expect(page.getByRole('link', { name: 'باز کردن پنل مدیریت' })).toHaveAttribute(
    'href',
    'https://browser-e2e.example.workers.dev/admin',
  );
  await expect(page.getByRole('link', { name: 'باز کردن Worker' })).toHaveAttribute(
    'href',
    'https://browser-e2e.example.workers.dev',
  );

  const request = installRequest as Record<string, unknown>;
  expect(request.token).toBe(installToken);
  expect(request.accountId).toBe('acc-1');
  expect(request.workerName).toBe('tehran-network-edge');
  expect(request.adminPassword).toMatch(/^[A-Za-z0-9]{18}$/);
  await expect(page.locator('.result-password code')).toHaveText(String(request.adminPassword));
  await expect(page.getByLabel('Cloudflare API Token')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(installToken);
  const storage = await page.evaluate(() => ({ ...localStorage, ...sessionStorage }));
  expect(JSON.stringify(storage)).not.toContain(installToken);
});

test('mobile flow also exposes only the token input before installation', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only assertion');
  await page.goto('http://127.0.0.1:43174/');
  await expect(page.getByLabel('Cloudflare API Token')).toBeVisible();
  await expect(page.getByRole('button', { name: 'نصب با کلید' })).toBeVisible();
  await expect(page.getByLabel('حساب Cloudflare')).toHaveCount(0);
  await expect(page.getByLabel('نام Worker')).toHaveCount(0);
  await expect(page.getByLabel('رمز مدیریت')).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
