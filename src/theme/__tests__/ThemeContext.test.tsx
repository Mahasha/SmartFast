/**
 * Unit tests for ThemeContext: ThemeProvider, useTheme, createThemeManager.
 *
 * Validates: Requirements 25.1, 25.2, 25.5, 19.4, 19.5
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemeProvider, useTheme, createThemeManager, ThemeContextValue } from '../ThemeContext';
import { lightTheme, darkTheme } from '../tokens';

// Mock Appearance module
jest.mock('react-native/Libraries/Utilities/Appearance', () => ({
  getColorScheme: jest.fn(() => 'light'),
  addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('ThemeProvider', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Clear the mock store
    await AsyncStorage.clear();
    // Default system scheme to light
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('light');
  });

  it('defaults to dark (OLED) on first launch when system is light', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.preference).toBe('dark');
    });

    expect(result.current.theme.mode).toBe('dark');
    expect(result.current.theme).toEqual(darkTheme);
  });

  it('defaults to dark (OLED) on first launch even when system is dark', async () => {
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.theme.mode).toBe('dark');
    });

    expect(result.current.preference).toBe('dark');
    expect(result.current.theme).toEqual(darkTheme);
  });

  it('loads persisted light preference from AsyncStorage', async () => {
    await AsyncStorage.setItem('@fasttrack:themePreference', 'light');
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.preference).toBe('light');
    });

    expect(result.current.theme.mode).toBe('light');
  });

  it('loads persisted dark preference from AsyncStorage', async () => {
    await AsyncStorage.setItem('@fasttrack:themePreference', 'dark');
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('light');

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.preference).toBe('dark');
    });

    expect(result.current.theme.mode).toBe('dark');
  });

  it('setTheme changes the active theme to dark', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    // App defaults to dark now — wait for load, switch to light, then back to dark.
    await waitFor(() => {
      expect(result.current.theme.mode).toBe('dark');
    });

    act(() => {
      result.current.setTheme('light');
    });
    await waitFor(() => {
      expect(result.current.theme.mode).toBe('light');
    });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.preference).toBe('dark');
    expect(result.current.theme.mode).toBe('dark');
    expect(result.current.theme).toEqual(darkTheme);
  });

  it('setTheme changes the active theme to light', async () => {
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.theme.mode).toBe('dark');
    });

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.preference).toBe('light');
    expect(result.current.theme.mode).toBe('light');
    expect(result.current.theme).toEqual(lightTheme);
  });

  it('setTheme persists preference to AsyncStorage', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    // Wait for load (defaults to dark), then persist a different value (light).
    await waitFor(() => {
      expect(result.current.theme.mode).toBe('dark');
    });

    act(() => {
      result.current.setTheme('light');
    });

    // Wait for async persistence
    await waitFor(async () => {
      const stored = await AsyncStorage.getItem('@fasttrack:themePreference');
      expect(stored).toBe('light');
    });
  });

  it('setTheme to system follows device preference', async () => {
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.theme.mode).toBe('dark');
    });

    // Set to light explicitly
    act(() => {
      result.current.setTheme('light');
    });
    expect(result.current.theme.mode).toBe('light');

    // Set back to system (which is dark)
    act(() => {
      result.current.setTheme('system');
    });
    expect(result.current.preference).toBe('system');
    expect(result.current.theme.mode).toBe('dark');
  });
});

describe('useTheme', () => {
  it('throws when used outside ThemeProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTheme());
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });
});

describe('createThemeManager', () => {
  it('getActiveTheme returns the current theme', () => {
    const mockContext: ThemeContextValue = {
      theme: lightTheme,
      preference: 'light',
      setTheme: jest.fn(),
    };

    const manager = createThemeManager(mockContext);
    expect(manager.getActiveTheme()).toEqual(lightTheme);
  });

  it('setTheme calls the context setTheme', () => {
    const setThemeMock = jest.fn();
    const mockContext: ThemeContextValue = {
      theme: lightTheme,
      preference: 'light',
      setTheme: setThemeMock,
    };

    const manager = createThemeManager(mockContext);
    manager.setTheme('dark');
    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });

  it('onThemeChange returns an unsubscribe function', () => {
    const mockContext: ThemeContextValue = {
      theme: lightTheme,
      preference: 'light',
      setTheme: jest.fn(),
    };

    const manager = createThemeManager(mockContext);
    const callback = jest.fn();
    const unsubscribe = manager.onThemeChange(callback);

    expect(typeof unsubscribe).toBe('function');
    // Calling unsubscribe should not throw
    unsubscribe();
  });
});
