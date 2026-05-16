import { beforeEach, describe, expect, it } from 'vitest';
import { state$ } from './observables.js';
import { clearTaskLogStatus, setTaskLogStatus, taskLogKey } from './task-log-write.js';

describe('taskLogKey', () => {
  it('task_id と date を - で結合する', () => {
    expect(taskLogKey('t1', '2026-05-16')).toBe('t1-2026-05-16');
  });

  it('UUID 形式の task_id でも正しく動く', () => {
    expect(taskLogKey('11111111-2222-3333-4444-555555555555', '2026-05-16')).toBe(
      '11111111-2222-3333-4444-555555555555-2026-05-16',
    );
  });
});

describe('setTaskLogStatus', () => {
  beforeEach(() => {
    state$.task_logs.set({});
  });

  it('state$.task_logs[key] に row を設定する', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    const row = state$.task_logs.get()['t1-2026-05-16'];
    expect(row).toBeDefined();
    expect(row?.task_id).toBe('t1');
    expect(row?.date).toBe('2026-05-16');
    expect(row?.status).toBe('complete');
  });

  it('status だけ書き換える場合も既存行と同じキーで上書きされる', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    setTaskLogStatus('t1', '2026-05-16', 'skip');
    expect(state$.task_logs.get()['t1-2026-05-16']?.status).toBe('skip');
  });

  it('別 task / 別 date は独立したキーで保存される', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    setTaskLogStatus('t2', '2026-05-16', 'fail');
    setTaskLogStatus('t1', '2026-05-15', 'skip');
    const logs = state$.task_logs.get();
    expect(logs['t1-2026-05-16']?.status).toBe('complete');
    expect(logs['t2-2026-05-16']?.status).toBe('fail');
    expect(logs['t1-2026-05-15']?.status).toBe('skip');
  });

  it('created_at / updated_at に ISO 文字列を埋める', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    const row = state$.task_logs.get()['t1-2026-05-16'];
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('clearTaskLogStatus', () => {
  beforeEach(() => {
    state$.task_logs.set({});
  });

  it('指定キーの行を削除する', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    expect(state$.task_logs.get()['t1-2026-05-16']).toBeDefined();
    clearTaskLogStatus('t1', '2026-05-16');
    expect(state$.task_logs.get()['t1-2026-05-16']).toBeUndefined();
  });

  it('存在しないキーを削除しても例外を投げない', () => {
    expect(() => clearTaskLogStatus('t-not-exist', '2026-05-16')).not.toThrow();
  });

  it('別キーには影響しない', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    setTaskLogStatus('t2', '2026-05-16', 'fail');
    clearTaskLogStatus('t1', '2026-05-16');
    expect(state$.task_logs.get()['t2-2026-05-16']).toBeDefined();
  });
});
