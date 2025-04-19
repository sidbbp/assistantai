import * as vscode from 'vscode';
import { fetchAIResponse, analyzeCode } from './aiHandler';
import { getAllFiles } from './fileUtils';

let isResponseInProgress = false;
let currentModel = 'llama3.1';

export function createWebviewPanel(
    context: vscode.ExtensionContext,
    isSidebar: boolean,
    initialModel: string = 'llama3.1'
) {
    currentModel = initialModel;

    const panel = vscode.window.createWebviewPanel(
        'assistantAIPanel',
        'AssistantAI Chat',
        isSidebar ? vscode.ViewColumn.Beside : vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getWebviewContent(currentModel, context);

    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'saveModel':
                    currentModel = message.model;
                    await context.globalState.update("selectedModel", currentModel);
                    console.log(`💾 Saved model: ${currentModel}`);
                    break;

                case 'saveApiKey':
                    await context.secrets.store(`${message.model}_apiKey`, message.apiKey);
                    console.log(`🔑 Saved API key for ${message.model}`);
                    break;

                case 'generateResponse':
                    if (isResponseInProgress) return;
                    isResponseInProgress = true;
                    panel.webview.postMessage({ command: 'clearResponse' });

                    const responsePrompt = message.prompt;
                    const responseFile = message.selectedFile;

                    let responseText = '';
                    fetchAIResponse(responsePrompt, responseFile, currentModel,context, (chunk, isFinal) => {
                        responseText += chunk;
                        panel.webview.postMessage({ command: 'updateResponse', response: responseText });
                        if (isFinal) isResponseInProgress = false;
                    });
                    break;

                case 'analyzeCode':
                    if (isResponseInProgress) return;
                    isResponseInProgress = true;
                    panel.webview.postMessage({ command: 'clearResponse' });

                    const analyzeFile = message.selectedFile;

                    let analyzeText = '';
                    analyzeCode(analyzeFile, currentModel,context, (chunk, isFinal) => {
                        analyzeText += chunk;
                        panel.webview.postMessage({ command: 'updateResponse', response: analyzeText });
                        if (isFinal) isResponseInProgress = false;
                    });
                    break;

                case 'fetchFiles':
                    const folders = vscode.workspace.workspaceFolders;
                    if (folders) {
                        let files = getAllFiles(folders[0].uri.fsPath).slice(0, 5);
                        panel.webview.postMessage({ command: 'updateFileList', files });
                    }
                    break;

                case 'searchFiles':
                    const query = message.query.toLowerCase();
                    const wsFolders = vscode.workspace.workspaceFolders;
                    if (wsFolders) {
                        let allFiles = getAllFiles(wsFolders[0].uri.fsPath);
                        let filtered = allFiles.filter(f => f.toLowerCase().includes(query)).slice(0, 5);
                        panel.webview.postMessage({ command: 'updateFileList', files: filtered });
                    }
                    break;
            }
        },
        undefined,
        context.subscriptions
    );

    panel.webview.postMessage({ command: 'fetchFiles' });
    panel.webview.postMessage({ command: 'updateModel', model: currentModel });
}

function getApiKeyFieldScript(): string {
    return `
        const apiKeyInputs = {
            "gemini": "Gemini API Key",
            "gpt-4o": "OpenAI API Key",
            "mistral": "Mistral API Key"
        };

        function onModelChange() {
            const model = document.getElementById("modelSelect").value;
            const container = document.getElementById("apiKeyFieldContainer");
            container.innerHTML = "";

            if (apiKeyInputs[model]) {
                const input = document.createElement("input");
                input.type = "password";
                input.id = "apiKeyInput";
                input.placeholder = apiKeyInputs[model];
                input.style.marginTop = "10px";
                input.style.marginBottom = "5px";
                container.appendChild(input);

                const saveBtn = document.createElement("button");
                saveBtn.innerText = "Save API Key";
                saveBtn.style.width = "100%";
                saveBtn.onclick = () => {
                    const apiKey = document.getElementById("apiKeyInput").value.trim();
                    if (!apiKey) {
                        alert("API key cannot be empty.");
                        return;
                    }
                    vscode.postMessage({ command: "saveApiKey", model, apiKey });
                };
                container.appendChild(saveBtn);
            }
        }
    `;
}

export function getWebviewContent(currentModel: string, context: vscode.ExtensionContext): string {
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
                .container { max-width: 900px; margin: auto; }
                textarea, select, input {
                    background-color: #252526; color: #d4d4d4;
                    border: 1px solid #3c3c3c; padding: 10px; border-radius: 5px;
                    width: 100%; font-size: 14px;
                }
                button {
                    background-color: #007acc; color: white;
                    border: none; padding: 10px; border-radius: 5px;
                    cursor: pointer; width: 48%; font-size: 14px;
                }
                button:hover { background-color: #005f99; }
                .chatbox {
                    width: 100%; height: 300px; overflow-y: auto;
                    background-color: #252526; border: 1px solid #3c3c3c;
                    padding: 10px; border-radius: 5px; margin-top: 10px;
                    white-space: pre-wrap; font-size: 14px; line-height: 1.5;
                }
                .buttons { display: flex; justify-content: space-between; margin-top: 10px; }
                .user-message { color: #9cdcfe; }
                .ai-message { color: #c586c0; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>AssistantAI Chat</h2>

                <label for="modelSelect">Choose AI Model:</label>
                <select id="modelSelect" onchange="onModelChange()">
                    <option value="llama3.1">Llama 3.1</option>
                    <option value="mistral">Mistral</option>
                    <option value="gemma">Gemma</option>
                    <option value="deepseek-r1">Deepseek-R1</option>
                    <option value="llama3.2">Llama 3.2</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gemini">Gemini</option>
                </select>

                <div id="apiKeyFieldContainer" style="margin-top: 10px;"></div>

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
                    lastAIMessage = null;
                    vscode.postMessage({ command: "generateResponse", prompt, selectedFile });
                }

                function analyzeSelectedFile() {
                    const selectedFile = document.getElementById("fileSelect").value;
                    if (!selectedFile) return alert("Please select a file to analyze.");
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
                    const msg = document.createElement("p");
                    msg.innerHTML = "<strong>" + sender + ":</strong> " + text;
                    msg.classList.add(className);
                    chatbox.appendChild(msg);
                    chatbox.scrollTop = chatbox.scrollHeight;
                    if (sender === "AI" || sender === "🔍 Analysis") lastAIMessage = msg;
                }

                window.addEventListener("message", event => {
                    const data = event.data;
                    if (data.command === "updateFileList") {
                        document.getElementById("fileSelect").innerHTML = data.files
                            .map(f => \`<option value="\${f}">\${f}</option>\`).join("");
                    } else if (data.command === "clearResponse") {
                        document.getElementById("chatbox").innerHTML = "";
                        lastAIMessage = null;
                    } else if (data.command === "updateResponse") {
                        if (lastAIMessage) {
                            lastAIMessage.innerHTML = "<strong>AI:</strong> " + data.response;
                        } else {
                            appendMessage("AI", data.response, "ai-message");
                        }
                    } else if (data.command === "updateModel") {
                        document.getElementById("modelSelect").value = data.model;
                        onModelChange(); // load API key input
                    }
                });

                ${getApiKeyFieldScript()}
                onModelChange(); // init on load

                vscode.postMessage({ command: "fetchFiles" });
            </script>
        </body>
        </html>
    `;
}
