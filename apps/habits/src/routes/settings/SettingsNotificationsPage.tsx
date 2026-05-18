import type { LinkComponentProps } from '@org/ui';
import { AppNav, Button, PageContainer, PageHeader } from '@org/ui';
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
    <PageContainer>
      <PageHeader
        title="通知設定"
        right={
          <AppNav
            linkComponent={Link as unknown as React.ComponentType<LinkComponentProps>}
            items={[
              { to: '/settings/time-slots', label: '時間帯' },
              { to: '/today', label: '今日のタスク' },
            ]}
          />
        }
      />
      <div className="space-y-3">
        <p className="text-sm">
          現在のステータス: <span className="font-mono">{permissionLabel(permission)}</span>
        </p>
        {permission === 'prompt' ? (
          <Button
            type="button"
            onClick={() => {
              void request();
            }}
          >
            通知を許可する
          </Button>
        ) : null}
        <p className="text-xs text-gray-500">
          v1 はアプリを開いている間のみ通知します（フォアグラウンド通知）。
          スロット時刻に「未完了タスクが残っている」場合のみ発火します。
        </p>
      </div>
    </PageContainer>
  );
}
