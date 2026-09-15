import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { fillHours, cellColor, cellTitle, ObservationStrip, ObservationWeeks } from './ObservationHeatmap';

afterEach(cleanup);

const now = new Date('2026-09-15T03:40:00Z');
const bucket = (hour: string, unique: number, attempted = 6) => ({ hour, messages: unique * 2, unique, aisstream: 0, fallback: unique, attempted });

describe('fillHours', () => {
  it('produces one slot per hour ending at the current hour, null where no row exists', () => {
    const out = fillHours([bucket('2026-09-15T03:00:00.000Z', 5)], 3, now);
    expect(out).toHaveLength(3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]?.unique).toBe(5);
  });
});

describe('cellColor', () => {
  it('keeps "not attempted" and "attempted, nothing heard" visually distinct from each other and from data', () => {
    const notAttempted = cellColor(null, 10);
    const heardNothing = cellColor(bucket('x', 0), 10);
    const data = cellColor(bucket('x', 10), 10);
    expect(new Set([notAttempted, heardNothing, data]).size).toBe(3);
    expect(cellColor(bucket('x', 3, 0), 10)).toBe(notAttempted);
  });

  it('scales intensity against the region peak, brightest at the peak', () => {
    expect(cellColor(bucket('x', 10), 10)).toBe('#f59e0b');
    expect(cellColor(bucket('x', 1), 10)).toBe('#3b2a08');
  });
});

describe('cellTitle', () => {
  it('spells out each state with its numbers', () => {
    expect(cellTitle('Hormuz', null, '2026-09-15T03:00:00.000Z')).toBe('Hormuz · 2026-09-15 03:00Z · not attempted (harvester did not run)');
    expect(cellTitle('Hormuz', bucket('x', 0), '2026-09-15T03:00:00.000Z')).toMatch(/attempted 6×, nothing heard/);
    expect(cellTitle('Hormuz', { ...bucket('x', 221), aisstream: 0 }, '2026-09-15T03:00:00.000Z')).toMatch(/221 contacts \(aisstream 0 · fallback 221\)/);
  });
});

describe('ObservationStrip', () => {
  it('draws rows × hours cells with titles', () => {
    render(<ObservationStrip rows={[{ id: 'suez', label: 'Suez', hours: [bucket('2026-09-15T03:00:00.000Z', 9)] }, { id: 'hormuz', label: 'Hormuz', hours: [] }]} windowHours={24} now={now} />);
    const svg = screen.getByTestId('observation-strip');
    expect(svg.querySelectorAll('rect')).toHaveLength(48);
    expect(svg.querySelectorAll('[data-testid="heat-row-suez"] rect[data-unique="9"]')).toHaveLength(1);
    expect(svg.querySelectorAll('title')).toHaveLength(48);
  });
});

describe('ObservationWeeks', () => {
  it('lays days out as rows × 24 hourly columns; today ends at the current hour, the far edge is trimmed to whole days', () => {
    render(<ObservationWeeks row={{ id: 'suez', label: 'Suez', hours: [] }} now={now} />);
    const svg = screen.getByTestId('observation-weeks-suez');
    // now = 03:40Z → today has 4 cells (00–03Z); the 168-h window's leading 20 h fall on an 8th day and are dropped.
    expect(svg.querySelectorAll('rect[data-day="6"]')).toHaveLength(4);
    expect(svg.querySelectorAll('rect[data-day="0"]')).toHaveLength(24);
    expect(svg.querySelectorAll('rect')).toHaveLength(6 * 24 + 4);
  });
});
