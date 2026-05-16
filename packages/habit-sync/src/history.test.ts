import { describe, expect, it, vi } from 'vitest';
import { loadTaskHistory } from './history.js';

interface MockBuilder {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
}

// PostgrestFilterBuilder のチェーン API を模倣
function makeClient(result: { data: unknown; error: unknown }): {
  client: unknown;
  calls: MockBuilder;
} {
  const calls: MockBuilder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  // チェーンメソッドは builder 自体を返し、limit は thenable Promise を返す
  const builder = {
    from: (...args: unknown[]) => {
      calls.from(...args);
      return builder;
    },
    select: (...args: unknown[]) => {
      calls.select(...args);
      return builder;
    },
    eq: (...args: unknown[]) => {
      calls.eq(...args);
      return builder;
    },
    lt: (...args: unknown[]) => {
      calls.lt(...args);
      return builder;
    },
    order: (...args: unknown[]) => {
      calls.order(...args);
      return builder;
    },
    limit: (...args: unknown[]) => {
      calls.limit(...args);
      return Promise.resolve(result);
    },
  };
  return { client: builder, calls };
}

describe('loadTaskHistory', () => {
  it('正しいクエリでフェッチし、data を返す', async () => {
    const rows = [
      {
        task_id: 't1',
        date: '2026-04-10',
        status: 'complete',
        created_at: '2026-04-10T00:00:00Z',
        updated_at: '2026-04-10T00:00:00Z',
      },
    ];
    const { client, calls } = makeClient({ data: rows, error: null });

    // biome-ignore lint/suspicious/noExplicitAny: テスト用モック
    const result = await loadTaskHistory(client as any, {
      taskId: 't1',
      beforeDate: '2026-04-15',
      limit: 31,
    });

    expect(calls.from).toHaveBeenCalledWith('task_logs');
    expect(calls.select).toHaveBeenCalledWith('*');
    expect(calls.eq).toHaveBeenCalledWith('task_id', 't1');
    expect(calls.lt).toHaveBeenCalledWith('date', '2026-04-15');
    expect(calls.order).toHaveBeenCalledWith('date', { ascending: false });
    expect(calls.limit).toHaveBeenCalledWith(31);
    expect(result).toEqual(rows);
  });

  it('limit 省略時は 31 件', async () => {
    const { client, calls } = makeClient({ data: [], error: null });
    // biome-ignore lint/suspicious/noExplicitAny: テスト用モック
    await loadTaskHistory(client as any, { taskId: 't1', beforeDate: '2026-04-15' });
    expect(calls.limit).toHaveBeenCalledWith(31);
  });

  it('data が null の場合は空配列を返す', async () => {
    const { client } = makeClient({ data: null, error: null });
    // biome-ignore lint/suspicious/noExplicitAny: テスト用モック
    const result = await loadTaskHistory(client as any, {
      taskId: 't1',
      beforeDate: '2026-04-15',
    });
    expect(result).toEqual([]);
  });

  it('error がある場合は throw', async () => {
    const err = new Error('db error');
    const { client } = makeClient({ data: null, error: err });
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用モック
      loadTaskHistory(client as any, { taskId: 't1', beforeDate: '2026-04-15' }),
    ).rejects.toThrow('db error');
  });
});
