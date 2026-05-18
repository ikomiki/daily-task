import { expect, test } from '@playwright/test';

// legend-state の exponential backoff リトライ（最長 14s）+ 同期チェーン分の余裕を確保
test.setTimeout(60_000);

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

  // 5. オンライン復帰前に task_logs への書き込みレスポンスを捕捉する準備をする
  //    legend-state のリトライが発火したとき waitForResponse が解決する
  const taskLogWritePromise = page.waitForResponse(
    (resp) => resp.url().includes('/rest/v1/task_logs') && resp.request().method() !== 'GET',
    { timeout: 50_000 },
  );

  // 6. オンラインに戻す（legend-state がリトライキューを再送する）
  await context.setOffline(false);

  // 7. オフラインバッジが消えることを確認（online$ が true に切り替わった）
  await expect(page.getByRole('status')).not.toBeVisible({ timeout: 10_000 });

  // 8. task_logs への書き込みが Supabase に到達するまで待つ
  await taskLogWritePromise;

  // 9. task_logs_update_stash トリガーの発火と task_stash 更新を待つ
  await page.waitForTimeout(2000);

  // 10. スタッシュを再ロードして同期後の完了カウントを確認
  //     refreshTaskStashView() はマウント時に呼ばれるため再ロードで最新データを取得する
  await page.reload();
  await expect(page.locator('article').first()).toBeVisible({ timeout: 10_000 });
  const completeCount = page.locator('article').first().locator('dd').first();
  await expect(completeCount).not.toHaveText('0', { timeout: 10_000 });
});
