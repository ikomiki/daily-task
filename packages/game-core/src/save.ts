import { z } from 'zod';

// セーブデータスキーマ。version でマイグレーション境界を担保。
const saveDataSchema = z.object({
  highScore: z.number().int().nonnegative(),
  version: z.literal(1),
});

export type SaveData = z.infer<typeof saveDataSchema>;

export const parseSaveData = (input: unknown) => saveDataSchema.safeParse(input);
