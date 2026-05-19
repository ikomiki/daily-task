import { PageContainer, PageHeader } from '@org/ui';
import React from 'react';
import { RoutedAppNav } from '../../components/RoutedAppNav.js';
import { getTodayDateString } from '../../lib/today-date.js';
import { TodayView } from './TodayView.js';

export function Today(): React.ReactElement {
  const today = getTodayDateString();
  const [doneCount, setDoneCount] = React.useState(0);
  const [totalDue, setTotalDue] = React.useState(0);

  const handleCountsChange = React.useCallback((done: number, total: number) => {
    setDoneCount(done);
    setTotalDue(total);
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="今日のタスク"
        right={
          totalDue > 0 ? (
            <span className="text-sm text-game-fg-muted">
              {doneCount} / {totalDue} 完了
            </span>
          ) : undefined
        }
      />
      <RoutedAppNav />
      <TodayView today={today} onCountsChange={handleCountsChange} />
    </PageContainer>
  );
}
