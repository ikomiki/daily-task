import { Link } from '@tanstack/react-router';
import type React from 'react';
import { useNotificationPermission } from '../../hooks/useNotificationPermission.js';

// permission 値を日本語表示ラベルに変換する
function permissionLabel(p: 'granted' | 'denied' | 'prompt' | 'unsupported'): string {
  switch (p) {
    case 'granted':
      return '許可済み';
    case 'denied':
      return '拒否';
    case 'prompt':
      return '未許可';
    case 'unsupported':
      return 'お使いのブラウザは通知非対応';
  }
}

export function SettingsNotificationsPage(): React.ReactElement {
  const { permission, request } = useNotificationPermission();
  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-game-accent">通知設定</h1>
        <nav className="flex items-center gap-2">
          <Link
            to="/settings/time-slots"
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            時間帯
          </Link>
          <Link to="/today" className="rounded border border-gray-500 px-3 py-1 text-sm">
            今日のタスク
          </Link>
        </nav>
      </header>
      <div className="space-y-3">
        <p className="text-sm">
          現在のステータス: <span className="font-mono">{permissionLabel(permission)}</span>
        </p>
        {permission === 'prompt' ? (
          <button
            type="button"
            onClick={() => {
              void request();
            }}
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            通知を許可する
          </button>
        ) : null}
        <p className="text-xs text-gray-500">
          v1 はアプリを開いている間のみ通知します（フォアグラウンド通知）。
          スロット時刻に「未完了タスクが残っている」場合のみ発火します。
        </p>
      </div>
    </section>
  );
}
