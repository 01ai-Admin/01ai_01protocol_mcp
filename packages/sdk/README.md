# @01protocol/sdk

Official JavaScript/TypeScript SDK for the [01 Protocol](https://01ai.ai) — portable, cryptographically verifiable AI agent identity.

## Install

```bash
npm install @01protocol/sdk
```

> **Note:** Until the npm package is published, install directly from GitHub:
> ```bash
> npm install github:01ai-Admin/01ai_01protocol_mcp#v0.1.0
> ```

## Quick Start

```typescript
import { createAgent, verifyFromText } from "@01protocol/sdk";

// Create a new agent identity
const result = createAgent({
  name: "Sales Analyst",
  role: "Data Analyst",
  goal: "Analyze quarterly sales data and surface insights",
});

console.log("Agent ID:", result.agent.instanceId);
console.log("SAVE THIS KEY:", result.privateKeyHex); // shown once

// Verify a .01ai file
import { readFileSync } from "node:fs";
const text = readFileSync("agent.01ai", "utf-8");
const verified = verifyFromText(text);

if (verified.valid) {
  console.log("✅ PASS:", verified.agent.name);
} else {
  console.log("❌ FAIL:", verified.error);
}
```

## With Memory Vault

```typescript
const result = createAgent({
  name: "Research Agent",
  role: "Research Analyst",
  goal: "Synthesize academic papers into actionable insights",
  includeMemory: true, // produces .01bundle
});
// result.bundle contains identity + memory vault
```

## Add Memory to Existing Agent

```typescript
import { addMemoryEntry, computeVaultMerkleRoot, resignAgent } from "@01protocol/sdk";

const updatedVault = addMemoryEntry(vault, {
  instanceId: agent.instanceId,
  layer: "persistent-vault",
  type: "decision",
  summary: "Chose PostgreSQL over MongoDB for the reporting module",
  tags: ["architecture", "database"],
});

const merkleRoot = computeVaultMerkleRoot(updatedVault);
const updatedAgent = resignAgent(agent, privateKeyHex, { memoryMerkleRoot: merkleRoot });
```

## API

| Function | Description |
|---|---|
| `createAgent(params)` | Mint a new agent identity with Ed25519 keypair |
| `verifyFromText(text)` | Parse + verify a `.01ai` file from raw string |
| `verifyAgentRecord(obj)` | Verify a pre-parsed agent object |
| `resignAgent(agent, key, updates)` | Re-sign after updates, increments evolutionCounter |
| `addMemoryEntry(vault, entry)` | Add a memory entry to a vault |
| `computeVaultMerkleRoot(vault)` | Compute SHA-256 Merkle root of vault contents |
| `createPortableBundle(agent, vault)` | Combine identity + vault into `.01bundle` |

## Protocol

- **Signing**: Ed25519 via [@noble/curves](https://github.com/paulmillr/noble-curves)
- **Hashing**: SHA-256 via [@noble/hashes](https://github.com/paulmillr/noble-hashes)
- **Format**: `.01ai` (identity only) or `.01bundle` (identity + memory)
- **Offline-first**: Zero network calls for verification
- **Patent**: US Provisional Patent pending

## Links

- [01AI.ai](https://01ai.ai) — Main site
- [app.01ai.ai](https://app.01ai.ai) — Web app
- [GitHub](https://github.com/01ai-Admin/01ai_01protocol_mcp) — Spec and source
- [Developers](https://01ai.ai/developers) — Full documentation

## License

MIT — see [LICENSE](../../LICENSE)
