/**
 * Hostile-input parser guard.
 * Every imported .01ai file is treated as hostile input.
 */

export const LIMITS = {
  MAX_BYTES: 1_000_000,
  MAX_DEPTH: 8,
  MAX_STRING_LEN: 8_000,
  MAX_ARRAY_LEN: 256,
  MAX_KEYS: 64,
} as const;

export type ParseGuardError =
  | { code: "TOO_LARGE"; detail: string }
  | { code: "INVALID_JSON"; detail: string }
  | { code: "DEPTH_EXCEEDED"; detail: string }
  | { code: "STRING_TOO_LONG"; detail: string }
  | { code: "ARRAY_TOO_LONG"; detail: string }
  | { code: "TOO_MANY_KEYS"; detail: string }
  | { code: "BAD_ROOT"; detail: string }
  | { code: "PROTOTYPE_POLLUTION"; detail: string };

export type ParseGuardResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: ParseGuardError };

const BANNED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function walkNode(node: unknown, depth: number, path: string): void {
  if (depth > LIMITS.MAX_DEPTH) {
    throw { code: "DEPTH_EXCEEDED", detail: `Nesting too deep at "${path}" (limit: ${LIMITS.MAX_DEPTH})` };
  }
  if (typeof node === "string") {
    if (node.length > LIMITS.MAX_STRING_LEN) {
      throw { code: "STRING_TOO_LONG", detail: `String at "${path}" exceeds ${LIMITS.MAX_STRING_LEN} chars` };
    }
    return;
  }
  if (Array.isArray(node)) {
    if (node.length > LIMITS.MAX_ARRAY_LEN) {
      throw { code: "ARRAY_TOO_LONG", detail: `Array at "${path}" exceeds ${LIMITS.MAX_ARRAY_LEN} items` };
    }
    node.forEach((item, i) => walkNode(item, depth + 1, `${path}[${i}]`));
    return;
  }
  if (node !== null && typeof node === "object") {
    const keys = Object.keys(node as object);
    if (keys.length > LIMITS.MAX_KEYS) {
      throw { code: "TOO_MANY_KEYS", detail: `Object at "${path}" has ${keys.length} keys (limit: ${LIMITS.MAX_KEYS})` };
    }
    for (const key of keys) {
      if (BANNED_KEYS.has(key)) {
        throw { code: "PROTOTYPE_POLLUTION", detail: `Banned key "${key}" at "${path}"` };
      }
      walkNode((node as Record<string, unknown>)[key], depth + 1, `${path}.${key}`);
    }
  }
}

export function parseGuarded(raw: string): ParseGuardResult {
  if (raw.length > LIMITS.MAX_BYTES) {
    return { ok: false, error: { code: "TOO_LARGE", detail: `Input is ${raw.length.toLocaleString()} characters` } };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: { code: "INVALID_JSON", detail: "Input is not valid JSON" } };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: { code: "BAD_ROOT", detail: "Root value must be a JSON object" } };
  }
  try {
    walkNode(parsed, 0, "$");
  } catch (e) {
    return { ok: false, error: e as ParseGuardError };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

export function parseGuardMessage(err: ParseGuardError): string {
  switch (err.code) {
    case "TOO_LARGE": return `File too large. ${err.detail}.`;
    case "INVALID_JSON": return "Invalid JSON — not a .01ai file.";
    case "DEPTH_EXCEEDED": return `Malformed file: ${err.detail}.`;
    case "STRING_TOO_LONG": return `Malformed file: ${err.detail}.`;
    case "ARRAY_TOO_LONG": return `Malformed file: ${err.detail}.`;
    case "TOO_MANY_KEYS": return `Malformed file: ${err.detail}.`;
    case "BAD_ROOT": return "Invalid file format — must be a JSON object.";
    case "PROTOTYPE_POLLUTION": return "Rejected: file contains unsafe key names.";
  }
}
