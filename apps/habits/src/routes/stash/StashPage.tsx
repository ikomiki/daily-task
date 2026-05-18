import type { LinkComponentProps } from '@org/ui';
import { AppNav, PageContainer, PageHeader } from '@org/ui';
import { Link } from '@tanstack/react-router';
import type React from 'react';
import { StashPanel } from '../../features/stash/StashPanel.js';

export function StashPage(): React.ReactElement {
  return (
    <PageContainer>
      <PageHeader
        title="スタッシュ"
        nav={
          <AppNav
            linkComponent={Link as unknown as React.ComponentType<LinkComponentProps>}
            items={[{ to: '/today', label: '今日のタスク' }]}
          />
        }
      />
      <StashPanel />
    </PageContainer>
  );
}
