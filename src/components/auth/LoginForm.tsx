'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requestedNext = searchParams.get('next');
  const destination =
    requestedNext?.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/dashboard';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError(response.status === 401 ? 'Access denied.' : 'Authentication unavailable.');
        return;
      }

      router.replace(destination);
      router.refresh();
    } catch {
      setError('Unable to reach the authentication service.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" aria-label="Straits access form">
      <div>
        <label
          htmlFor="password"
          className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500"
        >
          Shared access key
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          maxLength={256}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 w-full border border-zinc-800 bg-black px-3 font-mono text-sm text-zinc-100 outline-none transition-colors focus:border-amber-500"
        />
      </div>

      {error ? (
        <p role="alert" className="font-mono text-xs text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="h-11 w-full border border-amber-500 bg-amber-500 px-4 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Verifying…' : 'Enter command center'}
      </button>
    </form>
  );
}
