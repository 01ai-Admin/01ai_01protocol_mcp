"""Ed25519 verification for .01ai agent identity files."""

import re
from datetime import datetime, timezone
from typing import Any

from .crypto import compute_signed_digest, verify_signature
from .guard import parse_guarded

TERMINAL_STATES = {"DELETED"}
VALID_STATES = {"UNINITIALIZED", "ACTIVE", "FROZEN", "ARCHIVED", "TRANSFERRING", "DELETED"}

REQUIRED_FIELDS = [
    "instanceId", "name", "descriptor", "lifecycleState",
    "evolutionCounter", "integrityChecksum", "signature",
    "signerPublicKey", "createdAt", "updatedAt",
]


def verify_agent_record(agent: dict[str, Any]) -> dict[str, Any]:
    """
    Verify a pre-parsed agent dict.
    Returns {"valid": True, "agent": agent, "warnings": [...]}
          or {"valid": False, "error": "...", "agent": agent, "warnings": [...]}
    """
    warnings: list[str] = []

    for field in REQUIRED_FIELDS:
        if agent.get(field) is None:
            return {"valid": False, "error": f"Missing required field: {field}", "agent": agent, "warnings": warnings}

    if not isinstance(agent["evolutionCounter"], int) or agent["evolutionCounter"] < 0:
        return {"valid": False, "error": "evolutionCounter must be a non-negative integer", "agent": agent, "warnings": warnings}

    if not isinstance(agent["instanceId"], str) or not re.fullmatch(r"[0-9a-f]{32}", agent["instanceId"], re.I):
        return {"valid": False, "error": "instanceId must be a 32-character hex string", "agent": agent, "warnings": warnings}

    if agent["lifecycleState"] not in VALID_STATES:
        warnings.append(f"Unknown lifecycle state \"{agent['lifecycleState']}\"")

    if agent["evolutionCounter"] == 0 and agent.get("parentInstanceIds"):
        warnings.append("Evolution counter is 0 but agent has parent lineage — possible rollback or clone")

    if agent["lifecycleState"] in TERMINAL_STATES:
        warnings.append("This agent is in a DELETED (terminal) state.")

    if not re.fullmatch(r"[0-9a-f]{128}", agent.get("signature", ""), re.I):
        return {"valid": False, "error": "signature must be a 128-character hex string (Ed25519)", "agent": agent, "warnings": warnings}

    if not re.fullmatch(r"[0-9a-f]{64}", agent.get("signerPublicKey", ""), re.I):
        return {"valid": False, "error": "signerPublicKey must be a 64-character hex string", "agent": agent, "warnings": warnings}

    if not re.fullmatch(r"[0-9a-f]{64}", agent.get("integrityChecksum", ""), re.I):
        return {"valid": False, "error": "integrityChecksum must be a 64-character hex string (SHA-256)", "agent": agent, "warnings": warnings}

    try:
        created = datetime.fromisoformat(agent["createdAt"].replace("Z", "+00:00"))
        updated = datetime.fromisoformat(agent["updatedAt"].replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return {"valid": False, "error": "createdAt and updatedAt must be valid ISO 8601 timestamps", "agent": agent, "warnings": warnings}

    if updated < created:
        warnings.append("updatedAt is earlier than createdAt")

    now = datetime.now(timezone.utc)
    if created > now:
        warnings.append("createdAt is in the future — possible clock skew")

    import hashlib
    digest = compute_signed_digest(agent)
    expected_checksum = digest.hex()
    if expected_checksum != agent["integrityChecksum"]:
        return {"valid": False, "error": "Integrity checksum mismatch — file has been modified since signing", "agent": agent, "warnings": warnings}

    if not verify_signature(digest, agent["signature"], agent["signerPublicKey"]):
        return {"valid": False, "error": "Signature verification failed — integrity cannot be confirmed", "agent": agent, "warnings": warnings}

    return {"valid": True, "agent": agent, "warnings": warnings}


def verify_from_text(text: str) -> dict[str, Any]:
    """Parse and verify a .01ai file from raw text."""
    try:
        parsed = parse_guarded(text)
    except ValueError as e:
        return {"valid": False, "error": str(e), "warnings": []}
    return verify_agent_record(parsed)
