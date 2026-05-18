import { PageContainer, PageHeader } from '@org/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { signUp } from '../../lib/auth.js';
import { getAppSupabase } from '../../lib/supabase.js';
import { AuthForm } from './AuthForm.js';

export function Signup(): React.ReactElement {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // メール/パスワードで signUp し、成功時は /today へ遷移、失敗時はエラー表示
  const handleSubmit = async (values: { email: string; password: string }): Promise<void> => {
    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await signUp(getAppSupabase(), values.email, values.password);
    setIsSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }
    navigate({ to: '/today' });
  };

  // exactOptionalPropertyTypes: errorMessage は null のとき prop ごと省略する
  const errorProp = errorMessage !== null ? { errorMessage } : {};

  return (
    <PageContainer width="narrow">
      {/* ブランドマーク（TopBar が auth ページでは非表示のため独自表示） */}
      <div className="mb-8 flex items-center gap-2 text-[14px] font-semibold tracking-wide text-game-fg">
        <span className="relative inline-block h-[18px] w-[18px] rounded-[5px] bg-game-accent after:absolute after:inset-1 after:rounded-[2px] after:bg-game-bg" />
        <span>
          habits
          <em className="not-italic text-game-accent">.</em>
        </span>
      </div>
      <PageHeader title="新規登録" subtitle="無料でアカウントを作成。すぐに使い始められます。" />
      <AuthForm
        submitLabel="新規登録"
        onSubmit={(values) => {
          void handleSubmit(values);
        }}
        {...errorProp}
        isSubmitting={isSubmitting}
        passwordAutoComplete="new-password"
      />
      <p className="text-sm text-game-fg-muted">
        <Link to="/auth/login" className="text-game-accent hover:underline">
          既にアカウントをお持ちの方はこちら（ログイン）
        </Link>
      </p>
    </PageContainer>
  );
}
