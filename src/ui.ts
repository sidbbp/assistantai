import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export function createWebviewPanel(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'assitantAIPanel',
        'AssitantAI Chat',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getWebviewContent();

    panel.webview.onDidReceiveMessage(
        async (message) => {
            if (message.command === 'generateResponse') {
                const { prompt, selectedFile } = message;
                console.log(`📌 Received prompt: ${prompt}`);

                const fileTagMatch = prompt.match(/@([\w\d\-_.\/]+)$/);
                let filePath = fileTagMatch ? fileTagMatch[1] : selectedFile;
                let finalPrompt = fileTagMatch ? prompt.replace(/@[\w\d\-_.\/]+$/, '').trim() : prompt;

                panel.webview.postMessage({ command: 'displayResponse', response: 'Generating...\n\n', isFinal: false });

                fetchAIResponse(finalPrompt, filePath, (chunk, isFinal) => {
                    panel.webview.postMessage({ command: 'displayResponse', response: chunk, isFinal });
                });
            } else if (message.command === 'fetchFiles') {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders) {
                    let files = getAllFiles(workspaceFolders[0].uri.fsPath);
                    files = files.slice(0, 5); // Limit to 5 files
                    panel.webview.postMessage({ command: 'updateFileList', files });
                }
            } else if (message.command === 'searchFiles') {
                const query = message.query.toLowerCase();
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders) {
                    let files = getAllFiles(workspaceFolders[0].uri.fsPath);
                    files = files.filter(file => file.toLowerCase().includes(query)).slice(0, 5);
                    panel.webview.postMessage({ command: 'updateFileList', files });
                }
            }
        },
        undefined,
        context.subscriptions
    );

    panel.webview.postMessage({ command: 'fetchFiles' });
}

function fetchAIResponse(prompt: string, filePath: string | null, callback: (chunk: string, isFinal: boolean) => void) {
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
            vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(extractedCode, 'utf-8'));
            callback(`✅ Code written to ${filePath}!\n\n`, true);
        } else {
            callback("\n\n" + formatText(fullResponse), true);
        }
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

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}
function getWebviewContent(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AssistantAI Chat</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #1e1e1e;
                    color: #ffffff;
                    padding: 20px;
                }
                #chatbox {
                    border: 1px solid #333;
                    padding: 10px;
                    height: 400px;
                    overflow-y: auto;
                    background-color: #252526;
                    border-radius: 5px;
                    white-space: pre-wrap;
                }
                textarea, input, select {
                    width: 100%;
                    background: #252526;
                    color: white;
                    border: 1px solid #555;
                    border-radius: 4px;
                    padding: 5px;
                    margin-bottom: 10px;
                }
                button {
                    background-color: #007acc;
                    color: white;
                    padding: 10px;
                    border: none;
                    cursor: pointer;
                    border-radius: 5px;
                }
                .message {
                    padding: 10px;
                    margin-bottom: 10px;
                    border-radius: 5px;
                    max-width: 80%;
                    word-wrap: break-word;
                }
            </style>
        </head>
        <body>
            <h2>AssistantAI Chat</h2>
            <label for="fileSearch">Search Files</label>
            <input type="text" id="fileSearch" placeholder="Search files..." oninput="searchFiles()">
            
            <label for="fileSelect">Select a file</label>
            <select id="fileSelect">
                <option value="">-- No file selected --</option>
            </select>

            <div id="chatbox"></div>
            <textarea id="userInput" placeholder="Type your prompt... (@filename for file context)"></textarea>
            <button onclick="sendMessage()">Send</button>

            <script>
                const vscode = acquireVsCodeApi();
                const chatbox = document.getElementById("chatbox");
                const fileSelect = document.getElementById("fileSelect");

                function sendMessage() {
                    const inputElement = document.getElementById("userInput");
                    const prompt = inputElement.value.trim();
                    const selectedFile = fileSelect.value;
                    if (!prompt) return;

                    appendMessage("You: " + prompt, "user-message");
                    inputElement.value = "";
                    appendMessage("AI: Generating...", "ai-response");

                    vscode.postMessage({ command: "generateResponse", prompt, selectedFile });
                }

                function appendMessage(text, className) {
                    const div = document.createElement("div");
                    div.classList.add("message", className);
                    chatbox.appendChild(div);
                    chatbox.scrollTop = chatbox.scrollHeight;
                    div.innerHTML += text;
                }
                
                function updateLastMessage(text) {
                    const messages = document.getElementsByClassName("ai-response");
                    if (messages.length > 0) {
                        messages[messages.length - 1].innerHTML += text;
                        chatbox.scrollTop = chatbox.scrollHeight;
                    }
                }


                function searchFiles() {
                    const query = document.getElementById("fileSearch").value.trim();
                    vscode.postMessage({ command: "searchFiles", query });
                }

                window.addEventListener("message", event => {
                    if (event.data.command === "updateFileList") {
                        fileSelect.innerHTML = event.data.files.map(file => \`<option value="\${file}">\${file}</option>\`).join("");
                    } else if (event.data.command === "displayResponse") {
                        if (event.data.isFinal) {
                            appendMessage(event.data.response, "ai-response");
                        } else {
                            updateLastMessage(event.data.response);
                        }
                    }
                });

                vscode.postMessage({ command: "fetchFiles" });
            </script>
        </body>
        </html>
    `;
}
