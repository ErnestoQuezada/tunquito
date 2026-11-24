# Tunquito

A piggy-bank demo. "Tunquito" is Salvadoran for a little pig (associating with a piggy bank).

Visitors pick a name, Tunquito creates a virtual account for them, and they can send
sats (with a memo) to each other. Balances are tracked in SQLite and settled against a
single LNbits "vault" wallet (Fake Wallet funding source for testing). New-account
creation notifies an admin over Telegram.

## Stack

- Node.js + Express
- SQLite (better-sqlite3)
- LNbits HTTP API (single shared vault wallet)
- Telegram Bot API (admin notifications)

## Setup

1. Make sure LNbits is running (in WSL) and reachable from Windows at http://127.0.0.1:5000.
2. npm install
3. Copy .env.example to .env and fill real values.
4. npm run initdb (creates the SQLite DB + tables)
5. npm start

Open http://localhost:3000.

## Wallet model

Single custodial LNbits vault wallet. Tunquito keeps per-user virtual balances in SQLite.
Transfers between users are recorded in SQLite and (where possible) mirrored to LNbits
via the Fake Wallet internal-transfer API so the demo is end-to-end exercisable.

## Telegram

On each new account, Tunquito sends a message to TELEGRAM_ADMIN_CHAT_ID:
"New Tunquito account: <name>".
