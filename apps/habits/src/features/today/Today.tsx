import { PageContainer, PageHeader } from '@org/ui';
import type React from 'react';
import { RoutedAppNav } from '../../components/RoutedAppNav.js';
import { getTodayDateString } from '../../lib/today-date.js';
import { TodayView } from './TodayView.js';

export function Today(): React.ReactElement {
  const today = getTodayDateString();

  return (
    <PageContainer>
      <PageHeader title="今日のタスク" />
      <RoutedAppNav />
      <TodayView today={today} />
    </PageContainer>
  );
}
