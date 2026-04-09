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
  pedigree?: PedigreeBlock;
  [key: string]: unknown;
}

export interface PedigreeBlock {
  schema_version: string;
  generation: number;
  parent_ids: string[];
  trait_chromosome: Record<string, number>;
  composite_score: number;
  suite_name: string;
  suite_hash: string;
  dominant_from: Record<string, string>;
  evaluated_at: number;
  pedigree_hash: string;
  pedigree_sig: string;
  signed_by?: string;
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
  type: "summary" | "task-context" | "project-history" | "decision" | "achievement" | "learning" | "note" | "pedigree_genesis";
  summary: string;
  fingerprint: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  signed?: boolean;
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

export type PedigreeVerificationResult =
  | {
      valid: true;
      agent_id: string;
      generation: number;
      genesis?: boolean;
      parent_ids?: string[];
      composite_score?: number;
      dominant_traits?: Array<[string, number]>;
      weak_traits?: Array<[string, number]>;
      pedigree_hash?: string;
      sig_verified?: boolean;
      notes: string[];
    }
  | {
      valid: false;
      agent_id: string;
      generation: number;
      parent_ids: string[];
      composite_score: number;
      dominant_traits: Array<[string, number]>;
      weak_traits: Array<[string, number]>;
      pedigree_hash?: string;
      sig_verified: boolean;
      notes: string[];
    };
