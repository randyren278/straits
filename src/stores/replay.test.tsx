import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useReplayStore } from './replay';
import { ReplayControls } from '@/components/map/ReplayControls';
import { encodeSeries } from '@/lib/tracks/codec';

const data = { generatedAt: '', from: 1000, to: 2440, vessels: [{ m: 'a', h: encodeSeries([[1000, 25, 56], [2440, 25, 56.5]]), g: [] }] };
const reset = () => useReplayStore.setState({ data: null, model: null, status: 'idle', active: false, playing: false, t: 0, speed: 6, rate: 0, intro: false });

afterEach(() => { cleanup(); reset(); vi.unstubAllGlobals(); });

describe('replay store', () => {
  it('loads on enter and plays from 24 h ago, easing up to speed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => data })));
    await useReplayStore.getState().enter();
    const s = useReplayStore.getState();
    expect(s.active && s.playing).toBe(true);
    expect(s.t).toBe(1000);
    expect(s.model?.has('a')).toBe(true);
    s.tick(0.05, false);
    const eased = useReplayStore.getState().t - 1000;
    expect(eased).toBeGreaterThan(0);
    expect(eased).toBeLessThan(0.05 * 6);                       // still ramping
    useReplayStore.getState().tick(1, true);
    expect(useReplayStore.getState().t - 1000 - eased).toBeCloseTo(6, 5);   // 6 replay-min per second
  });

  it('stops an hour past the last harvest, and play from the end starts over', () => {
    useReplayStore.setState({ data, active: true, playing: true, rate: 1, t: 2497 });
    useReplayStore.getState().tick(1, true);
    expect(useReplayStore.getState().t).toBe(2500);
    expect(useReplayStore.getState().playing).toBe(false);
    useReplayStore.getState().setPlaying(true);
    expect(useReplayStore.getState().t).toBe(1000);
  });

  it('seeking pauses and clamps to the window', () => {
    useReplayStore.setState({ data, active: true, playing: true, t: 1500 });
    useReplayStore.getState().seek(99999);
    expect(useReplayStore.getState()).toMatchObject({ t: 2500, playing: false });
  });
});

describe('intro', () => {
  it('plays the last 6 h in ~8 s, then hands back to live', async () => {
    const now = Date.now() / 60000;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ...data, from: now - 1440, to: now - 5 }) })));
    await useReplayStore.getState().startIntro();
    const s = useReplayStore.getState();
    expect(s.intro && s.active).toBe(true);
    expect(s.introEnd - s.t).toBeCloseTo(360, 0);
    expect(s.speed).toBeCloseTo(45, 0);
    for (let k = 0; k < 7; k++) useReplayStore.getState().tick(1, false);
    expect(useReplayStore.getState().active).toBe(true);
    useReplayStore.getState().tick(1.1, false);
    expect(useReplayStore.getState()).toMatchObject({ active: false, intro: false });
  });

  it('does not start once the user has taken over the map', async () => {
    useReplayStore.setState({ data });
    await useReplayStore.getState().startIntro({ stillWanted: () => false });
    expect(useReplayStore.getState().active).toBe(false);
  });
});

describe('ReplayControls', () => {
  it('shows the rail while replaying and returns to live', () => {
    useReplayStore.setState({ data, active: true, playing: false, t: 1500 });
    render(<ReplayControls />);
    expect(screen.getByTestId('replay-banner')).toHaveTextContent(/Replay/);
    fireEvent.click(screen.getByRole('button', { name: /20m\/s/ }));
    expect(useReplayStore.getState().speed).toBe(20);
    fireEvent.click(screen.getByTestId('replay-live'));
    expect(useReplayStore.getState().active).toBe(false);
  });
});
