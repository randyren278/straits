/**
 * FleetTabs component tests.
 * Validates tab semantics, single-selection invariant and keyboard navigation.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FleetTabs, type FleetTab } from './FleetTabs';

afterEach(() => cleanup());

const tabs: FleetTab[] = [
  { id: 'sanctioned', label: 'Sanctioned', count: 60, accent: 'red' },
  { id: 'loitering', label: 'Loitering', count: 308 },
  { id: 'speed', label: 'Speed Anomaly', count: 225 },
];

describe('FleetTabs', () => {
  it('renders one tablist containing every tab with its count', () => {
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={() => {}} />);

    expect(screen.getAllByRole('tablist')).toHaveLength(1);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /Loitering.*308/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Sanctioned.*60/ })).toBeInTheDocument();
  });

  it('marks exactly one tab selected', () => {
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={() => {}} />);

    const selected = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');

    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Loitering');
  });

  it('links each tab to its panel via aria-controls', () => {
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={() => {}} />);

    const tab = screen.getByRole('tab', { name: /Loitering/ });

    expect(tab).toHaveAttribute('id', 'fleet-tab-loitering');
    expect(tab).toHaveAttribute('aria-controls', 'fleet-panel-loitering');
  });

  it('emits the clicked tab id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: /Speed Anomaly/ }));

    expect(onChange).toHaveBeenCalledWith('speed');
  });

  it('uses a roving tabindex so only the active tab is in the tab order', () => {
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={() => {}} />);

    expect(screen.getByRole('tab', { name: /Loitering/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: /Sanctioned/ })).toHaveAttribute('tabindex', '-1');
  });

  it('moves between tabs with the arrow keys and wraps at the ends', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={onChange} />);

    screen.getByRole('tab', { name: /Loitering/ }).focus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('speed');

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('sanctioned');
  });

  it('jumps to the first and last tab with Home and End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={onChange} />);

    screen.getByRole('tab', { name: /Loitering/ }).focus();

    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenCalledWith('sanctioned');

    await user.keyboard('{End}');
    expect(onChange).toHaveBeenCalledWith('speed');
  });

  it('wraps to the last tab when pressing ArrowLeft on the first tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FleetTabs tabs={tabs} activeId="sanctioned" onChange={onChange} />);

    screen.getByRole('tab', { name: /Sanctioned/ }).focus();

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('speed');
  });

  it('wraps to the first tab when pressing ArrowRight on the last tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FleetTabs tabs={tabs} activeId="speed" onChange={onChange} />);

    screen.getByRole('tab', { name: /Speed Anomaly/ }).focus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('sanctioned');
  });
});
