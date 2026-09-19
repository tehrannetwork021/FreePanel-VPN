import { expect, test } from '@playwright/test';

test('dashboard is bilingual and has no horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByText('نمای کلی')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  if (testInfo.project.name === 'desktop') {
    await page.screenshot({ path: 'assets/readme/dashboard-fa.png', fullPage: true });
  }

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('Overview')).toBeVisible();
  await expect(page.locator('[data-testid="dashboard"]')).toHaveAttribute('dir', 'ltr');

  if (testInfo.project.name === 'desktop') {
    await page.screenshot({ path: 'assets/readme/dashboard-en.png', fullPage: true });
  }
});
