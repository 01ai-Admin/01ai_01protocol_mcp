# @01protocol/mcp-server

MCP (Model Context Protocol) server for the [01 Protocol](https://01ai.ai).

Gives Claude Desktop and any MCP-compatible AI assistant native tools for creating, verifying, and managing AI agent identities — without leaving the conversation.

## Install in Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "01protocol": {
      "command": "npx",
      "args": ["-y", "@01protocol/mcp-server"],
      "env": {
        "AGENT_VAULT_DIR": "/Users/you/.01protocol/agents"
      }
    }
  }
}
```

**Config file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Restart Claude Desktop. You'll see the 01 Protocol tools available in the tools panel.

## Available Tools

### `create_agent`
Create a new cryptographically signed agent identity.

```
"Create a 01 Protocol identity for my customer support agent named Aria,
role: Customer Support, goal: resolve customer issues efficiently"
```

### `verify_agent`
Verify the integrity of a .01ai or .01bundle file.

```
"Verify the agent at /Users/me/agents/aria.01ai"
```

### `load_agent`
Display an agent's full identity and memory vault contents.

```
"Load my agent Aria and show me her memory vault"
```

### `list_agents`
List all agent files in the local vault.

```
"List all my agents"
```

### `add_memory`
Add a memory entry to an agent's vault (requires private key to re-sign).

```
"Add a memory to Aria: she resolved 200 tickets this week.
Private key: <hex>"
```

### `sign_output`
Sign any text or JSON output with an agent's identity.

```
"Sign this analysis report as my analyst agent"
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AGENT_VAULT_DIR` | `~/.01protocol/agents` | Directory where .01ai files are stored |

## Security

- Private keys are **never stored** by the server
- All cryptography runs locally — no network calls for verification
- Ed25519 signing via [@noble/curves](https://github.com/paulmillr/noble-curves)
- Input size and nesting limits enforced on all file reads

## Links

- [01AI.ai](https://01ai.ai)
- [app.01ai.ai](https://app.01ai.ai) — Web app
- [GitHub](https://github.com/01ai-Admin/01-protocol)

## License

MIT
