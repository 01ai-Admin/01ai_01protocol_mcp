/**
 * Multi-agent delegation tokens.
 * Agent A signs a delegation grant authorizing Agent B to act within a defined scope.
 * Verifiers check both the delegate's identity and the delegation token independently.
 */
import { sha256 } from "@noble/hashes/sha256";
import { signDigest, verifySignature, bytesToHex, hexToBytes } from "./crypto.js";
import { verifyAgentRecord } from "./verify.js";
import type { AgentId } from "./types.js";

export interface DelegationScope {
  /** Actions the delegate is permitted to perform, e.g. ["read:lab_results", "write:appointments"] */
  actions: string[];
  /** Optional resource constraints, e.g. { patientId: "p-123" } */
  resources?: Record<string, string>;
}

export interface DelegationToken {
  tokenId: string;
  delegatorInstanceId: string;
  delegatorPublicKey: string;
  delegateInstanceId: string;
  scope: DelegationScope;
  issuedAt: string;
  expiresAt: string;
  /** Ed25519 signature by the delegator over the canonical token payload */
  signature: string;
}

export interface DelegationVerifyResult {
  valid: boolean;
  error?: string;
  warnings: string[];
  token?: DelegationToken;
}

function canonicalTokenPayload(token: Omit<DelegationToken, "signature">): Uint8Array {
  const payload = JSON.stringify({
    tokenId: token.tokenId,
    delegatorInstanceId: token.delegatorInstanceId,
    delegatorPublicKey: token.delegatorPublicKey,
    delegateInstanceId: token.delegateInstanceId,
    scope: token.scope,
    issuedAt: token.issuedAt,
    expiresAt: token.expiresAt,
  });
  return sha256(new TextEncoder().encode(payload));
}

/**
 * Create a delegation token granting Agent B permission to act within a scope.
 * Must be called by Agent A using A's private key.
 */
export function createDelegationToken(params: {
  delegator: AgentId;
  delegatorPrivateKeyHex: string;
  delegateInstanceId: string;
  scope: DelegationScope;
  /** ISO 8601 expiry — e.g. new Date(Date.now() + 3600_000).toISOString() */
  expiresAt: string;
}): DelegationToken {
  const now = new Date().toISOString();
  const tokenId = bytesToHex(crypto.getRandomValues(new Uint8Array(8)));

  const partial: Omit<DelegationToken, "signature"> = {
    tokenId,
    delegatorInstanceId: params.delegator.instanceId,
    delegatorPublicKey: params.delegator.signerPublicKey,
    delegateInstanceId: params.delegateInstanceId,
    scope: params.scope,
    issuedAt: now,
    expiresAt: params.expiresAt,
  };

  const digest = canonicalTokenPayload(partial);
  const signature = signDigest(digest, params.delegatorPrivateKeyHex);

  return { ...partial, signature };
}

/**
 * Verify a delegation token.
 * Checks: signature valid, not expired, delegator identity matches, delegate identity matches.
 */
export function verifyDelegationToken(params: {
  token: DelegationToken;
  delegator: AgentId;
  delegate: AgentId;
  /** Action being attempted — checked against token scope */
  action: string;
}): DelegationVerifyResult {
  const warnings: string[] = [];
  const now = new Date();

  // 1. Verify the delegator's agent record is valid
  const delegatorCheck = verifyAgentRecord(params.delegator);
  if (!delegatorCheck.valid) {
    return { valid: false, error: `Delegator identity invalid: ${delegatorCheck.error}`, warnings };
  }

  // 2. Verify delegator public key in token matches the agent record
  if (params.token.delegatorPublicKey !== params.delegator.signerPublicKey) {
    return { valid: false, error: "Token delegator public key does not match delegator agent record", warnings };
  }

  // 3. Verify token signature
  const { signature, ...rest } = params.token;
  const digest = canonicalTokenPayload(rest);
  const sigValid = verifySignature(digest, signature, params.token.delegatorPublicKey);
  if (!sigValid) {
    return { valid: false, error: "Token signature invalid", warnings };
  }

  // 4. Verify token is for the right delegator and delegate
  if (params.token.delegatorInstanceId !== params.delegator.instanceId) {
    return { valid: false, error: "Token delegatorInstanceId does not match delegator agent", warnings };
  }
  if (params.token.delegateInstanceId !== params.delegate.instanceId) {
    return { valid: false, error: "Token delegateInstanceId does not match delegate agent", warnings };
  }

  // 5. Verify the delegate's own identity
  const delegateCheck = verifyAgentRecord(params.delegate);
  if (!delegateCheck.valid) {
    return { valid: false, error: `Delegate identity invalid: ${delegateCheck.error}`, warnings };
  }

  // 6. Check expiry
  if (now > new Date(params.token.expiresAt)) {
    return { valid: false, error: `Delegation token expired at ${params.token.expiresAt}`, warnings };
  }

  // 7. Check action is in scope
  if (!params.token.scope.actions.includes(params.action)) {
    return {
      valid: false,
      error: `Action "${params.action}" is not in delegation scope [${params.token.scope.actions.join(", ")}]`,
      warnings,
    };
  }

  // 8. Warn if delegator is not ACTIVE
  if (params.delegator.lifecycleState !== "ACTIVE") {
    warnings.push(`Delegator is in lifecycle state "${params.delegator.lifecycleState}" — expected ACTIVE`);
  }

  return { valid: true, warnings, token: params.token };
}

/**
 * Serialize a delegation token to JSON for transmission.
 */
export function serializeDelegationToken(token: DelegationToken): string {
  return JSON.stringify(token, null, 2);
}

/**
 * Parse and lightly validate a delegation token from JSON text.
 * Does not verify cryptographic signatures — call verifyDelegationToken for that.
 */
export function parseDelegationToken(text: string): DelegationToken {
  const obj = JSON.parse(text) as Record<string, unknown>;
  const required = ["tokenId", "delegatorInstanceId", "delegatorPublicKey", "delegateInstanceId", "scope", "issuedAt", "expiresAt", "signature"];
  for (const field of required) {
    if (obj[field] === undefined) throw new Error(`Missing required delegation token field: ${field}`);
  }
  return obj as unknown as DelegationToken;
}
