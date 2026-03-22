export interface AgentId {
  instanceId: string;
  name: string;
  descriptor: string;
  lifecycleState: string;
  evolutionCounter: number;
  integrityChecksum: string;
  signature: string;
  signerPublicKey: string;
  memoryMerkleRoot?: string;
  parentInstanceIds?: string[];
  parentChecksums?: string[];
  createdAt: string;
  updatedAt: string;
  platformProfiles?: PlatformProfile[];
  [key: string]: unknown;
}

export interface PlatformProfile {
  platform: string;
  model?: string;
  systemPromptOverride?: string;
  [key: string]: unknown;
}

export interface MemoryEntry {
  entryId: string;
  vaultId: string;
  instanceId: string;
  layer: "operational-cache" | "persistent-vault";
  type: "summary" | "task-context" | "project-history" | "decision" | "achievement" | "learning" | "note";
  summary: string;
  fingerprint: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentMemoryVault {
  vaultId: string;
  instanceId: string;
  operationalCache: MemoryEntry[];
  persistentEntries: MemoryEntry[];
  verifiedEntries: MemoryEntry[];
  memoryStats: {
    totalEntries: number;
    verifiedEntries: number;
    verifiedMemoryUnits: number;
    dedupeCount: number;
  };
  embeddingIndexKeys: string[];
  createdAt: string;
  updatedAt: string;
  lastCompactedAt?: string;
  merkleRoot?: string;
}

export interface PortableBundle {
  bundleVersion: string;
  bundleId: string;
  createdAt: string;
  identity: AgentId;
  memoryVault: AgentMemoryVault;
}

export interface CreateAgentParams {
  name: string;
  role: string;
  goal: string;
  platformProfiles?: PlatformProfile[];
  includeMemory?: boolean;
  memoryMode?: "always_on" | "session_only";
  serialNumber?: number;
  totalSupply?: number;
  rarityLabel?: string;
}

export interface CreateAgentResult {
  agent: AgentId;
  privateKeyHex: string;
  json: string;
  fileExtension: ".01ai" | ".01bundle";
  bundle?: PortableBundle;
}

export type VerifyResult =
  | { valid: true; agent: AgentId; warnings: string[] }
  | { valid: false; error: string; agent?: AgentId; warnings: string[] };

export interface SignedOutput {
  content: string;
  agentId: string;
  agentName: string;
  signerPublicKey: string;
  signature: string;
  signedAt: string;
}

export interface ConsentPolicy {
  permit: string[];
  deny: string[];
  escalate: string[];
}
