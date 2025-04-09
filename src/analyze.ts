import * as vscode from "vscode";
import { spawn } from "child_process";
import * as fs from "fs";

export function analyzeCode(filePath: string, callback: (chunk: string, isFinal: boolean) => void) {
    if (!filePath) {
        callback("❌ No file selected for analysis.", true);
        return;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        callback(`❌ Error: File not found: ${filePath}`, true);
        return;
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const analysisPrompt = `Analyze the following code and suggest fixes or improvements:\n\n${fileContent}`;

    console.log(`Running Ollama analysis for: ${filePath}`);
    console.log(`Analysis prompt:\n${analysisPrompt.substring(0, 200)}...`); // Show only first 200 chars

    const process = spawn("ollama", ["run", "llama3.1", analysisPrompt]);

    let fullResponse = "";

    // Capture standard output (Ollama response)
    process.stdout.on("data", (data) => {
        const chunk = data.toString();
        console.log(`📜 Received chunk: ${chunk}`);
        fullResponse += chunk;
        callback(chunk, false);
    });

    // Capture standard error (if something goes wrong)
    process.stderr.on("data", (data) => {
        const errorMsg = data.toString();
        console.error(`❌ Ollama Error: ${errorMsg}`);
        callback(`❌ Ollama Error: ${errorMsg}`, true);
    });

    // Capture process errors
    process.on("error", (error) => {
        console.error(`⚠️ Process Error: ${error.message}`);
        callback(`⚠️ Process Error: ${error.message}`, true);
    });

    // Final response when process closes
    process.on("close", (code) => {
        console.log(`✅ Ollama process exited with code: ${code}`);

        if (fullResponse.trim() === "") {
            callback("❌ No response from Ollama. It may not be running or is misconfigured.", true);
        } else {
            callback("\n\n✅ Analysis complete!\n\n" + fullResponse, true);
        }
    });
}
