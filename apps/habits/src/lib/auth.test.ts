import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { signIn, signOut, signUp } from './auth.js';

// SupabaseClient を最小限モック
function makeMockClient(handlers: {
  signUp?: ReturnType<typeof vi.fn>;
  signInWithPassword?: ReturnType<typeof vi.fn>;
  signOut?: ReturnType<typeof vi.fn>;
}): SupabaseClient {
  return {
    auth: {
      signUp: handlers.signUp ?? vi.fn(),
      signInWithPassword: handlers.signInWithPassword ?? vi.fn(),
      signOut: handlers.signOut ?? vi.fn(),
    },
  } as unknown as SupabaseClient;
}

const dummyUser = { id: 'u1', email: 'a@b.co' } as User;
const dummySession = { user: dummyUser, access_token: 'x' } as Session;

describe('lib/auth', () => {
  describe('signUp', () => {
    it('成功時に { ok: true, user, session } を返す', async () => {
      const client = makeMockClient({
        signUp: vi
          .fn()
          .mockResolvedValue({ data: { user: dummyUser, session: dummySession }, error: null }),
      });
      const result = await signUp(client, 'a@b.co', 'password123');
      expect(result).toEqual({ ok: true, user: dummyUser, session: dummySession });
    });

    it('失敗時に { ok: false, error } を返す', async () => {
      const client = makeMockClient({
        signUp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'invalid' },
        }),
      });
      const result = await signUp(client, 'a@b.co', 'short');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/invalid/);
      }
    });
  });

  describe('signIn', () => {
    it('成功時に { ok: true, user, session } を返す', async () => {
      const client = makeMockClient({
        signInWithPassword: vi
          .fn()
          .mockResolvedValue({ data: { user: dummyUser, session: dummySession }, error: null }),
      });
      const result = await signIn(client, 'a@b.co', 'password123');
      expect(result).toEqual({ ok: true, user: dummyUser, session: dummySession });
    });

    it('失敗時に { ok: false, error } を返す', async () => {
      const client = makeMockClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        }),
      });
      const result = await signIn(client, 'a@b.co', 'wrong');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Invalid login credentials/);
      }
    });
  });

  describe('signOut', () => {
    it('成功時に { ok: true } を返す', async () => {
      const client = makeMockClient({
        signOut: vi.fn().mockResolvedValue({ error: null }),
      });
      const result = await signOut(client);
      expect(result).toEqual({ ok: true });
    });

    it('失敗時に { ok: false, error } を返す', async () => {
      const client = makeMockClient({
        signOut: vi.fn().mockResolvedValue({ error: { message: 'net' } }),
      });
      const result = await signOut(client);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/net/);
      }
    });
  });
});
