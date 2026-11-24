async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function setMsg(el, text, ok) {
  el.textContent = text;
  el.className = 'msg' + (ok ? ' ok' : '');
}

const createForm = document.getElementById('create-form');
const sendForm = document.getElementById('send-form');
const usersList = document.getElementById('users-list');
const transfersList = document.getElementById('transfers-list');
const createMsg = document.getElementById('create-msg');
const sendMsg = document.getElementById('send-msg');
const topupForm = document.getElementById('topup-form');
const topupMsg = document.getElementById('topup-msg');
const rest = document.getElementById('rest');
const createCard = document.getElementById('create-card');

const STORAGE_KEY = 'tunquito.identity';

function getIdentity() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function setIdentity(name) {
  try { localStorage.setItem(STORAGE_KEY, name); } catch {}
}

function showApp(name) {
  // Reveal everything and prefill "From" with the claimed identity
  rest.hidden = false;
  document.getElementById('from-input').value = name;
  // Swap the create card into a "logged in" summary
  createMsg.textContent = 'You are ' + name + ' 🐷';
  createMsg.className = 'msg ok';
  document.getElementById('name-input').value = '';
  document.getElementById('name-input').parentElement.style.display = 'none';
  createCard.querySelector('button').style.display = 'none';
}

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name-input').value.trim();
  const { ok, status, data } = await api('/users', { method: 'POST', body: JSON.stringify({ name }) });
  if (ok) {
    setIdentity(name);
    showApp(name);
    await Promise.all([loadUsers(), loadTransfers()]);
  } else {
    setMsg(createMsg, data.error || ('Error ' + status), false);
  }
});

sendForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    from: document.getElementById('from-input').value.trim(),
    to: document.getElementById('to-input').value.trim(),
    amount: Number(document.getElementById('amount-input').value),
    memo: document.getElementById('memo-input').value.trim(),
  };
  const { ok, status, data } = await api('/transfer', { method: 'POST', body: JSON.stringify(body) });
  if (ok) {
    setMsg(sendMsg, `Sent ${data.amount} sats to ${data.to}`, true);
    document.getElementById('amount-input').value = '';
    document.getElementById('memo-input').value = '';
    await Promise.all([loadUsers(), loadTransfers()]);
  } else {
    setMsg(sendMsg, data.error || ('Error ' + status), false);
  }
});

topupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: document.getElementById('topup-name').value.trim(),
    amount: Number(document.getElementById('topup-amount').value),
  };
  const { ok, status, data } = await api('/topup', { method: 'POST', body: JSON.stringify(body) });
  if (ok) {
    setMsg(topupMsg, `Credited ${data.credited} sats to ${data.to} (balance ${data.balance})`, true);
    await loadUsers();
  } else {
    setMsg(topupMsg, data.error || ('Error ' + status), false);
  }
});

async function loadUsers() {
  const { data } = await api('/users');
  usersList.innerHTML = '';
  (data || []).forEach(u => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = u.name;
    const bal = document.createElement('span');
    bal.className = 'balance';
    bal.textContent = u.balance + ' sats';
    li.append(name, bal);
    usersList.appendChild(li);
  });
}

async function loadTransfers() {
  const { data } = await api('/transfers');
  transfersList.innerHTML = '';
  (data || []).forEach(t => {
    const li = document.createElement('li');
    li.textContent = `${t.from} → ${t.to}: ${t.amount} sats` + (t.memo ? ` (${t.memo})` : '');
    transfersList.appendChild(li);
  });
  if (!(data || []).length) transfersList.innerHTML = '<li>No transfers yet.</li>';
}

document.getElementById('refresh-btn').addEventListener('click', () => {
  Promise.all([loadUsers(), loadTransfers()]);
});

document.getElementById('reset-btn').addEventListener('click', async () => {
  if (!confirm('Reset ALL accounts and transfers? This wipes the demo ledger.')) return;
  const { ok } = await api('/reset', { method: 'POST' });
  if (ok) {
    // Also clear the local identity so the page returns to the "create account" gate
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    location.reload();
  } else {
    alert('Reset failed');
  }
});

(function init() {
  const name = getIdentity();
  if (name) {
    showApp(name);
    Promise.all([loadUsers(), loadTransfers()]);
  }
  // else: stay on "Create your account" only
})();
