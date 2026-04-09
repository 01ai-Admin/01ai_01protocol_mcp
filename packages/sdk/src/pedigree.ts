import fs from "node:fs";
import path from "node:path";
import { hashText, signDigest, verifySignature } from "./crypto.js";
import { verifyAgentRecord } from "./verify.js";
import type { AgentId, PedigreeBlock, PedigreeVerificationResult } from "./types.js";

function roundFloats(value: unknown): unknown {
  if (typeof value === "number") return Number(value.toFixed(4));
  if (Array.isArray(value)) return value.map(roundFloats);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, roundFloats(item)]),
    );
  }
  return value;
}

export function canonicalPedigreePayload(payload: Record<string, unknown>): string {
  return JSON.stringify(roundFloats(payload));
}

export class PedigreeRecord {
  constructor(
    public schemaVersion: string,
    public generation: number,
    public parentIds: string[],
    public traitChromosome: Record<string, number>,
    public compositeScore: number,
    public suiteName: string,
    public suiteHash: string,
    public dominantFrom: Record<string, string>,
    public evaluatedAt: number,
  ) {}

  toPayload(): Record<string, unknown> {
    return {
      schema_version: this.schemaVersion,
      generation: this.generation,
      parent_ids: [...this.parentIds].sort(),
      trait_chromosome: Object.fromEntries(
        Object.entries(this.traitChromosome)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, Number(value.toFixed(4))]),
      ),
      composite_score: Number(this.compositeScore.toFixed(4)),
      suite_name: this.suiteName,
      suite_hash: this.suiteHash,
      dominant_from: Object.fromEntries(
        Object.entries(this.dominantFrom).sort(([a], [b]) => a.localeCompare(b)),
      ),
      evaluated_at: Number(this.evaluatedAt.toFixed(4)),
    };
  }

  toSignablePayload(): string {
    return canonicalPedigreePayload(this.toPayload());
  }

  pedigreeHash(): string {
    return hashText(this.toSignablePayload());
  }
}

export function createPedigree(params: {
  childAgentPath: string;
  parentAPath: string;
  parentBPath: string;
  crossoverResult: Record<string, unknown>;
  suiteName: string;
  suiteHash: string;
  evaluatedAt: number;
  signingPrivateKeyHex: string;
}): { agentPath: string; pedigreeHash: string; signedBy: string } {
  const parentA = loadAgentIdentity(params.parentAPath);
  const parentB = loadAgentIdentity(params.parentBPath);
  assertValidAgent(parentA, params.parentAPath);
  assertValidAgent(parentB, params.parentBPath);
  const childDoc = loadAgentDocument(params.childAgentPath);
  const childAgent = childDoc.identity;

  const crossoverResult = params.crossoverResult;
  const childTraits = crossoverResult["child_traits"] as Record<string, number>;
  const record = new PedigreeRecord(
    "pedigree/v1",
    Number(crossoverResult["generation"]),
    (crossoverResult["parent_ids"] as string[]).map(String),
    Object.fromEntries(Object.entries(childTraits).map(([key, value]) => [key, Number(value)])),
    Object.values(childTraits).reduce((sum, value) => sum + Number(value), 0) / Math.max(Object.keys(childTraits).length, 1),
    params.suiteName,
    params.suiteHash,
    Object.fromEntries(Object.entries(crossoverResult["dominant_from"] as Record<string, string>).map(([key, value]) => [key, String(value)])),
    params.evaluatedAt,
  );

  const signerParent = selectSigningParent(parentA, parentB);
  const pedigreeHash = record.pedigreeHash();
  const pedigreeSig = signDigest(hexToBytes(pedigreeHash), params.signingPrivateKeyHex);
  const pedigreeBlock: PedigreeBlock = {
    ...(record.toPayload() as Omit<PedigreeBlock, "pedigree_hash" | "pedigree_sig" | "signed_by">),
    pedigree_hash: pedigreeHash,
    pedigree_sig: pedigreeSig,
    signed_by: signerParent.instanceId,
  };

  childAgent.pedigree = pedigreeBlock;
  saveAgentDocument(params.childAgentPath, childDoc.raw, childAgent);
  return { agentPath: params.childAgentPath, pedigreeHash, signedBy: signerParent.instanceId };
}

export function verifyPedigree(agentPath: string, parentPaths: string[] = [], agentStore?: string): PedigreeVerificationResult {
  const agent = loadAgentIdentity(agentPath);
  if (!agent.pedigree) {
    return {
      valid: true,
      agent_id: agent.instanceId,
      generation: 0,
      genesis: true,
      notes: ["Genesis agent - no pedigree required"],
    };
  }
  const { pedigree } = agent;
  const unsignedPayload = Object.fromEntries(
    Object.entries(pedigree).filter(([key]) => !["pedigree_hash", "pedigree_sig", "signed_by"].includes(key)),
  );
  const recomputedHash = hashText(canonicalPedigreePayload(unsignedPayload));
  const resolvedParents = resolveParents(pedigree.parent_ids, parentPaths, agentStore);
  const signerParent = selectSigningParent(resolvedParents[0], resolvedParents[1]);
  const sigVerified = signerParent
    ? verifySignature(hexToBytes(recomputedHash), pedigree.pedigree_sig, signerParent.signerPublicKey)
    : false;
  const traitItems = Object.entries(pedigree.trait_chromosome).sort((a, b) => b[1] - a[1]);
  return {
    valid: recomputedHash === pedigree.pedigree_hash && sigVerified,
    agent_id: agent.instanceId,
    generation: pedigree.generation,
    parent_ids: pedigree.parent_ids,
    composite_score: pedigree.composite_score,
    dominant_traits: traitItems.slice(0, 5),
    weak_traits: traitItems.slice(-3).reverse(),
    pedigree_hash: pedigree.pedigree_hash,
    sig_verified: sigVerified,
    notes: signerParent ? [] : ["Unable to resolve parent identity files for signature verification"],
  };
}

export function showLineage(agentPath: string, depth = 3, agentStore?: string): Record<string, unknown> {
  const agent = loadAgentIdentity(agentPath);
  const pedigree = agent.pedigree;
  const traits = pedigree
    ? Object.entries(pedigree.trait_chromosome).sort((a, b) => b[1] - a[1]).slice(0, 3)
    : [];
  const node: Record<string, unknown> = {
    agent_id: agent.instanceId,
    generation: pedigree?.generation ?? 0,
    composite_score: pedigree?.composite_score ?? 0,
    dominant_traits: traits,
    parents: [],
  };
  if (!pedigree || depth <= 0) return node;
  (node.parents as Record<string, unknown>[]).push(
    ...pedigree.parent_ids.flatMap((parentId) => {
      const parentPath = resolveAgentPath(parentId, agentStore);
      return parentPath ? [showLineage(parentPath, depth - 1, agentStore)] : [];
    }),
  );
  return node;
}

export function pedigreeGenesisSummary(agent: AgentId): string | null {
  if (!agent.pedigree || agent.pedigree.parent_ids.length < 2) return null;
  const traitNames = Object.entries(agent.pedigree.trait_chromosome)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key)
    .join(", ");
  return `This agent is generation ${agent.pedigree.generation}, bred from ${agent.pedigree.parent_ids[0]} and ${agent.pedigree.parent_ids[1]}. Composite fitness score at birth: ${agent.pedigree.composite_score.toFixed(4)}. Top inherited traits: ${traitNames || "none recorded"}.`;
}

function loadAgentDocument(filePath: string): { raw: Record<string, unknown>; identity: AgentId } {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  if ("identity" in raw && "memoryVault" in raw) {
    return { raw, identity: raw.identity as AgentId };
  }
  return { raw, identity: raw as AgentId };
}

function loadAgentIdentity(filePath: string): AgentId {
  return loadAgentDocument(filePath).identity;
}

function saveAgentDocument(filePath: string, raw: Record<string, unknown>, identity: AgentId): void {
  const output = "identity" in raw ? { ...raw, identity } : identity;
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2), "utf-8");
}

function assertValidAgent(agent: AgentId, source: string): void {
  const verification = verifyAgentRecord(agent);
  if (!verification.valid) {
    throw new Error(`invalid parent identity at ${source}: ${verification.error}`);
  }
}

function selectSigningParent(parentA?: AgentId, parentB?: AgentId): AgentId {
  if (!parentB) return parentA as AgentId;
  const scoreA = parentA?.pedigree?.composite_score ?? 1;
  const scoreB = parentB?.pedigree?.composite_score ?? 0;
  return scoreA >= scoreB ? (parentA as AgentId) : parentB;
}

function resolveParents(parentIds: string[], parentPaths: string[] = [], agentStore?: string): AgentId[] {
  return parentIds.flatMap((parentId, index) => {
    if (parentPaths[index]) return [loadAgentIdentity(parentPaths[index])];
    const resolved = resolveAgentPath(parentId, agentStore);
    return resolved ? [loadAgentIdentity(resolved)] : [];
  });
}

function resolveAgentPath(agentId: string, agentStore?: string): string | null {
  const candidate = path.resolve(agentId);
  if (fs.existsSync(candidate)) return candidate;
  if (!agentStore || !fs.existsSync(agentStore)) return null;
  for (const file of fs.readdirSync(agentStore)) {
    if (!file.endsWith(".01ai") && !file.endsWith(".01bundle")) continue;
    const full = path.join(agentStore, file);
    const identity = loadAgentIdentity(full);
    if (identity.instanceId === agentId) return full;
  }
  return null;
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, "hex"));
}
