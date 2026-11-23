import { spawn, ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ENTRY = path.resolve(__dirname, '../../dist/index.js');
const REQUEST_TIMEOUT_MS = 5_000;
export const MAX_LATENCY_MS = 2_000;

export interface FuzzServer {
  baseUrl: string;
  /** True while the server process is still running. A false value after a request means that request crashed it. */
  alive(): boolean;
  /** Last lines the server wrote to stderr, for crash reports. */
  stderrTail(): string;
  stop(): Promise<void>;
}

export interface ApiResponse {
  status: number;
  text: string;
  json: unknown;
  contentType: string;
  ms: number;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(500) });
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not become healthy within 15s');
}

/**
 * Starts the BUILT app (dist/index.js) as a child process in a throwaway working directory.
 * db.ts opens `orders.db` relative to cwd, so every server gets its own empty database
 * and the fuzzer never touches the real data or modifies src/.
 */
export async function startServer(): Promise<FuzzServer> {
  const dir = mkdtempSync(path.join(tmpdir(), 'fuzz-orders-'));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [ENTRY], {
    cwd: dir,
    env: { PATH: process.env.PATH, PORT: String(port), JWT_SECRET: 'fuzz-secret', NODE_ENV: 'production' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr?.on('data', (d: Buffer) => {
    stderr = (stderr + d.toString()).slice(-4000);
  });
  try {
    await waitForHealth(baseUrl, child);
  } catch (err) {
    child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`${(err as Error).message}\n${stderr}`);
  }
  return {
    baseUrl,
    alive: () => child.exitCode === null && child.signalCode === null,
    stderrTail: () => stderr,
    async stop() {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          const t = setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
          }, 3_000);
          child.once('exit', () => {
            clearTimeout(t);
            resolve();
          });
        });
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export interface RequestOptions {
  token?: string;
  headers?: Record<string, string>;
  /** Object bodies are JSON-encoded. Strings are sent verbatim so malformed JSON can be fuzzed. */
  body?: unknown;
}

export async function call(
  server: FuzzServer,
  method: string,
  pathAndQuery: string,
  opts: RequestOptions = {},
): Promise<ApiResponse> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: string | undefined;
  if (opts.body !== undefined) {
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    headers['Content-Type'] ??= 'application/json';
  }
  const started = performance.now();
  const res = await fetch(server.baseUrl + pathAndQuery, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  const ms = performance.now() - started;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, text, json, contentType: res.headers.get('content-type') ?? '', ms };
}

/** Registers (if needed) and logs in a user, returning a JWT. */
export async function login(server: FuzzServer, email = 'fuzz@example.com', password = 'Passw0rd!x'): Promise<string> {
  await call(server, 'POST', '/api/auth/register', { body: { email, password, name: 'Fuzz' } });
  const res = await call(server, 'POST', '/api/auth/login', { body: { email, password } });
  const token = (res.json as { token?: string } | undefined)?.token;
  if (!token) throw new Error(`login failed: ${res.status} ${res.text}`);
  return token;
}
