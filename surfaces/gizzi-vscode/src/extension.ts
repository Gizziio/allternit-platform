import * as vscode from "vscode";
import { GizziSidebarProvider } from "./webview-provider";
import {
  explainCode,
  refactorCode,
  generateTests,
  reviewCode,
  fixErrors,
} from "./commands";

/** Diagnostic collection for Gizzi Code review findings. */
let diagnosticCollection: vscode.DiagnosticCollection;

/**
 * Activates the Gizzi Code extension.
 * Registers all commands, creates the sidebar webview provider,
 * and sets up the status bar item.
 * @param context - The extension context provided by VS Code
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create diagnostic collection for code review findings
  diagnosticCollection = vscode.languages.createDiagnosticCollection("gizzi");
  context.subscriptions.push(diagnosticCollection);

  // Create sidebar webview provider
  const sidebarProvider = new GizziSidebarProvider(context.extensionUri);
  const sidebarRegistration = vscode.window.registerWebviewViewProvider(
    GizziSidebarProvider.viewType,
    sidebarProvider
  );
  context.subscriptions.push(sidebarRegistration);

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(sparkle) Gizzi Code";
  statusBarItem.tooltip = "Gizzi Code — AI Code Assistant";
  statusBarItem.command = "gizzi.openPanel";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("gizzi.openPanel", () => {
      // Focus the sidebar webview
      vscode.commands.executeCommand("gizzi.sidebar.focus");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("gizzi.explainCode", () => {
      explainCode(sidebarProvider);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("gizzi.refactorCode", () => {
      refactorCode(sidebarProvider);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("gizzi.generateTests", () => {
      generateTests(sidebarProvider);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("gizzi.reviewCode", () => {
      reviewCode(sidebarProvider, diagnosticCollection);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("gizzi.fixErrors", () => {
      fixErrors(sidebarProvider);
    })
  );

  // Clear diagnostics when files are closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnosticCollection.delete(doc.uri);
    })
  );
}

/**
 * Deactivates the Gizzi Code extension.
 * Cleans up the diagnostic collection.
 */
export function deactivate(): void {
  if (diagnosticCollection) {
    diagnosticCollection.clear();
    diagnosticCollection.dispose();
  }
}
