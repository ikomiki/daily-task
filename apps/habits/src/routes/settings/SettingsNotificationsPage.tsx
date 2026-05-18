import { Button, Card, PageContainer, PageHeader } from '@org/ui';
import type React from 'react';
import { RoutedAppNav } from '../../components/RoutedAppNav.js';
import { useNotificationPermission } from '../../hooks/useNotificationPermission.js';

// permission 値を日本語表示ラベルに変換する
const PERMISSION_LABEL: Record<'granted' | 'denied' | 'prompt' | 'unsupported', string> = {
  granted: '許可済み',
  denied: '拒否',
  prompt: '未許可',
  unsupported: 'お使いのブラウザは通知非対応',
};

export function SettingsNotificationsPage(): React.ReactElement {
  const { permission, request } = useNotificationPermission();
  return (
    <PageContainer>
      <PageHeader title="通知設定" subtitle="時間帯ごとの通知の挙動を確認します。" />
      <RoutedAppNav />
      <Card>
        <div className="space-y-3">
          <div className="text-sm">
            現在のステータス:{' '}
            <span className="font-mono text-game-fg">{PERMISSION_LABEL[permission]}</span>
          </div>
          {permission === 'prompt' ? (
            <Button
              variant="primary"
              onClick={() => {
                void request();
              }}
            >
              通知を許可する
            </Button>
          ) : null}
          {permission === 'denied' ? (
            <p className="text-xs text-game-fg-muted">
              通知が拒否されています。再度有効化するには、ブラウザの設定からこのサイトの通知を許可してください。
            </p>
          ) : null}
          {permission === 'granted' ? (
            <p className="text-xs text-game-fg-muted">
              アプリを開いている間、各時間帯の通知時刻に合わせて通知が表示されます。
            </p>
          ) : null}
          <hr className="border-t border-border-default my-2" />
          <p className="text-xs text-game-fg-muted">
            v1
            ではフォアグラウンド通知のみ（アプリを開いている間に限り通知される）です。バックグラウンド／プッシュ通知は今後対応予定です。
          </p>
        </div>
      </Card>
    </PageContainer>
  );
}
