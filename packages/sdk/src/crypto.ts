/**
 * Cross-platform crypto primitives (Node.js + browser).
 * Uses @noble/curves for Ed25519 and @noble/hashes for SHA-256.
 * No WebCrypto dependency — identical behavior across all runtimes.
 */
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/curves/abstract/utils";
import type { AgentId } from "./types.js";

export { bytesToHex, hexToBytes };

/**
 * Cross-platform random bytes — works in Node.js 19+, browsers, and Deno.
 */
export function randomBytes(n: number): Uint8Array {
  // Works in Node.js 19+, browsers, Deno, and Bun
  return crypto.getRandomValues(new Uint8Array(n));
}

export function hashText(text: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(text)));
}

/**
 * Canonical signed digest — identical across all runtimes.
 * Field order is spec-defined and must not change.
 */
export function computeSignedDigest(agent: AgentId): Uint8Array {
  const payload = JSON.stringify({
    instanceId: agent.instanceId,
    name: agent.name,
    descriptor: agent.descriptor,
    lifecycleState: agent.lifecycleState,
    evolutionCounter: agent.evolutionCounter,
    memoryMerkleRoot: agent.memoryMerkleRoot ?? null,
    parentInstanceIds: agent.parentInstanceIds ?? [],
    parentChecksums: agent.parentChecksums ?? [],
    createdAt: agent.createdAt,
  });
  return sha256(new TextEncoder().encode(payload));
}

export function generateKeypair(): { privateKeyHex: string; publicKeyHex: string } {
  const privKey = ed25519.utils.randomPrivateKey();
  const pubKey = ed25519.getPublicKey(privKey);
  return { privateKeyHex: bytesToHex(privKey), publicKeyHex: bytesToHex(pubKey) };
}

export function signDigest(digest: Uint8Array, privateKeyHex: string): string {
  return bytesToHex(ed25519.sign(digest, hexToBytes(privateKeyHex)));
}

export function verifySignature(digest: Uint8Array, signatureHex: string, publicKeyHex: string): boolean {
  try {
    return ed25519.verify(hexToBytes(signatureHex), digest, hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

export function generateId(prefix: string): string {
  const bytes = randomBytes(8);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${hex}`;
}

export function generateInstanceId(): string {
  return bytesToHex(randomBytes(16));
}
