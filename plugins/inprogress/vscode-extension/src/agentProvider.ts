import * as vscode from "vscode";
import { listAgents, type AgentRecord } from "./vault";

export class AgentItem extends vscode.TreeItem {
  constructor(public readonly record: AgentRecord) {
    super(record.agent.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "agent";
    this.description = record.agent.lifecycleState;
    this.tooltip = [
      `ID: ${record.agent.instanceId}`,
      `State: ${record.agent.lifecycleState}`,
      `Evolution: ${record.agent.evolutionCounter}`,
      record.vault ? `Memory entries: ${record.vault.memoryStats.totalEntries}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    this.iconPath = new vscode.ThemeIcon(
      record.agent.lifecycleState === "active" ? "account" : "circle-slash"
    );
  }
}

export class AgentProvider implements vscode.TreeDataProvider<AgentItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AgentItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AgentItem): vscode.TreeItem {
    return element;
  }

  getChildren(): AgentItem[] {
    return listAgents().map((r) => new AgentItem(r));
  }
}
