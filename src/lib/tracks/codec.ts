/** Compact [t, lat, lon] series: whole-minute and 1e-4° integer deltas. Shared client/server. */
export function encodeSeries(points: [number, number, number][]): number[] {
  const out: number[] = []; let pt = 0, pla = 0, plo = 0;
  for (const [t, lat, lon] of points) {
    const T = Math.round(t), A = Math.round(lat * 1e4), O = Math.round(lon * 1e4);
    out.push(T - pt, A - pla, O - plo); pt = T; pla = A; plo = O;
  }
  return out;
}
export function decodeSeries(flat: number[]): [number, number, number][] {
  const out: [number, number, number][] = []; let t = 0, la = 0, lo = 0;
  for (let k = 0; k + 2 < flat.length; k += 3) { t += flat[k]; la += flat[k + 1]; lo += flat[k + 2]; out.push([t, la / 1e4, lo / 1e4]); }
  return out;
}
