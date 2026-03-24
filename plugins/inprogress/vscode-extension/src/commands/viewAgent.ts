import * as vscode from "vscode";
import type { AgentItem } from "../agentProvider";

export async function viewAgentCommand(item?: AgentItem): Promise<void> {
  if (!item) return;

  const { agent, vault } = item.record;

  const lines = [
    `# ${agent.name}`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Instance ID | \`${agent.instanceId}\` |`,
    `| Descriptor | ${agent.descriptor} |`,
    `| Lifecycle State | ${agent.lifecycleState} |`,
    `| Evolution Counter | ${agent.evolutionCounter} |`,
    `| Created | ${agent.createdAt} |`,
    `| Updated | ${agent.updatedAt} |`,
    `| Public Key | \`${agent.signerPublicKey}\` |`,
    `| Integrity Checksum | \`${agent.integrityChecksum}\` |`,
  ];

  if (agent.memoryMerkleRoot) {
    lines.push(`| Memory Merkle Root | \`${agent.memoryMerkleRoot}\` |`);
  }

  if (agent.platformProfiles?.length) {
    lines.push(`| Platform Profiles | ${agent.platformProfiles.map((p: { platform: string; model?: string }) => `${p.platform}/${p.model ?? "default"}`).join(", ")} |`);
  }

  if (vault) {
    lines.push(
      ``,
      `## Memory Vault`,
      ``,
      `| Field | Value |`,
      `|---|---|`,
      `| Vault ID | \`${vault.vaultId}\` |`,
      `| Total Entries | ${vault.memoryStats.totalEntries} |`,
      `| Persistent Entries | ${vault.persistentEntries.length} |`,
      `| Operational Cache | ${vault.operationalCache.length} |`
    );

    if (vault.persistentEntries.length > 0) {
      lines.push(``, `## Persistent Memory`);
      vault.persistentEntries.forEach((e, i) => {
        lines.push(``, `### ${i + 1}. [${e.type}] ${e.summary}`, `_Tags: ${e.tags.join(", ") || "none"}_`);
      });
    }
  }

  const doc = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "markdown",
  });

  await vscode.window.showTextDocument(doc, { preview: true });
}
