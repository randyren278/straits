/**
 * Protected route group layout.
 * Provides a Suspense boundary for loading.tsx, and mounts the mobile bottom
 * navigation so every route in the group keeps its primary destinations when
 * the header's nav row is hidden below lg.
 */
import { MobileBottomNav } from '@/components/ui/MobileBottomNav';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <MobileBottomNav />
    </>
  );
}
