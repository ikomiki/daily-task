import { PageContainer } from '@org/ui';
import type React from 'react';
import { RoutedAppNav } from '../../components/RoutedAppNav.js';
import { StashPanel } from '../../features/stash/StashPanel.js';

export function StashPage(): React.ReactElement {
  return (
    <PageContainer>
      <RoutedAppNav />
      <StashPanel />
    </PageContainer>
  );
}
