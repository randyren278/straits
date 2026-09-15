import { describe, it, expect } from 'vitest';
import { resolveDestination } from './ports';

const near = (p: { lat: number; lon: number } | null, lat: number, lon: number) => {
  expect(p).not.toBeNull();
  expect(p!.lat).toBeCloseTo(lat, 0);
  expect(p!.lon).toBeCloseTo(lon, 0);
};

describe('resolveDestination', () => {
  it('resolves UN/LOCODEs with or without separators', () => {
    for (const s of ['EGPSD', 'EG PSD', 'EG_PSD', 'EG/PSD', 'eg psd', 'EG-PSD']) near(resolveDestination(s), 31.26, 32.30);
    near(resolveDestination('TRMER'), 36.79, 34.63);
    near(resolveDestination('IL HFA'), 32.82, 35.00);
  });

  it('resolves port names in the spellings crews actually type', () => {
    for (const s of ['PORT SAID', 'PORTSAID', 'P0RT SAID', 'PORT-SAID', 'PORT SAID, EGYPT', 'PORT SAID/EGYPT', 'PORT SAID  EGYPT', 'OPL PORT SAID', 'PORT SAID OPL', 'V ANCH PORT SAID', 'PORT SAID N6ANCH', 'PORT SAID EG']) {
      near(resolveDestination(s), 31.26, 32.30);
    }
    near(resolveDestination('TRIPOLI     LEBANON'), 34.45, 35.82);
    near(resolveDestination('LATTAKIA/SYR'), 35.52, 35.78);
    near(resolveDestination('VASSILIKO,CYPRUS'), 34.72, 33.32);
    near(resolveDestination('Malta'), 35.90, 14.51);
  });

  it('routing chains resolve to the last leg', () => {
    near(resolveDestination('LBBEY>TRMER'), 36.79, 34.63);
    near(resolveDestination('ES ALG >>> EGSUZ'), 29.95, 32.55);
    near(resolveDestination('EGDAM->EGPSD'), 31.26, 32.30);
    near(resolveDestination('RU VYS => EG PSD'), 31.26, 32.30);
  });

  it('instructions and open water are not places', () => {
    for (const s of ['FOR ORDERS', 'FOR ORDER', 'for-order', 'FOR.ORDERS', 'TO ORDER', 'ORDERS', 'AT SEA', 'OPEN SEA', 'MED SEA FOR ORDERS', 'SEA FOR ORDER', 'TBA', 'TBN', 'NO DATA', 'OFFSHORE', '', '   ']) {
      expect(resolveDestination(s)).toBeNull();
    }
  });

  it('a place qualified by an instruction still resolves to the place', () => {
    near(resolveDestination('SUEZ FOR ORDERS'), 29.95, 32.55);
    near(resolveDestination('MALTA OPL'), 35.90, 14.51);
    near(resolveDestination('EGPSD FOR ORDER'), 31.26, 32.30);
    near(resolveDestination('SINGAPORE FOR ORDER'), 1.26, 103.83);
  });

  it('unknown strings resolve to null rather than a wrong place', () => {
    for (const s of ['SEISMIC GUARD VESSEL', 'KEEP 2 NM  CPA', 'STENA FORTH', 'XXQQQ', 'EGZZ1']) expect(resolveDestination(s)).toBeNull();
  });
});
