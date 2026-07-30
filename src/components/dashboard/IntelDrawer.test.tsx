/**
 * IntelDrawer owns exactly one thing: whether it is open. Everything it shows
 * is passed in. These tests assert the toggle contract and nothing about the
 * panels, which are covered by their own suites.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntelDrawer } from './IntelDrawer';

afterEach(() => cleanup());

describe('IntelDrawer', () => {
  it('starts closed so the map is unobstructed on arrival', () => {
    render(<IntelDrawer><p>panel body</p></IntelDrawer>);
    expect(screen.getByTestId('intel-drawer')).toHaveAttribute('data-open', 'false');
  });

  it('is hidden outside the tablet tier', () => {
    render(<IntelDrawer><p>panel body</p></IntelDrawer>);
    const root = screen.getByTestId('intel-drawer-root');
    expect(root).toHaveClass('phone:hidden');
    expect(root).toHaveClass('desk:hidden');
  });

  it('opens and closes from the edge tab', async () => {
    const user = userEvent.setup();
    render(<IntelDrawer><p>panel body</p></IntelDrawer>);
    const drawer = screen.getByTestId('intel-drawer');

    await user.click(screen.getByRole('button', { name: 'Open intel panel' }));
    expect(drawer).toHaveAttribute('data-open', 'true');

    await user.click(screen.getByRole('button', { name: 'Close intel panel' }));
    expect(drawer).toHaveAttribute('data-open', 'false');
  });

  it('renders its children', () => {
    render(<IntelDrawer><p>panel body</p></IntelDrawer>);
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });

  it('removes the closed drawer from the tab order, not just from view', async () => {
    const user = userEvent.setup();
    render(<IntelDrawer><p>panel body</p></IntelDrawer>);
    const drawer = screen.getByTestId('intel-drawer');

    expect(drawer).toHaveAttribute('inert');

    await user.click(screen.getByRole('button', { name: 'Open intel panel' }));
    expect(drawer).not.toHaveAttribute('inert');
  });
});
