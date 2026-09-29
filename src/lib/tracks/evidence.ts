/** Evidence score 0–100 and tier: how much the map should trust and feature a ship. */
export interface Evidence { score: number; parts: [number, number, number, number, number]; tier: 0 | 1 | 2 }

export function scoreEvidence(input: {
  fixTimes: number[]; now: number; rejected: number; moves: number;
  identity: { name: boolean; type: boolean; flag: boolean; imoOrDest: boolean };
}): Evidence {
  const { fixTimes, now } = input;
  const n24 = fixTimes.filter((t) => t > now - 1440 && t <= now).length;
  const last = fixTimes.length ? fixTimes[fixTimes.length - 1] : -Infinity, age = now - last;
  const slots = new Set(fixTimes.filter((t) => t > now - 180 && t <= now).map((t) => Math.floor((now - t) / 10)));
  const volume = Math.min(1, n24 / 90) * 30;
  const recency = age <= 15 ? 25 : age <= 60 ? 16 : age <= 180 ? 7 : 0;
  const regularity = (Math.min(18, slots.size) / 18) * 15;
  const consistency = (1 - input.rejected / (input.moves + input.rejected + 1)) * 15;
  const idn = input.identity;
  const identity = (idn.name ? 5 : 0) + (idn.type ? 4 : 0) + (idn.flag ? 3 : 0) + (idn.imoOrDest ? 3 : 0);
  const parts: Evidence['parts'] = [volume, recency, regularity, consistency, identity].map((v) => Math.round(v)) as Evidence['parts'];
  const score = Math.round(volume + recency + regularity + consistency + identity);
  return { score, parts, tier: score >= 72 ? 0 : score >= 45 ? 1 : 2 };
}
