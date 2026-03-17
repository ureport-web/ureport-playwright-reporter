import { UReportApiClient } from '../src/api-client';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeResponse(
  body: unknown,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
): Response {
  const { ok = true, status = 200, statusText = 'OK' } = options;
  return {
    ok,
    status,
    statusText,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('UReportApiClient', () => {
  const serverUrl = 'http://localhost:4100';
  const apiToken = 'test-token-abc123';

  describe('token auth', () => {
    test('sends Authorization: Bearer header on every request', async () => {
      mockFetch.mockResolvedValue(makeResponse({ _id: 'build-1' }));
      const client = new UReportApiClient(serverUrl, apiToken);
      await client.createBuild({ product: 'App', type: 'E2E', build: 1, start_time: '' });

      expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBe(`Bearer ${apiToken}`);
    });
  });

  describe('createBuild', () => {
    test('posts to /api/build and returns response body', async () => {
      const buildResponse = { _id: 'build-42', product: 'App' };
      mockFetch.mockResolvedValue(makeResponse(buildResponse));

      const client = new UReportApiClient(serverUrl, apiToken);
      const result = await client.createBuild({
        product: 'App',
        type: 'E2E',
        build: 42,
        start_time: '2024-01-01T00:00:00.000Z',
      });

      expect(result._id).toBe('build-42');
      expect(mockFetch).toHaveBeenCalledWith(
        `${serverUrl}/api/build`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    test('build field (not build_number) is sent in the request body', async () => {
      mockFetch.mockResolvedValue(makeResponse({ _id: 'b1' }));
      const client = new UReportApiClient(serverUrl, apiToken);
      await client.createBuild({ product: 'App', type: 'E2E', build: 5, start_time: '' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.build).toBe(5);
      expect(typeof body.build).toBe('number');
      expect(body.build_number).toBeUndefined();
    });

    test('throws on failure', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, { ok: false, status: 500, statusText: 'Internal Server Error' }));
      const client = new UReportApiClient(serverUrl, apiToken);
      await expect(
        client.createBuild({ product: 'App', type: 'E2E', build: 1, start_time: '' })
      ).rejects.toThrow('[ureport-reporter] Failed to create build: 500 Internal Server Error');
    });
  });

  describe('submitTests', () => {
    test('posts tests array to /api/test/multi', async () => {
      mockFetch.mockResolvedValue(makeResponse({ state: 'Success', provided: 1, saved: 1 }));
      const client = new UReportApiClient(serverUrl, apiToken);
      const tests = [{ uid: 'tc-1', name: 'login', build: 'b1', status: 'PASS' as const, start_time: '', end_time: '', is_rerun: false }];
      await client.submitTests(tests);

      expect(mockFetch).toHaveBeenCalledWith(
        `${serverUrl}/api/test/multi`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ tests }),
        })
      );
    });

    test('throws on failure', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, { ok: false, status: 422, statusText: 'Unprocessable Entity' }));
      const client = new UReportApiClient(serverUrl, apiToken);
      await expect(client.submitTests([])).rejects.toThrow(
        '[ureport-reporter] Failed to submit tests: 422 Unprocessable Entity'
      );
    });
  });

  describe('saveTestRelation', () => {
    test('posts relation to /api/test_relation', async () => {
      mockFetch.mockResolvedValue(makeResponse({ uid: 'tc-1', _id: 'rel-1' }));
      const client = new UReportApiClient(serverUrl, apiToken);
      await client.saveTestRelation({ uid: 'tc-1', product: 'App', type: 'E2E' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${serverUrl}/api/test_relation`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ uid: 'tc-1', product: 'App', type: 'E2E' }),
        })
      );
    });

    test('throws on failure', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, { ok: false, status: 400, statusText: 'Bad Request' }));
      const client = new UReportApiClient(serverUrl, apiToken);
      await expect(
        client.saveTestRelation({ uid: 'tc-1', product: 'App', type: 'E2E' })
      ).rejects.toThrow('[ureport-reporter] Failed to save test relation: 400 Bad Request');
    });
  });

  describe('finalizeBuild', () => {
    test('posts to correct URL', async () => {
      mockFetch.mockResolvedValue(makeResponse({}));
      const client = new UReportApiClient(serverUrl, apiToken);
      await client.finalizeBuild('build-99');

      expect(mockFetch).toHaveBeenCalledWith(
        `${serverUrl}/api/build/status/calculate/build-99`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    test('throws on failure', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, { ok: false, status: 404, statusText: 'Not Found' }));
      const client = new UReportApiClient(serverUrl, apiToken);
      await expect(client.finalizeBuild('missing')).rejects.toThrow(
        '[ureport-reporter] Failed to finalize build: 404 Not Found'
      );
    });
  });
});
