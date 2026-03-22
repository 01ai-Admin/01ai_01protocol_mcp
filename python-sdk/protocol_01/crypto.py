"""
Cross-platform crypto primitives for the 01 Protocol.
Uses PyCA cryptography for Ed25519 and hashlib for SHA-256.
"""

import hashlib
import json
import os
import secrets
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PublicFormat,
    PrivateFormat,
    NoEncryption,
)


def random_bytes(n: int) -> bytes:
    return secrets.token_bytes(n)


def generate_instance_id() -> str:
    return random_bytes(16).hex()


def generate_id(prefix: str) -> str:
    return f"{prefix}-{random_bytes(8).hex()}"


def hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def generate_keypair() -> tuple[str, str]:
    """Returns (private_key_hex, public_key_hex)."""
    private_key = Ed25519PrivateKey.generate()
    private_bytes = private_key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
    public_bytes = private_key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    return private_bytes.hex(), public_bytes.hex()


def compute_signed_digest(agent: dict[str, Any]) -> bytes:
    """
    Canonical signed digest — identical to the TypeScript implementation.
    Field order is spec-defined and must not change.
    """
    payload = json.dumps({
        "instanceId": agent["instanceId"],
        "name": agent["name"],
        "descriptor": agent["descriptor"],
        "lifecycleState": agent["lifecycleState"],
        "evolutionCounter": agent["evolutionCounter"],
        "memoryMerkleRoot": agent.get("memoryMerkleRoot"),
        "parentInstanceIds": agent.get("parentInstanceIds", []),
        "parentChecksums": agent.get("parentChecksums", []),
        "createdAt": agent["createdAt"],
    }, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).digest()


def sign_digest(digest: bytes, private_key_hex: str) -> str:
    private_key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(private_key_hex))
    return private_key.sign(digest).hex()


def verify_signature(digest: bytes, signature_hex: str, public_key_hex: str) -> bool:
    try:
        from cryptography.exceptions import InvalidSignature
        public_key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_hex))
        public_key.verify(bytes.fromhex(signature_hex), digest)
        return True
    except Exception:
        return False
