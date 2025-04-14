import * as vscode from 'vscode';
import { fetchAIResponse, analyzeCode } from './aiHandler';
import { getAllFiles } from './fileUtils';

let isResponseInProgress = false;
let currentModel = 'llama3.1'; // default fallback

export function createWebviewPanel(
    context: vscode.ExtensionContext,
    isSidebar: boolean,
    initialModel: string = 'llama3.1'
) {
    currentModel = initialModel;

    const panel = vscode.window.createWebviewPanel(
        'assitantAIPanel',
        'AssistantAI Chat',
        isSidebar ? vscode.ViewColumn.Beside : vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getWebviewContent(currentModel);

    panel.webview.onDidReceiveMessage(
        async (message) => {
            if (message.command === 'generateResponse' && !isResponseInProgress) {
                isResponseInProgress = true;

                const { prompt, selectedFile } = message;
                console.log(`📌 Received prompt: ${prompt}`);

                panel.webview.postMessage({ command: 'clearResponse' });

                let responseText = '';
                fetchAIResponse(prompt, selectedFile, currentModel, (chunk, isFinal) => {
                    responseText += chunk;
                    panel.webview.postMessage({ command: 'updateResponse', response: responseText });
                    if (isFinal) {
                        isResponseInProgress = false;
                    }
                });

            } else if (message.command === 'analyzeCode' && !isResponseInProgress) {
                isResponseInProgress = true;

                const { selectedFile } = message;
                console.log(`🔍 Analyzing: ${selectedFile}`);

                panel.webview.postMessage({ command: 'clearResponse' });

                let responseText = '';
                analyzeCode(selectedFile, currentModel, (chunk, isFinal) => {
                    responseText += chunk;
                    panel.webview.postMessage({ command: 'updateResponse', response: responseText });
                    if (isFinal) {
                        isResponseInProgress = false;
                    }
                });

            } else if (message.command === 'fetchFiles') {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders) {
                    let files = getAllFiles(workspaceFolders[0].uri.fsPath);
                    files = files.slice(0, 5);
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
            } else if (message.command === 'saveModel') {
                currentModel = message.model;
                await context.globalState.update("selectedModel", currentModel);
                console.log(`💾 Saved model: ${currentModel}`);
            }
        },
        undefined,
        context.subscriptions
    );

    panel.webview.postMessage({ command: 'fetchFiles' });
    panel.webview.postMessage({ command: 'updateModel', model: currentModel });
}


export function getWebviewContent(currentModel: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8"> 
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AssistantAI Chat</title>
            <style>
                body {
                    font-family: 'Segoe UI', sans-serif;
                    background-color: #1e1e1e;
                    color: #d4d4d4;
                    padding: 20px;
                }
                h2 {
                    color: #ffffff;
                    text-align: left;
                    margin-bottom: 10px;
                }
                .container {
                    max-width: 900px;
                    margin: 0 auto;
                }
                textarea, select, input {
                    background-color: #252526;
                    color: #d4d4d4;
                    border: 1px solid #3c3c3c;
                    padding: 10px;
                    border-radius: 5px;
                    width: 100%;
                    font-size: 14px;
                }
                button {
                    background-color: #007acc;
                    color: white;
                    border: none;
                    padding: 10px;
                    border-radius: 5px;
                    cursor: pointer;
                    width: 48%;
                    font-size: 14px;
                }
                button:hover {
                    background-color: #005f99;
                }
                .chatbox {
                    width: 100%;
                    height: 300px;
                    overflow-y: auto;
                    background-color: #252526;
                    border: 1px solid #3c3c3c;
                    padding: 10px;
                    border-radius: 5px;
                    margin-top: 10px;
                    white-space: pre-wrap;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .buttons {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 10px;
                }
                .user-message {
                    color: #9cdcfe;
                }
                .ai-message {
                    color: #c586c0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>AssistantAI Chat</h2>

                <label for="modelSelect">Choose AI Model:</label>
                <select id="modelSelect">
                    <option value="llama3.1">Llama 3.1</option>
                    <option value="mistral">Mistral</option>
                    <option value="gemma">Gemma</option>
                    <option value="deepseek-r1">deepseek-r1</option>
                    <option value="llama3.2">llama3.2</option>
                </select>
                <button onclick="saveModel()" style="width: 100%; margin-top: 5px;">Save Model</button>

                <input type="text" id="fileSearch" placeholder="Search files..." oninput="searchFiles()">
                <select id="fileSelect">
                    <option value="">-- No file selected --</option>
                </select>

                <div class="chatbox" id="chatbox"></div>

                <textarea id="userInput" placeholder="Type your prompt..."></textarea>

                <div class="buttons">
                    <button onclick="sendMessage()">Generate Response</button>
                    <button onclick="analyzeSelectedFile()">Analyze Code</button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                document.getElementById("modelSelect").value = "${currentModel}";

                let lastAIMessage = null;

                function saveModel() {
                    const selectedModel = document.getElementById("modelSelect").value;
                    vscode.postMessage({ command: "saveModel", model: selectedModel });
                }

                function sendMessage() {
                    const prompt = document.getElementById("userInput").value.trim();
                    const selectedFile = document.getElementById("fileSelect").value;
                    if (!prompt) return;
                    appendMessage("You", prompt, "user-message");
                    lastAIMessage = null; // Reset before new response
                    vscode.postMessage({ command: "generateResponse", prompt, selectedFile });
                }

                function analyzeSelectedFile() {
                    const selectedFile = document.getElementById("fileSelect").value;
                    if (!selectedFile) {
                        alert("Please select a file to analyze.");
                        return;
                    }
                    appendMessage("🔍 Analysis", "Analyzing code...", "ai-message");
                    lastAIMessage = null;
                    vscode.postMessage({ command: "analyzeCode", selectedFile });
                }

                function searchFiles() {
                    const query = document.getElementById("fileSearch").value.trim();
                    vscode.postMessage({ command: "searchFiles", query });
                }

                function appendMessage(sender, text, className) {
                    const chatbox = document.getElementById("chatbox");
                    const messageElement = document.createElement("p");
                    messageElement.innerHTML = "<strong>" + sender + ":</strong> " + text;
                    messageElement.classList.add(className);
                    chatbox.appendChild(messageElement);
                    chatbox.scrollTop = chatbox.scrollHeight;

                    if (sender === "AI" || sender === "🔍 Analysis") {
                        lastAIMessage = messageElement;
                    }
                }

                window.addEventListener("message", event => {
                    if (event.data.command === "updateFileList") {
                        document.getElementById("fileSelect").innerHTML = event.data.files
                            .map(file => \`<option value="\${file}">\${file}</option>\`)
                            .join("");
                    } else if (event.data.command === "clearResponse") {
                        document.getElementById("chatbox").innerHTML = "";
                        lastAIMessage = null;
                    } else if (event.data.command === "updateResponse") {
                        if (lastAIMessage) {
                            lastAIMessage.innerHTML = "<strong>AI:</strong> " + event.data.response;
                        } else {
                            appendMessage("AI", event.data.response, "ai-message");
                        }
                    } else if (event.data.command === "updateModel") {
                        document.getElementById("modelSelect").value = event.data.model;
                    }
                });

                vscode.postMessage({ command: "fetchFiles" });
            </script>
        </body>
        </html>
    `;
}
