/**
 * Accessibility Utilities — Helpers for WCAG compliance in FastTrack.
 *
 * Provides:
 * - Dynamic text sizing support
 * - Contrast ratio verification
 * - Accessibility label helpers
 *
 * Validates: Requirements 29.1, 29.2, 29.3, 29.4, 29.5, 29.6
 */

import { PixelRatio, Platform } from 'react-native';

// ─── Dynamic Text Sizing ─────────────────────────────────────────────────────

/**
 * Returns a font size that respects the user's system text size preference.
 * Uses PixelRatio.getFontScale() to scale text proportionally.
 *
 * Validates: Requirement 29.3 (dynamic text sizing)
 */
export function scaledFontSize(baseFontSize: number): number {
  const fontScale = PixelRatio.getFontScale();
  return Math.round(baseFontSize * fontScale);
}

/**
 * Returns whether the user has increased their system font size.
 * Useful for conditionally adjusting layouts.
 */
export function isLargeTextEnabled(): boolean {
  return PixelRatio.getFontScale() > 1.0;
}

// ─── Contrast Ratio Verification ─────────────────────────────────────────────

/**
 * Calculates the relative luminance of a hex color.
 * Based on WCAG 2.1 formula.
 */
function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = rgb.map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/**
 * Converts a hex color string to RGB array.
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return null;

  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

/**
 * Calculates the contrast ratio between two colors.
 * Returns a value between 1 and 21.
 *
 * WCAG AA requirements:
 * - Normal text: minimum 4.5:1
 * - Large text (18pt+ or 14pt+ bold): minimum 3:1
 *
 * Validates: Requirements 29.4, 29.5
 */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Checks if a color combination meets WCAG AA contrast requirements.
 *
 * @param foreground - Text color (hex)
 * @param background - Background color (hex)
 * @param isLargeText - Whether the text is large (18pt+ or 14pt+ bold)
 * @returns true if contrast ratio meets the minimum requirement
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  isLargeText: boolean = false,
): boolean {
  const ratio = contrastRatio(foreground, background);
  const minimumRatio = isLargeText ? 3.0 : 4.5;
  return ratio >= minimumRatio;
}

// ─── Accessibility Label Helpers ─────────────────────────────────────────────

/**
 * Formats a duration for screen reader announcement.
 * E.g., "2 hours 30 minutes remaining"
 */
export function formatDurationForScreenReader(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (hours === 0 && minutes === 0) {
    parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  }

  return parts.join(' ');
}

/**
 * Creates an accessibility hint for interactive elements.
 * Provides context about what will happen when the element is activated.
 */
export function createAccessibilityHint(action: string): string {
  return Platform.OS === 'android'
    ? `Double tap to ${action}`
    : action;
}

/**
 * Minimum touch target size for accessibility (48x48 dp).
 * Validates: Requirement 29.6 (interactive controls distinguishable)
 */
export const MIN_TOUCH_TARGET = 48;
