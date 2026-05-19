import type { LinkComponentProps } from '@org/ui';
import { AppNav } from '@org/ui';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import type React from 'react';
import { signOut } from '../lib/auth.js';
import { getAppSupabase } from '../lib/supabase.js';

/** ルーター対応のグローバルナビゲーション。現在のパスを自動判定しアクティブ状態を反映する。 */
export function RoutedAppNav(): React.ReactElement {
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async (): Promise<void> => {
    await signOut(getAppSupabase());
    await navigate({ to: '/auth/login' });
  };

  return (
    <AppNav
      currentPath={currentPath}
      linkComponent={Link as unknown as React.ComponentType<LinkComponentProps>}
      onSignOut={() => {
        void handleSignOut();
      }}
      items={[
        { to: '/today', label: '今日' },
        { to: '/tasks', label: 'タスク' },
        { to: '/calendar', label: 'カレンダー' },
        { to: '/history', label: '履歴' },
        { to: '/stash', label: 'スタッシュ' },
        { to: '/settings/notifications', label: '設定' },
      ]}
    />
  );
}
