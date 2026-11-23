import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PARAMS } from './config';
import { call, FuzzServer, login, startServer } from './harness';
import { assertJsonErrors, assertRobust } from './oracles';
import { bodyOf, hostileString, idSegment, maybeField, queryValue } from './payloads';

let server: FuzzServer;
let token: string;

/** Restart after a crash so one crashing input does not turn every later run into noise. */
async function ensureUp(): Promise<void> {
  if (server.alive()) return;
  server = await startServer();
  token = await login(server);
}

beforeAll(async () => {
  server = await startServer();
  token = await login(server);
});
afterAll(async () => {
  await server.stop();
});

interface Req {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  body?: unknown;
}

const email = fc.emailAddress();
const text = fc.string({ minLength: 1, maxLength: 30 });

// One entry per route in src/routes.ts. When a route is added, add it here (the skill's checklist enforces this).
const ENDPOINTS: { name: string; auth: boolean; arb: fc.Arbitrary<Req> }[] = [
  {
    name: 'POST /api/auth/register',
    auth: false,
    arb: bodyOf({ email: maybeField(email), password: maybeField(text), name: maybeField(text) }).map((body) => ({ method: 'POST', path: '/api/auth/register', body })),
  },
  {
    name: 'POST /api/auth/login',
    auth: false,
    arb: bodyOf({ email: maybeField(email), password: maybeField(text) }).map((body) => ({ method: 'POST', path: '/api/auth/login', body })),
  },
  {
    name: 'POST /api/auth/forgot-password',
    auth: false,
    arb: bodyOf({ email: maybeField(email) }).map((body) => ({ method: 'POST', path: '/api/auth/forgot-password', body })),
  },
  {
    name: 'POST /api/auth/reset-password',
    auth: false,
    arb: bodyOf({ token: maybeField(text), password: maybeField(text) }).map((body) => ({ method: 'POST', path: '/api/auth/reset-password', body })),
  },
  { name: 'GET /api/products?search', auth: false, arb: queryValue.map((q) => ({ method: 'GET', path: `/api/products?search=${q}` })) },
  { name: 'GET /api/products/:id', auth: false, arb: idSegment.map((id) => ({ method: 'GET', path: `/api/products/${id}` })) },
  {
    name: 'POST /api/products',
    auth: true,
    arb: bodyOf({ name: maybeField(text), price: maybeField(fc.double({ min: 0, max: 5000, noNaN: true })), stock: maybeField(fc.nat(100)) }).map((body) => ({ method: 'POST', path: '/api/products', body })),
  },
  {
    name: 'PUT /api/products/:id',
    auth: true,
    arb: fc
      .tuple(idSegment, bodyOf({ name: maybeField(text), price: maybeField(fc.nat(500)), stock: maybeField(fc.nat(100)) }))
      .map(([id, body]) => ({ method: 'PUT', path: `/api/products/${id}`, body })),
  },
  {
    name: 'POST /api/orders',
    auth: true,
    arb: bodyOf({
      items: maybeField(fc.array(fc.record({ productId: maybeField(fc.integer({ min: 1, max: 5 })), quantity: maybeField(fc.integer({ min: 1, max: 5 })) }), { maxLength: 4 })),
    }).map((body) => ({ method: 'POST', path: '/api/orders', body })),
  },
  { name: 'GET /api/reports/daily?date', auth: true, arb: queryValue.map((d) => ({ method: 'GET', path: `/api/reports/daily?date=${d}` })) },
  {
    name: 'GET /api/orders?page&limit',
    auth: true,
    arb: fc.tuple(queryValue, queryValue).map(([p, l]) => ({ method: 'GET', path: `/api/orders?page=${p}&limit=${l}` })),
  },
  { name: 'GET /api/orders/:id', auth: true, arb: idSegment.map((id) => ({ method: 'GET', path: `/api/orders/${id}` })) },
];

const describeReq = (req: Req) =>
  `${req.method} ${req.path} ${typeof req.body === 'string' ? req.body.slice(0, 80) : (JSON.stringify(req.body)?.slice(0, 200) ?? '')}`;

describe('robustness: no endpoint may 5xx, crash, leak internals or hang on hostile input', () => {
  it.each(ENDPOINTS)('$name', async ({ auth, arb }) => {
    await fc.assert(
      fc.asyncProperty(arb, async (req) => {
        await ensureUp();
        const res = await call(server, req.method, req.path, { body: req.body, token: auth ? token : undefined });
        assertRobust(server, describeReq(req), res);
      }),
      PARAMS,
    );
  });
});

describe('contract: every 4xx answers with JSON, never framework HTML', () => {
  it.each(ENDPOINTS)('$name', async ({ auth, arb }) => {
    await fc.assert(
      fc.asyncProperty(arb, async (req) => {
        await ensureUp();
        const res = await call(server, req.method, req.path, { body: req.body, token: auth ? token : undefined });
        assertJsonErrors(describeReq(req), res);
      }),
      PARAMS,
    );
  });
});

describe('authentication: forged or garbage credentials never reach a handler', () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const forged = [
    '',
    'Bearer',
    'Bearer ',
    'Bearer null',
    'Basic dXNlcjpwYXNz',
    `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: 1, role: 'admin' })}.`,
    `Bearer ${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id: 1, role: 'admin' })}.invalidsignature`,
    `Bearer ${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id: 1, exp: 1 })}.x`,
  ];
  const headerValue = fc.oneof(fc.constantFrom(...forged), fc.stringMatching(/^[ -~]{0,300}$/));

  it('protected routes answer 401 for any bad Authorization header', async () => {
    await fc.assert(
      fc.asyncProperty(headerValue, fc.constantFrom('/api/orders', '/api/reports/daily?date=2026-01-01', '/api/orders/1'), async (authz, path) => {
        await ensureUp();
        const res = await call(server, 'GET', path, { headers: authz ? { Authorization: authz } : {} });
        assertRobust(server, `GET ${path} Authorization: ${authz}`, res);
        expect(res.status, `Authorization: ${authz}`).toBe(401);
      }),
      PARAMS,
    );
  });
});

describe('request-shape abuse', () => {
  it('oversized bodies are rejected cleanly (4xx JSON), not crashed on', async () => {
    await ensureUp();
    const res = await call(server, 'POST', '/api/auth/login', { body: JSON.stringify({ email: 'x', password: 'A'.repeat(2_000_000) }) });
    assertRobust(server, 'POST /api/auth/login 2MB body', res);
    assertJsonErrors('POST /api/auth/login 2MB body', res);
  });

  it.each([
    ['wrong content-type', { 'Content-Type': 'text/plain' }],
    ['no content-type', { 'Content-Type': '' }],
    ['unsupported charset', { 'Content-Type': 'application/json; charset=utf-7' }],
  ])('%s on JSON endpoints', async (_name, headers) => {
    await ensureUp();
    for (const p of ['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password']) {
      const res = await call(server, 'POST', p, { body: '{"email":"a@b.c","password":"x"}', headers });
      assertRobust(server, `POST ${p} (${_name})`, res);
    }
  });
});

describe('hostile strings survive a write-then-read round trip', () => {
  it('product names are stored and returned verbatim, and never alter the query', async () => {
    await fc.assert(
      fc.asyncProperty(hostileString, async (name) => {
        await ensureUp();
        const created = await call(server, 'POST', '/api/products', { token, body: { name, price: 1, stock: 1 } });
        assertRobust(server, `POST /api/products name=${JSON.stringify(name).slice(0, 80)}`, created);
        if (created.status !== 201) return;
        const id = (created.json as { id: number }).id;
        const got = await call(server, 'GET', `/api/products/${id}`);
        expect((got.json as { name: string }).name).toBe(name);
        // searching for the name must not blow up or return other injected rows
        const found = await call(server, 'GET', `/api/products?search=${encodeURIComponent(name)}`);
        assertRobust(server, `GET /api/products?search=${JSON.stringify(name).slice(0, 80)}`, found);
      }),
      PARAMS,
    );
  });
});

describe('search returns only what was asked for', () => {
  it('every row returned by ?search= contains the search term (no injection, no wildcard leakage)', async () => {
    await call(server, 'POST', '/api/products', { token, body: { name: 'fuzz-anchor', price: 1, stock: 1 } });
    await fc.assert(
      fc.asyncProperty(hostileString, async (term) => {
        await ensureUp();
        const res = await call(server, 'GET', `/api/products?search=${encodeURIComponent(term)}`);
        if (res.status >= 500) return; // reported by the robustness test; do not let it mask data-leak findings here
        assertRobust(server, `GET /api/products?search=${JSON.stringify(term).slice(0, 80)}`, res);
        if (res.status !== 200 || term === '') return;
        const rows = res.json as { name: unknown }[];
        for (const r of rows) {
          expect(String(r.name).toLowerCase(), `row ${JSON.stringify(r)} does not match term ${JSON.stringify(term).slice(0, 60)}`).toContain(term.toLowerCase());
        }
      }),
      PARAMS,
    );
  });
});
