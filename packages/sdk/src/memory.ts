import { hashText, generateId } from "./crypto.js";
import { pedigreeGenesisSummary } from "./pedigree.js";
import type { AgentId, AgentMemoryVault, MemoryEntry, PortableBundle } from "./types.js";

export function createStarterMemoryVault(agent: AgentId): AgentMemoryVault {
  const now = new Date().toISOString();
  const vaultId = generateId("vault");
  const summary = `${agent.name}: ${agent.descriptor}`;

  const starterEntry: MemoryEntry = {
    entryId: generateId("mem"),
    vaultId,
    instanceId: agent.instanceId,
    layer: "persistent-vault",
    type: "summary",
    summary,
    fingerprint: hashText(summary),
    tags: ["starter", "identity"],
    createdAt: now,
    updatedAt: now,
  };

  return {
    vaultId,
    instanceId: agent.instanceId,
    operationalCache: [],
    persistentEntries: [starterEntry],
    verifiedEntries: [],
    memoryStats: { totalEntries: 1, verifiedEntries: 0, verifiedMemoryUnits: 0, dedupeCount: 0 },
    embeddingIndexKeys: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addMemoryEntry(
  vault: AgentMemoryVault,
  entry: Omit<MemoryEntry, "entryId" | "vaultId" | "fingerprint" | "createdAt" | "updatedAt">,
  agent?: AgentId,
): AgentMemoryVault {
  vault = ensurePedigreeGenesisEntry(vault, agent);
  const now = new Date().toISOString();
  const newEntry: MemoryEntry = {
    ...entry,
    entryId: generateId("mem"),
    vaultId: vault.vaultId,
    fingerprint: hashText(entry.summary),
    createdAt: now,
    updatedAt: now,
  };

  const isVerified = entry.layer === "persistent-vault";
  return {
    ...vault,
    persistentEntries: isVerified ? [...vault.persistentEntries, newEntry] : vault.persistentEntries,
    operationalCache: !isVerified ? [...vault.operationalCache, newEntry] : vault.operationalCache,
    memoryStats: {
      ...vault.memoryStats,
      totalEntries: vault.memoryStats.totalEntries + 1,
    },
    updatedAt: now,
  };
}

export function ensurePedigreeGenesisEntry(vault: AgentMemoryVault, agent?: AgentId): AgentMemoryVault {
  if (!agent?.pedigree) return vault;
  if (vault.persistentEntries.some((entry) => entry.type === "pedigree_genesis")) return vault;
  const summary = pedigreeGenesisSummary(agent);
  if (!summary) return vault;
  const now = new Date().toISOString();
  const pedigreeEntry: MemoryEntry = {
    entryId: generateId("mem"),
    vaultId: vault.vaultId,
    instanceId: vault.instanceId,
    layer: "persistent-vault",
    type: "pedigree_genesis",
    summary,
    fingerprint: hashText(summary),
    tags: ["pedigree", "genesis", "system"],
    signed: true,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...vault,
    persistentEntries: [pedigreeEntry, ...vault.persistentEntries],
    memoryStats: {
      ...vault.memoryStats,
      totalEntries: vault.memoryStats.totalEntries + 1,
    },
    updatedAt: now,
  };
}

export function computeVaultMerkleRoot(vault: AgentMemoryVault): string {
  const hashable = {
    persistentEntries: [...vault.persistentEntries].sort((a, b) => a.entryId.localeCompare(b.entryId)),
    verifiedEntries: [...vault.verifiedEntries].sort((a, b) => a.entryId.localeCompare(b.entryId)),
  };
  return hashText(JSON.stringify(hashable));
}

export function createPortableBundle(identity: AgentId, memoryVault: AgentMemoryVault): PortableBundle {
  return {
    bundleVersion: "0.1.0",
    bundleId: generateId("bundle"),
    createdAt: new Date().toISOString(),
    identity,
    memoryVault,
  };
}
