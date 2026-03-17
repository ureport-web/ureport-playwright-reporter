import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  TestStep,
  FullResult,
  FullProject,
} from '@playwright/test/reporter';
import { validateOptions } from './config.js';
import type { UReportReporterOptions } from './config.js';
import { UReportApiClient } from './api-client.js';
import { mapTestToPayload, mapTestToRelationPayload, detectBrowser, detectDevice, detectEnvironments, detectSettings } from './mapper.js';
import type { UReportBuildPayload, UReportTestPayload, UReportTestRelationPayload } from './types.js';

export class UReportReporter implements Reporter {
  private options!: UReportReporterOptions;
  private client!: UReportApiClient;
  private buildId = '';
  private buildPayload!: UReportBuildPayload;
  private rootDir = '';
  private collectedTests: UReportTestPayload[] = [];
  private collectedRelations: UReportTestRelationPayload[] = [];
  private stepsByTestRetry = new Map<string, TestStep[]>();

  constructor(private readonly rawOptions: Partial<UReportReporterOptions> = {}) {}

  async onBegin(config: FullConfig, suite: Suite): Promise<void> {
    this.options = validateOptions(this.rawOptions);
    this.client = new UReportApiClient(this.options.serverUrl, this.options.apiToken);

    this.rootDir = process.cwd();

    if (!this.options.browser) {
      const firstProject = config.projects[0];
      if (firstProject) {
        this.options.browser = detectBrowser(firstProject);
      }
    }

    if (!this.options.device) {
      const firstProject = config.projects[0];
      if (firstProject) {
        this.options.device = detectDevice(firstProject);
      }
    }

    if (!this.options.platform) {
      this.options.platform = process.platform;
    }

    if (!this.options.environments) {
      const detected = detectEnvironments(config);
      if (detected) this.options.environments = detected;
    }

    if (!this.options.settings) {
      const detected = detectSettings(config);
      if (detected) this.options.settings = detected;
    }

    const rawBuild = this.options.buildNumber;
    const buildNumber = typeof rawBuild === 'number'
      ? rawBuild
      : (parseInt(String(rawBuild), 10) || Date.now());

    this.buildPayload = {
      product: this.options.product,
      type: this.options.type,
      build: buildNumber,
      team: this.options.team,
      browser: this.options.browser,
      device: this.options.device,
      platform: this.options.platform,
      platform_version: this.options.platform_version,
      stage: this.options.stage,
      version: this.options.version,
      start_time: new Date().toISOString(),
      environments: this.options.environments,
      settings: this.options.settings,
    };

    const build = await this.client.createBuild(this.buildPayload);
    this.buildId = build._id;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const key = test.id + ':' + result.retry;
    const steps = this.stepsByTestRetry.get(key) ?? [];

    const payload = mapTestToPayload(test, result, this.buildId, steps, this.options, this.rootDir);
    this.collectedTests.push(payload);

    this.stepsByTestRetry.delete(key);
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep): void {
    const key = test.id + ':' + result.retry;
    const steps = this.stepsByTestRetry.get(key) ?? [];
    steps.push(step);
    this.stepsByTestRetry.set(key, steps);
  }

  async onEnd(_result: FullResult): Promise<void> {
    const { batchSize = 50 } = this.options;

    for (let i = 0; i < this.collectedTests.length; i += batchSize) {
      const batch = this.collectedTests.slice(i, i + batchSize);
      await this.client.submitTests(batch);
    }

    await this.client.finalizeBuild(this.buildId);

    if (this.options.saveRelations !== false) {
      const seen = new Set<string>();
      for (const test of this.collectedTests) {
        if (seen.has(test.uid)) continue;
        seen.add(test.uid);
        const relation = mapTestToRelationPayload(test, this.options);
        this.collectedRelations.push(relation);
        await this.client.saveTestRelation(relation);
      }
    }

    const pass = this.collectedTests.filter((t) => t.status === 'PASS' || t.status === 'RERUN_PASS').length;
    const fail = this.collectedTests.filter((t) => t.status === 'FAIL').length;
    const skip = this.collectedTests.filter((t) => t.status === 'SKIP').length;

    console.log(
      `[ureport-reporter] Build ${this.buildId} finalized — PASS: ${pass}, FAIL: ${fail}, SKIP: ${skip}`
    );

    if (this.options.outputFile) {
      const { writeFile } = await import('fs/promises');
      const output = JSON.stringify(
        {
          build: this.buildPayload,
          tests: this.collectedTests,
          relations: this.collectedRelations,
        },
        null,
        2
      );
      await writeFile(this.options.outputFile, output, 'utf-8');
      console.log(`[ureport-reporter] Payload saved to ${this.options.outputFile}`);
    }
  }

  printsToStdio(): boolean {
    return false;
  }
}
