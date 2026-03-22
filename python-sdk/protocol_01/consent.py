"""
User consent policy enforcement for agent memory writes.
Every memory write is checked against the agent's consent policy before it lands in the vault.
Decisions: PERMIT (write immediately), DENY (drop silently, log), ESCALATE (pause, ask user).
"""

from datetime import datetime, timezone
from typing import Any, Literal

from .crypto import generate_id
from .memory import add_memory_entry

ConsentDecision = Literal["PERMIT", "DENY", "ESCALATE"]


def evaluate_consent_policy(
    policy: dict[str, list[str]],
    entry_type: str,
    entry_tags: list[str],
) -> tuple[ConsentDecision, str]:
    """
    Evaluate a consent decision for a proposed memory entry.
    Checks entry type first, then tags. DENY takes priority over ESCALATE.

    Returns (decision, matched_rule).
    """
    candidates = [entry_type] + entry_tags

    for candidate in candidates:
        if candidate in policy.get("deny", []):
            return "DENY", f"deny:{candidate}"

    for candidate in candidates:
        if candidate in policy.get("escalate", []):
            return "ESCALATE", f"escalate:{candidate}"

    permit_list = policy.get("permit", [])
    for candidate in candidates:
        if candidate in permit_list or "*" in permit_list:
            return "PERMIT", f"permit:{candidate}"

    return "DENY", "deny:default (not in policy)"


def guarded_add_memory_entry(
    vault: dict[str, Any],
    policy: dict[str, list[str]],
    entry: dict[str, Any],
) -> dict[str, Any]:
    """
    Attempt to write a memory entry, gated by the agent's consent policy.

    Returns a result dict:
    {
        "decision": "PERMIT" | "DENY" | "ESCALATE",
        "vault": <vault — updated if PERMIT, unchanged otherwise>,
        "audit_entry": {...},
        "escalation_prompt": "..." (only when ESCALATE)
    }
    """
    decision, matched_rule = evaluate_consent_policy(
        policy, entry.get("type", "note"), entry.get("tags", [])
    )

    audit_entry = {
        "auditId": generate_id("audit"),
        "instanceId": vault.get("instanceId"),
        "decision": decision,
        "entryType": entry.get("type"),
        "entryTags": entry.get("tags", []),
        "matchedRule": matched_rule,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    if decision == "PERMIT":
        updated_vault = add_memory_entry(
            vault,
            summary=entry.get("summary", ""),
            entry_type=entry.get("type", "note"),
            layer=entry.get("layer", "persistent-vault"),
            tags=entry.get("tags", []),
        )
        return {"decision": decision, "vault": updated_vault, "audit_entry": audit_entry}

    if decision == "ESCALATE":
        summary = entry.get("summary", "")
        truncated = summary[:120] + ("…" if len(summary) > 120 else "")
        prompt = (
            f"Your AI agent wants to store a memory entry of type \"{entry.get('type')}\" "
            f"(tags: {', '.join(entry.get('tags', []))}): \"{truncated}\". "
            f"Do you allow this?"
        )
        return {"decision": decision, "vault": vault, "audit_entry": audit_entry, "escalation_prompt": prompt}

    # DENY
    return {"decision": decision, "vault": vault, "audit_entry": audit_entry}


def confirm_escalation(
    vault: dict[str, Any],
    pending_entry: dict[str, Any],
    user_allowed: bool,
) -> dict[str, Any]:
    """
    After an ESCALATE result, call this with the user's response.
    Records the consent decision as a signed memory entry, then optionally writes the pending entry.

    Returns {"vault": updated_vault, "decision": "PERMIT" | "DENY"}
    """
    consent_summary = (
        f"User {'allowed' if user_allowed else 'denied'} memory write of type "
        f"\"{pending_entry.get('type')}\" (tags: {', '.join(pending_entry.get('tags', []))})"
    )
    updated_vault = add_memory_entry(
        vault,
        summary=consent_summary,
        entry_type="note",
        layer="persistent-vault",
        tags=["consent-decision", "consent-granted" if user_allowed else "consent-denied"],
    )

    if user_allowed:
        updated_vault = add_memory_entry(
            updated_vault,
            summary=pending_entry.get("summary", ""),
            entry_type=pending_entry.get("type", "note"),
            layer=pending_entry.get("layer", "persistent-vault"),
            tags=pending_entry.get("tags", []),
        )
        return {"vault": updated_vault, "decision": "PERMIT"}

    return {"vault": updated_vault, "decision": "DENY"}


def get_agent_consent_policy(agent: dict[str, Any]) -> dict[str, list[str]] | None:
    """Extract the consent policy embedded in an agent's identity record. Returns None if not set."""
    policy = agent.get("x-consent-policy")
    if not isinstance(policy, dict):
        return None
    if not all(isinstance(policy.get(k), list) for k in ("permit", "deny", "escalate")):
        return None
    return policy
