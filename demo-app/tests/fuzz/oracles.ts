import { ApiResponse, FuzzServer, MAX_LATENCY_MS } from './harness';

const STACK_FRAME = /\n\s+at\s+.+[(:]\S*:\d+:\d+\)?/;
const PASSWORD_HASH = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{20,}/;
const INTERNAL_LEAK = /node_modules|\/Users\/|\/home\/|better-sqlite3|SqliteError|SQLITE_|TypeError:|ReferenceError:|SyntaxError:/;

/** Contract oracle, kept separate so a plain-HTML 400 cannot mask a 5xx behind it (a property stops at its first failure). */
export function assertJsonErrors(label: string, res: ApiResponse): void {
  if (res.status >= 400 && res.status < 500 && !res.contentType.includes('application/json')) {
    throw new Error(`error response is not JSON (inconsistent contract)\n  request:  ${label}\n  response: ${res.status} ${res.contentType} ${res.text.slice(0, 120)}`);
  }
}

/**
 * Oracles that must hold for ANY input to ANY endpoint. A violation is a bug regardless of the
 * business rules, which is what makes them usable without a spec.
 * Throws on the first violation; fast-check then shrinks the input to a minimal reproduction.
 */
export function assertRobust(server: FuzzServer, label: string, res: ApiResponse): void {
  const fail = (why: string): never => {
    throw new Error(`${why}\n  request:  ${label}\n  response: ${res.status} ${res.contentType} ${res.text.slice(0, 300)}`);
  };
  if (!server.alive()) throw new Error(`SERVER CRASHED by ${label}\n${server.stderrTail()}`);
  if (res.status >= 500) fail('5xx: unhandled failure on client-controlled input (should be 4xx)');
  if (STACK_FRAME.test(res.text) || INTERNAL_LEAK.test(res.text)) fail('information leak: stack trace or internal detail in response');
  if (PASSWORD_HASH.test(res.text)) fail('data leak: bcrypt password hash in response');
  if (res.ms > MAX_LATENCY_MS) fail(`slow response: ${Math.round(res.ms)}ms > ${MAX_LATENCY_MS}ms (possible algorithmic DoS)`);
}
