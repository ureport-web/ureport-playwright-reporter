module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
      },
    }],
  },
  testTimeout: 90_000,
};
