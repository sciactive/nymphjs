import { createDefaultEsmPreset } from 'ts-jest';

const presetConfig = createDefaultEsmPreset();

/** @type {import('ts-jest').JestConfigWithTsJest} */
const jestConfig = {
  ...presetConfig,
  testEnvironment: 'node',
  rootDir: 'src/',
  moduleNameMapper: {
    '^(\\.|\\.\\.)\\/(.+)\\.js': '$1/$2',
  },
  testTimeout: 10000,
};

export default jestConfig;
