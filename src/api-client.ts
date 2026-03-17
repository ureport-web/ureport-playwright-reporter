import type { UReportBuildPayload, UReportBuildResponse, UReportTestPayload, UReportTestRelationPayload } from './types.js';

export class UReportApiClient {
  constructor(
    private readonly serverUrl: string,
    private readonly apiToken: string,
  ) {}

  async createBuild(payload: UReportBuildPayload): Promise<UReportBuildResponse> {
    const url = `${this.serverUrl}/api/build`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `[ureport-reporter] Failed to create build: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<UReportBuildResponse>;
  }

  async submitTests(tests: UReportTestPayload[]): Promise<void> {
    const url = `${this.serverUrl}/api/test/multi`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ tests }),
    });

    if (!response.ok) {
      throw new Error(
        `[ureport-reporter] Failed to submit tests: ${response.status} ${response.statusText}`
      );
    }
  }

  async saveTestRelation(relation: UReportTestRelationPayload): Promise<void> {
    const url = `${this.serverUrl}/api/test_relation`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify(relation),
    });

    if (!response.ok) {
      throw new Error(
        `[ureport-reporter] Failed to save test relation: ${response.status} ${response.statusText}`
      );
    }
  }

  async finalizeBuild(buildId: string): Promise<void> {
    const url = `${this.serverUrl}/api/build/status/calculate/${buildId}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(
        `[ureport-reporter] Failed to finalize build: ${response.status} ${response.statusText}`
      );
    }
  }

  private jsonHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiToken}`,
    };
  }
}
