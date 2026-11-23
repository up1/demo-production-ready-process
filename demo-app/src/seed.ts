import bcrypt from 'bcryptjs';
import db from './db';

const users = [
  { email: 'admin@example.com', password: 'admin123', name: 'Admin', role: 'admin' },
  { email: 'user@example.com', password: 'password123', name: 'Test User', role: 'user' },
];
for (const u of users) {
  db.prepare('INSERT OR IGNORE INTO users (email, password, name, role) VALUES (?, ?, ?, ?)').run(
    u.email, bcrypt.hashSync(u.password, 10), u.name, u.role
  );
}

const products = [
  { name: 'Laptop', price: 999.99, stock: 10 },
  { name: 'Mouse', price: 19.99, stock: 100 },
  { name: 'Keyboard', price: 49.5, stock: 50 },
  { name: 'Monitor', price: 249.0, stock: 20 },
];
const count: any = db.prepare('SELECT COUNT(*) as c FROM products').get();
if (count.c === 0) {
  for (const p of products) {
    db.prepare('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)').run(p.name, p.price, p.stock);
  }
}

console.log('Seeded database');
