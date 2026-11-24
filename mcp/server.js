import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Tunquito MCP server.
// Exposes wallet tools to arbitrary AI agents over stdio (Model Context Protocol).
// Each agent acts as an existing *named user* (option a). The agent is identified
// by a name it claims or already holds.

const BASE = (process.env.TUNQUITO_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

async function api(method, path, body) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.error || data.detail || data.message)) || data || res.status;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

const server = new McpServer({
  name: 'tunquito',
  version: '0.1.0',
});

// --- Tools ---

server.tool(
  'create_wallet',
  'Create a wallet for a given name (a virtual Tunquito account with a starter balance).',
  { name: z.string().describe('The name to claim. Must be unique and not reserved.') },
  async ({ name }) => {
    const u = await api('POST', '/users', { name });
    return { content: [{ type: 'text', text: JSON.stringify(u, null, 2) }] };
  }
);

server.tool(
  'get_balance',
  'Get the balance (in sats) for a named user.',
  { name: z.string().describe('The user name.') },
  async ({ name }) => {
    const u = await api('GET', '/users/' + encodeURIComponent(name));
    return { content: [{ type: 'text', text: JSON.stringify({ name: u.name, balance: u.balance }, null, 2) }] };
  }
);

server.tool(
  'list_users',
  'List all users and their balances.',
  {},
  async () => {
    const users = await api('GET', '/users');
    return { content: [{ type: 'text', text: JSON.stringify(users, null, 2) }] };
  }
);

server.tool(
  'send_sats',
  'Send sats from one user to another with an optional memo (a "message with sats" tip).',
  {
    from: z.string().describe('The sender name.'),
    to: z.string().describe('The receiver name.'),
    amount: z.number().int().positive().describe('Amount in sats (positive integer).'),
    memo: z.string().optional().describe('Optional text note attached to the transfer.'),
  },
  async ({ from, to, amount, memo }) => {
    const t = await api('POST', '/transfer', { from, to, amount, memo: memo || '' });
    return { content: [{ type: 'text', text: JSON.stringify(t, null, 2) }] };
  }
);

server.tool(
  'top_up',
  'Top up a user wallet by a number of sats (demo faucet). Default 21000.',
  {
    name: z.string().describe('The user name to credit.'),
    amount: z.number().int().positive().optional().describe('Amount in sats. Defaults to 21000.'),
  },
  async ({ name, amount }) => {
    const r = await api('POST', '/topup', { name, amount });
    return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
  }
);

server.tool(
  'list_transfers',
  'List recent transfers.',
  {},
  async () => {
    const transfers = await api('GET', '/transfers');
    return { content: [{ type: 'text', text: JSON.stringify(transfers, null, 2) }] };
  }
);

server.tool(
  'delete_wallet',
  "Delete a user's wallet and their transfer history.",
  { name: z.string().describe('The user name to delete.') },
  async ({ name }) => {
    const r = await api('DELETE', '/users/' + encodeURIComponent(name));
    return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
  }
);

// --- Run over stdio ---
const transport = new StdioServerTransport();
await server.connect(transport);
