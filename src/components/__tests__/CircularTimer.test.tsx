/**
 * Unit tests for CircularTimer component.
 *
 * Validates: Requirements 5.2, 5.3, 25.4, 29.1, 29.4
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { CircularTimer } from '../CircularTimer';

describe('CircularTimer', () => {
  const defaultProps = {
    progressFraction: 0.5,
    size: 240,
    strokeWidth: 16,
    arcColor: '#2E7D32',
    trackColor: '#E0E0E0',
    accessibilityLabel: 'Fasting timer: 50% complete, 08:00:00 remaining',
  };

  it('renders without crashing', () => {
    const { getByLabelText } = render(<CircularTimer {...defaultProps} />);
    expect(getByLabelText(defaultProps.accessibilityLabel)).toBeTruthy();
  });

  it('provides accessibility value with progress percentage', () => {
    const { getByLabelText } = render(<CircularTimer {...defaultProps} />);
    const timer = getByLabelText(defaultProps.accessibilityLabel);
    expect(timer.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 50,
    });
  });

  it('clamps progress fraction to 0 when negative', () => {
    const { getByLabelText } = render(
      <CircularTimer {...defaultProps} progressFraction={-0.5} />,
    );
    const timer = getByLabelText(defaultProps.accessibilityLabel);
    expect(timer.props.accessibilityValue.now).toBe(0);
  });

  it('clamps progress fraction to 100 when above 1', () => {
    const { getByLabelText } = render(
      <CircularTimer {...defaultProps} progressFraction={1.5} />,
    );
    const timer = getByLabelText(defaultProps.accessibilityLabel);
    expect(timer.props.accessibilityValue.now).toBe(100);
  });

  it('shows 0% progress when progressFraction is 0', () => {
    const { getByLabelText } = render(
      <CircularTimer {...defaultProps} progressFraction={0} />,
    );
    const timer = getByLabelText(defaultProps.accessibilityLabel);
    expect(timer.props.accessibilityValue.now).toBe(0);
  });

  it('shows 100% progress when progressFraction is 1', () => {
    const { getByLabelText } = render(
      <CircularTimer {...defaultProps} progressFraction={1} />,
    );
    const timer = getByLabelText(defaultProps.accessibilityLabel);
    expect(timer.props.accessibilityValue.now).toBe(100);
  });

  it('has progressbar accessibility role', () => {
    const { getByLabelText } = render(<CircularTimer {...defaultProps} />);
    const timer = getByLabelText(defaultProps.accessibilityLabel);
    expect(timer.props.accessibilityRole).toBe('progressbar');
  });
});
