import * as vscode from "vscode";
import { AllternitClient } from "./client";
import { GizziSidebarProvider } from "./webview-provider";

/**
 * Retrieves the active text editor, showing an error if none is open.
 * @returns The active TextEditor or undefined if unavailable
 */
function getActiveEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("Gizzi Code: No active editor. Open a file first.");
    return undefined;
  }
  return editor;
}

/**
 * Creates a fresh AllternitClient from the current workspace configuration.
 * @returns A configured AllternitClient instance
 */
function createClient(): AllternitClient {
  const config = vscode.workspace.getConfiguration("gizzi");
  const apiUrl = config.get<string>("apiUrl", "http://localhost:4096");
  const apiKey = config.get<string>("apiKey", "");
  return new AllternitClient(apiUrl, apiKey);
}

/**
 * Gets the selected text from the editor, falling back to the full document.
 * @param editor - The active text editor
 * @returns The selected text or full document text
 */
function getSelectionOrFull(editor: vscode.TextEditor): string {
  const selectedText = editor.document.getText(editor.selection);
  return selectedText || editor.document.getText();
}

/**
 * Explains the currently selected code by sending it to the Allternit API.
 * The explanation is displayed in the Gizzi Code sidebar webview.
 * @param sidebarProvider - The sidebar webview provider to display results in
 */
export async function explainCode(sidebarProvider: GizziSidebarProvider): Promise<void> {
  const editor = getActiveEditor();
  if (!editor) {
    return;
  }

  const client = createClient();
  const context = client.getCodeContext(editor);
  const selection = getSelectionOrFull(editor);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Gizzi Code: Explaining code...",
      cancellable: false,
    },
    async () => {
      try {
        const explanation = await client.chat([
          {
            role: "system",
            content:
              "You are a code explanation assistant. Explain the given code clearly and concisely. " +
              "Cover what it does, how it works, and any notable patterns. Use markdown formatting.",
          },
          {
            role: "user",
            content: `Explain this code:\n\n${context}\n\nSelected code:\n\`\`\`${editor.document.languageId}\n${selection}\n\`\`\``,
          },
        ]);
        sidebarProvider.displayResult(explanation);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Gizzi Code: ${msg}`);
      }
    }
  );
}

/**
 * Refactors the currently selected code using the Allternit API.
 * Presents the refactored code as a diff and offers to apply it.
 * @param sidebarProvider - The sidebar webview provider to display results in
 */
export async function refactorCode(sidebarProvider: GizziSidebarProvider): Promise<void> {
  const editor = getActiveEditor();
  if (!editor) {
    return;
  }

  const client = createClient();
  const context = client.getCodeContext(editor);
  const selection = getSelectionOrFull(editor);
  const languageId = editor.document.languageId;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Gizzi Code: Refactoring code...",
      cancellable: false,
    },
    async () => {
      try {
        const response = await client.chat([
          {
            role: "system",
            content:
              "You are a code refactoring assistant. Refactor the given code to improve readability, " +
              "maintainability, and performance. Return the full refactored code in a markdown code block " +
              "with the appropriate language identifier. Briefly explain your changes.",
          },
          {
            role: "user",
            content: `Refactor this code:\n\n${context}\n\nSelected code:\n\`\`\`${languageId}\n${selection}\n\`\`\``,
          },
        ]);

        sidebarProvider.displayResult(response);

        // Attempt to extract code block from the response and offer to apply
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          const refactoredCode = codeBlockMatch[1].trim();
          const apply = "Apply Changes";
          const choice = await vscode.window.showInformationMessage(
            "Gizzi Code: Refactored code ready. Apply to editor?",
            apply,
            "Cancel"
          );
          if (choice === apply) {
            const fullRange = new vscode.Range(
              editor.document.positionAt(0),
              editor.document.positionAt(editor.document.getText().length)
            );
            await editor.edit((editBuilder) => {
              editBuilder.replace(fullRange, refactoredCode);
            });
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Gizzi Code: ${msg}`);
      }
    }
  );
}

/**
 * Generates test code for the current file using the Allternit API.
 * Creates a new untitled document with the generated tests.
 * @param sidebarProvider - The sidebar webview provider to display results in
 */
export async function generateTests(sidebarProvider: GizziSidebarProvider): Promise<void> {
  const editor = getActiveEditor();
  if (!editor) {
    return;
  }

  const client = createClient();
  const context = client.getCodeContext(editor);
  const languageId = editor.document.languageId;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Gizzi Code: Generating tests...",
      cancellable: false,
    },
    async () => {
      try {
        const response = await client.chat([
          {
            role: "system",
            content:
              "You are a test generation assistant. Generate comprehensive unit tests for the given code. " +
              "Use the standard testing framework for the language (e.g., Jest for TypeScript/JavaScript, " +
              "pytest for Python, JUnit for Java). Include edge cases and error scenarios. " +
              "Return the test code in a markdown code block.",
          },
          {
            role: "user",
            content: `Generate tests for this code:\n\n${context}`,
          },
        ]);

        sidebarProvider.displayResult(response);

        // Extract code block and create a new file
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          const testCode = codeBlockMatch[1].trim();
          const testDoc = await vscode.workspace.openTextDocument({
            content: testCode,
            language: languageId,
          });
          await vscode.window.showTextDocument(testDoc, { preview: false });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Gizzi Code: ${msg}`);
      }
    }
  );
}

/**
 * Reviews the currently selected code using the Allternit API.
 * Displays review findings as VS Code diagnostics and in the sidebar.
 * @param sidebarProvider - The sidebar webview provider to display results in
 * @param diagnosticCollection - The diagnostic collection to add findings to
 */
export async function reviewCode(
  sidebarProvider: GizziSidebarProvider,
  diagnosticCollection: vscode.DiagnosticCollection
): Promise<void> {
  const editor = getActiveEditor();
  if (!editor) {
    return;
  }

  const client = createClient();
  const context = client.getCodeContext(editor);
  const selection = getSelectionOrFull(editor);
  const languageId = editor.document.languageId;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Gizzi Code: Reviewing code...",
      cancellable: false,
    },
    async () => {
      try {
        const response = await client.chat([
          {
            role: "system",
            content:
              "You are a code review assistant. Review the given code for bugs, security issues, " +
              "performance problems, and code style. List each finding with severity (critical/warning/info), " +
              "line number, and a brief description. Use markdown formatting with headers for each finding.",
          },
          {
            role: "user",
            content: `Review this code:\n\n${context}\n\nCode to review:\n\`\`\`${languageId}\n${selection}\n\`\`\``,
          },
        ]);

        sidebarProvider.displayResult(response);

        // Parse findings and add diagnostics
        const diagnostics: vscode.Diagnostic[] = [];
        const findingRegex = /line\s+(\d+)/gi;
        let match: RegExpExecArray | null;
        while ((match = findingRegex.exec(response)) !== null) {
          const lineNum = parseInt(match[1], 10) - 1;
          if (lineNum >= 0 && lineNum < editor.document.lineCount) {
            const line = editor.document.lineAt(lineNum);
            const severity = response.toLowerCase().includes("critical")
              ? vscode.DiagnosticSeverity.Error
              : response.toLowerCase().includes("warning")
                ? vscode.DiagnosticSeverity.Warning
                : vscode.DiagnosticSeverity.Information;
            diagnostics.push(
              new vscode.Diagnostic(
                line.range,
                `Gizzi Code review finding at line ${lineNum + 1}`,
                severity
              )
            );
          }
        }
        if (diagnostics.length > 0) {
          diagnosticCollection.set(editor.document.uri, diagnostics);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Gizzi Code: ${msg}`);
      }
    }
  );
}

/**
 * Collects diagnostics from the current file and sends them to the Allternit API
 * for automated fix suggestions. Applies fixes if the user accepts.
 * @param sidebarProvider - The sidebar webview provider to display results in
 */
export async function fixErrors(sidebarProvider: GizziSidebarProvider): Promise<void> {
  const editor = getActiveEditor();
  if (!editor) {
    return;
  }

  const client = createClient();
  const document = editor.document;
  const languageId = document.languageId;
  const fullText = document.getText();

  // Collect existing diagnostics for this file
  const existingDiagnostics = vscode.languages.getDiagnostics(document.uri);
  if (existingDiagnostics.length === 0) {
    vscode.window.showInformationMessage("Gizzi Code: No errors found in the current file.");
    return;
  }

  const diagnosticDescriptions = existingDiagnostics
    .map(
      (d) =>
        `Line ${d.range.start.line + 1}: [${d.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning"}] ${d.message}`
    )
    .join("\n");

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Gizzi Code: Fixing errors...",
      cancellable: false,
    },
    async () => {
      try {
        const response = await client.chat([
          {
            role: "system",
            content:
              "You are a code fix assistant. Given a file and its diagnostics/errors, provide the " +
              "corrected full file content in a markdown code block. Explain what you fixed briefly.",
          },
          {
            role: "user",
            content: `Fix these errors:\n\nFile: ${document.fileName}\nLanguage: ${languageId}\n\nErrors:\n${diagnosticDescriptions}\n\nCurrent code:\n\`\`\`${languageId}\n${fullText}\n\`\`\``,
          },
        ]);

        sidebarProvider.displayResult(response);

        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          const fixedCode = codeBlockMatch[1].trim();
          const apply = "Apply Fixes";
          const choice = await vscode.window.showInformationMessage(
            "Gizzi Code: Fixed code ready. Apply to editor?",
            apply,
            "Cancel"
          );
          if (choice === apply) {
            const fullRange = new vscode.Range(
              document.positionAt(0),
              document.positionAt(fullText.length)
            );
            await editor.edit((editBuilder) => {
              editBuilder.replace(fullRange, fixedCode);
            });
            // Clear diagnostics after applying fix
            vscode.languages.getDiagnostics(document.uri);
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Gizzi Code: ${msg}`);
      }
    }
  );
}
