/**
 * Tablet-only intel drawer.
 *
 * On a tablet the map is the product, so it runs full-bleed and the panels
 * become a deliberate act rather than a permanent 320px tax. The drawer
 * overlays the map — it never reflows it, so opening the drawer must not
 * change the map's width.
 *
 * Chosen over a bottom sheet on measured grounds: landscape iPad is 820px
 * tall, and a sheet spends the scarcer axis. This layout is identical in both
 * orientations, which is the point — rotation must not restructure the page.
 *
 * Owns exactly one piece of state: whether it is open.
 */
'use client';

import { useState, type ReactNode } from 'react';
import { ChevronLeft, X } from 'lucide-react';

export function IntelDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div data-testid="intel-drawer-root" className="phone:hidden desk:hidden">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open intel panel"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-11 h-24 flex items-center justify-center bg-black border border-r-0 border-amber-500/20 text-amber-500 hover:bg-amber-500/10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
      )}

      <aside
        data-testid="intel-drawer"
        data-open={open}
        aria-hidden={!open}
        className={`absolute inset-y-0 right-0 z-20 w-[340px] flex flex-col bg-black border-l border-amber-500 shadow-[-14px_0_34px_rgba(0,0,0,0.85)] transition-transform duration-200 motion-reduce:transition-none ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="shrink-0 flex items-center justify-between px-3 h-11 border-b border-amber-500/20">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-500">Intel</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close intel panel"
            className="min-w-[44px] min-h-[44px] -mr-3 inline-flex items-center justify-center text-amber-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-amber-500/10">
          {children}
        </div>
      </aside>
    </div>
  );
}
