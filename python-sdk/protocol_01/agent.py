"""Agent creation and management for the 01 Protocol."""

import json
from datetime import datetime, timezone
from typing import Any

from .crypto import (
    compute_signed_digest,
    generate_id,
    generate_instance_id,
    generate_keypair,
    sign_digest,
)
from .memory import compute_vault_merkle_root, create_portable_bundle, create_starter_memory_vault


def create_agent(
    name: str,
    role: str,
    goal: str,
    include_memory: bool = False,
    memory_mode: str = "always_on",
    serial_number: int = 1,
    total_supply: int = 1,
    rarity_label: str = "common",
    platform_profiles: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Create a new 01 Protocol agent identity.

    Returns:
        {
            "agent": {...},           # AgentId dict
            "private_key_hex": "...", # SHOW ONCE — not stored
            "json": "...",            # Serialized file content
            "file_extension": ".01ai" or ".01bundle",
            "bundle": {...}           # Only if include_memory=True
        }
    """
    private_key_hex, public_key_hex = generate_keypair()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    instance_id = generate_instance_id()
    descriptor = f"{role.strip()}: {goal.strip()}"

    profiles = platform_profiles or [{"platform": "universal", "model": "default"}]

    partial: dict[str, Any] = {
        "instanceId": instance_id,
        "name": name.strip(),
        "descriptor": descriptor,
        "lifecycleState": "ACTIVE",
        "evolutionCounter": 0,
        "memoryMerkleRoot": None,
        "parentInstanceIds": [],
        "parentChecksums": [],
        "createdAt": now,
        "updatedAt": now,
        "signerPublicKey": public_key_hex,
        "platformProfiles": profiles,
        "x-memory-mode": memory_mode,
        "x-rarity-label": rarity_label,
        "x-serial": serial_number,
        "x-total": total_supply,
    }

    digest = compute_signed_digest(partial)
    partial["integrityChecksum"] = digest.hex()
    partial["signature"] = sign_digest(digest, private_key_hex)
    agent = partial

    if include_memory:
        vault = create_starter_memory_vault(agent)
        merkle_root = compute_vault_merkle_root(vault)

        # Re-sign with memory Merkle root bound
        agent["memoryMerkleRoot"] = merkle_root
        agent["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        new_digest = compute_signed_digest(agent)
        agent["integrityChecksum"] = new_digest.hex()
        agent["signature"] = sign_digest(new_digest, private_key_hex)

        bundle = create_portable_bundle(agent, {**vault, "merkleRoot": merkle_root})
        return {
            "agent": agent,
            "private_key_hex": private_key_hex,
            "json": json.dumps(bundle, indent=2),
            "file_extension": ".01bundle",
            "bundle": bundle,
        }

    return {
        "agent": agent,
        "private_key_hex": private_key_hex,
        "json": json.dumps(agent, indent=2),
        "file_extension": ".01ai",
    }


def resign_agent(agent: dict[str, Any], private_key_hex: str, updates: dict[str, Any] | None = None) -> dict[str, Any]:
    """Re-sign an agent after updates. Increments evolutionCounter."""
    updated = {**agent, **(updates or {})}
    updated["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    updated["evolutionCounter"] = agent["evolutionCounter"] + 1
    digest = compute_signed_digest(updated)
    updated["integrityChecksum"] = digest.hex()
    updated["signature"] = sign_digest(digest, private_key_hex)
    return updated


def serialize_agent(agent: dict[str, Any]) -> str:
    return json.dumps(agent, indent=2)
