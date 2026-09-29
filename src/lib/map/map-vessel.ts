import type { VesselWithSanctions } from '@/lib/db/sanctions';

/** The map's wire format omits repeated identity fields from each fix. */
export type MapVessel = Omit<VesselWithSanctions, 'lastSeen' | 'position' | 'anomalyDetectedAt'> & {
  lastSeen: string | null;
  anomalyDetectedAt?: string | null;
  position: Omit<VesselWithSanctions['position'], 'time' | 'mmsi' | 'imo'> & { time: string };
};

export function toMapVessel(vessel: VesselWithSanctions): MapVessel {
  const p = vessel.position;
  return {
    imo: vessel.imo,
    mmsi: vessel.mmsi,
    name: vessel.name,
    flag: vessel.flag,
    shipType: vessel.shipType,
    destination: vessel.destination,
    lastSeen: vessel.lastSeen ? new Date(vessel.lastSeen).toISOString() : null,
    isSanctioned: vessel.isSanctioned,
    sanctioningAuthority: vessel.sanctioningAuthority,
    sanctionReason: vessel.sanctionReason,
    sanctionRiskCategory: vessel.sanctionRiskCategory,
    anomalyType: vessel.anomalyType,
    anomalyConfidence: vessel.anomalyConfidence,
    anomalyDetectedAt: vessel.anomalyDetectedAt
      ? new Date(vessel.anomalyDetectedAt).toISOString() : null,
    position: {
      time: new Date(p.time).toISOString(),
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed,
      course: p.course,
      heading: p.heading,
      navStatus: p.navStatus,
      lowConfidence: p.lowConfidence,
    },
  };
}

/** Restore the existing selection contract for a deep-linked vessel. */
export function expandMapVessel(vessel: MapVessel): VesselWithSanctions {
  const observedAt = new Date(vessel.position.time);
  return {
    ...vessel,
    lastSeen: vessel.lastSeen ? new Date(vessel.lastSeen) : null,
    anomalyDetectedAt: vessel.anomalyDetectedAt
      ? new Date(vessel.anomalyDetectedAt) : null,
    position: {
      ...vessel.position,
      time: observedAt,
      mmsi: vessel.mmsi,
      imo: vessel.imo,
    },
  };
}
