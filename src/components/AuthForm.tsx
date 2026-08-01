'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Alert, Spinner } from '@/components/ui';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup';
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get('next') || '/dashboard';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const translate = (msg: string) => {
    const m = msg.toLowerCase();
    if (m.includes('invalid login')) return 'ایمیل یا رمز عبور اشتباه است.';
    if (m.includes('already registered') || m.includes('already been registered'))
      return 'این ایمیل قبلاً ثبت شده است. وارد شوید.';
    if (m.includes('password should be at least'))
      return 'رمز عبور باید حداقل ۶ کاراکتر باشد.';
    if (m.includes('unable to validate email') || m.includes('invalid email'))
      return 'قالب ایمیل معتبر نیست.';
    if (m.includes('email not confirmed'))
      return 'ایمیل شما تأیید نشده است. صندوق ورودی را بررسی کنید.';
    if (m.includes('rate limit') || m.includes('too many'))
      return 'تعداد تلاش‌ها زیاد بود. کمی صبر کنید.';
    return msg;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() || email.split('@')[0] },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        if (data.session) {
          router.push('/onboarding');
          router.refresh();
          return;
        }
        setInfo('حساب شما ساخته شد. لینک تأیید به ایمیلتان ارسال شد.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.push(nextPath);
        router.refresh();
        return;
      }
    } catch (err) {
      setError(translate(err instanceof Error ? err.message : 'خطای نامشخص'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-7 fade-in">
      <h1 className="mb-1 text-xl font-bold">
        {isSignup ? 'ساخت حساب کاربری' : 'ورود به حساب'}
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--muted)' }}>
        {isSignup
          ? 'در یک دقیقه شروع کنید و سطح خود را بسنجید.'
          : 'خوش آمدید! ادامه یادگیری از همان‌جا که رها کردید.'}
      </p>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      {info && (
        <div className="mb-4">
          <Alert kind="success">{info}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignup && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">نام و نام خانوادگی</label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثلاً: یاسر رضایی"
              autoComplete="name"
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium">ایمیل</label>
          <input
            className="input ltr"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            dir="ltr"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">رمز عبور</label>
          <input
            className="input ltr"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="حداقل ۶ کاراکتر"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            dir="ltr"
          />
        </div>

        <button type="submit" className="btn btn-primary w-full py-3" disabled={loading}>
          {loading ? <Spinner /> : isSignup ? 'ساخت حساب' : 'ورود'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
        {isSignup ? 'قبلاً حساب دارید؟ ' : 'حساب ندارید؟ '}
        <Link
          href={isSignup ? '/login' : '/signup'}
          className="font-medium hover:underline"
          style={{ color: 'var(--color-brand-600)' }}
        >
          {isSignup ? 'وارد شوید' : 'ثبت‌نام کنید'}
        </Link>
      </p>
    </div>
  );
}
