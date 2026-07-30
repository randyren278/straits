/**
 * Mobile bottom navigation.
 *
 * The header's nav row is hidden on phones; this replaces it and puts the
 * primary destinations in the thumb zone. Rendered from the (protected)
 * layout so every route in the group keeps navigation on a phone. Tablets
 * use the header's own nav row instead — see `roomy:hidden` below.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, BarChart3, Ship, Info } from 'lucide-react';

const DESTINATIONS = [
  { href: '/dashboard', label: 'Map', Icon: Map },
  { href: '/analytics', label: 'Analytics', Icon: BarChart3 },
  { href: '/fleet', label: 'Fleet', Icon: Ship },
  { href: '/about', label: 'About', Icon: Info },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="roomy:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 h-[var(--straits-nav-h)] bg-black border-t border-amber-500/20 pb-[env(safe-area-inset-bottom)]"
    >
      {DESTINATIONS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors ${
              active ? 'text-amber-500' : 'text-gray-500'
            }`}
          >
            <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
