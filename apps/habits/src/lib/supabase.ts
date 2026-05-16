import { getSupabaseClient, type SupabaseConfig } from '@org/habit-sync';
import type { SupabaseClient } from '@supabase/supabase-js';

// env から SupabaseClient を取得する。habit-sync のシングルトン管理に委譲する。
// 環境変数未設定時は明確なエラーで落ち、誤って production / staging を指していないか
// 開発者がすぐ気づけるようにする。
export function getAppSupabase(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (typeof url !== 'string' || url === '') {
    throw new Error(
      'VITE_SUPABASE_URL が未設定です。apps/habits/.env.local.example を元に .env.local を作成してください。',
    );
  }
  if (typeof anonKey !== 'string' || anonKey === '') {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY が未設定です。supabase start の出力から anon key をコピーして .env.local に記載してください。',
    );
  }

  const config: SupabaseConfig = { url, anonKey };
  return getSupabaseClient(config);
}
