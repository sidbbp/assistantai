import * as vscode from 'vscode';
import { createWebviewPanel } from './ui/webview';

export function activate(context: vscode.ExtensionContext) {
    console.log("🔹 assistantAI Extension Activated");

    // Register command to open the floating panel
    let disposablePanel = vscode.commands.registerCommand('assitantAI.openPanel', () => {
        createWebviewPanel(context, false);  // Opens in a floating panel
    });

    // Register command to open the sidebar
    let disposableSidebar = vscode.commands.registerCommand('assitantAI.openSidebar', () => {
        createWebviewPanel(context, true);   // Opens in the sidebar
    });

    context.subscriptions.push(disposablePanel, disposableSidebar);
}

export function deactivate() {
    console.log("🔻 assistantAI Extension Deactivated");
}
