import * as vscode from "vscode";
import * as path from "node:path";
import { createAgent } from "@01protocol/sdk";
import { getVaultDir, ensureVaultDir } from "../vault";
import * as fs from "node:fs";

export async function createAgentCommand(): Promise<void> {
  const name = await vscode.window.showInputBox({
    title: "01 Protocol — Create Agent (1/3)",
    prompt: "Agent name",
    placeHolder: "e.g. Sales Analyst",
    validateInput: (v) => (v.trim() ? null : "Name is required"),
  });
  if (!name) return;

  const role = await vscode.window.showInputBox({
    title: "01 Protocol — Create Agent (2/3)",
    prompt: "Agent role",
    placeHolder: "e.g. Data Analyst",
    validateInput: (v) => (v.trim() ? null : "Role is required"),
  });
  if (!role) return;

  const goal = await vscode.window.showInputBox({
    title: "01 Protocol — Create Agent (3/3)",
    prompt: "Agent goal or purpose",
    placeHolder: "e.g. Analyze sales data and generate weekly reports",
    validateInput: (v) => (v.trim() ? null : "Goal is required"),
  });
  if (!goal) return;

  const includeMemory = await vscode.window.showQuickPick(["Yes — include memory vault (.01bundle)", "No — identity only (.01ai)"], {
    title: "Include memory vault?",
  });
  if (!includeMemory) return;

  const result = createAgent({
    name: name.trim(),
    role: role.trim(),
    goal: goal.trim(),
    includeMemory: includeMemory.startsWith("Yes"),
    memoryMode: "always_on",
    serialNumber: 1,
    totalSupply: 1,
  });

  const vaultDir = getVaultDir();
  ensureVaultDir(vaultDir);
  const safeName = result.agent.name.toLowerCase().replace(/\s+/g, "-");
  const filePath = path.join(vaultDir, `${safeName}${result.fileExtension}`);
  fs.writeFileSync(filePath, result.json, "utf-8");

  // Show private key in a warning modal — shown once, never stored
  const action = await vscode.window.showWarningMessage(
    `Agent "${result.agent.name}" created.\n\n` +
      `⚠️ PRIVATE KEY (shown once — copy it now):\n\n${result.privateKeyHex}\n\n` +
      `This key is NOT stored anywhere. You need it to sign outputs and update memory.`,
    { modal: true },
    "Copy Private Key",
    "Dismiss"
  );

  if (action === "Copy Private Key") {
    await vscode.env.clipboard.writeText(result.privateKeyHex);
    vscode.window.showInformationMessage("Private key copied to clipboard.");
  }

  vscode.window.showInformationMessage(
    `✅ Agent "${result.agent.name}" saved to vault.\nID: ${result.agent.instanceId}`
  );
}
