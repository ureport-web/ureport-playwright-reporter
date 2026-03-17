import { validateOptions } from '../src/config';

describe('validateOptions', () => {
  const validBase = {
    serverUrl: 'http://localhost:4100',
    apiToken: 'test-token-abc123',
    product: 'MyApp',
    type: 'E2E',
  };

  test('returns merged options with defaults when all required fields provided', () => {
    const result = validateOptions(validBase);
    expect(result.serverUrl).toBe('http://localhost:4100');
    expect(result.batchSize).toBe(50);
    expect(result.includeSteps).toBe(true);
    expect(result.includeScreenshots).toBe(true);
    expect(typeof result.buildNumber).toBe('number');
  });

  test('uses provided buildNumber over default', () => {
    const result = validateOptions({ ...validBase, buildNumber: '42' });
    expect(result.buildNumber).toBe('42');
  });

  test.each(['serverUrl', 'apiToken', 'product', 'type'] as const)(
    'throws when required field "%s" is missing',
    (field) => {
      const opts = { ...validBase, [field]: undefined };
      expect(() => validateOptions(opts)).toThrow(
        `[ureport-reporter] Missing required option: "${field}"`
      );
    }
  );

  test('throws when required field is empty string', () => {
    expect(() => validateOptions({ ...validBase, serverUrl: '' })).toThrow(
      '[ureport-reporter] Missing required option: "serverUrl"'
    );
  });

  test('applies custom batchSize', () => {
    const result = validateOptions({ ...validBase, batchSize: 10 });
    expect(result.batchSize).toBe(10);
  });

  test('respects includeSteps: false', () => {
    const result = validateOptions({ ...validBase, includeSteps: false });
    expect(result.includeSteps).toBe(false);
  });

  test('respects optional fields', () => {
    const result = validateOptions({ ...validBase, team: 'QA', stage: 'staging' });
    expect(result.team).toBe('QA');
    expect(result.stage).toBe('staging');
  });
});
