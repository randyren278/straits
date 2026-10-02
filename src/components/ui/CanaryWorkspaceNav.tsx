'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IS_CANARY_CLIENT } from '@/lib/canary-client';

const WORKSPACES = [
  { href: '/investigations', label: 'Investigations', key: 'investigations' },
  { href: '/scenarios', label: 'Parallel Seas', key: 'scenarios' },
  { href: '/coverage', label: 'Coverage', key: 'coverage' },
  { href: '/investigations/following', label: 'Following', key: 'following' },
] as const;

export function isCanaryWorkspacePath(pathname: string): boolean {
  return pathname === '/scenarios' || pathname.startsWith('/scenarios/') ||
    pathname === '/coverage' || pathname.startsWith('/coverage/') ||
    pathname === '/investigations' || pathname.startsWith('/investigations/');
}

function activeWorkspace(pathname: string): (typeof WORKSPACES)[number]['key'] | null {
  if (pathname === '/scenarios' || pathname.startsWith('/scenarios/')) return 'scenarios';
  if (pathname === '/coverage' || pathname.startsWith('/coverage/')) return 'coverage';
  if (pathname === '/investigations/following' || pathname.startsWith('/investigations/following/')) return 'following';
  if (pathname === '/investigations' || pathname.startsWith('/investigations/stories/')) return 'investigations';
  return null;
}

export function CanaryWorkspaceNav() {
  const pathname = usePathname();
  if (!IS_CANARY_CLIENT || !isCanaryWorkspacePath(pathname)) return null;

  const active = activeWorkspace(pathname);
  return (
    <nav aria-label="Canary workspaces" className="border-t border-amber-500/10 bg-black px-3">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto overscroll-x-contain">
        {WORKSPACES.map(({ href, label, key }) => {
          const selected = key === active;
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              aria-current={selected ? 'page' : undefined}
              className={`inline-flex min-h-[44px] shrink-0 items-center border-b-2 px-3 text-[10px] font-mono uppercase tracking-wider transition-colors phone:px-2.5 ${
                selected
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-gray-600 hover:text-gray-300'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
