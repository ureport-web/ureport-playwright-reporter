import { readFileSync } from 'fs';
import { basename, dirname, relative } from 'path';
import type { TestCase, TestResult, TestStep, FullProject, FullConfig } from '@playwright/test/reporter';
import type { UReportStepPayload, UReportTestPayload, UReportTestRelationPayload, UReportTestInfo, UReportStatus } from './types.js';
import type { UReportReporterOptions } from './config.js';


function detectOsFromUserAgent(userAgent: string): string {
  if (/\(X11; CrOS/i.test(userAgent)) return 'ChromeOS';
  if (/Windows NT/i.test(userAgent)) return 'Windows';
  if (/Macintosh/i.test(userAgent)) return 'macOS';
  if (/X11.*Linux/i.test(userAgent)) return 'Linux';
  return 'Unknown';
}

export function detectDevice(project: FullProject): string | undefined {
  const use = project.use as Record<string, unknown>;
  const userAgent = use.userAgent as string | undefined;
  const isMobile = use.isMobile as boolean | undefined;

  if (isMobile) {
    let model: string | undefined;
    if (userAgent) {
      if (/\(iPhone[;)]/i.test(userAgent)) model = 'iPhone';
      else if (/\(iPad[;)]/i.test(userAgent)) model = 'iPad';
      else {
        const androidMatch = userAgent.match(/\(Linux; Android [^;]+; ([^)]+)\)/);
        if (androidMatch) model = androidMatch[1].trim();
      }
    }
    return model ? `MOBILE-${model}` : 'MOBILE';
  }

  if (isMobile === false && userAgent) {
    return `DESKTOP-${detectOsFromUserAgent(userAgent)}`;
  }

  return undefined;
}

export function detectBrowser(project: FullProject): string | undefined {
  const channel = (project.use as Record<string, unknown>).channel as string | undefined;
  if (channel) {
    if (channel.startsWith('msedge')) return 'edge';
    if (channel.startsWith('chrome')) return 'chrome';
    return channel;
  }
  const browserName = project.use.browserName || project.use.defaultBrowserType || 'chromium';
  if (browserName === 'webkit') return 'safari';
  return browserName;
}

export function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1_000).toFixed(1)}s`;
  }
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export function mapStatus(
  playwrightStatus: TestResult['status'],
  isRerun: boolean
): UReportStatus {
  switch (playwrightStatus) {
    case 'passed':
      return isRerun ? 'RERUN_PASS' : 'PASS';
    // UReport has no RERUN_FAIL / RERUN_SKIP — retried failures use the same
    // FAIL/SKIP status; is_rerun: true on the payload carries the retry signal.
    case 'failed':
    case 'timedOut':
    default:
      return 'FAIL';
    case 'skipped':
    case 'interrupted':
      return 'SKIP';
  }
}

/**
 * Collects all @-prefixed tags for a test.
 *
 * Sources (combined and deduplicated):
 *  1. testCase.tags — tags set via { tag: ['@smoke'] } in test options
 *  2. @word patterns extracted from the test title itself, e.g. "login @smoke @p1"
 */
export function extractTags(testCase: TestCase): string[] {
  const tags = new Set<string>(testCase.tags ?? []);
  const titleTags = testCase.title.match(/@\w+/g) ?? [];
  for (const tag of titleTags) {
    tags.add(tag);
  }
  return [...tags];
}

export function generateUid(testCase: TestCase): string {
  const ureportAnnotation = testCase.annotations.find(
    (a) => a.type === 'ureport-uid'
  );
  if (ureportAnnotation?.description) {
    return ureportAnnotation.description;
  }
  return testCase.title;
}

// Internal categories Playwright creates as implementation details — not user steps
const INTERNAL_STEP_CATEGORIES = new Set(['test.attach']);

function mapStep(step: TestStep, includeScreenshots: boolean): UReportStepPayload {
  let attachment: string | undefined;

  if (includeScreenshots && step.attachments) {
    const imageAttachment = step.attachments.find(
      (a) => a.contentType === 'image/png' || a.contentType === 'image/jpeg'
    );
    if (imageAttachment?.path) {
      try {
        const data = readFileSync(imageAttachment.path);
        attachment = data.toString('base64');
      } catch {
        // ignore read errors
      }
    } else if (imageAttachment?.body) {
      attachment = imageAttachment.body.toString('base64');
    }
  }

  const childSteps = (step.steps ?? [])
    .filter(s => !INTERNAL_STEP_CATEGORIES.has(s.category))
    .map(s => mapStep(s, includeScreenshots));

  return {
    timestamp: step.startTime.toISOString(),
    status: step.error ? 'FAIL' : 'PASS',
    detail: step.title,
    ...(attachment !== undefined ? { attachment } : {}),
    ...(childSteps.length > 0 ? { steps: childSteps } : {}),
  };
}

function isHookStep(step: TestStep): boolean {
  return step.category === 'hook';
}

function isSetupHook(step: TestStep): boolean {
  return /before/i.test(step.title);
}

function isTeardownHook(step: TestStep): boolean {
  return /after/i.test(step.title);
}

function getAllDescendants(step: TestStep): Set<TestStep> {
  const result = new Set<TestStep>();
  for (const child of step.steps ?? []) {
    result.add(child);
    for (const d of getAllDescendants(child)) result.add(d);
  }
  return result;
}

export function categorizeSteps(
  steps: TestStep[],
  includeScreenshots: boolean
): { setup: UReportStepPayload[]; body: UReportStepPayload[]; teardown: UReportStepPayload[] } {
  const setup: UReportStepPayload[] = [];
  const body: UReportStepPayload[] = [];
  const teardown: UReportStepPayload[] = [];

  // Identify all descendants so we only process top-level steps
  const descendants = new Set<TestStep>();
  for (const step of steps) {
    for (const d of getAllDescendants(step)) descendants.add(d);
  }
  const topLevel = steps.filter(s => !descendants.has(s));

  for (const step of topLevel) {
    const mapped = mapStep(step, includeScreenshots);
    if (isHookStep(step)) {
      if (isTeardownHook(step)) {
        teardown.push(mapped);
      } else {
        setup.push(mapped);
      }
    } else {
      body.push(mapped);
    }
  }

  return { setup, body, teardown };
}

export function mapTestToPayload(
  testCase: TestCase,
  result: TestResult,
  buildId: string,
  steps: TestStep[],
  options: UReportReporterOptions,
  rootDir: string
): UReportTestPayload {
  const isRerun = result.retry > 0;
  const startTime = result.startTime;
  const endTime = new Date(startTime.getTime() + result.duration);

  const info: UReportTestPayload['info'] = {
    file: basename(testCase.location.file),
    path: relative(rootDir, dirname(testCase.location.file)),
    tags: extractTags(testCase),
    duration: formatDuration(result.duration),
  };

  const ARRAY_ANNOTATION_TYPES = new Set(['components', 'teams']);

  for (const annotation of testCase.annotations) {
    if (annotation.type === 'ureport-uid' || annotation.description === undefined) continue;

    if (ARRAY_ANNOTATION_TYPES.has(annotation.type)) {
      const existing = (info[annotation.type] as string[] | undefined) ?? [];
      info[annotation.type] = [...existing, annotation.description];
    } else {
      info[annotation.type] = annotation.description;
    }
  }

  const payload: UReportTestPayload = {
    uid: generateUid(testCase),
    name: testCase.title,
    build: buildId,
    status: mapStatus(result.status, isRerun),
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    is_rerun: isRerun,
    info,
  };

  const firstError = result.errors[0];
  if (firstError && (result.status === 'failed' || result.status === 'timedOut')) {
    payload.failure = {
      error_message: firstError.message ?? String(firstError),
      stack_trace: firstError.stack,
    };
  }

  if (options.includeSteps) {
    const { setup, body, teardown } = categorizeSteps(
      steps,
      options.includeScreenshots ?? true
    );
    if (setup.length > 0) payload.setup = setup;
    if (body.length > 0) payload.body = body;
    if (teardown.length > 0) payload.teardown = teardown;
  }

  return payload;
}

export function detectEnvironments(config: FullConfig): Record<string, unknown> | undefined {
  const firstProject = config.projects[0];
  const baseURL = (firstProject?.use as Record<string, unknown>)?.baseURL as string | undefined;
  if (!baseURL) return undefined;
  return { baseURL };
}

export function detectSettings(config: FullConfig): Record<string, unknown> | undefined {
  const s: Record<string, unknown> = {};
  const firstProject = config.projects[0];
  const timeout = firstProject?.timeout;
  const retries = firstProject?.retries;
  if (timeout) s.timeout = timeout;
  if (retries) s.retries = retries;
  if (config.workers) s.workers = config.workers;
  return Object.keys(s).length > 0 ? s : undefined;
}

// Keys on info that map to dedicated relation fields — not put into customs.
const RELATION_INFO_KEYS = new Set(['file', 'path', 'tags', 'components', 'teams', 'duration']);

export function mapTestToRelationPayload(
  test: UReportTestPayload,
  options: UReportReporterOptions
): UReportTestRelationPayload {
  const relation: UReportTestRelationPayload = {
    uid: test.uid,
    product: options.product,
    type: options.type,
  };

  const info = (test.info ?? {}) as UReportTestInfo;

  if (info.file) relation.file = info.file as string;
  if (info.path !== undefined) relation.path = info.path as string;
  if ((info.tags as string[] | undefined)?.length) relation.tags = info.tags as string[];
  if ((info.components as string[] | undefined)?.length) relation.components = info.components as string[];
  if ((info.teams as string[] | undefined)?.length) relation.teams = info.teams as string[];

  const customs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(info)) {
    if (!RELATION_INFO_KEYS.has(key)) {
      customs[key] = value;
    }
  }
  if (Object.keys(customs).length > 0) relation.customs = customs;

  return relation;
}
