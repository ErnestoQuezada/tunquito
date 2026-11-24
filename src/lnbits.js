const BASE = (process.env.LNBITS_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const INKEY = process.env.LNBITS_INKEY || '';

async function lnbits(path, options = {}) {
  const url = BASE + path;
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Api-Key': INKEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || data || res.status;
    throw new Error('LNbits API ' + res.status + ': ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
  }
  return data;
}

// Create an invoice against the vault wallet (receiving funds)
export async function createInvoice(amountSats, memo = '') {
  return lnbits('/api/v1/payments', {
    method: 'POST',
    body: JSON.stringify({ out: false, amount: amountSats, memo }),
  });
}

// Pay a bolt11 invoice from the vault wallet (Fake Wallet internal transfer)
export async function payInvoice(bolt11) {
  return lnbits('/api/v1/payments', {
    method: 'POST',
    body: JSON.stringify({ out: true, bolt11 }),
  });
}

// Wallet balance (msat)
export async function getWalletBalance() {
  const w = await lnbits('/api/v1/wallet');
  return w && (w.balance ?? w.balance_msat ?? null);
}
