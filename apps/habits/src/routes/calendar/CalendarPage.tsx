import { PageContainer, PageHeader } from '@org/ui';
import type React from 'react';
import { RoutedAppNav } from '../../components/RoutedAppNav.js';
import { CalendarView } from '../../features/calendar/CalendarView.js';

export function CalendarPage(): React.ReactElement {
  return (
    <PageContainer>
      <PageHeader title="カレンダー" />
      <RoutedAppNav />
      <CalendarView />
    </PageContainer>
  );
}
