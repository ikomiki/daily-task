import { PageContainer, PageHeader } from '@org/ui';
import type React from 'react';
import { RoutedAppNav } from '../../components/RoutedAppNav.js';
import { StashPanel } from '../../features/stash/StashPanel.js';

export function StashPage(): React.ReactElement {
  return (
    <PageContainer>
      <PageHeader title="スタッシュ" />
      <RoutedAppNav />
      <StashPanel />
    </PageContainer>
  );
}
