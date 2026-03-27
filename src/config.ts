import type { TestCase } from '@playwright/test/reporter';
import type { TestTransformResult, TestTransformContext } from './types.js';

export interface UReportReporterOptions {
  serverUrl: string;
  apiToken: string;
  product: string;
  type: string;
  buildNumber?: string | number;
  team?: string;
  browser?: string;
  device?: string;
  platform?: string;
  platform_version?: string;
  stage?: string;
  version?: string;
  batchSize?: number;
  includeSteps?: boolean;
  includeScreenshots?: boolean;
  environments?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  /** Write the full submitted test payload to this JSON file after the run (for inspection). */
  outputFile?: string;
  /**
   * Save a test relation record (uid, product, type, tags, components, teams, customs) for every
   * unique test after the build is finalized. Default: true.
   * Set to false to skip the /api/test_relation calls entirely.
   */
  saveRelations?: boolean;
  /**
   * Auto-detect platform and platform_version from the OS. Default: true.
   * Set to false to suppress auto-detection (explicit values still apply).
   */
  autoDetectPlatform?: boolean;
  /**
   * Annotation types that should be stored as quickInfo (key/value pairs on test.info.quickInfo).
   * These values are execution-specific and are never saved to test relations.
   * Example: ['env', 'build_url', 'run_id']
   */
  quickInfoAnnotations?: string[];
  /**
   * Optional transform applied to each test before mapping.
   * - Return `name` to override the display name AND the UID (unless the test
   *   has a `ureport-uid` annotation, which always takes precedence).
   * - Return `relations` to inject custom key/value pairs into customs;
   *   explicit annotations will override these if they share the same key.
   * - Second argument `ctx` gives access to build-level metadata (browser, device, etc.)
   */
  testTransform?: (testCase: TestCase, ctx: TestTransformContext) => TestTransformResult;
}

export const DEFAULT_OPTIONS = {
  batchSize: 50,
  includeSteps: true,
  includeScreenshots: true,
} as const;

const REQUIRED_FIELDS: (keyof UReportReporterOptions)[] = [
  'serverUrl',
  'apiToken',
  'product',
  'type',
];

export function validateOptions(options: Partial<UReportReporterOptions>): UReportReporterOptions {
  for (const field of REQUIRED_FIELDS) {
    if (!options[field]) {
      throw new Error(`[ureport-reporter] Missing required option: "${field}"`);
    }
  }

  return {
    ...DEFAULT_OPTIONS,
    ...options,
    buildNumber: options.buildNumber ?? Date.now(),
  } as UReportReporterOptions;
}
