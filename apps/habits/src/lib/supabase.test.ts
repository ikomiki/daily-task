import { resetSupabaseClient } from '@org/habit-sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('lib/supabase', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    resetSupabaseClient();
  });

  afterEach(() => {
    // env を元に戻す
    Object.assign(import.meta.env, originalEnv);
    vi.unstubAllEnvs();
    resetSupabaseClient();
  });

  it('VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY からクライアントを生成する', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ-dummy');
    const { getAppSupabase } = await import('./supabase.js');
    const client = getAppSupabase();
    expect(client).toBeDefined();
    expect(typeof client.auth.signInWithPassword).toBe('function');
  });

  it('VITE_SUPABASE_URL が未定義の場合は分かりやすいエラーで落ちる', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ-dummy');
    const { getAppSupabase } = await import('./supabase.js');
    expect(() => getAppSupabase()).toThrow(/VITE_SUPABASE_URL/);
  });

  it('VITE_SUPABASE_ANON_KEY が未定義の場合は分かりやすいエラーで落ちる', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { getAppSupabase } = await import('./supabase.js');
    expect(() => getAppSupabase()).toThrow(/VITE_SUPABASE_ANON_KEY/);
  });
});
