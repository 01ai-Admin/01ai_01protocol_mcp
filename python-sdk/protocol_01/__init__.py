"""
protocol-01 — Python SDK for the 01 Protocol

Portable, cryptographically verifiable AI agent identity.

Usage:
    from protocol_01 import create_agent, verify_agent, load_agent

    result = create_agent(name="My Agent", role="Analyst", goal="Analyze data")
    print(result["agent"]["instanceId"])
    print("SAVE THIS KEY:", result["private_key_hex"])
"""

from .agent import create_agent, resign_agent, serialize_agent
from .verify import verify_from_text, verify_agent_record
from .memory import (
    create_starter_memory_vault,
    add_memory_entry,
    compute_vault_merkle_root,
    create_portable_bundle,
)
from .guard import parse_guarded, LIMITS
from .delegation import (
    create_delegation_token,
    verify_delegation_token,
    serialize_delegation_token,
    parse_delegation_token,
)
from .consent import (
    evaluate_consent_policy,
    guarded_add_memory_entry,
    confirm_escalation,
    get_agent_consent_policy,
)

__version__ = "0.1.0"
__all__ = [
    "create_agent",
    "resign_agent",
    "serialize_agent",
    "verify_from_text",
    "verify_agent_record",
    "create_starter_memory_vault",
    "add_memory_entry",
    "compute_vault_merkle_root",
    "create_portable_bundle",
    "parse_guarded",
    "LIMITS",
    "create_delegation_token",
    "verify_delegation_token",
    "serialize_delegation_token",
    "parse_delegation_token",
    "evaluate_consent_policy",
    "guarded_add_memory_entry",
    "confirm_escalation",
    "get_agent_consent_policy",
]
