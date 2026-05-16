// タスクの状態型。'empty' は DB 上の行不在を表す論理状態のため
// この型には含めず、null/undefined 等で外側が表現する。
export type TaskStatus = 'complete' | 'skip' | 'fail';

// UI/集計での「未操作」を含む拡張状態
export type DisplayTaskStatus = TaskStatus | 'empty';
