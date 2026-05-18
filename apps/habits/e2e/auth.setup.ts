import { expect, test as setup } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';
const email = process.env.E2E_TEST_EMAIL ?? 'e2e@habits.test';
const password = process.env.E2E_TEST_PASSWORD ?? 'habits-e2e-pw';

setup('テストユーザーでログイン済み状態を保存する', async ({ page }) => {
  // サインアップを試みる（既存ユーザーの場合は /today 以外に留まる）
  await page.goto('/auth/signup');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: '新規登録' }).click();

  const redirected = await page
    .waitForURL('**/today', { timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!redirected) {
    // ユーザーが既に存在する場合はログインにフォールバック
    await page.goto('/auth/login');
    await page.getByLabel('メールアドレス').fill(email);
    await page.getByLabel('パスワード').fill(password);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForURL('**/today');
  }

  await expect(page.getByRole('heading', { name: '今日のタスク' })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
