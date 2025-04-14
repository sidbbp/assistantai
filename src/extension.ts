import * as vscode from 'vscode';
import { createWebviewPanel } from './ui/webview';

export async function activate(context: vscode.ExtensionContext) {
    console.log("🔹 assistantAI Extension Activated");

    const disposablePanel = vscode.commands.registerCommand('assitantAI.openPanel', async () => {
        const currentModel = context.globalState.get<string>('selectedModel') || 'llama3.1';
        createWebviewPanel(context, false, currentModel);
    });

    const disposableSidebar = vscode.commands.registerCommand('assitantAI.openSidebar', async () => {
        const currentModel = context.globalState.get<string>('selectedModel') || 'llama3.1';
        createWebviewPanel(context, true, currentModel);
    });

    vscode.window.registerWebviewPanelSerializer('assitantAIPanel', {
        async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
            const currentModel = context.globalState.get<string>('selectedModel') || 'llama3.1';
            createWebviewPanel(context, false, currentModel);
        }
    });

    context.subscriptions.push(disposablePanel, disposableSidebar);
}

export function deactivate() {
    console.log("🔻 assistantAI Extension Deactivated");
}
