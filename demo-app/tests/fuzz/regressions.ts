/**
 * Regression corpus. Seeded with the requests the first fuzz run proved to break the app (red until fixed);
 * after a fix keeps them green forever, and every new confirmed finding is minimised and added here.
 */
export interface RegressionCase {
  id: string;
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  body?: unknown;
  auth?: boolean;
}

export const REGRESSIONS: RegressionCase[] = [
  { id: 'search-single-quote-sqli', method: 'GET', path: "/api/products?search=%27" },
  { id: 'order-null-item', method: 'POST', path: '/api/orders', body: { items: [null] }, auth: true },
  { id: 'register-non-string-password', method: 'POST', path: '/api/auth/register', body: { email: 'a@b.c', password: 123 } },
  { id: 'login-missing-fields', method: 'POST', path: '/api/auth/login', body: {} },
  { id: 'order-negative-quantity', method: 'POST', path: '/api/orders', body: { items: [{ productId: 1, quantity: -1 }] }, auth: true },
  { id: 'malformed-json', method: 'POST', path: '/api/auth/login', body: '{' },
];
