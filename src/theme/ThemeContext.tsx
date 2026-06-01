/**
 * ThemeContext — React context providing theme management for FastTrack.
 *
 * Implements the ThemeManager interface from the design:
 * - getActiveTheme(): returns the currently resolved Theme
 * - setTheme(preference): sets user preference and persists to AsyncStorage
 * - onThemeChange(callback): subscribes to theme changes, returns unsubscribe fn
 *
 * System-theme detection uses the react-native Appearance API.
 * Defaults to dark (OLED) on first launch; switchable to light or system in Settings.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../utils/constants';
import {
  Theme,
  ThemePreference,
  darkTheme,
  lightTheme,
} from './tokens';

// ---------------------------------------------------------------------------
// ThemeManager interface (matches design doc)
// ---------------------------------------------------------------------------

export interface ThemeManager {
  getActiveTheme(): Theme;
  setTheme(preference: ThemePreference): void;
  onThemeChange(callback: (theme: Theme) => void): () => void;
}

// ---------------------------------------------------------------------------
// Context value type exposed to consumers
// ---------------------------------------------------------------------------

export interface ThemeContextValue {
  /** The currently active resolved theme */
  theme: Theme;
  /** The user's stored preference ('light' | 'dark' | 'system') */
  preference: ThemePreference;
  /** Update the theme preference */
  setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the effective theme based on user preference and system color scheme.
 */
function resolveTheme(
  preference: ThemePreference,
  systemScheme: ColorSchemeName,
): Theme {
  if (preference === 'light') return lightTheme;
  if (preference === 'dark') return darkTheme;
  // 'system' — follow device preference, default to light if indeterminate
  return systemScheme === 'dark' ? darkTheme : lightTheme;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Default to dark (OLED) on first launch. Users can switch to light/system.
  const [preference, setPreference] = useState<ThemePreference>('dark');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme(),
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Subscribers for onThemeChange
  const listenersRef = useRef<Set<(theme: Theme) => void>>(new Set());

  // Resolve the active theme
  const theme = resolveTheme(preference, systemScheme);

  // Load persisted preference on mount
  useEffect(() => {
    async function loadPreference() {
      try {
        const stored = await AsyncStorage.getItem(
          STORAGE_KEYS.THEME_PREFERENCE,
        );
        if (
          stored === 'light' ||
          stored === 'dark' ||
          stored === 'system'
        ) {
          setPreference(stored);
        }
        // If nothing stored, default remains 'dark' (OLED)
      } catch {
        // Silently default to 'system' on read failure
      } finally {
        setIsLoaded(true);
      }
    }
    loadPreference();
  }, []);

  // Listen for system appearance changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  // Notify listeners when theme changes
  const prevThemeModeRef = useRef<string>(theme.mode);
  useEffect(() => {
    if (!isLoaded) return;
    if (prevThemeModeRef.current !== theme.mode) {
      prevThemeModeRef.current = theme.mode;
      listenersRef.current.forEach((cb) => cb(theme));
    }
  }, [theme, isLoaded]);

  // setTheme — persists preference and updates state
  const handleSetTheme = useCallback((newPreference: ThemePreference) => {
    setPreference(newPreference);
    AsyncStorage.setItem(STORAGE_KEYS.THEME_PREFERENCE, newPreference).catch(
      () => {
        // Non-critical: preference will default to 'system' on next launch
      },
    );
  }, []);

  const contextValue: ThemeContextValue = {
    theme,
    preference,
    setTheme: handleSetTheme,
  };

  // Don't render children until preference is loaded to avoid flash
  if (!isLoaded) return null;

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook to access the current theme and theme management functions.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// ---------------------------------------------------------------------------
// ThemeManager factory (imperative API matching design interface)
// ---------------------------------------------------------------------------

/**
 * Creates a ThemeManager instance that wraps the context-based implementation.
 * Useful for domain-layer code that needs theme access outside React components.
 *
 * NOTE: For most UI code, prefer the useTheme() hook directly.
 */
export function createThemeManager(contextValue: ThemeContextValue): ThemeManager {
  const listeners = new Set<(theme: Theme) => void>();

  return {
    getActiveTheme(): Theme {
      return contextValue.theme;
    },

    setTheme(pref: ThemePreference): void {
      contextValue.setTheme(pref);
    },

    onThemeChange(callback: (theme: Theme) => void): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
}
