import { Suspense } from 'react';
import Link from 'next/link';
import AuthForm from '@/components/AuthForm';

export const metadata = { title: 'ثبت‌نام | زبان‌یار' };

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-xl font-bold">
          <span className="text-2xl">🎓</span> زبان‌یار
        </Link>
        <Suspense fallback={<div className="card h-96 skeleton" />}>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </main>
  );
}
