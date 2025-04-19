import * as vscode from 'vscode';
import { createWebviewPanel } from './ui/webview';

export async function activate(context: vscode.ExtensionContext) {
    console.log("🔹 assistantAI Extension Activated");

    // Command to open the panel with a standard model
    const disposablePanel = vscode.commands.registerCommand('assitantAI.openPanel', async () => {
        const currentModel = context.globalState.get<string>('selectedModel') || 'llama3.1';
        createWebviewPanel(context, false, currentModel);
    });

    // Command to open the sidebar with a standard model
    const disposableSidebar = vscode.commands.registerCommand('assitantAI.openSidebar', async () => {
        const currentModel = context.globalState.get<string>('selectedModel') || 'llama3.1';
        createWebviewPanel(context, true, currentModel);
    });

    // Register the panel serializer to restore panel state
    vscode.window.registerWebviewPanelSerializer('assitantAIPanel', {
        async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
            // Deserialize and use the stored model, or fallback to default if none exists
            const currentModel = context.globalState.get<string>('selectedModel') || 'llama3.1';
            createWebviewPanel(context, false, currentModel);
        }
    });

    // Add commands to subscriptions for cleanup
    context.subscriptions.push(disposablePanel, disposableSidebar);
}

export function deactivate() {
    console.log("🔻 assistantAI Extension Deactivated");
}
