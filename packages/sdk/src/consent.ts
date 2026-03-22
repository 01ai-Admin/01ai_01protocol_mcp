/**
 * User consent policy enforcement for agent memory writes.
 * Every memory write is checked against the agent's consent policy before it lands in the vault.
 * Decisions: PERMIT (write immediately), DENY (drop silently, log), ESCALATE (pause, ask user).
 */
import { hashText, generateId } from "./crypto.js";
import { addMemoryEntry } from "./memory.js";
import type { AgentId, AgentMemoryVault, MemoryEntry } from "./types.js";

export type ConsentDecision = "PERMIT" | "DENY" | "ESCALATE";

export interface ConsentPolicy {
  /** Memory entry types/tags that are always allowed */
  permit: string[];
  /** Memory entry types/tags that are always blocked */
  deny: string[];
  /** Memory entry types/tags that require explicit user confirmation */
  escalate: string[];
}

export interface ConsentAuditEntry {
  auditId: string;
  instanceId: string;
  decision: ConsentDecision;
  entryType: string;
  entryTags: string[];
  matchedRule: string;
  timestamp: string;
}

export interface GuardedWriteResult {
  decision: ConsentDecision;
  vault?: AgentMemoryVault;
  auditEntry: ConsentAuditEntry;
  /** Only present when decision is ESCALATE — call this with user's answer */
  escalationPrompt?: string;
}

/**
 * Evaluate a consent decision for a proposed memory entry.
 * Checks entry type first, then tags. Deny takes priority over escalate.
 */
export function evaluateConsentPolicy(
  policy: ConsentPolicy,
  entryType: string,
  entryTags: string[]
): { decision: ConsentDecision; matchedRule: string } {
  const candidates = [entryType, ...entryTags];

  // DENY takes highest priority
  for (const candidate of candidates) {
    if (policy.deny.includes(candidate)) {
      return { decision: "DENY", matchedRule: `deny:${candidate}` };
    }
  }

  // ESCALATE next
  for (const candidate of candidates) {
    if (policy.escalate.includes(candidate)) {
      return { decision: "ESCALATE", matchedRule: `escalate:${candidate}` };
    }
  }

  // PERMIT if explicitly listed or if policy has wildcard "*"
  for (const candidate of candidates) {
    if (policy.permit.includes(candidate) || policy.permit.includes("*")) {
      return { decision: "PERMIT", matchedRule: `permit:${candidate}` };
    }
  }

  // Default deny — not in any list
  return { decision: "DENY", matchedRule: "deny:default (not in policy)" };
}

/**
 * Attempt to write a memory entry, gated by the agent's consent policy.
 *
 * - PERMIT: writes to vault, returns updated vault
 * - DENY: drops entry, returns original vault with audit log
 * - ESCALATE: returns escalationPrompt — call confirmEscalation() with user's answer
 *
 * The audit trail is always returned regardless of decision.
 */
export function guardedAddMemoryEntry(
  vault: AgentMemoryVault,
  policy: ConsentPolicy,
  entry: Omit<MemoryEntry, "entryId" | "vaultId" | "fingerprint" | "createdAt" | "updatedAt">
): GuardedWriteResult {
  const { decision, matchedRule } = evaluateConsentPolicy(policy, entry.type, entry.tags);

  const auditEntry: ConsentAuditEntry = {
    auditId: generateId("audit"),
    instanceId: vault.instanceId,
    decision,
    entryType: entry.type,
    entryTags: entry.tags,
    matchedRule,
    timestamp: new Date().toISOString(),
  };

  if (decision === "PERMIT") {
    const updatedVault = addMemoryEntry(vault, entry);
    return { decision, vault: updatedVault, auditEntry };
  }

  if (decision === "ESCALATE") {
    const escalationPrompt =
      `Your AI agent wants to store a memory entry of type "${entry.type}" ` +
      `(tags: ${entry.tags.join(", ")}): "${entry.summary.slice(0, 120)}${entry.summary.length > 120 ? "…" : ""}". ` +
      `Do you allow this?`;
    return { decision, vault, auditEntry, escalationPrompt };
  }

  // DENY — return vault unchanged
  return { decision, vault, auditEntry };
}

/**
 * After an ESCALATE, call this with the user's response.
 * If allowed, writes the entry. If denied, drops it.
 * Either way, the user's decision is recorded as a signed audit entry in the vault.
 */
export function confirmEscalation(
  vault: AgentMemoryVault,
  pendingEntry: Omit<MemoryEntry, "entryId" | "vaultId" | "fingerprint" | "createdAt" | "updatedAt">,
  userAllowed: boolean
): { vault: AgentMemoryVault; decision: "PERMIT" | "DENY" } {
  // Record the consent decision itself as a memory entry
  const consentRecord: Omit<MemoryEntry, "entryId" | "vaultId" | "fingerprint" | "createdAt" | "updatedAt"> = {
    instanceId: vault.instanceId,
    layer: "persistent-vault",
    type: "note",
    summary: `User ${userAllowed ? "allowed" : "denied"} memory write of type "${pendingEntry.type}" (tags: ${pendingEntry.tags.join(", ")})`,
    tags: ["consent-decision", userAllowed ? "consent-granted" : "consent-denied"],
  };

  let updatedVault = addMemoryEntry(vault, consentRecord);

  if (userAllowed) {
    updatedVault = addMemoryEntry(updatedVault, pendingEntry);
    return { vault: updatedVault, decision: "PERMIT" };
  }

  return { vault: updatedVault, decision: "DENY" };
}

/**
 * Extract the consent policy embedded in an agent's identity record.
 * Returns null if no policy is set.
 */
export function getAgentConsentPolicy(agent: AgentId): ConsentPolicy | null {
  const raw = agent["x-consent-policy"];
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (!Array.isArray(p.permit) || !Array.isArray(p.deny) || !Array.isArray(p.escalate)) return null;
  return {
    permit: p.permit as string[],
    deny: p.deny as string[],
    escalate: p.escalate as string[],
  };
}
