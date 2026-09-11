/**
 * Shareable investigation links — pure URL (de)serialisation.
 *
 * A dashboard URL carries the investigation state: the selected vessel, the
 * chokepoint in view, and/or a free map view. Filters ride along so a link
 * reproduces what the sender saw. Client-safe; no window access here.
 */
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';

export interface InvestigationState {
  vessel?: string | null;
  chokepoint?: string | null;
  view?: { lat: number; lon: number; zoom: number } | null;
  tankersOnly?: boolean;
  anomaliesOnly?: boolean;
}

export function parseInvestigation(search: string): InvestigationState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const state: InvestigationState = {};

  const vessel = params.get('vessel');
  if (vessel && /^\d{7}$/.test(vessel)) state.vessel = vessel;

  const cp = params.get('cp');
  if (cp && CHOKEPOINTS[cp]) state.chokepoint = cp;

  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  const zoom = Number(params.get('z'));
  if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(zoom) && params.has('lat') && params.has('lon')) {
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && zoom >= 1 && zoom <= 20) {
      state.view = { lat, lon, zoom };
    }
  }

  if (params.get('tankers') === '1') state.tankersOnly = true;
  if (params.get('anomalies') === '1') state.anomaliesOnly = true;
  return state;
}

export function serializeInvestigation(state: InvestigationState): string {
  const params = new URLSearchParams();
  if (state.vessel) params.set('vessel', state.vessel);
  if (state.chokepoint) params.set('cp', state.chokepoint);
  if (state.view) {
    params.set('lat', state.view.lat.toFixed(4));
    params.set('lon', state.view.lon.toFixed(4));
    params.set('z', state.view.zoom.toFixed(1));
  }
  if (state.tankersOnly) params.set('tankers', '1');
  if (state.anomaliesOnly) params.set('anomalies', '1');
  const s = params.toString();
  return s ? `?${s}` : '';
}
