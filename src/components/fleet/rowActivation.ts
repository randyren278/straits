/**
 * Keyboard activation for table rows that behave as buttons.
 *
 * A `<tr role="button">` is neither focusable nor keyboard-operable on its own,
 * so rows carrying that role need an explicit tabIndex plus Enter/Space
 * handling to satisfy WCAG 2.1.1. Shared by the two Fleet tables so both
 * behave identically.
 */
import type { KeyboardEvent } from 'react';

export function handleRowKeyDown(event: KeyboardEvent<HTMLElement>, activate: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  // Space would otherwise scroll the page.
  event.preventDefault();
  activate();
}
