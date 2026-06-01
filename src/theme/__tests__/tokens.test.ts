/**
 * Unit tests for theme tokens: stableHash, getCardColor, lightTheme, darkTheme.
 *
 * Validates: Requirements 25.1, 25.2, 25.3, 25.4, 25.5
 */

import { stableHash, getCardColor, lightTheme, darkTheme, Theme } from '../tokens';

describe('stableHash', () => {
  it('produces consistent results for the same input', () => {
    const result1 = stableHash('test-identifier');
    const result2 = stableHash('test-identifier');
    expect(result1).toBe(result2);
  });

  it('produces consistent results across multiple calls with various inputs', () => {
    const inputs = ['planId-123', 'recipeId-abc', 'water', 'weight', 'calories'];
    for (const input of inputs) {
      expect(stableHash(input)).toBe(stableHash(input));
    }
  });

  it('produces different results for different inputs', () => {
    const hash1 = stableHash('plan-16:8');
    const hash2 = stableHash('plan-18:6');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different results for similar but distinct strings', () => {
    const hash1 = stableHash('abc');
    const hash2 = stableHash('abd');
    expect(hash1).not.toBe(hash2);
  });

  it('returns a non-negative number', () => {
    const testCases = ['', 'a', 'hello world', '🎉', 'very-long-identifier-string-12345'];
    for (const input of testCases) {
      const result = stableHash(input);
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles empty string', () => {
    const result = stableHash('');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('handles special characters', () => {
    const result = stableHash('plan:16/8-custom!@#$');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('getCardColor', () => {
  it('returns a deterministic color for the same identifier', () => {
    const color1 = getCardColor('plan-16:8', lightTheme);
    const color2 = getCardColor('plan-16:8', lightTheme);
    expect(color1).toBe(color2);
  });

  it('returns a color from the cardPastel palette', () => {
    const color = getCardColor('some-id', lightTheme);
    expect(lightTheme.colors.cardPastel).toContain(color);
  });

  it('returns a color from the dark theme palette when using dark theme', () => {
    const color = getCardColor('some-id', darkTheme);
    expect(darkTheme.colors.cardPastel).toContain(color);
  });

  it('uses modulo correctly for palette wrapping', () => {
    // Generate many identifiers and verify all results are within palette bounds
    const identifiers = Array.from({ length: 100 }, (_, i) => `item-${i}`);
    for (const id of identifiers) {
      const color = getCardColor(id, lightTheme);
      expect(lightTheme.colors.cardPastel).toContain(color);
    }
  });

  it('produces stable colors across different theme objects with same palette', () => {
    // Same identifier should map to the same index regardless of theme,
    // but the actual color depends on the theme's palette
    const id = 'test-card';
    const lightColor = getCardColor(id, lightTheme);
    const darkColor = getCardColor(id, darkTheme);

    // Both should be valid palette entries for their respective themes
    expect(lightTheme.colors.cardPastel).toContain(lightColor);
    expect(darkTheme.colors.cardPastel).toContain(darkColor);

    // The index should be the same (same hash % same length)
    const lightIndex = lightTheme.colors.cardPastel.indexOf(lightColor);
    const darkIndex = darkTheme.colors.cardPastel.indexOf(darkColor);
    expect(lightIndex).toBe(darkIndex);
  });

  it('does not assign colors randomly — same id always gets same color', () => {
    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(getCardColor('stable-test', lightTheme));
    }
    // All results should be identical
    expect(new Set(results).size).toBe(1);
  });
});

describe('lightTheme', () => {
  it('has mode set to light', () => {
    expect(lightTheme.mode).toBe('light');
  });

  it('has all required color properties', () => {
    const requiredKeys: (keyof Theme['colors'])[] = [
      'primary',
      'background',
      'surface',
      'text',
      'textSecondary',
      'border',
      'timerArc',
      'timerTrack',
      'cardPastel',
      'error',
      'warning',
      'success',
      'locked',
    ];
    for (const key of requiredKeys) {
      expect(lightTheme.colors[key]).toBeDefined();
    }
  });

  it('has a dark green primary accent color', () => {
    // Dark green should be in the green spectrum
    expect(lightTheme.colors.primary).toBe('#2E7D32');
  });

  it('has a non-empty cardPastel palette', () => {
    expect(lightTheme.colors.cardPastel.length).toBeGreaterThan(0);
  });

  it('uses dark green accent for timerArc', () => {
    expect(lightTheme.colors.timerArc).toBe('#2E7D32');
  });
});

describe('darkTheme', () => {
  it('has mode set to dark', () => {
    expect(darkTheme.mode).toBe('dark');
  });

  it('has all required color properties', () => {
    const requiredKeys: (keyof Theme['colors'])[] = [
      'primary',
      'background',
      'surface',
      'text',
      'textSecondary',
      'border',
      'timerArc',
      'timerTrack',
      'cardPastel',
      'error',
      'warning',
      'success',
      'locked',
    ];
    for (const key of requiredKeys) {
      expect(darkTheme.colors[key]).toBeDefined();
    }
  });

  it('has a lighter green primary for dark backgrounds', () => {
    expect(darkTheme.colors.primary).toBe('#6DBE71');
  });

  it('uses a true OLED black background', () => {
    expect(darkTheme.colors.background).toBe('#000000');
  });

  it('uses a dark-grey surface and a subtle border', () => {
    expect(darkTheme.colors.surface).toBe('#1E1E1E');
    expect(darkTheme.colors.border).toBe('#2A2A2A');
  });

  it('has a non-empty cardPastel palette', () => {
    expect(darkTheme.colors.cardPastel.length).toBeGreaterThan(0);
  });

  it('has same palette length as light theme', () => {
    expect(darkTheme.colors.cardPastel.length).toBe(lightTheme.colors.cardPastel.length);
  });

  it('uses lighter green accent for timerArc in dark mode', () => {
    expect(darkTheme.colors.timerArc).toBe('#6DBE71');
  });
});
