import { PageContainer, PageHeader } from '@org/ui';
import type React from 'react';
import { RoutedAppNav } from '../../components/RoutedAppNav.js';
import { TimeSlotList } from '../../features/timeslot/TimeSlotList.js';

export function SettingsTimeSlotsPage(): React.ReactElement {
  return (
    <PageContainer>
      <PageHeader title="時間帯設定" subtitle="通知を送る時間帯を管理します。" />
      <RoutedAppNav />
      <TimeSlotList />
    </PageContainer>
  );
}
