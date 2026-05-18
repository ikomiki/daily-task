import { expect, test } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL ?? 'e2e@habits.test';
const password = process.env.E2E_TEST_PASSWORD ?? 'habits-e2e-pw';

test('/auth/login でログインページが表示される', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  await expect(page.getByLabel('メールアドレス')).toBeVisible();
  await expect(page.getByLabel('パスワード')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
});

test('/auth/signup で新規登録ページが表示される', async ({ page }) => {
  await page.goto('/auth/signup');
  await expect(page.getByRole('heading', { name: '新規登録' })).toBeVisible();
  await expect(page.getByRole('button', { name: '新規登録' })).toBeVisible();
});

test('未認証で /today にアクセスすると /auth/login にリダイレクトされる', async ({ page }) => {
  await page.goto('/today');
  await page.waitForURL('**/auth/login');
  await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
});

test('未認証で / にアクセスすると /auth/login にリダイレクトされる', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL('**/auth/login');
  await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
});

test('無効なパスワードでログインするとエラーメッセージが表示される', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill('wrongpassword123');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('正しい認証情報でログインすると /today にリダイレクトされ見出しが表示される', async ({
  page,
}) => {
  await page.goto('/auth/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL('**/today');
  await expect(page.getByRole('heading', { name: '今日のタスク' })).toBeVisible();
});

test('/today でログアウトすると /auth/login にリダイレクトされる', async ({ page }) => {
  // ログイン
  await page.goto('/auth/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL('**/today');

  // ログアウト
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await page.waitForURL('**/auth/login');
  await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
});
