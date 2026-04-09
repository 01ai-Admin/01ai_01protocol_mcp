#!/usr/bin/env node
/**
 * 01 Protocol MCP Server
 *
 * Exposes 01 Protocol agent identity tools to Claude Desktop
 * and any MCP-compatible AI assistant.
 *
 * Install in Claude Desktop claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "01protocol": {
 *       "command": "npx",
 *       "args": ["-y", "@01protocol/mcp-server"],
 *       "env": { "AGENT_VAULT_DIR": "/path/to/your/agents" }
 *     }
 *   }
 * }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { MemoryEntry } from "@01protocol/sdk";
import {
  createAgent,
  verifyFromText,
  addMemoryEntry,
  computeVaultMerkleRoot,
  resignAgent,
  createPortableBundle,
  createStarterMemoryVault,
  signOutput,
  createPedigree,
  showLineage,
  verifyPedigree,
} from "@01protocol/sdk";
import type { AgentId, AgentMemoryVault, PortableBundle } from "@01protocol/sdk";

const DEFAULT_VAULT_DIR = path.join(os.homedir(), ".01protocol", "agents");
const VAULT_DIR = path.resolve(process.env["AGENT_VAULT_DIR"] ?? DEFAULT_VAULT_DIR);

function ensureVaultDir(): void {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
}

function loadAgentFile(filePath: string): { agent: AgentId; vault?: AgentMemoryVault; bundle?: PortableBundle } {
  const text = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(text);
  if (parsed.identity && parsed.memoryVault) {
    return { agent: parsed.identity as AgentId, vault: parsed.memoryVault as AgentMemoryVault, bundle: parsed as PortableBundle };
  }
  return { agent: parsed as AgentId };
}

function findAgentFile(nameOrId: string): string | null {
  ensureVaultDir();
  const files = fs.readdirSync(VAULT_DIR);
  for (const f of files) {
    if (!f.endsWith(".01ai") && !f.endsWith(".01bundle")) continue;
    try {
      const data = loadAgentFile(path.join(VAULT_DIR, f));
      if (
        data.agent.instanceId === nameOrId ||
        data.agent.name.toLowerCase() === nameOrId.toLowerCase() ||
        f === nameOrId
      ) {
        return path.join(VAULT_DIR, f);
      }
    } catch { /* skip malformed files */ }
  }
  return null;
}

const server = new Server(
  { name: "01protocol", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_agent",
      description: "Create a new 01 Protocol agent identity. Returns the agent ID and saves the .01ai file locally. The private key is shown once — save it securely.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Agent name (e.g. 'Sales Analyst')" },
          role: { type: "string", description: "Agent role (e.g. 'Data Analyst')" },
          goal: { type: "string", description: "Agent primary goal or purpose" },
          include_memory: { type: "boolean", description: "Include a starter memory vault (produces .01bundle)", default: false },
          memory_mode: { type: "string", enum: ["always_on", "session_only"], default: "always_on" },
          serial_number: { type: "number", description: "Edition serial number", default: 1 },
          total_supply: { type: "number", description: "Total supply for this agent type", default: 1 },
        },
        required: ["name", "role", "goal"],
      },
    },
    {
      name: "verify_agent",
      description: "Verify the cryptographic integrity of a .01ai or .01bundle file. Pass file path or raw JSON.",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string", description: "File path to a .01ai/.01bundle file, agent name, or raw JSON content" },
        },
        required: ["source"],
      },
    },
    {
      name: "load_agent",
      description: "Load and display an agent's full identity and memory vault details.",
      inputSchema: {
        type: "object",
        properties: {
          name_or_id: { type: "string", description: "Agent name, instance ID, or file path" },
        },
        required: ["name_or_id"],
      },
    },
    {
      name: "list_agents",
      description: "List all .01ai and .01bundle agent identity files in the local vault directory.",
      inputSchema: {
        type: "object",
        properties: {
          vault_dir: { type: "string", description: "Directory to scan (defaults to ~/.01protocol/agents)" },
        },
      },
    },
    {
      name: "add_memory",
      description: "Add a memory entry to an agent's vault. Recomputes the Merkle root and requires the private key to re-sign.",
      inputSchema: {
        type: "object",
        properties: {
          name_or_id: { type: "string", description: "Agent name, instance ID, or file path" },
          private_key_hex: { type: "string", description: "Agent's Ed25519 private key hex (64 chars)" },
          summary: { type: "string", description: "Memory entry content" },
          type: {
            type: "string",
            enum: ["summary", "task-context", "project-history", "decision", "achievement", "learning", "note"],
            default: "note",
          },
          tags: { type: "array", items: { type: "string" }, description: "Tags for this memory entry" },
          layer: { type: "string", enum: ["operational-cache", "persistent-vault"], default: "persistent-vault" },
        },
        required: ["name_or_id", "private_key_hex", "summary"],
      },
    },
    {
      name: "create_pedigree",
      description: "Create and attach a pedigree block for a bred agent identity.",
      inputSchema: {
        type: "object",
        properties: {
          child_agent_path: { type: "string", description: "Path to the child .01ai or .01bundle file" },
          child_agent_id: { type: "string", description: "Child agent instance ID" },
          parent_a_path: { type: "string", description: "Path to parent A identity file" },
          parent_b_path: { type: "string", description: "Path to parent B identity file" },
          crossover_result: { type: "object", description: "Output from HeredityEngine.crossover()" },
          suite_name: { type: "string" },
          suite_hash: { type: "string" },
          evaluated_at: { type: "number" },
          signing_private_key_hex: { type: "string", description: "Private key hex for the selected signing parent" },
        },
        required: ["child_agent_path", "child_agent_id", "parent_a_path", "parent_b_path", "crossover_result", "suite_name", "suite_hash", "evaluated_at", "signing_private_key_hex"],
      },
    },
    {
      name: "verify_pedigree",
      description: "Verify an agent pedigree block independently of the main agent identity signature.",
      inputSchema: {
        type: "object",
        properties: {
          agent_path: { type: "string", description: "Path to a .01ai or .01bundle file" },
        },
        required: ["agent_path"],
      },
    },
    {
      name: "show_lineage",
      description: "Show a recursive lineage tree for an agent pedigree.",
      inputSchema: {
        type: "object",
        properties: {
          agent_path: { type: "string", description: "Path to a .01ai or .01bundle file" },
          depth: { type: "number", default: 3 },
          agent_store: { type: "string", description: "Directory containing related agent identities" },
        },
        required: ["agent_path"],
      },
    },
    {
      name: "sign_output",
      description: "Sign a text output or JSON payload with an agent's identity to prove it came from that agent.",
      inputSchema: {
        type: "object",
        properties: {
          name_or_id: { type: "string", description: "Agent name, instance ID, or file path" },
          private_key_hex: { type: "string", description: "Agent's Ed25519 private key hex (64 chars)" },
          content: { type: "string", description: "The text or JSON content to sign" },
        },
        required: ["name_or_id", "private_key_hex", "content"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return { content: [{ type: "text", text: "❌ Error: Missing arguments" }], isError: true };
  }

  try {
    if (name === "create_agent") {
      ensureVaultDir();
      const result = createAgent({
        name: String(args["name"]),
        role: String(args["role"]),
        goal: String(args["goal"]),
        includeMemory: Boolean(args["include_memory"]),
        memoryMode: (args["memory_mode"] as "always_on" | "session_only") ?? "always_on",
        serialNumber: typeof args["serial_number"] === "number" ? args["serial_number"] : 1,
        totalSupply: typeof args["total_supply"] === "number" ? args["total_supply"] : 1,
      });

      const safeName = result.agent.name.toLowerCase().replace(/\s+/g, "-");
      const fileName = `${safeName}${result.fileExtension}`;
      const filePath = path.join(VAULT_DIR, fileName);
      fs.writeFileSync(filePath, result.json, "utf-8");

      return {
        content: [{
          type: "text",
          text: [
            `✅ Agent created: **${result.agent.name}**`,
            ``,
            `**Instance ID:** \`${result.agent.instanceId}\``,
            `**Public Key:** \`${result.agent.signerPublicKey}\``,
            `**File:** \`${filePath}\``,
            `**Format:** ${result.fileExtension}`,
            ``,
            `⚠️ **PRIVATE KEY (save this — shown once):**`,
            `\`${result.privateKeyHex}\``,
            ``,
            `The agent file has been saved to your vault. The private key is NOT stored — keep it safe to sign future outputs or update memory.`,
          ].join("\n"),
        }],
      };
    }

    if (name === "verify_agent") {
      const source = String(args["source"]);
      let text: string;

      if (fs.existsSync(source)) {
        text = fs.readFileSync(source, "utf-8");
      } else {
        const found = findAgentFile(source);
        if (found) {
          text = fs.readFileSync(found, "utf-8");
        } else {
          text = source;
        }
      }

      try {
        const parsed = JSON.parse(text);
        if (parsed.identity) text = JSON.stringify(parsed.identity);
      } catch { /* not JSON */ }

      const result = verifyFromText(text);

      const lines = [
        result.valid ? `✅ **PASS** — Signature verified` : `❌ **FAIL** — ${result.error}`,
      ];

      if (result.agent) {
        lines.push(
          ``,
          `**Name:** ${result.agent.name}`,
          `**ID:** \`${result.agent.instanceId}\``,
          `**State:** ${result.agent.lifecycleState}`,
          `**Created:** ${result.agent.createdAt}`,
          `**Evolution:** ${result.agent.evolutionCounter}`,
        );
        if (result.agent.memoryMerkleRoot) {
          lines.push(`**Memory Merkle Root:** \`${result.agent.memoryMerkleRoot}\``);
        }
      }

      if (result.warnings.length > 0) {
        lines.push(``, `**Warnings:**`);
        result.warnings.forEach((w) => lines.push(`⚠️ ${w}`));
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "load_agent") {
      const nameOrId = String(args["name_or_id"]);
      let filePath: string;

      if (fs.existsSync(nameOrId)) {
        filePath = nameOrId;
      } else {
        const found = findAgentFile(nameOrId);
        if (!found) {
          return { content: [{ type: "text", text: `❌ Agent not found: "${nameOrId}"\n\nTry \`list_agents\` to see available agents.` }] };
        }
        filePath = found;
      }

      const { agent, vault } = loadAgentFile(filePath);
      const lines = [
        `## Agent: ${agent.name}`,
        ``,
        `**Instance ID:** \`${agent.instanceId}\``,
        `**Descriptor:** ${agent.descriptor}`,
        `**Lifecycle State:** ${agent.lifecycleState}`,
        `**Evolution Counter:** ${agent.evolutionCounter}`,
        `**Created:** ${agent.createdAt}`,
        `**Updated:** ${agent.updatedAt}`,
        `**Public Key:** \`${agent.signerPublicKey}\``,
        `**Integrity Checksum:** \`${agent.integrityChecksum}\``,
      ];

      if (agent.memoryMerkleRoot) {
        lines.push(`**Memory Merkle Root:** \`${agent.memoryMerkleRoot}\``);
      }
      if (agent.platformProfiles) {
        lines.push(`**Platform Profiles:** ${agent.platformProfiles.map((p: { platform: string; model?: string }) => `${p.platform}/${p.model ?? "default"}`).join(", ")}`);
      }

      if (vault) {
        lines.push(
          ``,
          `## Memory Vault`,
          `**Vault ID:** \`${vault.vaultId}\``,
          `**Total Entries:** ${vault.memoryStats.totalEntries}`,
          `**Persistent Entries:** ${vault.persistentEntries.length}`,
          `**Operational Cache:** ${vault.operationalCache.length}`,
        );
        if (vault.persistentEntries.length > 0) {
          lines.push(``, `### Persistent Memory Entries`);
          vault.persistentEntries.slice(0, 10).forEach((e, i) => {
            lines.push(`${i + 1}. [${e.type}] ${e.summary} _(${e.tags.join(", ")})_`);
          });
        }
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "list_agents") {
      const dir = args["vault_dir"] ? String(args["vault_dir"]) : VAULT_DIR;
      ensureVaultDir();

      if (!fs.existsSync(dir)) {
        return { content: [{ type: "text", text: `❌ Directory not found: ${dir}` }] };
      }

      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".01ai") || f.endsWith(".01bundle"));

      if (files.length === 0) {
        return { content: [{ type: "text", text: `No agent files found in ${dir}\n\nUse \`create_agent\` to mint your first agent.` }] };
      }

      const lines = [`## Agent Vault (${files.length} agent${files.length !== 1 ? "s" : ""})`, ``];
      for (const f of files) {
        try {
          const { agent, vault } = loadAgentFile(path.join(dir, f));
          lines.push(
            `### ${agent.name}`,
            `- **ID:** \`${agent.instanceId}\``,
            `- **State:** ${agent.lifecycleState}`,
            `- **File:** \`${f}\``,
            vault ? `- **Memory entries:** ${vault.memoryStats.totalEntries}` : "",
            ``,
          );
        } catch {
          lines.push(`- \`${f}\` — ⚠️ could not parse`, ``);
        }
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "add_memory") {
      const nameOrId = String(args["name_or_id"]);
      const privateKeyHex = String(args["private_key_hex"]);

      let filePath: string;
      if (fs.existsSync(nameOrId)) {
        filePath = nameOrId;
      } else {
        const found = findAgentFile(nameOrId);
        if (!found) {
          return { content: [{ type: "text", text: `❌ Agent not found: "${nameOrId}"` }] };
        }
        filePath = found;
      }

      const fileData = loadAgentFile(filePath);
      let vault = fileData.vault ?? createStarterMemoryVault(fileData.agent);
      let agent = fileData.agent;

      const updatedVault = addMemoryEntry(vault, {
        instanceId: agent.instanceId,
        layer: (args["layer"] as "persistent-vault" | "operational-cache") ?? "persistent-vault",
        type: (args["type"] as MemoryEntry["type"]) ?? "note",
        summary: String(args["summary"]),
        tags: Array.isArray(args["tags"]) ? (args["tags"] as unknown[]).map(String) : [],
      }, agent);

      const merkleRoot = computeVaultMerkleRoot(updatedVault);
      agent = resignAgent(agent, privateKeyHex, { memoryMerkleRoot: merkleRoot });

      const bundle = createPortableBundle(agent, { ...updatedVault, merkleRoot });
      const newPath = filePath.replace(/\.(01ai|01bundle)$/, ".01bundle");
      fs.writeFileSync(newPath, JSON.stringify(bundle, null, 2), "utf-8");

      if (newPath !== filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return {
        content: [{
          type: "text",
          text: [
            `✅ Memory entry added to **${agent.name}**`,
            ``,
            `**Entry:** ${args["summary"]}`,
            `**Type:** ${args["type"] ?? "note"}`,
            `**New Merkle Root:** \`${merkleRoot}\``,
            `**Total Entries:** ${updatedVault.memoryStats.totalEntries}`,
            `**Saved to:** \`${newPath}\``,
          ].join("\n"),
        }],
      };
    }

    if (name === "create_pedigree") {
      const result = createPedigree({
        childAgentPath: String(args["child_agent_path"]),
        parentAPath: String(args["parent_a_path"]),
        parentBPath: String(args["parent_b_path"]),
        crossoverResult: args["crossover_result"] as Record<string, unknown>,
        suiteName: String(args["suite_name"]),
        suiteHash: String(args["suite_hash"]),
        evaluatedAt: Number(args["evaluated_at"]),
        signingPrivateKeyHex: String(args["signing_private_key_hex"]),
      });

      return {
        content: [{
          type: "text",
          text: [
            `Pedigree created for child agent \`${String(args["child_agent_id"])}\``,
            `Agent path: \`${result.agentPath}\``,
            `Pedigree hash: \`${result.pedigreeHash}\``,
            `Signed by: \`${result.signedBy}\``,
          ].join("\n"),
        }],
      };
    }

    if (name === "verify_pedigree") {
      const result = verifyPedigree(String(args["agent_path"]), [], VAULT_DIR);
      return {
        content: [{
          type: "text",
          text: `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
        }],
      };
    }

    if (name === "show_lineage") {
      const lineage = showLineage(
        String(args["agent_path"]),
        typeof args["depth"] === "number" ? args["depth"] : 3,
        typeof args["agent_store"] === "string" ? String(args["agent_store"]) : VAULT_DIR,
      );
      return {
        content: [{
          type: "text",
          text: `\`\`\`json\n${JSON.stringify(lineage, null, 2)}\n\`\`\``,
        }],
      };
    }

    if (name === "sign_output") {
      const nameOrId = String(args["name_or_id"]);
      const privateKeyHex = String(args["private_key_hex"]);
      const content = String(args["content"]);

      let filePath: string;
      if (fs.existsSync(nameOrId)) {
        filePath = nameOrId;
      } else {
        const found = findAgentFile(nameOrId);
        if (!found) {
          return { content: [{ type: "text", text: `❌ Agent not found: "${nameOrId}"` }] };
        }
        filePath = found;
      }

      const { agent } = loadAgentFile(filePath);
      const signed = signOutput(content, agent, privateKeyHex);

      return {
        content: [{
          type: "text",
          text: [
            `✅ Output signed by **${agent.name}**`,
            ``,
            `**Agent ID:** \`${agent.instanceId}\``,
            `**Signed At:** ${signed.signedAt}`,
            `**Signature:** \`${signed.signature}\``,
            ``,
            `\`\`\`json`,
            JSON.stringify(signed, null, 2),
            `\`\`\``,
          ].join("\n"),
        }],
      };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };

  } catch (err) {
    return {
      content: [{
        type: "text",
        text: `❌ Error: ${err instanceof Error ? err.message : String(err)}`,
      }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("01 Protocol MCP Server running. Vault:", VAULT_DIR);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
