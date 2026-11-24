import 'dotenv/config';
import express from 'express';
import { db, initDb } from './db.js';
import { createInvoice, payInvoice, getWalletBalance } from './lnbits.js';
import { notifyNewUser, notifyUserDeleted } from './telegram.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const RESERVED = new Set(
  (process.env.RESERVED_NAMES || 'admin,root,tunquito,owner,staff')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
);

function normalizeName(name) { return String(name || '').trim(); }
function nameKey(name) { return normalizeName(name).toLowerCase(); }

// ---- API ----

app.get('/api/users', (req, res) => {
  const rows = db.prepare('SELECT id, name, balance, created_at FROM users ORDER BY name').all();
  res.json(rows);
});

app.get('/api/users/:name', (req, res) => {
  const key = nameKey(req.params.name);
  const u = db.prepare('SELECT id, name, balance, created_at FROM users WHERE name_key = ?').get(key);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u);
});

// Delete a user's account (and their transfer history). Demo: open to anyone.
app.delete('/api/users/:name', (req, res) => {
  const key = nameKey(req.params.name);
  const u = db.prepare('SELECT id, name FROM users WHERE name_key = ?').get(key);
  if (!u) return res.status(404).json({ error: 'User not found' });

  const apply = db.transaction(() => {
    db.prepare('DELETE FROM transfers WHERE from_id = ? OR to_id = ?').run(u.id, u.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  });
  apply();

  notifyUserDeleted(u.name).catch(e => console.error('[telegram]', e.message));
  res.json({ ok: true, deleted: u.name });
});

app.post('/api/users', async (req, res) => {
  const name = normalizeName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (name.length > 40) return res.status(400).json({ error: 'Name too long (max 40 chars)' });
  const key = nameKey(name);
  if (RESERVED.has(key)) return res.status(409).json({ error: 'That name is reserved' });

  const existing = db.prepare('SELECT id FROM users WHERE name_key = ?').get(key);
  if (existing) return res.status(409).json({ error: 'That name is already taken' });

  const info = db.prepare('INSERT INTO users (name, name_key, balance) VALUES (?, ?, 21000)').run(name, key);
  const user = db.prepare('SELECT id, name, balance, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);

  notifyNewUser(name).catch(e => console.error('[telegram]', e.message));

  res.status(201).json(user);
});

app.post('/api/transfer', async (req, res) => {
  const from = nameKey(req.body?.from);
  const to = nameKey(req.body?.to);
  const amount = Number(req.body?.amount);
  const memo = String(req.body?.memo || '').slice(0, 500);

  if (!from || !to) return res.status(400).json({ error: 'Both from and to are required' });
  if (from === to) return res.status(400).json({ error: 'Cannot send to yourself' });
  if (!Number.isInteger(amount) || amount <= 0) return res.status(400).json({ error: 'Amount must be a positive integer (sats)' });

  const sender = db.prepare('SELECT id, name, balance FROM users WHERE name_key = ?').get(from);
  const receiver = db.prepare('SELECT id, name FROM users WHERE name_key = ?').get(to);
  if (!sender) return res.status(404).json({ error: 'Sender not found' });
  if (!receiver) return res.status(404).json({ error: 'Receiver not found' });
  if (sender.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

  const apply = db.transaction(() => {
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, sender.id);
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, receiver.id);
    const t = db.prepare('INSERT INTO transfers (from_id, to_id, amount, memo) VALUES (?, ?, ?, ?)').run(sender.id, receiver.id, amount, memo);
    return t.lastInsertRowid;
  });
  const transferId = apply();

  try {
    await mirrorToLnbits(sender.name, receiver.name, amount, memo);
  } catch (e) {
    console.error('[lnbits mirror]', e.message);
  }

  res.status(201).json({ transferId, from: sender.name, to: receiver.name, amount, memo });
});

app.get('/api/transfers', (req, res) => {
  const rows = db.prepare("SELECT t.id, uf.name AS \"from\", ut.name AS \"to\", t.amount, t.memo, t.created_at FROM transfers t JOIN users uf ON uf.id = t.from_id JOIN users ut ON ut.id = t.to_id ORDER BY t.id DESC LIMIT 100").all();
  res.json(rows);
});

async function mirrorToLnbits(fromName, toName, amount, memo) {
  try {
    const inv = await createInvoice(amount, `Tunquito tip from ${fromName} to ${toName}: ${memo || '(no memo)'}`);
    if (inv && inv.payment_request) {
      await payInvoice(inv.payment_request);
    }
  } catch (e) {
    throw e;
  }
}

// Top up a user's virtual balance (demo faucet). Adds sats (default 21000).
app.post('/api/topup', (req, res) => {
  const name = nameKey(req.body?.name);
  const amount = Number(req.body?.amount);
  const amt = Number.isInteger(amount) && amount > 0 ? amount : 21000;

  if (!name) return res.status(400).json({ error: 'Name is required' });
  const user = db.prepare('SELECT id, name, balance FROM users WHERE name_key = ?').get(name);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amt, user.id);
  const updated = db.prepare('SELECT id, name, balance FROM users WHERE id = ?').get(user.id);
  res.json({ ok: true, to: updated.name, credited: amt, balance: updated.balance });
});

// Reset the whole ledger (delete all users + transfers). For "show from scratch" demos.
app.post('/api/reset', (req, res) => {
  const apply = db.transaction(() => {
    db.prepare('DELETE FROM transfers').run();
    db.prepare('DELETE FROM users').run();
  });
  apply();
  res.json({ ok: true, reset: true });
});

app.get('/api/status', async (req, res) => {
  let lnbitsBalance = null, lnbitsError = null;
  try { lnbitsBalance = await getWalletBalance(); } catch (e) { lnbitsError = e.message; }
  res.json({ ok: true, lnbits: { balance_msat: lnbitsBalance, error: lnbitsError }, userCount: db.prepare('SELECT COUNT(*) c FROM users').get().c });
});

const os = await import('node:os');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // bind all interfaces so LAN peers can connect
initDb();

function lanIPs() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  return out;
}

app.listen(PORT, HOST, () => {
  console.log(`Tunquito listening on http://localhost:${PORT}`);
  for (const ip of lanIPs()) {
    console.log(`  LAN: http://${ip}:${PORT}`);
  }
});
