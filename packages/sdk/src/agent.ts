import { sha256 } from "@noble/hashes/sha256";
import {
  computeSignedDigest,
  generateKeypair,
  generateInstanceId,
  signDigest,
  bytesToHex,
} from "./crypto.js";
import { computeVaultMerkleRoot, createStarterMemoryVault, createPortableBundle } from "./memory.js";
import type { AgentId, CreateAgentParams, CreateAgentResult, PlatformProfile } from "./types.js";

export function createAgent(params: CreateAgentParams): CreateAgentResult {
  const { privateKeyHex, publicKeyHex } = generateKeypair();
  const now = new Date().toISOString();
  const instanceId = generateInstanceId();
  const descriptor = `${params.role.trim()}: ${params.goal.trim()}`;

  const platformProfiles: PlatformProfile[] = params.platformProfiles ?? [
    { platform: "universal", model: "default" },
  ];

  const partial: Omit<AgentId, "integrityChecksum" | "signature"> = {
    instanceId,
    name: params.name.trim(),
    descriptor,
    lifecycleState: "ACTIVE",
    evolutionCounter: 0,
    memoryMerkleRoot: undefined,
    parentInstanceIds: [],
    parentChecksums: [],
    createdAt: now,
    updatedAt: now,
    signerPublicKey: publicKeyHex,
    platformProfiles,
    ...(params.memoryMode ? { "x-memory-mode": params.memoryMode } : {}),
    ...(params.rarityLabel ? { "x-rarity-label": params.rarityLabel } : {}),
    ...(params.serialNumber !== undefined ? { "x-serial": params.serialNumber } : {}),
    ...(params.totalSupply !== undefined ? { "x-total": params.totalSupply } : {}),
  };

  const digest = computeSignedDigest(partial as AgentId);
  const integrityChecksum = bytesToHex(digest);
  const signature = signDigest(digest, privateKeyHex);

  let agent: AgentId = { ...partial, integrityChecksum, signature } as AgentId;

  if (params.includeMemory) {
    const vault = createStarterMemoryVault(agent);
    const merkleRoot = computeVaultMerkleRoot(vault);

    // Re-sign with merkle root bound
    const updated: AgentId = { ...agent, memoryMerkleRoot: merkleRoot, updatedAt: new Date().toISOString() };
    const newDigest = computeSignedDigest(updated);
    updated.integrityChecksum = bytesToHex(newDigest);
    updated.signature = signDigest(newDigest, privateKeyHex);
    agent = updated;

    const bundle = createPortableBundle(agent, { ...vault, merkleRoot });
    return {
      agent,
      privateKeyHex,
      json: JSON.stringify(bundle, null, 2),
      fileExtension: ".01bundle",
      bundle,
    };
  }

  return {
    agent,
    privateKeyHex,
    json: JSON.stringify(agent, null, 2),
    fileExtension: ".01ai",
  };
}

export function resignAgent(agent: AgentId, privateKeyHex: string, updates: Partial<AgentId> = {}): AgentId {
  const updated: AgentId = {
    ...agent,
    ...updates,
    updatedAt: new Date().toISOString(),
    evolutionCounter: agent.evolutionCounter + 1,
  };
  const digest = computeSignedDigest(updated);
  updated.integrityChecksum = bytesToHex(digest);
  updated.signature = signDigest(digest, privateKeyHex);
  return updated;
}

export function signOutput(content: string, agent: AgentId, privateKeyHex: string) {
  const signedAt = new Date().toISOString();
  const payload = JSON.stringify({ content, agentId: agent.instanceId, signedAt });
  const digest = sha256(new TextEncoder().encode(payload));
  const signatureHex = signDigest(digest, privateKeyHex);
  return { content, agentId: agent.instanceId, agentName: agent.name, signerPublicKey: agent.signerPublicKey, signature: signatureHex, signedAt };
}

export function serializeAgent(agent: AgentId): string {
  return JSON.stringify(agent, null, 2);
}
