import { PageContainer, PageHeader } from '@org/ui';
import type React from 'react';
import { RoutedAppNav } from '../../components/RoutedAppNav.js';
import { HistoryView } from '../../features/history/HistoryView.js';

export function HistoryPage(): React.ReactElement {
  return (
    <PageContainer>
      <PageHeader title="履歴" />
      <RoutedAppNav />
      <HistoryView />
    </PageContainer>
  );
}
