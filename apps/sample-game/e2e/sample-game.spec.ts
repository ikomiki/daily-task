import { test, expect } from '@playwright/test';

test('TAP するとスコアが増える', async ({ page }) => {
  await page.goto('/');
  const score = page.getByRole('status', { name: /score/i });
  await expect(score).toContainText('0');
  await page.getByRole('button', { name: /tap/i }).click();
  await expect(score).toContainText('1');
});
