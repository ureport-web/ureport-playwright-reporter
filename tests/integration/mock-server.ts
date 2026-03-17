import * as http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';

export interface CapturedRequest {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * A minimal in-process HTTP server that mimics the UReport REST API.
 * Runs inside the Jest process — Playwright (subprocess) makes real HTTP
 * requests to it, giving us full payload visibility.
 */
export class MockUReportServer {
  private server: http.Server;
  public requests: CapturedRequest[] = [];
  public port = 0;

  constructor() {
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      let parsed: unknown = {};
      try { parsed = JSON.parse(body); } catch { /* empty body is fine */ }

      this.requests.push({
        method: req.method ?? 'GET',
        path: req.url ?? '/',
        body: parsed,
        headers: req.headers as Record<string, string | string[] | undefined>,
      });

      const path = req.url ?? '/';

      if (path === '/api/build') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ _id: 'mock-build-id', product: 'test' }));

      } else if (path === '/api/test/multi') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ state: 'Success', provided: 0, saved: 0 }));

      } else if (path.startsWith('/api/build/status/calculate/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));

      } else if (path === '/api/test_relation') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const body = parsed as { uid?: string };
        res.end(JSON.stringify({ uid: body.uid, _id: 'mock-relation-id' }));

      } else {
        res.writeHead(404);
        res.end();
      }
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address() as { port: number };
        this.port = addr.port;
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  /** Returns all captured requests for a given path */
  requestsTo(path: string): CapturedRequest[] {
    return this.requests.filter((r) => r.path === path);
  }

  /** Returns the first captured request for a given path */
  firstRequestTo(path: string): CapturedRequest | undefined {
    return this.requests.find((r) => r.path === path);
  }
}
