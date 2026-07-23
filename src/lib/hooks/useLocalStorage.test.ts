// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns initialValue on first render', () => {
    const { result } = renderHook(() => useLocalStorage('missing_key', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('reads the persisted value after mount', async () => {
    window.localStorage.setItem('user_id', 'stored-uuid');
    const { result } = renderHook(() => useLocalStorage('user_id', ''));
    await waitFor(() => expect(result.current[0]).toBe('stored-uuid'));
  });

  it('setValue persists to localStorage', async () => {
    const { result } = renderHook(() => useLocalStorage('user_id', ''));
    act(() => result.current[1]('new-uuid'));
    expect(result.current[0]).toBe('new-uuid');
    expect(window.localStorage.getItem('user_id')).toBe('new-uuid');
  });
});
