'use client';

import dynamic from 'next/dynamic';

/** Dossier code is needed only after a contact is selected. */
export const VesselPanel = dynamic(() => import('./VesselPanel').then(module => module.VesselPanel), {
  loading: () => <p role="status" className="px-3 py-4 text-xs font-mono text-gray-500">Loading vessel dossier…</p>,
});
