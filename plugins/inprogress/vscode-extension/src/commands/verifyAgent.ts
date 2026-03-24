import * as vscode from "vscode";
import * as fs from "node:fs";
import { verifyFromText } from "@01protocol/sdk";
import type { AgentItem } from "../agentProvider";

export async function verifyAgentCommand(item?: AgentItem): Promise<void> {
  let filePath: string | undefined;

  if (item) {
    filePath = item.record.filePath;
  } else {
    // Try active editor first
    const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (activeFile && (activeFile.endsWith(".01ai") || activeFile.endsWith(".01bundle"))) {
      filePath = activeFile;
    } else {
      // Let user pick a file
      const picked = await vscode.window.showOpenDialog({
        title: "Select a .01ai or .01bundle file",
        filters: { "01 Protocol Agent": ["01ai", "01bundle"] },
        canSelectMany: false,
      });
      filePath = picked?.[0]?.fsPath;
    }
  }

  if (!filePath) return;

  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf-8");
  } catch {
    vscode.window.showErrorMessage(`Could not read file: ${filePath}`);
    return;
  }

  // If bundle, verify the identity portion
  try {
    const parsed = JSON.parse(text);
    if (parsed.identity) text = JSON.stringify(parsed.identity);
  } catch {
    // not JSON
  }

  const result = verifyFromText(text);

  const lines: string[] = [result.valid ? "✅ PASS — Signature verified" : `❌ FAIL — ${result.error}`];

  if (result.agent) {
    lines.push(
      "",
      `Name: ${result.agent.name}`,
      `ID: ${result.agent.instanceId}`,
      `State: ${result.agent.lifecycleState}`,
      `Created: ${result.agent.createdAt}`,
      `Evolution: ${result.agent.evolutionCounter}`
    );
    if (result.agent.memoryMerkleRoot) {
      lines.push(`Memory Merkle Root: ${result.agent.memoryMerkleRoot}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    result.warnings.forEach((w) => lines.push(`⚠️ ${w}`));
  }

  if (result.valid) {
    vscode.window.showInformationMessage(lines.join("\n"), { modal: true }, "OK");
  } else {
    vscode.window.showErrorMessage(lines.join("\n"), { modal: true }, "OK");
  }
}
