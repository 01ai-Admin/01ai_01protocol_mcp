# protocol-01

Official Python SDK for the [01 Protocol](https://01ai.ai) — portable, cryptographically verifiable AI agent identity.

## Install

```bash
pip install protocol-01
```

## Quick Start

```python
from protocol_01 import create_agent, verify_from_text

# Create a new agent identity
result = create_agent(
    name="Research Analyst",
    role="Research Analyst",
    goal="Synthesize academic papers into actionable insights",
)

print("Agent ID:", result["agent"]["instanceId"])
print("SAVE THIS KEY:", result["private_key_hex"])  # shown once

# Save the .01ai file
with open("research-analyst.01ai", "w") as f:
    f.write(result["json"])
```

## Verify an Agent

```python
from protocol_01 import verify_from_text

with open("research-analyst.01ai") as f:
    text = f.read()

result = verify_from_text(text)

if result["valid"]:
    print(f"✅ PASS: {result['agent']['name']}")
else:
    print(f"❌ FAIL: {result['error']}")

for warning in result["warnings"]:
    print(f"⚠️  {warning}")
```

## With Memory Vault

```python
result = create_agent(
    name="Sales Agent",
    role="Sales Analyst",
    goal="Track and report on pipeline metrics",
    include_memory=True,  # produces .01bundle
)
# result["bundle"] contains identity + memory vault
```

## Add Memory to Existing Agent

```python
import json
from protocol_01 import add_memory_entry, compute_vault_merkle_root, resign_agent

with open("agent.01bundle") as f:
    bundle = json.load(f)

agent = bundle["identity"]
vault = bundle["memoryVault"]

updated_vault = add_memory_entry(
    vault,
    summary="Successfully closed Q1 enterprise deal with Acme Corp",
    entry_type="achievement",
    tags=["sales", "enterprise", "Q1"],
)

merkle_root = compute_vault_merkle_root(updated_vault)
updated_agent = resign_agent(agent, private_key_hex, {"memoryMerkleRoot": merkle_root})
```

## CLI

```bash
# Create an agent
create-agent create --name "My Agent" --role "Analyst" --goal "Analyze data" --out agent.01ai

# Verify an agent
create-agent verify agent.01ai
```

## API

| Function | Description |
|---|---|
| `create_agent(name, role, goal, ...)` | Mint a new agent identity |
| `verify_from_text(text)` | Parse + verify a `.01ai` file |
| `verify_agent_record(dict)` | Verify a pre-parsed agent dict |
| `resign_agent(agent, key, updates)` | Re-sign after updates |
| `add_memory_entry(vault, summary, ...)` | Add a memory entry |
| `compute_vault_merkle_root(vault)` | Compute Merkle root |
| `create_portable_bundle(agent, vault)` | Build a `.01bundle` |

## Requirements

- Python ≥ 3.10
- `cryptography` ≥ 42.0.0

## Links

- [01AI.ai](https://01ai.ai)
- [app.01ai.ai](https://app.01ai.ai)
- [GitHub](https://github.com/01ai-Admin/01ai_01protocol_mcp)

## License

MIT
