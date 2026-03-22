"""
Multi-agent delegation tokens for the 01 Protocol.
Agent A signs a grant authorizing Agent B to act within a defined scope.
"""

import hashlib
import json
import secrets
from datetime import datetime, timezone
from typing import Any

from .crypto import sign_digest, verify_signature
from .verify import verify_agent_record


def _canonical_token_payload(token: dict[str, Any]) -> bytes:
    payload = json.dumps({
        "tokenId": token["tokenId"],
        "delegatorInstanceId": token["delegatorInstanceId"],
        "delegatorPublicKey": token["delegatorPublicKey"],
        "delegateInstanceId": token["delegateInstanceId"],
        "scope": token["scope"],
        "issuedAt": token["issuedAt"],
        "expiresAt": token["expiresAt"],
    }, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).digest()


def create_delegation_token(
    delegator: dict[str, Any],
    delegator_private_key_hex: str,
    delegate_instance_id: str,
    scope: dict[str, Any],
    expires_at: str,
) -> dict[str, Any]:
    """
    Create a delegation token granting another agent permission to act within a scope.

    Args:
        delegator: The delegating agent's identity dict (AgentId).
        delegator_private_key_hex: The delegator's Ed25519 private key.
        delegate_instance_id: The instanceId of the agent being granted permission.
        scope: Dict with at minimum {"actions": ["action1", "action2"]}.
        expires_at: ISO 8601 expiry timestamp.

    Returns:
        Delegation token dict including Ed25519 signature.
    """
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    token_id = secrets.token_bytes(8).hex()

    partial = {
        "tokenId": token_id,
        "delegatorInstanceId": delegator["instanceId"],
        "delegatorPublicKey": delegator["signerPublicKey"],
        "delegateInstanceId": delegate_instance_id,
        "scope": scope,
        "issuedAt": now,
        "expiresAt": expires_at,
    }

    digest = _canonical_token_payload(partial)
    signature = sign_digest(digest, delegator_private_key_hex)
    return {**partial, "signature": signature}


def verify_delegation_token(
    token: dict[str, Any],
    delegator: dict[str, Any],
    delegate: dict[str, Any],
    action: str,
) -> dict[str, Any]:
    """
    Verify a delegation token.

    Checks:
    - Delegator identity is cryptographically valid
    - Token signature matches delegator's public key
    - Delegate identity is cryptographically valid
    - Token is not expired
    - Requested action is within scope

    Returns {"valid": True, "warnings": [...]} or {"valid": False, "error": "...", "warnings": [...]}
    """
    warnings: list[str] = []
    now = datetime.now(timezone.utc)

    # 1. Verify delegator agent identity
    delegator_check = verify_agent_record(delegator)
    if not delegator_check["valid"]:
        return {"valid": False, "error": f"Delegator identity invalid: {delegator_check['error']}", "warnings": warnings}

    # 2. Delegator public key must match token
    if token.get("delegatorPublicKey") != delegator.get("signerPublicKey"):
        return {"valid": False, "error": "Token delegatorPublicKey does not match delegator agent record", "warnings": warnings}

    # 3. Verify token signature
    sig = token.pop("signature", None)
    if sig is None:
        return {"valid": False, "error": "Token missing signature", "warnings": warnings}
    digest = _canonical_token_payload(token)
    token["signature"] = sig  # restore

    if not verify_signature(digest, sig, token["delegatorPublicKey"]):
        return {"valid": False, "error": "Token signature invalid", "warnings": warnings}

    # 4. Instance ID linkage
    if token.get("delegatorInstanceId") != delegator.get("instanceId"):
        return {"valid": False, "error": "Token delegatorInstanceId does not match delegator agent", "warnings": warnings}
    if token.get("delegateInstanceId") != delegate.get("instanceId"):
        return {"valid": False, "error": "Token delegateInstanceId does not match delegate agent", "warnings": warnings}

    # 5. Verify delegate agent identity
    delegate_check = verify_agent_record(delegate)
    if not delegate_check["valid"]:
        return {"valid": False, "error": f"Delegate identity invalid: {delegate_check['error']}", "warnings": warnings}

    # 6. Expiry
    try:
        expires = datetime.fromisoformat(token["expiresAt"].replace("Z", "+00:00"))
    except (ValueError, KeyError):
        return {"valid": False, "error": "Token expiresAt is not a valid ISO 8601 timestamp", "warnings": warnings}

    if now > expires:
        return {"valid": False, "error": f"Delegation token expired at {token['expiresAt']}", "warnings": warnings}

    # 7. Scope check
    allowed_actions = token.get("scope", {}).get("actions", [])
    if action not in allowed_actions:
        return {
            "valid": False,
            "error": f"Action \"{action}\" is not in delegation scope {allowed_actions}",
            "warnings": warnings,
        }

    # 8. Lifecycle warning
    if delegator.get("lifecycleState") != "ACTIVE":
        warnings.append(f"Delegator is in lifecycle state \"{delegator['lifecycleState']}\" — expected ACTIVE")

    return {"valid": True, "warnings": warnings, "token": token}


def serialize_delegation_token(token: dict[str, Any]) -> str:
    return json.dumps(token, indent=2)


def parse_delegation_token(text: str) -> dict[str, Any]:
    """Parse a delegation token from JSON. Does not verify — call verify_delegation_token for that."""
    obj = json.loads(text)
    required = ["tokenId", "delegatorInstanceId", "delegatorPublicKey",
                 "delegateInstanceId", "scope", "issuedAt", "expiresAt", "signature"]
    for field in required:
        if field not in obj:
            raise ValueError(f"Missing required delegation token field: {field}")
    return obj
