import * as vscode from "vscode";
import { signOutput } from "@01protocol/sdk";
import { listAgents } from "../vault";

export async function signOutputCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const selection = editor?.selection;
  const content = editor?.document.getText(selection && !selection.isEmpty ? selection : undefined);

  if (!content?.trim()) {
    vscode.window.showWarningMessage("Select text to sign, or open a file.");
    return;
  }

  const agents = listAgents();
  if (agents.length === 0) {
    vscode.window.showWarningMessage("No agents in vault. Create one first with 01 Protocol: Create Agent.");
    return;
  }

  const picked = await vscode.window.showQuickPick(
    agents.map((r) => ({ label: r.agent.name, description: r.agent.instanceId, record: r })),
    { title: "Sign with which agent?" }
  );
  if (!picked) return;

  const privateKey = await vscode.window.showInputBox({
    title: `Sign Output — ${picked.record.agent.name}`,
    prompt: "Enter agent private key (Ed25519 hex, 64 chars)",
    password: true,
    validateInput: (v) => (v.trim().length === 64 ? null : "Private key must be 64 hex characters"),
  });
  if (!privateKey) return;

  const signed = signOutput(content, picked.record.agent, privateKey.trim());
  const json = JSON.stringify(signed, null, 2);

  const action = await vscode.window.showInformationMessage(
    `✅ Signed by "${picked.record.agent.name}"\nSignature: ${signed.signature.slice(0, 16)}...`,
    "Copy Signed JSON",
    "Insert into Editor"
  );

  if (action === "Copy Signed JSON") {
    await vscode.env.clipboard.writeText(json);
    vscode.window.showInformationMessage("Signed JSON copied to clipboard.");
  } else if (action === "Insert into Editor" && editor) {
    editor.edit((eb) => {
      eb.replace(selection && !selection.isEmpty ? selection : new vscode.Range(0, 0, editor.document.lineCount, 0), json);
    });
  }
}
