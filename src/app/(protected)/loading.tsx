/**
 * Route transition loading indicator for the (protected) group.
 * Bloomberg terminal aesthetic — minimal pulse animation.
 */
export default function ProtectedLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-3">
        <div className="h-1 w-16 animate-pulse bg-amber-500/60" />
        <p className="font-mono text-xs uppercase tracking-widest text-amber-500/40">
          LOADING...
        </p>
      </div>
    </div>
  );
}
