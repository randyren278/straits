'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
      <div className="bg-[#16162a] p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Tanker Tracker
        </h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="password" className="block text-gray-300 mb-2">
            Enter password to access
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded bg-[#0d0d1a] border border-gray-700 text-white focus:outline-none focus:border-amber-500"
            placeholder="Password"
            autoFocus
          />
          {error && (
            <p className="text-red-400 mt-2 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 p-3 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Access Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
