const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '';

export async function notifyNewUser(name) {
  if (!TOKEN || !CHAT_ID) {
    console.warn('[telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID — skipping');
    return;
  }
  const text = `🐷 New Tunquito account: ${name}`;
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
  if (!res.ok) throw new Error('Telegram send failed ' + res.status);
}

export async function notifyUserDeleted(name) {
  if (!TOKEN || !CHAT_ID) {
    console.warn('[telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID — skipping');
    return;
  }
  const text = `💀 Tunquito account deleted: ${name}`;
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
  if (!res.ok) throw new Error('Telegram send failed ' + res.status);
}
