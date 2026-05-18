import type { LinkComponentProps } from '@org/ui';
import { AppNav, PageContainer, PageHeader } from '@org/ui';
import { Link } from '@tanstack/react-router';
import { TimeSlotList } from '../../features/timeslot/TimeSlotList.js';

export function SettingsTimeSlotsPage(): React.ReactElement {
  return (
    <PageContainer>
      <PageHeader
        title="時間帯の設定"
        nav={
          <AppNav
            linkComponent={Link as unknown as React.ComponentType<LinkComponentProps>}
            items={[
              { to: '/settings/notifications', label: '通知設定' },
              { to: '/today', label: '今日のタスク' },
            ]}
          />
        }
      />
      <TimeSlotList />
    </PageContainer>
  );
}
