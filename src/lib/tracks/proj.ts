/** Per-vessel local equirectangular frame in nautical miles. */
export interface Proj { k: number }
/** A timed point: t in minutes since the Unix epoch, x/y in nm in a vessel's frame. */
export interface TPt { t: number; x: number; y: number }

export const projAt = (lat: number): Proj => ({ k: Math.cos((lat * Math.PI) / 180) });
export const toX = (p: Proj, lon: number) => lon * 60 * p.k;
export const toY = (lat: number) => lat * 60;
export const toLon = (p: Proj, x: number) => x / (60 * p.k);
export const toLat = (y: number) => y / 60;
/** Distance in nm between two lon/lat points (local flat approximation). */
export function nmBetween(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const k = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  return Math.hypot((lon2 - lon1) * 60 * k, (lat2 - lat1) * 60);
}
