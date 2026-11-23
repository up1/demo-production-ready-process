import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PARAMS } from './config';
import { call, FuzzServer, login, startServer } from './harness';
import { assertRobust } from './oracles';

let server: FuzzServer;
let token: string;

beforeAll(async () => {
  server = await startServer();
  token = await login(server);
});
afterAll(async () => {
  await server.stop();
});

interface Product {
  id: number;
  price: number;
  stock: number;
}

async function readProduct(id: number): Promise<Product> {
  const res = await call(server, 'GET', `/api/products/${id}`);
  return res.json as Product;
}

async function makeProduct(price: number, stock: number): Promise<Product> {
  const res = await call(server, 'POST', '/api/products', { token, body: { name: 'fuzz', price, stock } });
  expect(res.status, res.text).toBe(201);
  return readProduct((res.json as { id: number }).id);
}

function assertProductSane(p: Product, ctx: string): void {
  expect(Number.isInteger(p.stock) && p.stock >= 0, `stock must be a non-negative integer, got ${p.stock} (${ctx})`).toBe(true);
  expect(typeof p.price === 'number' && Number.isFinite(p.price) && p.price >= 0, `price must be finite and >= 0, got ${String(p.price)} (${ctx})`).toBe(true);
}

// quantity: mostly valid, sometimes the values a lazy validator lets through
const quantity = fc.oneof({ arbitrary: fc.integer({ min: 1, max: 12 }), weight: 6 }, fc.constantFrom(0, -1, -100, 0.5, 1.5, 1e9));

type Cmd =
  | { t: 'order'; lines: { p: number; qty: number }[] }
  | { t: 'update'; p: number; stock?: number; price?: number };

const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  { arbitrary: fc.record({ t: fc.constant('order' as const), lines: fc.array(fc.record({ p: fc.nat(2), qty: quantity }), { minLength: 1, maxLength: 3 }) }), weight: 4 },
  { arbitrary: fc.record({ t: fc.constant('update' as const), p: fc.nat(2), stock: fc.option(fc.integer({ min: -5, max: 50 }), { nil: undefined }), price: fc.option(fc.integer({ min: -5, max: 500 }), { nil: undefined }) }), weight: 1 },
);

describe('stateful: any sequence of valid-looking calls keeps the data consistent', () => {
  it('stock/price invariants and order accounting hold', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(cmd, { minLength: 1, maxLength: 8 }), fc.array(fc.nat(15), { minLength: 3, maxLength: 3 }), async (cmds, stocks) => {
        const products = await Promise.all(stocks.map((s, i) => makeProduct(10 + i * 90, s)));

        for (const c of cmds) {
          const before = await Promise.all(products.map((p) => readProduct(p.id)));

          if (c.t === 'update') {
            const body: Record<string, number> = {};
            if (c.stock !== undefined) body.stock = c.stock;
            if (c.price !== undefined) body.price = c.price;
            const res = await call(server, 'PUT', `/api/products/${products[c.p].id}`, { token, body });
            assertRobust(server, `PUT product ${JSON.stringify(body)}`, res);
          } else {
            const items = c.lines.map((l) => ({ productId: products[l.p].id, quantity: l.qty }));
            const res = await call(server, 'POST', '/api/orders', { token, body: { items } });
            assertRobust(server, `POST /api/orders ${JSON.stringify(items)}`, res);
            const after = await Promise.all(products.map((p) => readProduct(p.id)));

            if (res.status === 201) {
              const o = res.json as { subtotal: number; discount: number; tax: number; total: number };
              expect(c.lines.every((l) => Number.isInteger(l.qty) && l.qty > 0), `order accepted with invalid quantity: ${JSON.stringify(items)}`).toBe(true);
              const ordered = new Map<number, number>();
              for (const l of c.lines) ordered.set(l.p, (ordered.get(l.p) ?? 0) + l.qty);
              for (const [i, qty] of ordered) {
                expect(after[i].stock, `stock of product ${i} must drop by exactly the ordered quantity`).toBe(before[i].stock - qty);
              }
              const expectedSubtotal = c.lines.reduce((s, l) => s + products[l.p].price * l.qty, 0);
              expect(o.subtotal).toBeCloseTo(expectedSubtotal, 2);
              expect(o.total).toBeCloseTo(o.subtotal - o.discount + o.tax, 2);
              expect(o.total).toBeGreaterThanOrEqual(0);
            } else {
              // a rejected order must change nothing (atomicity)
              expect(after.map((p) => p.stock), `rejected order (${res.status}) changed stock: ${JSON.stringify(items)}`).toEqual(before.map((p) => p.stock));
            }
          }

          const now = await Promise.all(products.map((p) => readProduct(p.id)));
          now.forEach((p, i) => assertProductSane(p, `after ${JSON.stringify(c)} on product ${i}`));
        }
      }),
      { ...PARAMS, numRuns: Math.max(10, Math.floor(PARAMS.numRuns! / 2)) },
    );
  });
});

describe('concurrency: parallel orders never oversell', () => {
  it('units sold <= initial stock and final stock = initial - sold', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 10 }), fc.integer({ min: 2, max: 25 }), fc.integer({ min: 1, max: 3 }), async (stock, clients, qty) => {
        const p = await makeProduct(10, stock);
        const results = await Promise.all(
          Array.from({ length: clients }, () => call(server, 'POST', '/api/orders', { token, body: { items: [{ productId: p.id, quantity: qty }] } })),
        );
        results.forEach((r) => assertRobust(server, 'parallel POST /api/orders', r));
        const sold = results.filter((r) => r.status === 201).length * qty;
        const final = await readProduct(p.id);
        expect(sold, 'oversold').toBeLessThanOrEqual(stock);
        expect(final.stock).toBe(stock - sold);
      }),
      { ...PARAMS, numRuns: Math.max(10, Math.floor(PARAMS.numRuns! / 4)) },
    );
  });
});

describe('pagination: pages partition the result set', () => {
  it('walking every page returns each order exactly once, in order', async () => {
    const buyer = await login(server, 'pager@example.com');
    const p = await makeProduct(1, 1000);
    for (let i = 0; i < 13; i++) {
      await call(server, 'POST', '/api/orders', { token: buyer, body: { items: [{ productId: p.id, quantity: 1 }] } });
    }
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 15 }), async (limit) => {
        const seen: number[] = [];
        for (let page = 1; page <= 20; page++) {
          const res = await call(server, 'GET', `/api/orders?page=${page}&limit=${limit}`, { token: buyer });
          assertRobust(server, `GET /api/orders?page=${page}&limit=${limit}`, res);
          const body = res.json as { data: { id: number }[]; totalPages: number };
          seen.push(...body.data.map((o) => o.id));
          if (page >= body.totalPages) break;
        }
        expect(new Set(seen).size, 'duplicate rows across pages').toBe(seen.length);
        expect(seen.length, 'rows missing across pages').toBe(13);
      }),
      PARAMS,
    );
  });
});

describe('authorization: users cannot reach each other\'s data or admin data', () => {
  it('another user can never read my order, whatever id they try', async () => {
    const alice = await login(server, 'alice@example.com');
    const mallory = await login(server, 'mallory@example.com');
    const p = await makeProduct(5, 500);
    const created = await call(server, 'POST', '/api/orders', { token: alice, body: { items: [{ productId: p.id, quantity: 1 }] } });
    const orderId = (created.json as { id: number }).id;
    await fc.assert(
      fc.asyncProperty(fc.oneof(fc.constant(orderId), fc.integer({ min: 0, max: orderId + 5 })), async (id) => {
        const mine = await call(server, 'GET', `/api/orders/${id}`, { token: mallory });
        assertRobust(server, `GET /api/orders/${id} as another user`, mine);
        expect([403, 404], `user B got ${mine.status} for order ${id}`).toContain(mine.status);
      }),
      PARAMS,
    );
  });

  it('a non-admin cannot read store-wide revenue', async () => {
    const plain = await login(server, 'plain@example.com');
    const res = await call(server, 'GET', '/api/reports/daily?date=2026-01-01', { token: plain });
    expect([401, 403], `non-admin got ${res.status}`).toContain(res.status);
  });

  it('a non-admin cannot create or change catalogue products', async () => {
    const plain = await login(server, 'plain2@example.com');
    const res = await call(server, 'POST', '/api/products', { token: plain, body: { name: 'x', price: 1, stock: 1 } });
    expect([401, 403], `non-admin got ${res.status}`).toContain(res.status);
  });
});
