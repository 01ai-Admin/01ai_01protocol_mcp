"""Hostile-input parser guard — identical limits to the TypeScript SDK."""

import json
from typing import Any

LIMITS = {
    "MAX_BYTES": 1_000_000,
    "MAX_DEPTH": 8,
    "MAX_STRING_LEN": 8_000,
    "MAX_ARRAY_LEN": 256,
    "MAX_KEYS": 64,
}

BANNED_KEYS = {"__proto__", "constructor", "prototype"}


def _walk_node(node: Any, depth: int, path: str) -> None:
    if depth > LIMITS["MAX_DEPTH"]:
        raise ValueError(f"DEPTH_EXCEEDED: Nesting too deep at '{path}'")
    if isinstance(node, str):
        if len(node) > LIMITS["MAX_STRING_LEN"]:
            raise ValueError(f"STRING_TOO_LONG: String at '{path}' exceeds {LIMITS['MAX_STRING_LEN']} chars")
        return
    if isinstance(node, list):
        if len(node) > LIMITS["MAX_ARRAY_LEN"]:
            raise ValueError(f"ARRAY_TOO_LONG: Array at '{path}' exceeds {LIMITS['MAX_ARRAY_LEN']} items")
        for i, item in enumerate(node):
            _walk_node(item, depth + 1, f"{path}[{i}]")
        return
    if isinstance(node, dict):
        if len(node) > LIMITS["MAX_KEYS"]:
            raise ValueError(f"TOO_MANY_KEYS: Object at '{path}' has {len(node)} keys")
        for key in node:
            if key in BANNED_KEYS:
                raise ValueError(f"PROTOTYPE_POLLUTION: Banned key '{key}' at '{path}'")
            _walk_node(node[key], depth + 1, f"{path}.{key}")


def parse_guarded(raw: str) -> dict[str, Any]:
    """
    Parse and validate raw .01ai JSON text.
    Raises ValueError with a descriptive message on any violation.
    Returns the parsed dict on success.
    """
    if len(raw) > LIMITS["MAX_BYTES"]:
        raise ValueError(f"TOO_LARGE: Input is {len(raw):,} characters (limit: {LIMITS['MAX_BYTES']:,})")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"INVALID_JSON: {e}") from e
    if not isinstance(parsed, dict):
        raise ValueError("BAD_ROOT: Root value must be a JSON object")
    _walk_node(parsed, 0, "$")
    return parsed
