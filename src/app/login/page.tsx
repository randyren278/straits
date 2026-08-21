import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { isAuthConfigured } from '@/lib/auth/session';

export default function LoginPage() {
  if (!isAuthConfigured()) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-5 py-12 text-zinc-100">
      <section className="w-full max-w-md border border-zinc-800 bg-[#050505] p-6 sm:p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-600">
          STRAITS / SECURE ACCESS
        </div>
        <h1 className="mt-4 font-mono text-2xl font-semibold uppercase tracking-tight text-amber-500">
          Geopolitical intelligence
        </h1>
        <p className="mt-3 max-w-sm font-mono text-xs leading-5 text-zinc-500">
          This deployment is access-controlled. Authenticate to enter the maritime intelligence command center.
        </p>
        <Suspense fallback={<div className="mt-8 h-28 animate-pulse border border-zinc-900" />}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
