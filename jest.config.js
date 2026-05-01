/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        strict: true,
        noUncheckedIndexedAccess: true,
        forceConsistentCasingInFileNames: true,
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      },
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', { configFile: './babel.config.test.js' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|@react-native-async-storage/async-storage|react-native-svg|uuid)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['./jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
