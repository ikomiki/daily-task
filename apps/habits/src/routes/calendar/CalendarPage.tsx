import type { LinkComponentProps } from '@org/ui';
import { AppNav, PageContainer, PageHeader } from '@org/ui';
import { Link } from '@tanstack/react-router';
import type React from 'react';
import { CalendarView } from '../../features/calendar/CalendarView.js';

export function CalendarPage(): React.ReactElement {
  return (
    <PageContainer>
      <PageHeader
        title="カレンダー"
        nav={
          <AppNav
            linkComponent={Link as unknown as React.ComponentType<LinkComponentProps>}
            items={[{ to: '/today', label: '今日のタスク' }]}
          />
        }
      />
      <CalendarView />
    </PageContainer>
  );
}
