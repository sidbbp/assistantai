import * as vscode from 'vscode';
// import { createWebviewPanel } from './ui';
import { createWebviewPanel } from './ui/webview';

export function activate(context: vscode.ExtensionContext) {
    console.log("🔹 assistantAI Extension Activated");

    let disposable = vscode.commands.registerCommand('assitantAI.openPanel', () => {
        createWebviewPanel(context);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    console.log("🔻 assistantAI Extension Deactivated");
}
