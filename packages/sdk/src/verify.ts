import { bytesToHex, hexToBytes, computeSignedDigest, verifySignature } from "./crypto.js";
import { parseGuarded, parseGuardMessage } from "./guard.js";
import type { AgentId, VerifyResult } from "./types.js";

const TERMINAL_STATES = new Set(["DELETED"]);
const VALID_STATES = new Set([
  "UNINITIALIZED", "ACTIVE", "FROZEN", "ARCHIVED", "TRANSFERRING", "DELETED",
]);

export function verifyAgentRecord(raw: Record<string, unknown>): VerifyResult {
  const agent = raw as AgentId;
  const warnings: string[] = [];

  const required: Array<keyof AgentId> = [
    "instanceId", "name", "descriptor", "lifecycleState",
    "evolutionCounter", "integrityChecksum", "signature",
    "signerPublicKey", "createdAt", "updatedAt",
  ];

  for (const field of required) {
    if (agent[field] === undefined || agent[field] === null) {
      return { valid: false, error: `Missing required field: ${field}`, agent, warnings };
    }
  }

  if (typeof agent.evolutionCounter !== "number" || !Number.isInteger(agent.evolutionCounter) || agent.evolutionCounter < 0) {
    return { valid: false, error: "evolutionCounter must be a non-negative integer", agent, warnings };
  }
  if (typeof agent.instanceId !== "string" || !/^[0-9a-f]{32}$/i.test(agent.instanceId)) {
    return { valid: false, error: "instanceId must be a 32-character hex string", agent, warnings };
  }
  if (!VALID_STATES.has(agent.lifecycleState)) {
    warnings.push(`Unknown lifecycle state "${agent.lifecycleState}"`);
  }
  if (agent.evolutionCounter === 0 && agent.parentInstanceIds && agent.parentInstanceIds.length > 0) {
    warnings.push("Evolution counter is 0 but agent has parent lineage — possible rollback or clone");
  }
  if (TERMINAL_STATES.has(agent.lifecycleState)) {
    warnings.push("This agent is in a DELETED (terminal) state.");
  }
  if (typeof agent.signature !== "string" || !/^[0-9a-f]{128}$/i.test(agent.signature)) {
    return { valid: false, error: "signature must be a 128-character hex string (Ed25519)", agent, warnings };
  }
  if (typeof agent.signerPublicKey !== "string" || !/^[0-9a-f]{64}$/i.test(agent.signerPublicKey)) {
    return { valid: false, error: "signerPublicKey must be a 64-character hex string", agent, warnings };
  }
  if (typeof agent.integrityChecksum !== "string" || !/^[0-9a-f]{64}$/i.test(agent.integrityChecksum)) {
    return { valid: false, error: "integrityChecksum must be a 64-character hex string (SHA-256)", agent, warnings };
  }

  const created = Date.parse(agent.createdAt);
  const updated = Date.parse(agent.updatedAt);
  if (isNaN(created) || isNaN(updated)) {
    return { valid: false, error: "createdAt and updatedAt must be valid ISO 8601 timestamps", agent, warnings };
  }
  if (updated < created) {
    warnings.push("updatedAt is earlier than createdAt");
  }
  if (created > Date.now() + 60_000) {
    warnings.push("createdAt is in the future — possible clock skew");
  }

  const digest = computeSignedDigest(agent);
  const expectedChecksum = bytesToHex(digest);
  if (expectedChecksum !== agent.integrityChecksum) {
    return { valid: false, error: "Integrity checksum mismatch — file has been modified since signing", agent, warnings };
  }

  const ok = verifySignature(digest, agent.signature, agent.signerPublicKey);
  if (!ok) {
    return { valid: false, error: "Signature verification failed — integrity cannot be confirmed", agent, warnings };
  }

  return { valid: true, agent, warnings };
}

export function verifyFromText(text: string): VerifyResult {
  const guard = parseGuarded(text);
  if (!guard.ok) {
    return { valid: false, error: parseGuardMessage(guard.error), warnings: [] };
  }
  return verifyAgentRecord(guard.value);
}

export { bytesToHex, hexToBytes };
