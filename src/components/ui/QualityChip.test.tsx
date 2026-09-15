import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QualityChip, describeBasis } from './QualityChip';

afterEach(cleanup);

const basis = { bucketsLast6h: 35, nonEmptyLast6h: 6, latestFix: '2026-09-15T02:50:00Z', latestFixAgeMinutes: 4, unique24h: 221 };

describe('QualityChip', () => {
  it.each([
    ['recent', 'Recent observations', 'text-green-400'],
    ['intermittent', 'Intermittent observations', 'text-yellow-300'],
    ['insufficient', 'Insufficient observations', 'text-gray-500'],
  ] as const)('%s renders its label and tone', (quality, label, tone) => {
    render(<QualityChip id="hormuz" quality={quality} basis={basis} />);
    const chip = screen.getByTestId('quality-chip-hormuz');
    expect(chip).toHaveTextContent(label);
    expect(chip).toHaveClass(tone);
    expect(chip).toHaveAttribute('data-quality', quality);
  });

  it('carries the numeric basis in the title so a hover explains the label', () => {
    render(<QualityChip id="suez" quality="recent" basis={basis} />);
    expect(screen.getByTestId('quality-chip-suez')).toHaveAttribute('title', 'latest fix 4m ago · 6/6 hourly windows with data · 35 collection windows attempted');
  });

  it('the full variant prints the basis inline', () => {
    render(<QualityChip id="suez" quality="recent" basis={basis} variant="full" />);
    expect(screen.getByTestId('quality-chip-suez')).toHaveTextContent('6/6 hourly windows');
  });
});

describe('describeBasis', () => {
  it('says "no fix in 24h" when there is none, hours when old', () => {
    expect(describeBasis({ ...basis, latestFix: null, latestFixAgeMinutes: null })).toMatch(/^no fix in 24h/);
    expect(describeBasis({ ...basis, latestFixAgeMinutes: 150 })).toMatch(/^latest fix 3h ago/);
  });
});
