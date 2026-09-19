import { expect, test } from '@playwright/test';

test('installer guides users to Cloudflare token creation without overflow', async ({
  page,
}, testInfo) => {
  await page.goto('http://127.0.0.1:4174/');
  const tokenLink = page.getByRole('link', { name: /Cloudflare API Token/i });
  await expect(tokenLink).toBeVisible();
  await expect(tokenLink).toHaveAttribute('href', /dash\.cloudflare\.com\/profile\/api-tokens/);
  await expect(page.getByLabel('Cloudflare API Token')).toHaveAttribute('type', 'password');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  if (testInfo.project.name === 'desktop') {
    await page.screenshot({ path: 'assets/readme/installer-fa.png', fullPage: true });
  }
});
