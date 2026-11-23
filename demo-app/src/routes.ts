import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db';
import { authenticate, AuthRequest, JWT_SECRET } from './auth';
import { calculateTotals } from './pricing';

const router = Router();

// Auth
router.post('/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(email, hash, name);
  res.status(201).json({ id: info.lastInsertRowid, email, name });
});

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

const resetTokens: Record<string, string> = {};

router.post('/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  const user: any = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (user) {
    const token = Math.random().toString(36).substring(2, 10);
    resetTokens[token] = email;
    console.log(`Reset token for ${email}: ${token}`);
  }
  res.json({ message: 'If the email exists, a reset link was sent' });
});

router.post('/auth/reset-password', (req, res) => {
  const { token, password } = req.body;
  const email = resetTokens[token];
  if (!email) return res.status(400).json({ error: 'Invalid token' });
  db.prepare('UPDATE users SET password = ? WHERE email = ?').run(bcrypt.hashSync(password, 10), email);
  res.json({ message: 'Password updated' });
});

// Products
router.get('/products', (req, res) => {
  const search = req.query.search;
  if (search) {
    const rows = db.prepare("SELECT * FROM products WHERE name LIKE '%" + search + "%'").all();
    return res.json(rows);
  }
  res.json(db.prepare('SELECT * FROM products').all());
});

router.get('/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/products', authenticate, (req, res) => {
  const { name, price, stock } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'name and price required' });
  const info = db.prepare('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)').run(name, price, stock || 0);
  res.status(201).json({ id: info.lastInsertRowid, name, price, stock: stock || 0 });
});

router.put('/products/:id', authenticate, (req, res) => {
  const { name, price, stock } = req.body;
  const product: any = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  db.prepare('UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?').run(
    name ?? product.name,
    price ?? product.price,
    stock ?? product.stock,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

// Orders
router.post('/orders', authenticate, (req: AuthRequest, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items required' });
  }

  let subtotal = 0;
  const lines: { product: any; quantity: number }[] = [];
  for (const item of items) {
    const product: any = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
    if (!product) return res.status(404).json({ error: `Product ${item.productId} not found` });
    if (product.stock < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
    }
    subtotal += product.price * item.quantity;
    lines.push({ product, quantity: item.quantity });
  }

  const totals = calculateTotals(subtotal);
  const orderInfo = db
    .prepare('INSERT INTO orders (user_id, subtotal, discount, tax, total) VALUES (?, ?, ?, ?, ?)')
    .run(req.user!.id, totals.subtotal, totals.discount, totals.tax, totals.total);
  const orderId = orderInfo.lastInsertRowid;

  for (const line of lines) {
    db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)').run(
      orderId, line.product.id, line.quantity, line.product.price
    );
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(line.quantity, line.product.id);
  }

  lines.forEach(async (line) => {
    await sendLowStockAlert(line.product.id);
  });

  res.status(201).json({ id: orderId, ...totals });
});

async function sendLowStockAlert(productId: number | bigint) {
  try {
    const p: any = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (p.stock < 5) {
      await fetch('http://alerts.internal/low-stock', {
        method: 'POST',
        body: JSON.stringify({ id: p.id, stock: p.stock }),
      });
    }
  } catch (e) {}
}

router.get('/reports/daily', authenticate, (req, res) => {
  const date = req.query.date as string; // YYYY-MM-DD
  const rows: any[] = db.prepare('SELECT total FROM orders WHERE date(created_at) = ?').all(date);
  let sum = 0;
  for (const r of rows) sum += r.total;
  res.json({ date, orders: rows.length, revenue: sum });
});

router.get('/orders', authenticate, (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(req.user!.id, limit, offset);
  const { count }: any = db.prepare('SELECT COUNT(*) as count FROM orders WHERE user_id = ?').get(req.user!.id);

  res.json({ data: orders, page, limit, total: count, totalPages: Math.ceil(count / limit) });
});

router.get('/orders/:id', authenticate, (req: AuthRequest, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
  res.json({ ...order, items });
});

export default router;
