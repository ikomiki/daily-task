import { expect, test } from '@playwright/test';

test('サインアップ → タスク完了 → スタッシュに完了数が反映される', async ({ page }) => {
  // テスト実行ごとにユニークなメールアドレスを使い既存ユーザーと衝突しない
  const uniqueEmail = `e2e-${Date.now()}@habits.test`;
  const password = 'habits-e2e-pw';

  // 1. 新規ユーザーとしてサインアップ
  await page.goto('/auth/signup');
  await page.getByLabel('メールアドレス').fill(uniqueEmail);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: '新規登録' }).click();
  await page.waitForURL('**/today');
  await expect(page.getByRole('heading', { name: '今日のタスク' })).toBeVisible();

  // 2. 初期タスクが表示されていることを確認し、最初のタスクを「完了」にする
  //    auth.users INSERT トリガーで 6 タスク + 2 時間帯が自動生成される
  const completeButton = page.getByRole('button', { name: '完了' }).first();
  await expect(completeButton).toBeVisible({ timeout: 10_000 });
  await completeButton.click();
  await expect(completeButton).toHaveAttribute('aria-pressed', 'true');

  // 3. Supabase へのオプティミスティック書き込みと task_stash トリガーの発火を待つ
  await page.waitForTimeout(2000);

  // 4. スタッシュページに遷移（StashPanel マウント時に refreshTaskStashView() が呼ばれる）
  await page.getByRole('link', { name: 'スタッシュ' }).click();
  await page.waitForURL('**/stash');
  await expect(page.getByRole('heading', { name: 'スタッシュ' })).toBeVisible();

  // 5. 最初のタスクの完了カウントが 1 以上であることを確認
  //    StashRow 構造: <article> → <dl> → <div><dt>完了</dt><dd>1</dd></div>...
  const firstRow = page.locator('article').first();
  await expect(firstRow).toBeVisible({ timeout: 10_000 });
  const completeCount = firstRow.locator('dd').first();
  await expect(completeCount).not.toHaveText('0');
});
