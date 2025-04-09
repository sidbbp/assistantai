import { spawn } from 'child_process';
import * as vscode from 'vscode';


export function fetchAIResponse(prompt: string, filePath: string | null, callback: (chunk: string, isFinal: boolean) => void) {
    const process = spawn("ollama", ["run", "llama3.1", prompt], { stdio: ['ignore', 'pipe', 'pipe'] });

    let fullResponse = "";

    process.stdout.on("data", (data) => {
        const chunk = data.toString();
        fullResponse += chunk;
        callback(chunk, false);
    });

    process.on("close", (code) => {
        console.log(`✅ Ollama Process Exited with Code: ${code}`);

        const extractedCode = extractCode(fullResponse);
        if (filePath && extractedCode) {
            vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(extractedCode, 'utf-8'))
                .then(() => {
                    callback(`✅ Code written to ${filePath}!\n\n`, true);
                }, (error) => {
                    callback(`❌ Error writing file: ${error.message}\n\n`, true);
                });
        } else {
            callback("\n\n" + formatText(fullResponse), true);
        }
    });
}


export function analyzeCode(filePath: string, callback: (chunk: string, isFinal: boolean) => void) {
    vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
        .then((fileContent) => {
            const code = new TextDecoder().decode(fileContent); 
            const analysisPrompt = `Analyze the following code and provide suggestions for improvements, optimizations, and best practices:\n\n\`\`\`\n${code}\n\`\`\``;

            const process = spawn("ollama", ["run", "llama3.1", analysisPrompt], { stdio: ['ignore', 'pipe', 'pipe'] });

            let fullResponse = "";

            process.stdout.on("data", (data) => {
                const chunk = data.toString();
                fullResponse += chunk;
                callback(chunk, false);
            });

            process.on("close", (code) => {
                console.log(`✅ Analysis Completed with Code: ${code}`);
                callback("\n\n" + formatText(fullResponse), true);
            });
        },
        (error) => { 
            callback(`❌ Error reading file: ${error.message}\n\n`, true);
        });
}

function extractCode(text: string): string {
    const codeRegex = /```(?:\w+\n)?([\s\S]*?)```/g;
    let match;
    let codeBlocks = [];

    while ((match = codeRegex.exec(text)) !== null) {
        codeBlocks.push(match[1].trim());
    }

    return codeBlocks.length > 0 ? codeBlocks.join("\n\n") : text;
}


function formatText(text: string): string {
    return text.replace(/\n/g, "<br>").replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
}
