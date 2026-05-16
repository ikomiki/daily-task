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
    <section className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold text-game-accent">新規登録</h1>
      <AuthForm
        submitLabel="新規登録"
        onSubmit={(values) => {
          void handleSubmit(values);
        }}
        {...errorProp}
        isSubmitting={isSubmitting}
        passwordAutoComplete="new-password"
      />
      <p className="text-sm">
        <Link to="/auth/login" className="text-game-accent underline">
          既にアカウントをお持ちの方はこちら（ログイン）
        </Link>
      </p>
    </section>
  );
}
