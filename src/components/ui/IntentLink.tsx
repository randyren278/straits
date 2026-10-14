'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';

/** Prepare a destination on intent without downloading every screen at startup. */
export function IntentLink({ onMouseEnter, onFocus, prefetchOnIntent = true, ...props }: Omit<ComponentProps<typeof Link>, 'prefetch'> & { prefetchOnIntent?: boolean }) {
  const [active, setActive] = useState(false);
  return <Link {...props} prefetch={active ? null : false}
    onMouseEnter={(event) => { if (prefetchOnIntent) setActive(true); onMouseEnter?.(event); }}
    onFocus={(event) => { if (prefetchOnIntent) setActive(true); onFocus?.(event); }}
  />;
}
