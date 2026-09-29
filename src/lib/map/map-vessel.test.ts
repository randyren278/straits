import { describe, expect, it } from 'vitest';
import type { VesselWithSanctions } from '@/lib/db/sanctions';
import { expandMapVessel, toMapVessel } from './map-vessel';
import { vesselsToGeoJSON } from './geojson';

describe('map vessel transport', () => {
  it('keeps marker and deep-link details while removing repeated position identity', () => {
    const observed = new Date('2026-09-29T12:00:00.000Z');
    const lastSeen = new Date('2026-09-29T11:00:00.000Z');
    const vessel: VesselWithSanctions = {
      imo: '9000001', mmsi: '123456789', name: 'TEST', flag: 'PA', shipType: 80,
      destination: 'FUJAIRAH', lastSeen, isSanctioned: true,
      sanctioningAuthority: 'OFAC', sanctionReason: 'Listed', sanctionRiskCategory: 'high',
      anomalyType: 'route-deviation', anomalyConfidence: 'high', anomalyDetectedAt: observed,
      position: {
        time: observed, imo: '9000001', mmsi: '123456789', latitude: 25,
        longitude: 55, speed: 8, course: 90, heading: 90, navStatus: 0,
        lowConfidence: false,
      },
    };

    const compact = toMapVessel(vessel);
    expect(compact.lastSeen).toBe(lastSeen.toISOString());
    expect(compact.position).not.toHaveProperty('imo');
    expect(compact.position).not.toHaveProperty('mmsi');
    expect(compact.position.time).toBe(observed.toISOString());
    expect(vesselsToGeoJSON([compact]).features[0].properties).toMatchObject({
      imo: vessel.imo, mmsi: vessel.mmsi, isSanctioned: true,
      hasAnomaly: true, time: observed.toISOString(),
    });
    expect(expandMapVessel(compact)).toEqual(vessel);
  });
});
