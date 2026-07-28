import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSheetDetent } from './useSheetDetent';

describe('useSheetDetent', () => {
  it('starts at peek and is not open', () => {
    const { result } = renderHook(() => useSheetDetent());
    expect(result.current.detent).toBe('peek');
    expect(result.current.isOpen).toBe(false);
  });

  it('cycles peek -> half -> full -> peek', () => {
    const { result } = renderHook(() => useSheetDetent());
    act(() => result.current.cycle());
    expect(result.current.detent).toBe('half');
    act(() => result.current.cycle());
    expect(result.current.detent).toBe('full');
    act(() => result.current.cycle());
    expect(result.current.detent).toBe('peek');
  });

  it('reports isOpen for any detent above peek', () => {
    const { result } = renderHook(() => useSheetDetent());
    act(() => result.current.expand());
    expect(result.current.detent).toBe('half');
    expect(result.current.isOpen).toBe(true);

    // 'full' must report open too. Asserting only 'half' left the test blind:
    // a broken `isOpen: detent === 'half'` passed the entire suite.
    act(() => result.current.expand());
    expect(result.current.detent).toBe('full');
    expect(result.current.isOpen).toBe(true);
  });

  it('collapse returns to peek from any detent', () => {
    const { result } = renderHook(() => useSheetDetent());
    act(() => result.current.cycle());
    expect(result.current.detent).toBe('half');
    act(() => result.current.collapse());
    expect(result.current.detent).toBe('peek');

    act(() => result.current.cycle());
    act(() => result.current.cycle());
    expect(result.current.detent).toBe('full');
    act(() => result.current.collapse());
    expect(result.current.detent).toBe('peek');
  });

  it('expand from full stays at full rather than wrapping to peek', () => {
    const { result } = renderHook(() => useSheetDetent());
    act(() => result.current.cycle());
    act(() => result.current.cycle());
    act(() => result.current.expand());
    expect(result.current.detent).toBe('full');
  });
});
