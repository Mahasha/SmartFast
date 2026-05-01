/**
 * CircularTimer — A circular progress ring component for the fasting dashboard.
 *
 * Renders an SVG circle with a progress arc using react-native-svg.
 * The arc fills clockwise from the top (12 o'clock position).
 *
 * Validates: Requirements 5.2, 5.3, 25.4, 29.1, 29.4
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export interface CircularTimerProps {
  /** Progress fraction from 0 to 1 */
  progressFraction: number;
  /** Diameter of the timer circle in pixels */
  size: number;
  /** Width of the arc stroke */
  strokeWidth: number;
  /** Color of the progress arc (dark green accent) */
  arcColor: string;
  /** Color of the background track (muted) */
  trackColor: string;
  /** Accessible description of the timer state */
  accessibilityLabel: string;
}

/**
 * CircularTimer renders a circular progress ring using SVG.
 * The progress arc fills clockwise from the top.
 */
export function CircularTimer({
  progressFraction,
  size,
  strokeWidth,
  arcColor,
  trackColor,
  accessibilityLabel,
}: CircularTimerProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(1, Math.max(0, progressFraction));
  const strokeDashoffset = circumference * (1 - clampedProgress);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(clampedProgress * 100),
      }}
    >
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={arcColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
    </View>
  );
}
