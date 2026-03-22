"""Memory vault operations for the 01 Protocol."""

import json
from datetime import datetime, timezone
from typing import Any

from .crypto import generate_id, hash_text


def create_starter_memory_vault(agent: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    vault_id = generate_id("vault")
    summary = f"{agent['name']}: {agent['descriptor']}"

    starter_entry = {
        "entryId": generate_id("mem"),
        "vaultId": vault_id,
        "instanceId": agent["instanceId"],
        "layer": "persistent-vault",
        "type": "summary",
        "summary": summary,
        "fingerprint": hash_text(summary),
        "tags": ["starter", "identity"],
        "createdAt": now,
        "updatedAt": now,
    }

    return {
        "vaultId": vault_id,
        "instanceId": agent["instanceId"],
        "operationalCache": [],
        "persistentEntries": [starter_entry],
        "verifiedEntries": [],
        "memoryStats": {
            "totalEntries": 1,
            "verifiedEntries": 0,
            "verifiedMemoryUnits": 0,
            "dedupeCount": 0,
        },
        "embeddingIndexKeys": [],
        "createdAt": now,
        "updatedAt": now,
    }


def add_memory_entry(
    vault: dict[str, Any],
    summary: str,
    entry_type: str = "note",
    layer: str = "persistent-vault",
    tags: list[str] | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    entry = {
        "entryId": generate_id("mem"),
        "vaultId": vault["vaultId"],
        "instanceId": vault["instanceId"],
        "layer": layer,
        "type": entry_type,
        "summary": summary,
        "fingerprint": hash_text(summary),
        "tags": tags or [],
        "createdAt": now,
        "updatedAt": now,
    }

    updated = {**vault, "updatedAt": now}
    if layer == "persistent-vault":
        updated["persistentEntries"] = [*vault["persistentEntries"], entry]
    else:
        updated["operationalCache"] = [*vault["operationalCache"], entry]

    updated["memoryStats"] = {
        **vault["memoryStats"],
        "totalEntries": vault["memoryStats"]["totalEntries"] + 1,
    }
    return updated


def compute_vault_merkle_root(vault: dict[str, Any]) -> str:
    hashable = {
        "persistentEntries": sorted(vault["persistentEntries"], key=lambda e: e["entryId"]),
        "verifiedEntries": sorted(vault.get("verifiedEntries", []), key=lambda e: e["entryId"]),
    }
    return hash_text(json.dumps(hashable, separators=(",", ":")))


def create_portable_bundle(identity: dict[str, Any], memory_vault: dict[str, Any]) -> dict[str, Any]:
    return {
        "bundleVersion": "0.1.0",
        "bundleId": generate_id("bundle"),
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "identity": identity,
        "memoryVault": memory_vault,
    }
