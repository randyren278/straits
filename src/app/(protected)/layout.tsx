/**
 * Protected route group layout.
 * Pass-through layout that provides a Suspense boundary for loading.tsx.
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
