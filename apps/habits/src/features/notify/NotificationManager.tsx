import { use$ } from '@legendapp/state/react';
import {
  type NotificationProvider,
  type SlotSchedule,
  state$,
  type Task,
  type TaskLog,
  type TimeSlot,
} from '@org/habit-sync';
import { useEffect } from 'react';
import { getSlotPendingNotificationTasks } from '../../lib/slot-pending.js';

export interface NotificationManagerProps {
  provider: NotificationProvider;
  today: string; // YYYY-MM-DD
}

// UI を持たない orchestrator。
// state$.time_slots を購読して、変化のたびに provider.scheduleDaily を再実行する。
// onFire(slot) のタイミングで state$.tasks / state$.task_logs から未操作タスクを抽出し、
// 件数 > 0 のとき provider.show(slot.name, body) で通知を発火する。
export function NotificationManager(props: NotificationManagerProps): null {
  const { provider, today } = props;

  // time_slots の id/notify_at/name/sort_order が変わったら effect を再走させたいので、
  // 比較可能な signature を作って依存配列に渡す。
  const slotsSignature = use$<string>(() => {
    const slots = (Object.values(state$.time_slots.get()) as TimeSlot[])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    return slots.map((s) => `${s.id}|${s.name}|${s.notify_at}`).join(',');
  });

  useEffect(() => {
    const slots = (Object.values(state$.time_slots.get()) as TimeSlot[])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const schedules: SlotSchedule[] = slots.map((s) => ({
      slotId: s.id,
      slotName: s.name,
      notifyAt: s.notify_at,
    }));
    provider.scheduleDaily(schedules, (slot) => {
      const tasks = Object.values(state$.tasks.get()) as Task[];
      const logs = Object.values(state$.task_logs.get()) as TaskLog[];
      const allSlots = Object.values(state$.time_slots.get()) as TimeSlot[];
      const pending = getSlotPendingNotificationTasks(slot.slotId, today, tasks, logs, allSlots);
      if (pending.length === 0) {
        return;
      }
      provider.show(slot.slotName, `${pending.length} 件のタスクが未完了です`);
    });
    return () => {
      provider.cancelAll();
    };
    // slotsSignature を依存に入れることで、time_slots 内容が変わったときに effect が再走する
  }, [provider, today, slotsSignature]);

  return null;
}
