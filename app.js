// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
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

const QWEN_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GPT4O_API_URL = 'https://api.paxsenix.biz.id/ai/gpt4o';
const GPT4O_MINI_API_URL = 'https://api.paxsenix.biz.id/ai/gpt4omini';
const GEMINI_REALTIME_API_URL = 'https://api.paxsenix.biz.id/ai/gemini-realtime';
const QWEN_MODEL_NAME = 'qwen/qwen2.5-vl-72b-instruct:free';
const qwenAPI = "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";

let currentModel = localStorage.getItem('current_model') || 'gpt4o';
modelSelector.value = currentModel;

// Show/Hide Image Input based on Model
function toggleImageInput() {
    imageInput.style.display = currentModel === 'qwen' ? 'block' : 'none';
}

modelSelector.addEventListener('change', () => {
    currentModel = modelSelector.value;
    localStorage.setItem('current_model', currentModel);
    toggleImageInput();
});

toggleImageInput();

// Event Listeners
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

function getRequestBody(message, imageUrl) {
    if (currentModel === 'qwen') {
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
    } else {
        return {
            message: message
        };
    }
}

async function sendMessage() {
    const message = chatInput.value.trim();
    const imageUrl = imageInput.value.trim();

    if (!message && !imageUrl) return;

    chatInput.value = '';
    imageInput.value = '';
    chatInput.style.height = 'auto';

    appendMessage(message, true);
    showLoading();

    try {
        let apiUrl = currentModel === 'qwen' ? QWEN_API_URL : 
                    currentModel === 'gpt4o' ? `${GPT4O_API_URL}?text=${encodeURIComponent(message)}` :
                    currentModel === 'gpt4omini' ? `${GPT4O_MINI_API_URL}?text=${encodeURIComponent(message)}` :
                    `${GEMINI_REALTIME_API_URL}?text=${encodeURIComponent(message)}`;
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        let options = {
            method: currentModel === 'qwen' ? 'POST' : 'GET',
            headers
        };

        if (currentModel === 'qwen') {
            headers['Authorization'] = `Bearer ${qwenAPI}`;
            options.body = JSON.stringify(getRequestBody(message, imageUrl));
        }

        const response = await fetch(apiUrl, options);

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        
        let botResponse = currentModel === 'qwen' ? 
            data.choices[0].message.content :
            data.response || data.message || 'No response from API';
        
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