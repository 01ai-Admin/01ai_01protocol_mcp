import * as vscode from "vscode";
import { AgentProvider } from "./agentProvider";
import { createAgentCommand } from "./commands/createAgent";
import { verifyAgentCommand } from "./commands/verifyAgent";
import { viewAgentCommand } from "./commands/viewAgent";
import { addMemoryCommand } from "./commands/addMemory";
import { signOutputCommand } from "./commands/signOutput";
import type { AgentItem } from "./agentProvider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new AgentProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("01protocolAgents", provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("01protocol.createAgent", async () => {
      await createAgentCommand();
      provider.refresh();
    }),

    vscode.commands.registerCommand("01protocol.refreshAgents", () => {
      provider.refresh();
    }),

    vscode.commands.registerCommand("01protocol.verifyAgent", (item?: AgentItem) => {
      return verifyAgentCommand(item);
    }),

    vscode.commands.registerCommand("01protocol.viewAgent", (item?: AgentItem) => {
      return viewAgentCommand(item);
    }),

    vscode.commands.registerCommand("01protocol.addMemory", async (item?: AgentItem) => {
      await addMemoryCommand(item);
      provider.refresh();
    }),

    vscode.commands.registerCommand("01protocol.signOutput", () => {
      return signOutputCommand();
    }),

    vscode.commands.registerCommand("01protocol.openSettings", () => {
      vscode.commands.executeCommand("workbench.action.openSettings", "01protocol");
    })
  );
}

export function deactivate(): void {}
