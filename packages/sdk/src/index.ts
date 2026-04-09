export { createAgent, resignAgent, serializeAgent, signOutput } from "./agent.js";
export { verifyFromText, verifyAgentRecord } from "./verify.js";
export { createStarterMemoryVault, addMemoryEntry, computeVaultMerkleRoot, createPortableBundle, ensurePedigreeGenesisEntry } from "./memory.js";
export { parseGuarded, LIMITS } from "./guard.js";
export { bytesToHex, hexToBytes, computeSignedDigest, hashText } from "./crypto.js";
export { PedigreeRecord, canonicalPedigreePayload, createPedigree, verifyPedigree, showLineage, pedigreeGenesisSummary } from "./pedigree.js";
export {
  createDelegationToken,
  verifyDelegationToken,
  serializeDelegationToken,
  parseDelegationToken,
} from "./delegation.js";
export type { DelegationToken, DelegationScope, DelegationVerifyResult } from "./delegation.js";
export {
  guardedAddMemoryEntry,
  confirmEscalation,
  evaluateConsentPolicy,
  getAgentConsentPolicy,
} from "./consent.js";
export type { ConsentDecision, ConsentAuditEntry, GuardedWriteResult } from "./consent.js";
export type {
  AgentId,
  PedigreeBlock,
  PlatformProfile,
  MemoryEntry,
  AgentMemoryVault,
  PortableBundle,
  CreateAgentParams,
  CreateAgentResult,
  VerifyResult,
  SignedOutput,
  ConsentPolicy,
  PedigreeVerificationResult,
} from "./types.js";
