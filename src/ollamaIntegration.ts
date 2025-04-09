import * as vscode from 'vscode';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export async function generateCode(prompt: string, filePath?: string) {
    vscode.window.showInformationMessage(`Generating code...`);

    // Run Ollama AI model
    const result = spawnSync("ollama", ["run", "llama3.1", prompt], { encoding: 'utf-8' });

    if (result.error) {
        vscode.window.showErrorMessage(`❌ Ollama failed: ${result.error.message}`);
        return;
    }

    let output = result.stdout.trim();
    if (!output) {
        vscode.window.showErrorMessage("⚠ No output received from Ollama.");
        return;
    }

    // Extract only the Python code if it exists
    const codeMatch = output.match(/```python([\s\S]*?)```/);
    if (codeMatch) {
        output = codeMatch[1].trim();
    }

    // If no file is provided, return the output (for chat mode)
    if (!filePath) {
        return output;
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        vscode.window.showErrorMessage(`❌ Directory does not exist: ${dir}`);
        return;
    }

    // Confirm before writing
    const userConfirmation = await vscode.window.showQuickPick(
        ["Yes", "No"], { placeHolder: `Overwrite ${filePath}?` }
    );

    if (userConfirmation !== "Yes") {
        vscode.window.showInformationMessage("🚫 File write canceled.");
        return;
    }

    fs.writeFileSync(filePath, output, 'utf-8');
    vscode.window.showInformationMessage(`✅ Code written to ${filePath}!`);
}
