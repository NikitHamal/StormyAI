// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const apiKeyInput = document.getElementById('api-key-input');
const saveKeyButton = document.getElementById('save-key');
const loadingOverlay = document.getElementById('loadingOverlay');

// Constants
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
const API_KEY_STORAGE_KEY = 'AIzaSyACk4YyXgd_VOvBlFWV8r17LuwkT1iGfmg';

// State
let apiKey = localStorage.getItem(API_KEY_STORAGE_KEY) || '';

// Initialize
if (apiKey) {
    apiKeyInput.value = apiKey;
}

// Event Listeners
saveKeyButton.addEventListener('click', () => {
    apiKey = apiKeyInput.value.trim();
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    alert('API key saved!');
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendButton.addEventListener('click', sendMessage);

// Functions
function createMessageElement(content, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const avatar = document.createElement('div');
    avatar.className = `avatar ${isUser ? 'user-avatar' : 'bot-avatar'}`;
    avatar.textContent = isUser ? 'U' : 'A';

    const textDiv = document.createElement('div');
    textDiv.textContent = content;

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

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    if (!apiKey) {
        alert('Please enter and save your API key first!');
        return;
    }

    // Clear input
    chatInput.value = '';

    // Add user message to chat
    appendMessage(message, true);

    try {
        showLoading();
        const response = await fetch(`${API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: message
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        const botResponse = data.candidates[0].content.parts[0].text;
        appendMessage(botResponse, false);
    } catch (error) {
        console.error('Error:', error);
        appendMessage('Sorry, I encountered an error. Please try again.', false);
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