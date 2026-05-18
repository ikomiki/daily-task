import type { LinkComponentProps } from '@org/ui';
import { AppNav, PageContainer, PageHeader } from '@org/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { signOut } from '../../lib/auth.js';
import { getAppSupabase } from '../../lib/supabase.js';
import { getTodayDateString } from '../../lib/today-date.js';
import { TodayView } from './TodayView.js';

export function Today(): React.ReactElement {
  const navigate = useNavigate();
  const today = getTodayDateString();

  const handleSignOut = async (): Promise<void> => {
    await signOut(getAppSupabase());
    navigate({ to: '/auth/login' });
  };

  return (
    <PageContainer>
      <PageHeader
        title="今日のタスク"
        right={
          <AppNav
            linkComponent={Link as unknown as React.ComponentType<LinkComponentProps>}
            items={[
              { to: '/tasks', label: 'タスク管理' },
              { to: '/stash', label: 'スタッシュ' },
              { to: '/calendar', label: 'カレンダー' },
              { to: '/history', label: '履歴' },
              { to: '/settings/time-slots', label: '設定' },
            ]}
            onSignOut={() => {
              void handleSignOut();
            }}
          />
        }
      />
      <TodayView today={today} />
    </PageContainer>
  );
}
