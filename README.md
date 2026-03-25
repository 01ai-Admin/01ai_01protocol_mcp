# 01 Protocol Monorepo

Portable, cryptographically verifiable AI agent identity.

This repository contains the canonical public distribution packages for 01 Protocol.

## Packages

- `@01protocol/sdk` (`packages/sdk`): TypeScript/JavaScript SDK for creating, verifying, and evolving `.01ai` identities.
- `@01protocol/mcp-server` (`packages/mcp-server`): MCP server exposing agent identity tools to Claude Desktop and other MCP clients.
- `protocol-01` (`python-sdk`): Python SDK.

## Install

```bash
# SDK
npm install @01protocol/sdk

# MCP server (Claude Desktop / any MCP client)
npx @01protocol/mcp-server
```

## MCP Quick Start

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

Config file locations:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

## Specs and Docs

- Main site: https://01ai.ai
- App: https://app.01ai.ai
- Developer page: https://01ai.ai/developers
- Canonical repo: https://github.com/01ai-Admin/01ai_01protocol_mcp
- Protocol spec bundle in workspace: `github-docs/spec/`

## Contributing

Contribution docs will be added at root (`CONTRIBUTING.md`).
For now, open issues or PRs with reproducible examples.
