import { expect, test } from '@playwright/test';

test('オフライン中のタスク操作が再接続後に Supabase へ同期される', async ({ page, context }) => {
  // 1. 今日のページにアクセス（storageState で認証済み）
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日のタスク' })).toBeVisible();

  // タスクが表示されていることを確認
  const completeButton = page.getByRole('button', { name: '完了' }).first();
  await expect(completeButton).toBeVisible({ timeout: 10_000 });

  // 2. ネットワークをオフラインにする
  //    window の 'offline' イベントが発火し online$.set(false) が呼ばれる
  await context.setOffline(true);

  // 3. オフライン状態でタスクを完了にする（楽観更新: IndexedDB に書き込まれリトライキューに入る）
  await completeButton.click();
  await expect(completeButton).toHaveAttribute('aria-pressed', 'true');

  // 4. スタッシュページに遷移してオフラインバッジが表示されることを確認
  await page.getByRole('link', { name: 'スタッシュ' }).click();
  await page.waitForURL('**/stash');
  // PendingSyncBadge: online$ === false のとき role="status" で表示される
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByText('オフライン')).toBeVisible();

  // 5. オンラインに戻す（legend-state がリトライキューを再送する）
  await context.setOffline(false);

  // 6. オフラインバッジが消えることを確認
  await expect(page.getByRole('status')).not.toBeVisible({ timeout: 5000 });

  // 7. スタッシュを再ロードして同期後の完了カウントを確認
  //    legend-state retry → Supabase 書き込み → トリガー発火 → task_stash 更新を待つ
  await page.waitForTimeout(5000);
  await page.reload();
  await expect(page.locator('article').first()).toBeVisible({ timeout: 10_000 });
  const completeCount = page.locator('article').first().locator('dd').first();
  await expect(completeCount).not.toHaveText('0', { timeout: 15_000 });
});
