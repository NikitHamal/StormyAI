// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const apiKeyInput = document.getElementById('api-key-input');
const saveKeyButton = document.getElementById('save-key');
const modelSelector = document.getElementById('model-selector');
const imageInput = document.getElementById('image-url-input');
const loadingOverlay = document.getElementById('loadingOverlay');

marked.setOptions({
    highlight: function(code, language) {
        if (language && hljs.getLanguage(language)) {
            return hljs.highlight(code, { language: language }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
});

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
const QWEN_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GPT4O_API_URL = 'https://api.paxsenix.biz.id/ai/gpt4o';
const GPT4O_MINI_API_URL = 'https://api.paxsenix.biz.id/ai/gpt4omini';
const GEMINI_REALTIME_API_URL = 'https://api.paxsenix.biz.id/ai/gemini-realtime';
const GEMINI_MODEL_NAME = 'gemini';
const QWEN_MODEL_NAME = 'qwen/qwen2.5-vl-72b-instruct:free';
const GPT4O_MODEL_NAME = 'gpt4o';
const GPT4O_MINI_MODEL_NAME = 'gpt4omini';
const GEMINI_REALTIME_MODEL_NAME = 'gemini_realtime';

// API Key Storage Keys
const GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';
const QWEN_API_KEY_STORAGE_KEY = 'qwen_api_key';
const qwenAPI = "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";

let apiKey = '';
let currentModel = localStorage.getItem('current_model') || GEMINI_MODEL_NAME;
modelSelector.value = currentModel;

// Initialize API Keys from Local Storage
const loadApiKey = () => {
    if (currentModel === GPT4O_MODEL_NAME || currentModel === GPT4O_MINI_MODEL_NAME || currentModel === GEMINI_REALTIME_MODEL_NAME) {
        apiKey = '';
        apiKeyInput.style.display = 'none';
        saveKeyButton.style.display = 'none';
    } else {
        apiKey = localStorage.getItem(currentModel === GEMINI_MODEL_NAME ? GEMINI_API_KEY_STORAGE_KEY : QWEN_API_KEY_STORAGE_KEY) || '';
        apiKeyInput.style.display = 'block';
        saveKeyButton.style.display = 'block';
    }
};

// Show/Hide Image Input based on Model
function toggleImageInput() {
    imageInput.style.display = currentModel === QWEN_MODEL_NAME ? 'block' : 'none';
}

// Initial setup
loadApiKey();
toggleImageInput();

modelSelector.addEventListener('change', () => {
    currentModel = modelSelector.value;
    localStorage.setItem('current_model', currentModel);
    toggleImageInput();
    loadApiKey();
});

// Event Listeners
saveKeyButton.addEventListener('click', () => {
    const newApiKey = apiKeyInput.value.trim();
    if (!newApiKey) {
        alert('Please enter an API key');
        return;
    }
    apiKey = newApiKey;
    localStorage.setItem(
        currentModel === GEMINI_MODEL_NAME ? GEMINI_API_KEY_STORAGE_KEY : QWEN_API_KEY_STORAGE_KEY,
        apiKey
    );
    alert('API key saved!');
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendButton.addEventListener('click', sendMessage);

// Helper Functions
function createMessageElement(content, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const avatar = document.createElement('div');
    avatar.className = `avatar ${isUser ? 'user-avatar' : 'bot-avatar'}`;
    avatar.textContent = isUser ? 'U' : 'A';

    const textDiv = document.createElement('div');
    textDiv.className = 'message-content';
    
    if (isUser) {
        textDiv.textContent = content;
    } else {
        // Parse markdown and render HTML for bot messages
        const formattedContent = marked.parse(content);
        textDiv.innerHTML = formattedContent;
        
        // Add copy buttons to code blocks
        const codeBlocks = textDiv.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.innerHTML = 'Copy';
            copyButton.onclick = () => {
                navigator.clipboard.writeText(block.textContent);
                copyButton.innerHTML = 'Copied!';
                setTimeout(() => {
                    copyButton.innerHTML = 'Copy';
                }, 2000);
            };
            
            const preBlock = block.parentElement;
            preBlock.style.position = 'relative';
            preBlock.insertBefore(copyButton, block);
        });

        // Add link click handling
        const links = textDiv.querySelectorAll('a');
        links.forEach(link => {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        });
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(textDiv);
    return messageDiv;
}

function appendMessage(content, isUser) {
    const messageElement = createMessageElement(content, isUser);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function extractResponse(data) {
    if (currentModel === QWEN_MODEL_NAME) {
        return data.choices[0].message.content;
    } else {
        return data.candidates[0].content.parts[0].text;
    }
}

function getRequestBody(message, imageUrl) {
    if (currentModel === QWEN_MODEL_NAME) {
        return {
            model: QWEN_MODEL_NAME,
            messages: [{
                role: 'user',
                content: imageUrl 
                    ? `${message}\n\nImage: ${imageUrl}`
                    : message
            }],
            temperature: 0.7,
            max_tokens: 1024,
            top_p: 0.95,
            frequency_penalty: 0.6,
            presence_penalty: 0,
            stream: false
        };
    } else if (currentModel === GPT4O_MODEL_NAME || currentModel === GPT4O_MINI_MODEL_NAME) {
        return {
            message: message
        };
    } else {
        return {
            contents: [{
                parts: [{
                    text: message
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024
            }
        };
    }
}

async function sendMessage() {
    const message = chatInput.value.trim();
    const imageUrl = imageInput.value.trim();

    if (!message && !imageUrl) return;
    if (currentModel !== GPT4O_MODEL_NAME && 
        currentModel !== GPT4O_MINI_MODEL_NAME && 
        currentModel !== GEMINI_REALTIME_MODEL_NAME && 
        !apiKey) {
        alert('Please enter and save your API key for the selected model!');
        return;
    }

    chatInput.value = '';
    imageInput.value = '';

    appendMessage(message, true);
    showLoading();

    try {
        let apiUrl = currentModel === QWEN_MODEL_NAME ? QWEN_API_URL : 
                    currentModel === GPT4O_MODEL_NAME ? `${GPT4O_API_URL}?text=${encodeURIComponent(message)}` :
                    currentModel === GPT4O_MINI_MODEL_NAME ? `${GPT4O_MINI_API_URL}?text=${encodeURIComponent(message)}` :
                    currentModel === GEMINI_REALTIME_MODEL_NAME ? `${GEMINI_REALTIME_API_URL}?text=${encodeURIComponent(message)}` :
                    GEMINI_API_URL;
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        let options = {
            method: (currentModel === GPT4O_MODEL_NAME || 
                    currentModel === GPT4O_MINI_MODEL_NAME || 
                    currentModel === GEMINI_REALTIME_MODEL_NAME) ? 'GET' : 'POST',
            headers
        };

        if (currentModel === QWEN_MODEL_NAME) {
            headers['Authorization'] = `Bearer ${qwenAPI}`;
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(getRequestBody(message, imageUrl));
        } else if (currentModel === GEMINI_MODEL_NAME) {
            apiUrl += `?key=${apiKey}`;
            options.body = JSON.stringify(getRequestBody(message));
        }

        console.log('Request:', { url: apiUrl, options });
        const response = await fetch(apiUrl, options);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', errorData);
            throw new Error(errorData.error?.message || errorData.message || `API request failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        
        let botResponse;
        if (currentModel === GPT4O_MODEL_NAME || 
            currentModel === GPT4O_MINI_MODEL_NAME || 
            currentModel === GEMINI_REALTIME_MODEL_NAME) {
            botResponse = data.response || data.message || 'No response from API';
        } else {
            botResponse = extractResponse(data);
        }
        
        appendMessage(botResponse, false);
    } catch (error) {
        console.error('Error:', error);
        appendMessage(`Error: ${error.message}`, false);
    } finally {
        hideLoading();
    }
}

// Auto-resize textarea
chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    const maxHeight = 200;
    if (this.scrollHeight > maxHeight) {
        this.style.height = maxHeight + 'px';
        this.style.overflowY = 'auto';
    } else {
        this.style.overflowY = 'hidden';
    }
});