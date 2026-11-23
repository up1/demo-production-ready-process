---
name: robust-api-logic
description: Rules and code patterns that prevent hidden logic bugs in Node/TypeScript APIs (float money, check-then-act on stock, duplicate order lines, unvalidated quantities, async in forEach, swallowed errors, timezone and pagination mistakes). Use BEFORE and WHILE writing business logic, pricing, inventory, async or date code.
---

# Robust API logic (prevent hidden bugs)

Each rule maps to a bug the `bug-hunter` confirms (`bug-pattern-catalog`). For every rule you apply, write the test first (see `api-definition-of-done`).

## 1. Money is never a float
Store and compute in integer minor units (cents/satang). Round exactly once, at a defined step.
```ts
type Money = number; // integer cents
const tax = Math.round(afterDiscount * TAX_RATE_BPS / 10_000); // basis points, integer math
```
DB columns: `price_cents INTEGER`. Convert to a decimal string only at the API edge. Never sum floats in a loop.

## 2. Check-then-act must be atomic
Stock check and decrement is a single guarded statement inside a transaction, and you verify it changed a row.
```ts
const placeOrder = db.transaction((userId: number, lines: Line[]) => {
  for (const l of lines) {
    const r = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(l.qty, l.productId, l.qty);
    if (r.changes !== 1) throw new HttpError(409, `Insufficient stock for ${l.productId}`);
  }
  // insert order + items here: all-or-nothing
});
```
Never `SELECT stock` then `UPDATE` in separate steps. Multi-row writes always run in one transaction.

## 3. Normalize input before validating it
- Merge duplicate product lines first (`Map<productId, qty>`), then check stock against the merged quantity.
- Quantity: positive integer with a sane maximum. Price, discount, tax: bounded (discount 0..100%). Reject, never clamp silently.
- Parse numeric query params explicitly; `NaN` is rejected, not passed to SQL.

## 4. Async: no fire-and-forget by accident
- Never `array.forEach(async ...)`. Use `for...of` with `await`, or `await Promise.all(items.map(...))`.
- Every promise is awaited or deliberately detached with a `.catch(logError)`. Enable `@typescript-eslint/no-floating-promises`.
- No empty `catch {}` and no `catch (e) { console.log(e) }` that continues as if it worked. Either handle it (retry, fallback, 5xx) or rethrow. Side effects (emails, alerts) run after the DB commit and their failures are logged with context.

## 5. Dates and time
- Store UTC ISO-8601. Compare instants, not formatted strings.
- Reports take an explicit timezone (`?tz=Asia/Bangkok`) and compute the UTC range for the local day; do not use `date(created_at) = ?`.
- Inject a clock (`now: () => Date`) in services so tests can pin time.

## 6. Pagination
```ts
const page = Math.max(1, Number(q.page) || 1);
const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
const offset = (page - 1) * limit;
```
Always `ORDER BY` a unique, stable key. Return total and totalPages. Test page 1, last page, page beyond the end, limit 0 and 1000.

## 7. Missing data and edge cases
- Every `.get()` result is checked for `undefined` before use. Unknown id = 404, not a 500 crash.
- Handle empty arrays, zero totals and max values explicitly.
- Mutating endpoints that clients may retry (create order, payment) accept an `Idempotency-Key`.

## 8. Lifecycle
- Handle SIGTERM/SIGINT: stop accepting requests, close the server, close the DB, then exit.
- Timeouts on every outbound call.

## Before finishing
List in your report which of these rules apply to the code you wrote, and the test that proves each one.
