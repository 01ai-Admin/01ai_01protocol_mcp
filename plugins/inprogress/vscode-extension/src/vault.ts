import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as vscode from "vscode";
import type { AgentId, AgentMemoryVault, PortableBundle } from "@01protocol/sdk";

export interface AgentRecord {
  agent: AgentId;
  vault?: AgentMemoryVault;
  bundle?: PortableBundle;
  filePath: string;
  fileName: string;
}

export function getVaultDir(): string {
  const config = vscode.workspace.getConfiguration("01protocol");
  const configured = config.get<string>("vaultDir");
  if (configured && configured.trim()) return configured.trim();
  return path.join(os.homedir(), ".01protocol", "agents");
}

export function ensureVaultDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadAgentFile(filePath: string): AgentRecord {
  const text = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(text);
  const fileName = path.basename(filePath);
  if (parsed.identity && parsed.memoryVault) {
    return {
      agent: parsed.identity as AgentId,
      vault: parsed.memoryVault as AgentMemoryVault,
      bundle: parsed as PortableBundle,
      filePath,
      fileName,
    };
  }
  return { agent: parsed as AgentId, filePath, fileName };
}

export function listAgents(dir?: string): AgentRecord[] {
  const vaultDir = dir ?? getVaultDir();
  ensureVaultDir(vaultDir);
  const files = fs.readdirSync(vaultDir).filter((f) => f.endsWith(".01ai") || f.endsWith(".01bundle"));
  const records: AgentRecord[] = [];
  for (const f of files) {
    try {
      records.push(loadAgentFile(path.join(vaultDir, f)));
    } catch {
      // skip malformed files
    }
  }
  return records;
}

export function saveBundle(filePath: string, data: object): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
