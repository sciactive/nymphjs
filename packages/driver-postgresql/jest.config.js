const jestConfig = {
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,ts,jsx,tsx,mjs,mts}',
    '<rootDir>/src/**/?(*.)(spec|test).{js,ts,jsx,tsx,mjs,mts}',
  ],
  transform: {
    '^.+\\.(ts|tsx|mts)$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: true,
          },
          target: 'es2023',
        },
        module: {
          type: 'commonjs',
        },
      },
    ],
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs)$'],
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^(\\.|\\.\\.)\\/(.+)\\.js': '$1/$2',
  },
};

export default jestConfig;
