import { mapStatus, generateUid, categorizeSteps, extractTags, mapTestToPayload, mapTestToRelationPayload, formatDuration, detectBrowser, detectDevice, detectPlatformVersion } from '../src/mapper';
import type { TestCase, TestResult, TestStep, FullProject } from '@playwright/test/reporter';
import type { UReportReporterOptions } from '../src/config';

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'test-1',
    title: 'my test',
    location: { file: '/project/tests/login.spec.ts', line: 10, column: 0 },
    titlePath: () => ['describe block', 'my test'],
    annotations: [],
    tags: [],
    ...overrides,
  } as unknown as TestCase;
}

function makeStep(overrides: Partial<TestStep> = {}): TestStep {
  return {
    title: 'click button',
    category: 'action',
    startTime: new Date('2024-01-01T00:00:00Z'),
    error: undefined,
    attachments: [],
    ...overrides,
  } as unknown as TestStep;
}

describe('formatDuration', () => {
  test.each([
    // milliseconds
    [0,         '0ms'],
    [1,         '1ms'],
    [999,       '999ms'],
    // seconds (boundary at 1000ms)
    [1_000,     '1.0s'],
    [1_500,     '1.5s'],
    [59_999,    '60.0s'],
    // minutes (boundary at 60 000ms)
    [60_000,    '1m 0s'],
    [90_000,    '1m 30s'],
    [3_599_999, '59m 59s'],
    // hours (boundary at 3 600 000ms)
    [3_600_000, '1h 0m'],
    [5_400_000, '1h 30m'],
    [7_384_000, '2h 3m'],
  ] as const)('%ims → %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe('mapStatus', () => {
  test.each([
    // Passed: isRerun distinguishes PASS vs RERUN_PASS
    ['passed',      false, 'PASS'],
    ['passed',      true,  'RERUN_PASS'],
    // Failed/timedOut: always FAIL regardless of retry — is_rerun carries the signal
    ['failed',      false, 'FAIL'],
    ['failed',      true,  'FAIL'],
    ['timedOut',    false, 'FAIL'],
    ['timedOut',    true,  'FAIL'],
    // Skipped/interrupted: always SKIP regardless of retry
    ['skipped',     false, 'SKIP'],
    ['skipped',     true,  'SKIP'],
    ['interrupted', false, 'SKIP'],
    ['interrupted', true,  'SKIP'],
  ] as const)('%s isRerun=%s → %s', (status, isRerun, expected) => {
    expect(mapStatus(status as TestResult['status'], isRerun)).toBe(expected);
  });
});

describe('generateUid', () => {
  test('uses the test title as uid when no annotation', () => {
    const tc = makeTestCase({ title: 'my test' });
    expect(generateUid(tc)).toBe('my test');
  });

  test('uses ureport-uid annotation value when present', () => {
    const tc = makeTestCase({
      annotations: [{ type: 'ureport-uid', description: 'TC-001' }],
    });
    expect(generateUid(tc)).toBe('TC-001');
  });

  test('annotation overrides the title', () => {
    const tc = makeTestCase({
      title: 'login flow',
      annotations: [{ type: 'ureport-uid', description: 'TC-LOGIN-001' }],
    });
    expect(generateUid(tc)).toBe('TC-LOGIN-001');
  });
});

describe('extractTags', () => {
  test('returns tags from testCase.tags', () => {
    const tc = makeTestCase({ tags: ['@smoke', '@regression'] });
    expect(extractTags(tc)).toEqual(expect.arrayContaining(['@smoke', '@regression']));
  });

  test('extracts @-prefixed words from the test title', () => {
    const tc = makeTestCase({ title: 'login flow @p1 @critical' });
    expect(extractTags(tc)).toEqual(expect.arrayContaining(['@p1', '@critical']));
  });

  test('combines and deduplicates tags from both sources', () => {
    const tc = makeTestCase({ title: 'checkout @smoke', tags: ['@smoke', '@p1'] });
    const tags = extractTags(tc);
    expect(tags).toEqual(expect.arrayContaining(['@smoke', '@p1']));
    expect(tags.filter((t) => t === '@smoke')).toHaveLength(1); // no duplicates
  });

  test('returns empty array when no tags anywhere', () => {
    const tc = makeTestCase({ title: 'plain test with no tags', tags: [] });
    expect(extractTags(tc)).toEqual([]);
  });

  test('ignores words without @ prefix in the title', () => {
    const tc = makeTestCase({ title: 'test without prefix smoke regression', tags: [] });
    expect(extractTags(tc)).toEqual([]);
  });
});

describe('categorizeSteps', () => {
  test('puts non-hook steps in body', () => {
    const step = makeStep({ category: 'action', title: 'click button' });
    const result = categorizeSteps([step], false);
    expect(result.body).toHaveLength(1);
    expect(result.setup).toHaveLength(0);
    expect(result.teardown).toHaveLength(0);
  });

  test('puts beforeEach/beforeAll hook steps in setup', () => {
    const step = makeStep({ category: 'hook', title: 'beforeEach hook' });
    const result = categorizeSteps([step], false);
    expect(result.setup).toHaveLength(1);
    expect(result.body).toHaveLength(0);
    expect(result.teardown).toHaveLength(0);
  });

  test('puts afterEach/afterAll hook steps in teardown', () => {
    const step = makeStep({ category: 'hook', title: 'afterEach hook' });
    const result = categorizeSteps([step], false);
    expect(result.teardown).toHaveLength(1);
  });

  test('maps step status based on error presence', () => {
    const passing = makeStep({ error: undefined });
    const failing = makeStep({ error: { message: 'oops' } as never });
    const result = categorizeSteps([passing, failing], false);
    expect(result.body[0].status).toBe('PASS');
    expect(result.body[1].status).toBe('FAIL');
  });

  test('sets correct timestamp and detail', () => {
    const date = new Date('2024-03-01T12:00:00Z');
    const step = makeStep({ startTime: date, title: 'navigate to page' });
    const result = categorizeSteps([step], false);
    expect(result.body[0].timestamp).toBe('2024-03-01T12:00:00.000Z');
    expect(result.body[0].detail).toBe('navigate to page');
  });

  test('does not include attachment when includeScreenshots is false', () => {
    const step = makeStep({
      attachments: [{ name: 'screenshot', contentType: 'image/png', path: '/tmp/shot.png' }],
    });
    const result = categorizeSteps([step], false);
    expect(result.body[0].attachment).toBeUndefined();
  });
});

describe('categorizeSteps — nested steps', () => {
  test('nested child appears under parent steps, not as a sibling', () => {
    const child = makeStep({ title: 'inner step', category: 'test.step', steps: [] });
    const parent = makeStep({ title: 'outer step', category: 'test.step', steps: [child] });
    const result = categorizeSteps([parent, child], false);
    expect(result.body).toHaveLength(1);
    expect(result.body[0].detail).toBe('outer step');
    expect(result.body[0].steps).toHaveLength(1);
    expect(result.body[0].steps![0].detail).toBe('inner step');
  });

  test('double-counting is prevented: flat array with parent+child → only parent in output', () => {
    const child = makeStep({ title: 'child', category: 'test.step', steps: [] });
    const parent = makeStep({ title: 'parent', category: 'test.step', steps: [child] });
    const result = categorizeSteps([parent, child], false);
    expect(result.body).toHaveLength(1);
    expect(result.body[0].detail).toBe('parent');
  });

  test('parent step without children has no steps field', () => {
    const step = makeStep({ title: 'solo step', category: 'test.step', steps: [] });
    const result = categorizeSteps([step], false);
    expect(result.body[0].steps).toBeUndefined();
  });

  test('multi-level nesting (grandchild) is preserved', () => {
    const grandchild = makeStep({ title: 'grandchild', category: 'test.step', steps: [] });
    const child = makeStep({ title: 'child', category: 'test.step', steps: [grandchild] });
    const parent = makeStep({ title: 'parent', category: 'test.step', steps: [child] });
    const result = categorizeSteps([parent, child, grandchild], false);
    expect(result.body).toHaveLength(1);
    expect(result.body[0].steps).toHaveLength(1);
    expect(result.body[0].steps![0].steps).toHaveLength(1);
    expect(result.body[0].steps![0].steps![0].detail).toBe('grandchild');
  });

  test('internal test.attach child steps are excluded from nested steps', () => {
    const attachStep = makeStep({ title: 'attach internal', category: 'test.attach', steps: [] });
    const userStep = makeStep({ title: 'user action', category: 'test.step', steps: [] });
    const parent = makeStep({ title: 'outer', category: 'test.step', steps: [attachStep, userStep] });
    const result = categorizeSteps([parent], false);
    expect(result.body[0].steps).toHaveLength(1);
    expect(result.body[0].steps![0].detail).toBe('user action');
  });
});

function makeResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    retry: 0,
    status: 'passed',
    startTime: new Date('2024-01-01T00:00:00Z'),
    duration: 1234,
    errors: [],
    attachments: [],
    steps: [],
    ...overrides,
  } as unknown as TestResult;
}

function makeOptions(overrides: Partial<UReportReporterOptions> = {}): UReportReporterOptions {
  return {
    serverUrl: 'http://localhost',
    apiToken: 'test-token',
    product: 'MyApp',
    type: 'E2E',
    ...overrides,
  };
}

describe('mapTestToPayload — custom relations and duration', () => {
  test('adds duration to info as a formatted string', () => {
    const tc = makeTestCase();
    const result = makeResult({ duration: 4200 });
    const payload = mapTestToPayload(tc, result, 'build-1', [], makeOptions(), '/project');
    expect(payload.info?.duration).toBe('4.2s');
  });

  test('maps non-ureport-uid annotations as custom relation keys on info', () => {
    const tc = makeTestCase({
      annotations: [
        { type: 'jira', description: 'PROJ-123' },
        { type: 'owner', description: 'alice' },
      ],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions(), '/project');
    expect(payload.info?.['jira']).toBe('PROJ-123');
    expect(payload.info?.['owner']).toBe('alice');
  });

  test('components annotation is collected into an array', () => {
    const tc = makeTestCase({
      annotations: [
        { type: 'components', description: 'auth' },
        { type: 'components', description: 'checkout' },
      ],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions(), '/project');
    expect(payload.info?.components).toEqual(['auth', 'checkout']);
  });

  test('teams annotation is collected into an array', () => {
    const tc = makeTestCase({
      annotations: [
        { type: 'teams', description: 'backend' },
        { type: 'teams', description: 'platform' },
      ],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions(), '/project');
    expect(payload.info?.teams).toEqual(['backend', 'platform']);
  });

  test('single components annotation produces a one-element array', () => {
    const tc = makeTestCase({
      annotations: [{ type: 'components', description: 'login' }],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions(), '/project');
    expect(payload.info?.components).toEqual(['login']);
  });

  test('ureport-uid annotation is not added as a custom relation', () => {
    const tc = makeTestCase({
      annotations: [{ type: 'ureport-uid', description: 'TC-001' }],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions(), '/project');
    expect(payload.info?.['ureport-uid']).toBeUndefined();
  });

  test('annotations without description are ignored', () => {
    const tc = makeTestCase({
      annotations: [{ type: 'jira' }],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions(), '/project');
    expect(payload.info?.['jira']).toBeUndefined();
  });
});

describe('mapTestToRelationPayload', () => {
  function makeTestPayload(overrides: Partial<ReturnType<typeof mapTestToPayload>> = {}) {
    return {
      uid: 'my test',
      name: 'my test',
      build: 'build-1',
      status: 'PASS' as const,
      start_time: '',
      end_time: '',
      is_rerun: false,
      info: {
        file: 'login.spec.ts',
        path: 'tests',
        tags: ['@smoke'],
        duration: '1.0s',
      },
      ...overrides,
    };
  }

  test('sets uid, product, type from test and options', () => {
    const rel = mapTestToRelationPayload(makeTestPayload(), makeOptions());
    expect(rel.uid).toBe('my test');
    expect(rel.product).toBe('MyApp');
    expect(rel.type).toBe('E2E');
  });

  test('maps file, path, tags, components, teams from info', () => {
    const rel = mapTestToRelationPayload(
      makeTestPayload({
        info: { file: 'a.spec.ts', path: 'tests', tags: ['@smoke'], components: ['auth'], teams: ['backend'], duration: '1s' },
      }),
      makeOptions()
    );
    expect(rel.file).toBe('a.spec.ts');
    expect(rel.path).toBe('tests');
    expect(rel.tags).toEqual(['@smoke']);
    expect(rel.components).toEqual(['auth']);
    expect(rel.teams).toEqual(['backend']);
  });

  test('puts non-reserved info keys into customs', () => {
    const rel = mapTestToRelationPayload(
      makeTestPayload({ info: { file: 'a.spec.ts', path: 'tests', tags: [], duration: '1s', jira: 'PROJ-1', owner: 'alice' } }),
      makeOptions()
    );
    expect(rel.customs).toEqual({ jira: 'PROJ-1', owner: 'alice' });
  });

  test('duration is not included in the relation', () => {
    const rel = mapTestToRelationPayload(makeTestPayload(), makeOptions());
    expect(rel.customs?.['duration']).toBeUndefined();
    expect((rel as unknown as Record<string, unknown>)['duration']).toBeUndefined();
  });

  test('omits empty tags/components/teams', () => {
    const rel = mapTestToRelationPayload(
      makeTestPayload({ info: { file: 'a.spec.ts', path: 'tests', tags: [], duration: '1s' } }),
      makeOptions()
    );
    expect(rel.tags).toBeUndefined();
    expect(rel.components).toBeUndefined();
    expect(rel.teams).toBeUndefined();
  });

  test('omits customs when no non-reserved keys exist', () => {
    const rel = mapTestToRelationPayload(makeTestPayload(), makeOptions());
    expect(rel.customs).toBeUndefined();
  });
});

describe('quickInfo annotations', () => {
  test('quickInfo annotation goes to info.quickInfo as [{ key, value }], not top-level', () => {
    const tc = makeTestCase({
      annotations: [{ type: 'trace_url', description: 'https://trace.example.com/123' }],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions({ quickInfoAnnotations: ['trace_url'] }), '/project');
    expect(payload.info?.quickInfo).toEqual([{ key: 'trace_url', value: 'https://trace.example.com/123' }]);
    expect(payload.info?.['trace_url']).toBeUndefined();
  });

  test('multiple quickInfo annotations accumulate into the array', () => {
    const tc = makeTestCase({
      annotations: [
        { type: 'trace_url', description: 'https://trace.example.com/123' },
        { type: 'session_id', description: 'abc-456' },
        { type: 'trace_url', description: 'https://trace.example.com/456' },
      ],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions({ quickInfoAnnotations: ['trace_url', 'session_id'] }), '/project');
    expect(payload.info?.quickInfo).toEqual([
      { key: 'trace_url', value: 'https://trace.example.com/123' },
      { key: 'session_id', value: 'abc-456' },
      { key: 'trace_url', value: 'https://trace.example.com/456' },
    ]);
  });

  test('non-quickInfo annotations are unaffected and still top-level on info', () => {
    const tc = makeTestCase({
      annotations: [
        { type: 'trace_url', description: 'https://trace.example.com/123' },
        { type: 'jira', description: 'PROJ-42' },
      ],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions({ quickInfoAnnotations: ['trace_url'] }), '/project');
    expect(payload.info?.['jira']).toBe('PROJ-42');
    expect(payload.info?.quickInfo).toEqual([{ key: 'trace_url', value: 'https://trace.example.com/123' }]);
  });

  test('mapTestToRelationPayload — quickInfo does NOT appear in relation.customs', () => {
    const tc = makeTestCase({
      annotations: [{ type: 'trace_url', description: 'https://trace.example.com/123' }],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions({ quickInfoAnnotations: ['trace_url'] }), '/project');
    const rel = mapTestToRelationPayload(payload, makeOptions({ quickInfoAnnotations: ['trace_url'] }));
    expect(rel.customs?.['quickInfo']).toBeUndefined();
    expect(rel.customs?.['trace_url']).toBeUndefined();
  });

  test('mapTestToRelationPayload — normal custom annotations still appear in relation.customs', () => {
    const tc = makeTestCase({
      annotations: [
        { type: 'trace_url', description: 'https://trace.example.com/123' },
        { type: 'jira', description: 'PROJ-42' },
      ],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions({ quickInfoAnnotations: ['trace_url'] }), '/project');
    const rel = mapTestToRelationPayload(payload, makeOptions({ quickInfoAnnotations: ['trace_url'] }));
    expect(rel.customs?.['jira']).toBe('PROJ-42');
  });
});

describe('testTransform option', () => {
  test('testTransform returns name → payload.name uses it', () => {
    const tc = makeTestCase({ title: '4Y-425 canvasSsfBiddingTest' });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [],
      makeOptions({ testTransform: () => ({ name: '[4Y] canvasSsfBiddingTest' }) }),
      '/project');
    expect(payload.name).toBe('[4Y] canvasSsfBiddingTest');
  });

  test('testTransform returns name → payload.uid uses transformed name', () => {
    const tc = makeTestCase({ title: '4Y-425 canvasSsfBiddingTest' });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [],
      makeOptions({ testTransform: () => ({ name: '[4Y] canvasSsfBiddingTest' }) }),
      '/project');
    expect(payload.uid).toBe('[4Y] canvasSsfBiddingTest');
  });

  test('ureport-uid annotation always wins over transformedName for uid', () => {
    const tc = makeTestCase({
      title: '4Y-425 canvasSsfBiddingTest',
      annotations: [{ type: 'ureport-uid', description: 'STABLE-UID-001' }],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [],
      makeOptions({ testTransform: () => ({ name: '[4Y] canvasSsfBiddingTest' }) }),
      '/project');
    expect(payload.uid).toBe('STABLE-UID-001');
    expect(payload.name).toBe('[4Y] canvasSsfBiddingTest');
  });

  test('testTransform returns empty object → payload.name and uid fall back to testCase.title', () => {
    const tc = makeTestCase({ title: 'plain test' });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [],
      makeOptions({ testTransform: () => ({}) }),
      '/project');
    expect(payload.name).toBe('plain test');
    expect(payload.uid).toBe('plain test');
  });

  test('testTransform not provided → no change in behavior', () => {
    const tc = makeTestCase({ title: 'plain test' });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], makeOptions(), '/project');
    expect(payload.name).toBe('plain test');
    expect(payload.uid).toBe('plain test');
  });

  test('testTransform returns relations → they appear as info keys', () => {
    const tc = makeTestCase({ title: '4Y-425 canvasSsfBiddingTest' });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [],
      makeOptions({
        testTransform: () => ({
          relations: { companyCode: '4Y', companyId: '425' },
        }),
      }),
      '/project');
    expect(payload.info?.['companyCode']).toBe('4Y');
    expect(payload.info?.['companyId']).toBe('425');
  });

  test('testTransform relations flow into rel.customs via mapTestToRelationPayload', () => {
    const tc = makeTestCase({ title: '4Y-425 canvasSsfBiddingTest' });
    const opts = makeOptions({
      testTransform: () => ({
        relations: { companyCode: '4Y', companyId: '425' },
      }),
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [], opts, '/project');
    const rel = mapTestToRelationPayload(payload, opts);
    expect(rel.customs?.['companyCode']).toBe('4Y');
    expect(rel.customs?.['companyId']).toBe('425');
  });

  test('annotation overrides transform relation when both set the same key', () => {
    const tc = makeTestCase({
      title: '4Y-425 canvasSsfBiddingTest',
      annotations: [{ type: 'companyCode', description: 'OVERRIDE' }],
    });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [],
      makeOptions({
        testTransform: () => ({ relations: { companyCode: '4Y' } }),
      }),
      '/project');
    expect(payload.info?.['companyCode']).toBe('OVERRIDE');
  });

  test('testTransform relation with string[] value is stored as-is', () => {
    const tc = makeTestCase({ title: 'my test' });
    const payload = mapTestToPayload(tc, makeResult(), 'build-1', [],
      makeOptions({
        testTransform: () => ({ relations: { markets: ['US', 'EU'] } }),
      }),
      '/project');
    expect(payload.info?.['markets']).toEqual(['US', 'EU']);
  });

  test('ctx passed to testTransform contains browser/device/platform from options', () => {
    const tc = makeTestCase({ title: 'my test' });
    let capturedCtx: Record<string, unknown> = {};
    mapTestToPayload(tc, makeResult(), 'build-1', [],
      makeOptions({
        browser: 'CHROME',
        device: 'DESKTOP',
        platform: 'macOS',
        platform_version: '14.0',
        stage: 'staging',
        version: '1.2.3',
        team: 'alpha',
        testTransform: (_tc, ctx) => { capturedCtx = ctx as Record<string, unknown>; return {}; },
      }),
      '/project');
    expect(capturedCtx['browser']).toBe('CHROME');
    expect(capturedCtx['device']).toBe('DESKTOP');
    expect(capturedCtx['platform']).toBe('macOS');
    expect(capturedCtx['platform_version']).toBe('14.0');
    expect(capturedCtx['stage']).toBe('staging');
    expect(capturedCtx['version']).toBe('1.2.3');
    expect(capturedCtx['team']).toBe('alpha');
  });

  test('ctx uses resolvedBrowser/resolvedDevice over options.browser/device (auto-detected values)', () => {
    const tc = makeTestCase({ title: 'my test' });
    let capturedCtx: Record<string, unknown> = {};
    mapTestToPayload(tc, makeResult(), 'build-1', [],
      makeOptions({
        testTransform: (_tc, ctx) => { capturedCtx = ctx as Record<string, unknown>; return {}; },
      }),
      '/project',
      'CHROMIUM',   // resolvedBrowser (auto-detected by reporter)
      'MOBILE-IPHONE', // resolvedDevice (auto-detected by reporter)
    );
    expect(capturedCtx['browser']).toBe('CHROMIUM');
    expect(capturedCtx['device']).toBe('MOBILE-IPHONE');
  });
});

function makeProject(use: Record<string, unknown>): FullProject {
  return { use } as unknown as FullProject;
}

describe('detectBrowser', () => {
  test('chromium project → CHROMIUM', () => {
    expect(detectBrowser(makeProject({ browserName: 'chromium' }))).toBe('CHROMIUM');
  });

  test('webkit project → SAFARI', () => {
    expect(detectBrowser(makeProject({ browserName: 'webkit' }))).toBe('SAFARI');
  });

  test('firefox project → FIREFOX', () => {
    expect(detectBrowser(makeProject({ browserName: 'firefox' }))).toBe('FIREFOX');
  });

  test('channel chrome-beta → CHROME', () => {
    expect(detectBrowser(makeProject({ channel: 'chrome-beta' }))).toBe('CHROME');
  });

  test('channel msedge → EDGE', () => {
    expect(detectBrowser(makeProject({ channel: 'msedge' }))).toBe('EDGE');
  });
});

describe('detectDevice', () => {
  const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)';
  const androidUA = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36';
  const windowsUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  test('iPhone user agent + isMobile → MOBILE-IPHONE', () => {
    expect(detectDevice(makeProject({ isMobile: true, userAgent: iphoneUA }))).toBe('MOBILE-IPHONE');
  });

  test('Android Pixel 5 user agent + isMobile → MOBILE-PIXEL 5', () => {
    expect(detectDevice(makeProject({ isMobile: true, userAgent: androidUA }))).toBe('MOBILE-PIXEL 5');
  });

  test('isMobile=false + Windows user agent → DESKTOP-WINDOWS', () => {
    expect(detectDevice(makeProject({ isMobile: false, userAgent: windowsUA }))).toBe('DESKTOP-WINDOWS');
  });

  test('isMobile=true + no user agent → MOBILE', () => {
    expect(detectDevice(makeProject({ isMobile: true }))).toBe('MOBILE');
  });

  test('no isMobile → undefined', () => {
    expect(detectDevice(makeProject({}))).toBeUndefined();
  });
});

describe('detectPlatformVersion', () => {
  test('returns a non-empty string', () => {
    expect(typeof detectPlatformVersion()).toBe('string');
    expect(detectPlatformVersion().length).toBeGreaterThan(0);
  });
});
