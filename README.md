# 01 Protocol Monorepo

Portable, cryptographically verifiable AI agent identity.

This repository contains the canonical public distribution packages for 01 Protocol.

## Packages

- `@01protocol/sdk` (`packages/sdk`): TypeScript/JavaScript SDK for creating, verifying, and evolving `.01ai` identities.
- `@01protocol/mcp-server` (`packages/mcp-server`): MCP server exposing agent identity tools to Claude Desktop and other MCP clients.
- `protocol-01` (`python-sdk`): Python SDK.

## Current Install Status

- npm packages: not published yet
- PyPI package: publish in progress
- Local monorepo usage: supported now

## Local Quick Start

1. Install dependencies from repo root:

```bash
npm install
```

2. Build all workspace packages:

```bash
npm run build
```

3. Use SDK locally in another project:

```bash
npm install /absolute/path/to/01protocol/packages/sdk
```

## MCP Quick Start (Local)

Build the MCP package, then point Claude Desktop to the built entrypoint.

```json
{
  "mcpServers": {
    "01protocol": {
      "command": "node",
      "args": ["/absolute/path/to/01protocol/packages/mcp-server/dist/index.js"],
      "env": {
        "AGENT_VAULT_DIR": "/absolute/path/to/agent-vault"
      }
    }
  }
}
```

## Specs and Docs

- Main site: https://01ai.ai
- App: https://app.01ai.ai
- Developer page: https://01ai.ai/developers
- Canonical repo: https://github.com/01ai-Admin/01ai_01protocol_mcp
- Protocol spec bundle in workspace: `github-docs/spec/`

## Contributing

Contribution docs will be added at root (`CONTRIBUTING.md`).
For now, open issues or PRs with reproducible examples.
