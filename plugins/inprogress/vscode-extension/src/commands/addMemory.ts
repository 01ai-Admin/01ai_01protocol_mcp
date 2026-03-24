import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  addMemoryEntry,
  computeVaultMerkleRoot,
  resignAgent,
  createPortableBundle,
  createStarterMemoryVault,
} from "@01protocol/sdk";
import type { MemoryEntry } from "@01protocol/sdk";
import type { AgentItem } from "../agentProvider";
import { loadAgentFile, saveBundle } from "../vault";

export async function addMemoryCommand(item?: AgentItem): Promise<void> {
  if (!item) return;

  const privateKey = await vscode.window.showInputBox({
    title: `Add Memory — ${item.record.agent.name}`,
    prompt: "Enter agent private key (Ed25519 hex, 64 chars)",
    password: true,
    validateInput: (v) => (v.trim().length === 64 ? null : "Private key must be 64 hex characters"),
  });
  if (!privateKey) return;

  const summary = await vscode.window.showInputBox({
    title: "Memory entry content",
    prompt: "What should be remembered?",
    placeHolder: "e.g. Completed Q1 sales analysis report",
    validateInput: (v) => (v.trim() ? null : "Content is required"),
  });
  if (!summary) return;

  const typeChoice = await vscode.window.showQuickPick(
    ["note", "summary", "task-context", "project-history", "decision", "achievement", "learning"],
    { title: "Memory type" }
  );
  if (!typeChoice) return;

  const tagsInput = await vscode.window.showInputBox({
    title: "Tags (optional)",
    prompt: "Comma-separated tags",
    placeHolder: "e.g. q1, sales, report",
  });

  const tags = tagsInput ? tagsInput.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const { agent, vault, filePath } = loadAgentFile(item.record.filePath);
  const currentVault = vault ?? createStarterMemoryVault(agent);

  const updatedVault = addMemoryEntry(currentVault, {
    instanceId: agent.instanceId,
    layer: "persistent-vault",
    type: typeChoice as MemoryEntry["type"],
    summary: summary.trim(),
    tags,
  });

  const merkleRoot = computeVaultMerkleRoot(updatedVault);
  const updatedAgent = resignAgent(agent, privateKey.trim(), { memoryMerkleRoot: merkleRoot });
  const bundle = createPortableBundle(updatedAgent, { ...updatedVault, merkleRoot });

  const newPath = filePath.replace(/\.(01ai|01bundle)$/, ".01bundle");
  saveBundle(newPath, bundle);

  if (newPath !== filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  vscode.window.showInformationMessage(
    `✅ Memory added to "${updatedAgent.name}". Total entries: ${updatedVault.memoryStats.totalEntries + 1}`
  );
}
