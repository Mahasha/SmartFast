/**
 * Jest mock for react-native-svg.
 * Provides minimal React components that render as plain Views for testing.
 */
const React = require('react');
const { View } = require('react-native');

const createComponent = (name) => {
  const Component = (props) => React.createElement(View, { ...props, testID: name });
  Component.displayName = name;
  return Component;
};

module.exports = {
  __esModule: true,
  default: createComponent('Svg'),
  Svg: createComponent('Svg'),
  Circle: createComponent('Circle'),
  Rect: createComponent('Rect'),
  Path: createComponent('Path'),
  G: createComponent('G'),
  Line: createComponent('Line'),
  Text: createComponent('SvgText'),
  Defs: createComponent('Defs'),
  LinearGradient: createComponent('LinearGradient'),
  Stop: createComponent('Stop'),
};
