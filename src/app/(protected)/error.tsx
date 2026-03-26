'use client';

/**
 * Page-level error boundary for the (protected) route group.
 * Last-resort fallback when a page component throws during render.
 * Next.js provides error + reset props automatically.
 */
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-black px-4">
      <div className="flex flex-col items-center gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-red-500/60">
          FATAL ERROR
        </p>
        <p className="max-w-lg text-center font-mono text-sm text-amber-500">
          {error.message || 'An unexpected error occurred'}
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-amber-500/30">
            DIGEST: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="border border-amber-500/40 bg-transparent px-6 py-2 font-mono text-xs uppercase tracking-widest text-amber-500 transition-colors hover:border-amber-500 hover:bg-amber-500/10"
      >
        RETRY
      </button>
    </div>
  );
}
