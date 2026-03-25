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
import { mapTestToPayload, mapTestToRelationPayload, detectBrowser, detectDevice, detectEnvironments, detectSettings, detectPlatformVersion } from './mapper.js';
import type { UReportBuildPayload, UReportTestPayload, UReportTestRelationPayload } from './types.js';

interface PendingTest {
  test: TestCase;
  result: TestResult;
  steps: TestStep[];
  project: FullProject | undefined;
}

export class UReportReporter implements Reporter {
  private options!: UReportReporterOptions;
  private client!: UReportApiClient;
  private rootDir = '';
  private pendingTests: PendingTest[] = [];
  private collectedRelations: UReportTestRelationPayload[] = [];
  private stepsByTestRetry = new Map<string, TestStep[]>();
  private commonBuildFields!: Omit<UReportBuildPayload, 'browser' | 'device' | 'start_time'>;

  constructor(private readonly rawOptions: Partial<UReportReporterOptions> = {}) {}

  async onBegin(config: FullConfig, _suite: Suite): Promise<void> {
    this.options = validateOptions(this.rawOptions);
    this.client = new UReportApiClient(this.options.serverUrl, this.options.apiToken);
    this.rootDir = process.cwd();

    if (this.options.autoDetectPlatform !== false) {
      if (!this.options.platform) this.options.platform = process.platform;
      if (!this.options.platform_version) this.options.platform_version = detectPlatformVersion();
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

    this.commonBuildFields = {
      product:          this.options.product,
      type:             this.options.type,
      build:            buildNumber,
      team:             this.options.team,
      platform:         this.options.platform,
      platform_version: this.options.platform_version,
      stage:            this.options.stage,
      version:          this.options.version,
      environments:     this.options.environments,
      settings:         this.options.settings,
    };
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const key = test.id + ':' + result.retry;
    const steps = this.stepsByTestRetry.get(key) ?? [];
    this.pendingTests.push({ test, result, steps, project: this.getProjectForTest(test) });
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

    // Group pending tests by project name
    const byProject = new Map<string, { project: FullProject | undefined; pending: PendingTest[] }>();
    for (const p of this.pendingTests) {
      const key = p.project?.name ?? '__default__';
      if (!byProject.has(key)) byProject.set(key, { project: p.project, pending: [] });
      byProject.get(key)!.pending.push(p);
    }

    interface BuildRecord { project: FullProject | undefined; payload: UReportBuildPayload; tests: UReportTestPayload[] }
    const allMappedTests: UReportTestPayload[] = [];
    const buildRecords: BuildRecord[] = [];

    for (const [, { project, pending }] of byProject) {
      const browser = this.options.browser ?? (project ? detectBrowser(project) : undefined);
      const device  = this.options.device  ?? (project ? detectDevice(project)  : undefined);
      const payload: UReportBuildPayload = {
        ...this.commonBuildFields,
        browser,
        device,
        start_time: new Date().toISOString(),
      };

      const build = await this.client.createBuild(payload);

      const mapped = pending.map(({ test, result, steps }) =>
        mapTestToPayload(test, result, build._id, steps, this.options, this.rootDir)
      );
      allMappedTests.push(...mapped);
      buildRecords.push({ project, payload, tests: mapped });

      for (let i = 0; i < mapped.length; i += batchSize) {
        await this.client.submitTests(mapped.slice(i, i + batchSize));
      }

      await this.client.finalizeBuild(build._id);

      const pass = mapped.filter(t => t.status === 'PASS' || t.status === 'RERUN_PASS').length;
      const fail = mapped.filter(t => t.status === 'FAIL').length;
      const skip = mapped.filter(t => t.status === 'SKIP').length;
      console.log(
        `[ureport-reporter] Build ${build._id} (${project?.name ?? 'default'}) finalized — PASS: ${pass}, FAIL: ${fail}, SKIP: ${skip}`
      );
    }

    if (this.options.saveRelations !== false) {
      const seen = new Set<string>();
      for (const t of allMappedTests) {
        if (seen.has(t.uid)) continue;
        seen.add(t.uid);
        const relation = mapTestToRelationPayload(t, this.options);
        this.collectedRelations.push(relation);
        await this.client.saveTestRelation(relation);
      }
    }

    if (this.options.outputFile) {
      const { writeFile } = await import('fs/promises');
      const output = buildRecords.length === 1
        ? JSON.stringify(
            {
              build:     buildRecords[0].payload,
              tests:     buildRecords[0].tests,
              relations: this.collectedRelations,
            },
            null, 2
          )
        : JSON.stringify(
            {
              builds:    buildRecords.map(b => ({ project: b.project?.name ?? 'default', build: b.payload, tests: b.tests })),
              relations: this.collectedRelations,
            },
            null, 2
          );
      await writeFile(this.options.outputFile, output, 'utf-8');
      console.log(`[ureport-reporter] Payload saved to ${this.options.outputFile}`);
    }
  }

  printsToStdio(): boolean {
    return false;
  }

  private getProjectForTest(test: TestCase): FullProject | undefined {
    let suite: Suite | undefined = test.parent;
    while (suite) {
      if (suite.type === 'project') return suite.project() ?? undefined;
      suite = suite.parent;
    }
    return undefined;
  }
}
