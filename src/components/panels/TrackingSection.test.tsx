import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { TrackingSection } from './TrackingSection';
import { useTrackStore } from '@/stores/tracks';

beforeEach(() => {
  useTrackStore.setState({ byMmsi: new Map([['1', {
    mmsi: '1', tier: 0, score: 88, parts: [30, 25, 9, 15, 9], state: 'underway', sog: 11.6, cog: 248,
    lastRealAt: Date.now() / 60000 - 25, method: 'damped', tau: 60, uncert: 0.03, path: null, trail: null,
    cleaning: { kept: 9, rejected: 1, inland: 0, rerouted: 1 },
  }]]) });
});

describe('TrackingSection', () => {
  it('shows the evidence score, derived kinematics and the estimate basis in plain words', () => {
    render(<TrackingSection mmsi="1" />);
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText(/well tracked/i)).toBeInTheDocument();
    expect(screen.getByText(/11\.6 kn · 248°/)).toBeInTheDocument();
    expect(screen.getByText(/estimated for 25 min/i)).toBeInTheDocument();
    expect(screen.getByText(/slowing/i)).toBeInTheDocument();
  });

  it('renders nothing for a vessel the engine has not scored', () => {
    const { container } = render(<TrackingSection mmsi="999" />);
    expect(container).toBeEmptyDOMElement();
  });
});
