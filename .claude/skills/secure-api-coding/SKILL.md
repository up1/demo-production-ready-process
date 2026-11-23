---
name: secure-api-coding
description: Rules and code patterns for writing Node.js/Express/SQL API code that does not contain the vulnerabilities AI assistants usually introduce (injection, hard-coded secrets, IDOR, missing authorization, weak tokens, mass assignment). Use BEFORE and WHILE writing or changing any API endpoint, auth, or database code.
---

# Secure API coding (prevent vulnerabilities)

Each rule maps to a finding the `security-auditor` reports (`owasp-review`). Follow all of them by default. If a rule cannot be met, say so in your final report; never silently skip it.

## 1. SQL: parameters only (SEC injection)
Never build SQL with `+` or template strings. Wildcards go in the parameter, not the SQL.
```ts
// BAD:  db.prepare("SELECT * FROM products WHERE name LIKE '%" + q + "%'")
const rows = db.prepare('SELECT * FROM products WHERE name LIKE ?').all(`%${q}%`);
```
Dynamic column or sort names: map through an allowlist object, never interpolate user input.

## 2. Secrets and config (SEC secret)
- No default for secrets: `const JWT_SECRET = process.env.JWT_SECRET; if (!JWT_SECRET) throw new Error('JWT_SECRET required');` (fail at startup).
- Read all env in one `config.ts`, validated with zod. Nothing else touches `process.env`.
- Never log tokens, passwords, reset codes or full request bodies.

## 3. Authentication and authorization (SEC IDOR, broken access control)
- Every route is authenticated unless it is explicitly public (login, register, health, public catalog reads).
- Authorization is separate from authentication: write `requireRole('admin')` and apply it to mutating admin routes (create/update/delete products).
- Every query on user-owned data includes the owner: `WHERE id = ? AND user_id = ?`. Admin override is explicit. Return 404 (not 403) for other users' resources.
```ts
const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, req.user.id);
if (!order) return res.status(404).json({ error: 'Order not found' });
```

## 4. Tokens (SEC weak randomness)
- `crypto.randomBytes(32).toString('hex')` or `crypto.randomUUID()`. Never `Math.random()` or `Date.now()`.
- Reset/verification tokens: store only a SHA-256 hash, set expiry (15 min), single use, constant response for unknown emails.
- JWT: `jwt.sign(payload, secret, { expiresIn: '15m', algorithm: 'HS256' })` and `jwt.verify(token, secret, { algorithms: ['HS256'] })`. Use refresh tokens if long sessions are needed, not a 7-day access token.

## 5. Input validation at the boundary (SEC/BUG mass assignment, NaN, negatives)
- Parse `req.body`, `req.query` and `req.params` with a zod schema in the route. Reject unknown fields (`.strict()`). Never spread `req.body` into a DB write.
- Numbers: `z.number().int().positive()` for quantity/ids, `z.number().nonnegative()` for price, `limit` clamped 1..100.
- Role and other privileged fields are never accepted from the client.

## 6. Abuse protection and hardening
- `express-rate-limit` on login, register and password reset (e.g. 10 per 15 min per IP).
- `helmet()`; CORS with an explicit origin allowlist, never `*` on an authenticated API.
- `express.json({ limit: '100kb' })`.
- Passwords: bcrypt cost >= 12 (or argon2), minimum length 12, compare in constant time (bcrypt does).

## 7. Errors and outbound calls
- One central error handler: log details server-side, return `{ error: 'Internal error' }` with a request id. Never send `err.stack` or SQL errors.
- Outbound calls use HTTPS, a timeout (`AbortSignal.timeout(5000)`), and handle failure explicitly.

## 8. Dependencies
- Commit the lockfile. Run `npm audit --omit=dev` before finishing; fix High/Critical.

## Self-check grep (run before finishing)
```
grep -rnE "Math\.random|\+ *(req|search|q)\b|\`.*(SELECT|INSERT|UPDATE|DELETE).*\$\{|secret *= *['\"]|\|\| *['\"][a-z]+['\"]" src
```
Any hit must be justified or fixed.
