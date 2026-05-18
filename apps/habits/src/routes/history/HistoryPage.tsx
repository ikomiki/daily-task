import type { LinkComponentProps } from '@org/ui';
import { AppNav, PageContainer, PageHeader } from '@org/ui';
import { Link } from '@tanstack/react-router';
import type React from 'react';
import { HistoryView } from '../../features/history/HistoryView.js';

export function HistoryPage(): React.ReactElement {
  return (
    <PageContainer>
      <PageHeader
        title="履歴"
        right={
          <AppNav
            linkComponent={Link as unknown as React.ComponentType<LinkComponentProps>}
            items={[{ to: '/today', label: '今日のタスク' }]}
          />
        }
      />
      <HistoryView />
    </PageContainer>
  );
}
