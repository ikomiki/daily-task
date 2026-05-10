import { describe, expect, it } from 'vitest';
import { parseSaveData, type SaveData } from './save';

describe('parseSaveData', () => {
  it('有効なデータをパースできる', () => {
    const input = { highScore: 42, version: 1 };
    const result = parseSaveData(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const data: SaveData = result.data;
      expect(data.highScore).toBe(42);
    }
  });

  it('highScore が負数の場合は失敗する', () => {
    const input = { highScore: -1, version: 1 };
    const result = parseSaveData(input);
    expect(result.success).toBe(false);
  });

  it('version 不一致の場合は失敗する', () => {
    const input = { highScore: 0, version: 2 };
    const result = parseSaveData(input);
    expect(result.success).toBe(false);
  });

  it('未知のフィールドは無視される', () => {
    const input = { highScore: 1, version: 1, extra: 'ignored' };
    const result = parseSaveData(input);
    expect(result.success).toBe(true);
  });
});
