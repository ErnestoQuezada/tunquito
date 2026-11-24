# Tunquito MCP server

Exposes Tunquito wallet tools to arbitrary AI agents over the **Model Context Protocol (MCP)**.
Agents act as **existing named users** — an agent claims a name (or uses one that already
exists) and then has full control over that wallet, including deletion.

## Tools

| Tool | What it does |
|------|--------------|
| `create_wallet(name)` | Claim a name → new virtual wallet (starter balance) |
| `get_balance(name)` | Read a user's balance in sats |
| `list_users()` | List all users + balances |
| `send_sats(from, to, amount, memo)` | Send sats + optional memo between users |
| `top_up(name, amount?)` | Credit a wallet (default 21000 sats) |
| `list_transfers()` | Recent transfers |
| `delete_wallet(name)` | Delete a wallet + its history |

## Setup

1. Make sure the main Tunquito app is running: `npm start` (default `http://127.0.0.1:3000`).
2. `npm install` (pulls MCP SDK + zod)
3. Run the MCP server: `npm run mcp`

The MCP server talks to the app over HTTP (set `TUNQUITO_URL` in `.env` to change the
app URL; defaults to `http://127.0.0.1:3000`).

## Wire it into an agent (examples)

### Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "tunquito": {
      "command": "node",
      "args": ["C:/Users/acreonte/Desktop/Tunquito/mcp/server.js"]
    }
  }
}
```

### Cursor / other stdio MCP clients
Register the same command (`node mcp/server.js`) as an MCP server. Most MCP clients accept
a stdio server via command + args.

### Any MCP-over-HTTP client
This server uses stdio transport. For HTTP/SSE access, run a transport bridge or use the
Tunquito REST API directly (see `/api/*` — same operations, plain HTTP).
