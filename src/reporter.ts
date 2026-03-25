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

interface BuildRecord {
  project: FullProject;
  buildId: string;
  payload: UReportBuildPayload;
  tests: UReportTestPayload[];
}

export class UReportReporter implements Reporter {
  private options!: UReportReporterOptions;
  private client!: UReportApiClient;
  private rootDir = '';
  private builds: BuildRecord[] = [];
  private collectedRelations: UReportTestRelationPayload[] = [];
  private stepsByTestRetry = new Map<string, TestStep[]>();

  constructor(private readonly rawOptions: Partial<UReportReporterOptions> = {}) {}

  async onBegin(config: FullConfig, suite: Suite): Promise<void> {
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

    // Collect the projects that are actually running. suite.suites are project-level
    // suites — only populated for projects that have matched tests, unlike
    // config.projects which lists every configured project regardless of --project filter.
    const runningProjects: FullProject[] = suite.suites
      .map((s) => s.project())
      .filter((p): p is FullProject => p != null);

    // Fallback: if suite isn't populated yet (edge case), use config.projects
    const projectsToCreate = runningProjects.length > 0
      ? runningProjects
      : config.projects.slice(0, 1);

    for (const project of projectsToCreate) {
      const browser = this.options.browser ?? detectBrowser(project);
      const device  = this.options.device  ?? detectDevice(project);

      const payload: UReportBuildPayload = {
        product:           this.options.product,
        type:              this.options.type,
        build:             buildNumber,
        team:              this.options.team,
        browser,
        device,
        platform:          this.options.platform,
        platform_version:  this.options.platform_version,
        stage:             this.options.stage,
        version:           this.options.version,
        start_time:        new Date().toISOString(),
        environments:      this.options.environments,
        settings:          this.options.settings,
      };

      const build = await this.client.createBuild(payload);
      this.builds.push({ project, buildId: build._id, payload, tests: [] });
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const key = test.id + ':' + result.retry;
    const steps = this.stepsByTestRetry.get(key) ?? [];

    const buildRecord = this.getBuildForTest(test);
    const payload = mapTestToPayload(test, result, buildRecord.buildId, steps, this.options, this.rootDir);
    buildRecord.tests.push(payload);

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

    for (const record of this.builds) {
      for (let i = 0; i < record.tests.length; i += batchSize) {
        await this.client.submitTests(record.tests.slice(i, i + batchSize));
      }

      await this.client.finalizeBuild(record.buildId);

      const pass = record.tests.filter((t) => t.status === 'PASS' || t.status === 'RERUN_PASS').length;
      const fail = record.tests.filter((t) => t.status === 'FAIL').length;
      const skip = record.tests.filter((t) => t.status === 'SKIP').length;
      console.log(
        `[ureport-reporter] Build ${record.buildId} (${record.project.name}) finalized — PASS: ${pass}, FAIL: ${fail}, SKIP: ${skip}`
      );
    }

    if (this.options.saveRelations !== false) {
      const allTests = this.builds.flatMap((b) => b.tests);
      const seen = new Set<string>();
      for (const test of allTests) {
        if (seen.has(test.uid)) continue;
        seen.add(test.uid);
        const relation = mapTestToRelationPayload(test, this.options);
        this.collectedRelations.push(relation);
        await this.client.saveTestRelation(relation);
      }
    }

    if (this.options.outputFile) {
      const { writeFile } = await import('fs/promises');
      const output = this.builds.length === 1
        ? JSON.stringify(
            {
              build:     this.builds[0].payload,
              tests:     this.builds[0].tests,
              relations: this.collectedRelations,
            },
            null, 2
          )
        : JSON.stringify(
            {
              builds:    this.builds.map((b) => ({ project: b.project.name, build: b.payload, tests: b.tests })),
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

  private getBuildForTest(test: TestCase): BuildRecord {
    let suite: Suite | undefined = test.parent;
    while (suite) {
      const project = suite.project();
      if (project) {
        const record = this.builds.find((b) => b.project.name === project.name);
        if (record) return record;
      }
      suite = suite.parent;
    }
    return this.builds[0]!;
  }
}
