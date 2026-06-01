/**
 * Theme design tokens for FastTrack.
 *
 * Defines light and dark Theme objects with dark green accent,
 * pastel card palette, timer arc/track colors, and semantic colors.
 *
 * The dark theme is a true OLED-black, minimalist palette (#000000 background,
 * near-black surfaces, hairline borders) and is the app's default appearance.
 */

export interface Theme {
  mode: 'light' | 'dark';
  colors: {
    /** Dark green accent for primary actions, active states, highlights */
    primary: string;
    /** Screen background */
    background: string;
    /** Card/surface background */
    surface: string;
    /** Primary text */
    text: string;
    /** Secondary/muted text */
    textSecondary: string;
    /** Subtle border / hairline separator color */
    border: string;
    /** Circular timer progress arc color */
    timerArc: string;
    /** Circular timer background track color */
    timerTrack: string;
    /** Gold accent for the goal-reached / overtime state */
    goalAccent: string;
    /** Deterministic pastel palette for content cards */
    cardPastel: string[];
    /** Error state color */
    error: string;
    /** Warning state color */
    warning: string;
    /** Success state color */
    success: string;
    /** Lock indicator color for Pro-gated features */
    locked: string;
  };
}

export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Light theme tokens.
 * Uses a warm white background with dark green accent.
 */
export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    primary: '#2E7D32', // dark green accent
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#1C1C1E',
    textSecondary: '#6B7280',
    border: '#E5E5E5',
    timerArc: '#2E7D32',
    timerTrack: '#E0E0E0',
    goalAccent: '#C8A028', // gold
    cardPastel: [
      '#E8F5E9', // soft green
      '#E3F2FD', // soft blue
      '#FFF3E0', // soft orange
      '#F3E5F5', // soft purple
      '#E0F7FA', // soft cyan
      '#FFF9C4', // soft yellow
      '#FCE4EC', // soft pink
      '#E8EAF6', // soft indigo
    ],
    error: '#D32F2F',
    warning: '#F9A825',
    success: '#388E3C',
    locked: '#9E9E9E',
  },
};

/**
 * Dark theme tokens — true OLED black, minimalist.
 * Pure-black (#000000) background saves power on OLED panels; cards use a dark
 * grey (#1E1E1E) for slight elevation, with subtle borders. Keeps the muted
 * green accent for continuity.
 */
export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    primary: '#6DBE71', // muted green primary action color
    background: '#000000', // true OLED black
    surface: '#1E1E1E', // dark grey cards for slight elevation
    text: '#F5F5F5', // high-contrast primary text
    textSecondary: '#A0A0A0', // legible secondary text on #000000 and #1E1E1E
    border: '#2A2A2A', // subtle separators, visible on black and on cards
    timerArc: '#6DBE71',
    timerTrack: '#2A2A2A',
    goalAccent: '#FFD54F', // gold (lifted for dark backgrounds)
    cardPastel: [
      '#1B5E20', // muted green
      '#0D47A1', // muted blue
      '#E65100', // muted orange
      '#4A148C', // muted purple
      '#006064', // muted cyan
      '#F57F17', // muted yellow
      '#880E4F', // muted pink
      '#1A237E', // muted indigo
    ],
    error: '#EF5350',
    warning: '#FFB300',
    success: '#4CAF50',
    locked: '#757575',
  },
};

/**
 * Computes a stable hash from a string identifier.
 * Uses a simple djb2-style hash for deterministic results.
 */
export function stableHash(identifier: string): number {
  let hash = 5381;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash * 33) ^ identifier.charCodeAt(i);
  }
  // Ensure non-negative
  return Math.abs(hash);
}

/**
 * Returns a deterministic pastel card color for a given identifier.
 * Uses a stable hash of the identifier modulo the palette length.
 * Colors are NOT assigned randomly or by render index.
 *
 * @param identifier - Stable card identifier (e.g., planId, recipeId, metric name)
 * @param theme - The active theme containing the cardPastel palette
 * @returns A color string from the cardPastel palette
 */
export function getCardColor(identifier: string, theme: Theme): string {
  const index = stableHash(identifier) % theme.colors.cardPastel.length;
  return theme.colors.cardPastel[index]!;
}
