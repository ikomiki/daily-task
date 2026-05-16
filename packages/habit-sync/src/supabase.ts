import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Supabase クライアントのシングルトンを生成する。
// M5 でこのクライアントを legend-state の syncedSupabase に渡す。
let client: SupabaseClient | null = null;

export function getSupabaseClient(config: SupabaseConfig): SupabaseClient {
  if (client !== null) {
    return client;
  }
  client = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

// テスト用にシングルトンをリセットする。
export function resetSupabaseClient(): void {
  client = null;
}
