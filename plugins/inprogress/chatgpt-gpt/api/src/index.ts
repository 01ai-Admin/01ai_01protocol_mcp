import express from "express";
import cors from "cors";
import {
  createAgent,
  verifyFromText,
  serializeAgent,
} from "@01protocol/sdk";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "256kb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "01protocol-gpt-api", version: "0.1.0" });
});

/**
 * POST /agents/create
 * Create a new 01 Protocol agent identity.
 * Returns the agent JSON and private key. Stateless — nothing is stored server-side.
 */
app.post("/agents/create", (req, res) => {
  const { name, role, goal, include_memory, serial_number, total_supply } = req.body ?? {};

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!role || typeof role !== "string" || !role.trim()) {
    res.status(400).json({ error: "role is required" });
    return;
  }
  if (!goal || typeof goal !== "string" || !goal.trim()) {
    res.status(400).json({ error: "goal is required" });
    return;
  }

  const result = createAgent({
    name: name.trim(),
    role: role.trim(),
    goal: goal.trim(),
    includeMemory: Boolean(include_memory),
    memoryMode: "always_on",
    serialNumber: typeof serial_number === "number" ? serial_number : 1,
    totalSupply: typeof total_supply === "number" ? total_supply : 1,
  });

  res.json({
    agent: result.agent,
    private_key_hex: result.privateKeyHex,
    file_extension: result.fileExtension,
    file_content: result.json,
    warning: "SAVE YOUR PRIVATE KEY — it is not stored anywhere and cannot be recovered.",
  });
});

/**
 * POST /agents/verify
 * Verify the cryptographic integrity of a 01 Protocol agent.
 * Accepts raw JSON string or parsed agent object.
 */
app.post("/agents/verify", (req, res) => {
  const { agent_json } = req.body ?? {};

  if (!agent_json) {
    res.status(400).json({ error: "agent_json is required" });
    return;
  }

  let text: string;
  if (typeof agent_json === "string") {
    text = agent_json;
  } else {
    text = JSON.stringify(agent_json);
  }

  // If bundle, verify the identity portion
  try {
    const parsed = JSON.parse(text);
    if (parsed.identity) text = JSON.stringify(parsed.identity);
  } catch {
    // not JSON — try as-is
  }

  const result = verifyFromText(text);

  res.json({
    valid: result.valid,
    error: result.error ?? null,
    warnings: result.warnings,
    agent: result.agent ?? null,
  });
});

/**
 * POST /agents/view
 * Parse and return structured details from a 01 Protocol agent file.
 * No cryptographic verification — use /verify for that.
 */
app.post("/agents/view", (req, res) => {
  const { agent_json } = req.body ?? {};

  if (!agent_json) {
    res.status(400).json({ error: "agent_json is required" });
    return;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = typeof agent_json === "string" ? JSON.parse(agent_json) : agent_json;
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  // Handle both .01ai and .01bundle formats
  const isBundle = Boolean(parsed.identity && parsed.memoryVault);
  const identity = isBundle ? parsed.identity : parsed;
  const vault = isBundle ? parsed.memoryVault : null;

  res.json({
    format: isBundle ? ".01bundle" : ".01ai",
    identity,
    memory_vault: vault,
  });
});

app.listen(port, () => {
  console.log(`01 Protocol GPT API running on port ${port}`);
});
