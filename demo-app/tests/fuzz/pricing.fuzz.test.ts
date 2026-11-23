import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateTotals } from '../../src/pricing';
import { PARAMS } from './config';

// In-process property tests for the pure pricing function: thousands of cases per second, no server needed.
const subtotal = fc.oneof(
  fc.double({ min: 0, max: 100_000, noNaN: true }),
  fc.integer({ min: 0, max: 20_000 }).map((c) => c / 100), // realistic cent amounts
  fc.constantFrom(0, 99.99, 100, 499.99, 500, 999.99, 1000, 0.1 + 0.2),
);

const cents = fc.integer({ min: 0, max: 2_000_000 }).map((c) => c / 100);
const decimals = (n: number) => (String(n).split('.')[1] ?? '').length;

describe('calculateTotals properties', () => {
  it('total = subtotal - discount + tax', () => {
    fc.assert(
      fc.property(subtotal, (s) => {
        const t = calculateTotals(s);
        expect(t.total).toBeCloseTo(t.subtotal - t.discount + t.tax, 6);
      }),
      PARAMS,
    );
  });

  it('0 <= discount <= subtotal and total >= 0 and everything is finite', () => {
    fc.assert(
      fc.property(subtotal, (s) => {
        const t = calculateTotals(s);
        for (const v of Object.values(t)) expect(Number.isFinite(v)).toBe(true);
        expect(t.discount).toBeGreaterThanOrEqual(0);
        expect(t.discount).toBeLessThanOrEqual(t.subtotal);
        expect(t.total).toBeGreaterThanOrEqual(0);
      }),
      PARAMS,
    );
  });

  it('money amounts are rounded to whole cents', () => {
    fc.assert(
      fc.property(cents, (s) => {
        const t = calculateTotals(s);
        for (const [k, v] of Object.entries(t)) expect(decimals(v), `${k}=${v} for subtotal ${s}`).toBeLessThanOrEqual(2);
      }),
      PARAMS,
    );
  });

  it('is pure and deterministic', () => {
    fc.assert(
      fc.property(subtotal, (s) => {
        expect(calculateTotals(s)).toEqual(calculateTotals(s));
      }),
      PARAMS,
    );
  });

  it('rejects or neutralises invalid subtotals (negative, NaN, Infinity)', () => {
    fc.assert(
      fc.property(fc.constantFrom(-1, -0.01, -1e9, NaN, Infinity, -Infinity), (s) => {
        const t = calculateTotals(s);
        // acceptable: throws, or returns only finite non-negative numbers
        for (const v of Object.values(t)) expect(Number.isFinite(v) && v >= 0, `subtotal ${s} -> ${JSON.stringify(t)}`).toBe(true);
      }),
      PARAMS,
    );
  });
});

