// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const modelSelector = document.getElementById('model-selector');
const imageInput = document.getElementById('image-url-input');
const loadingOverlay = document.getElementById('loadingOverlay');
const downloadResult = document.getElementById('download-result');
const videoThumbnail = document.getElementById('video-thumbnail');
const videoTitle = document.getElementById('video-title');
const videoDuration = document.getElementById('video-duration');
const qualitySelector = document.getElementById('quality-selector');
const downloadButton = document.getElementById('download-button');

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

const GPT4O_API_URL = 'https://api.paxsenix.biz.id/ai/gpt4o';
const GPT4O_MINI_API_URL = 'https://api.paxsenix.biz.id/ai/gpt4omini';
const GEMINI_REALTIME_API_URL = 'https://api.paxsenix.biz.id/ai/gemini-realtime';
const GEMINI_FLASH_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
const GEMINI_FLASH_API_KEY = 'AIzaSyChpeOa4gwBVR6ZcOa8KGQezB8iL7hJuI8';

// API endpoints
const FB_DOWNLOADER_API = 'https://api.paxsenix.biz.id/dl/fb';

// Chat history management
const MAX_HISTORY = 15;
let chatHistory = [];

// Rate limiting
const RATE_LIMIT_DELAY = 1000; // 1 second between requests
let lastRequestTime = 0;

let currentModel = localStorage.getItem('current_model') || 'gemini_flash';
modelSelector.value = currentModel;

// Hide image input as it's no longer needed
imageInput.style.display = 'none';

modelSelector.addEventListener('change', () => {
    currentModel = modelSelector.value;
    localStorage.setItem('current_model', currentModel);
});

// Event Listeners
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendButton.addEventListener('click', sendMessage);

// Helper Functions
function createMessageElement(content, isUser, options = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'user-message' : 'bot-message'}`;
    
    // Add message content
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = marked.parse(content);
    messageDiv.appendChild(messageContent);

    // Add download options if provided
    if (options && Array.isArray(options) && options.length > 0) {
        console.log('Creating download options UI with options:', options); // Debug log
        
        const downloadOptions = document.createElement('div');
        downloadOptions.className = 'download-options';
        
        const qualitySelector = document.createElement('select');
        qualitySelector.className = 'model-dropdown';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Quality';
        qualitySelector.appendChild(defaultOption);
        
        // Add quality options
        options.forEach((quality, index) => {
            if (!quality.downloadUrl) {
                console.log('Skipping invalid quality option:', quality);
                return;
            }
            console.log('Adding quality option:', quality);
            const option = document.createElement('option');
            option.value = quality.downloadUrl;
            option.textContent = quality.quality;
            qualitySelector.appendChild(option);
        });

        const downloadButton = document.createElement('button');
        downloadButton.className = 'download-button';
        downloadButton.textContent = 'Download';
        
        // Add click handler
        downloadButton.onclick = () => {
            const selectedUrl = qualitySelector.value;
            if (!selectedUrl) {
                appendMessage('Please select a quality option first', false, null, false);
                return;
            }
            handleDownload(selectedUrl);
        };

        downloadOptions.appendChild(qualitySelector);
        downloadOptions.appendChild(downloadButton);
        messageDiv.appendChild(downloadOptions);
    } else {
        console.log('No download options provided or empty array'); // Debug log
    }

    return messageDiv;
}

function appendMessage(content, isUser, options = null, saveToHistory = true) {
    const messageElement = createMessageElement(content, isUser, options);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Only save to history if saveToHistory is true
    if (saveToHistory) {
        // Add message to history
        chatHistory.push({
            content,
            isUser,
            timestamp: new Date().toISOString()
        });

        // Keep only the last MAX_HISTORY messages
        if (chatHistory.length > MAX_HISTORY) {
            chatHistory = chatHistory.slice(chatHistory.length - MAX_HISTORY);
            // Remove excess messages from DOM
            while (chatMessages.children.length > MAX_HISTORY) {
                chatMessages.removeChild(chatMessages.firstChild);
            }
        }
    }
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Check if it's a download command
    if (message.toLowerCase().startsWith('download ')) {
        const url = message.slice(9).trim();
        
        // Check for valid URL format
        if (!isValidUrl(url)) {
            appendMessage('Please provide a valid URL', false);
            return;
        }

        // Check for social media platforms
        const platform = detectSocialPlatform(url);
        if (platform === 'facebook') {
            await handleFacebookDownload(url);
        } else if (platform) {
            appendMessage(`${platform} video downloader is not available yet.`, false);
        } else {
            appendMessage('Unsupported URL. Please provide a Facebook video link.', false);
        }
        return;
    }

    // Check rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
        const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    chatInput.value = '';
    chatInput.style.height = 'auto';

    appendMessage(message, true);
    showLoading();

    try {
        let apiUrl, options;

        if (currentModel === 'gemini_flash') {
            apiUrl = `${GEMINI_FLASH_API_URL}?key=${GEMINI_FLASH_API_KEY}`;
            
            // Format the conversation history and current message
            const conversationText = chatHistory.length > 1 ? 
                `Previous conversation:\n${chatHistory.slice(0, -1)
                    .map(msg => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.content}`)
                    .join('\n')}\n\n` : '';

            options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are a helpful AI assistant. Please help with the following:

${conversationText}User message:
${message}`
                        }]
                    }]
                })
            };
        } else {
            // For other models, include chat history in the prompt
            const historyContext = chatHistory.slice(0, -1)
                .map(msg => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.content}`)
                .join('\n');
            
            const fullMessage = `Previous conversation:\n${historyContext}\n\nUser: ${message}`;
            
            apiUrl = currentModel === 'gpt4o' ? `${GPT4O_API_URL}?text=${encodeURIComponent(fullMessage)}` :
                    currentModel === 'gpt4omini' ? `${GPT4O_MINI_API_URL}?text=${encodeURIComponent(fullMessage)}` :
                    `${GEMINI_REALTIME_API_URL}?text=${encodeURIComponent(fullMessage)}`;
            
            options = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }

        lastRequestTime = Date.now();
        const response = await fetch(apiUrl, options);

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please wait a moment before sending another message.');
            }
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        let botResponse;
        
        if (currentModel === 'gemini_flash') {
            if (data.error) {
                throw new Error(data.error.message || 'API Error');
            }
            botResponse = data.candidates[0].content.parts[0].text;
        } else {
            botResponse = data.response || data.message || 'No response from API';
        }

        appendMessage(botResponse, false);
    } catch (error) {
        console.error('Error:', error);
        const errorMessage = error.message.includes('Rate limit') ? 
            'The AI is a bit busy. Please wait a few seconds and try again.' :
            `Error: ${error.message}`;
        appendMessage(errorMessage, false);
    } finally {
        hideLoading();
    }
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function detectSocialPlatform(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();

        // Facebook
        if (hostname.includes('facebook.com') || hostname.includes('fb.watch')) {
            return 'facebook';
        }
        // Instagram
        if (hostname.includes('instagram.com')) {
            return 'Instagram';
        }
        // YouTube
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            return 'YouTube';
        }
        // TikTok
        if (hostname.includes('tiktok.com')) {
            return 'TikTok';
        }
        // Twitter/X
        if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            return 'Twitter/X';
        }
        // LinkedIn
        if (hostname.includes('linkedin.com')) {
            return 'LinkedIn';
        }
        // Reddit
        if (hostname.includes('reddit.com')) {
            return 'Reddit';
        }
        // Snapchat
        if (hostname.includes('snapchat.com')) {
            return 'Snapchat';
        }
        // Pinterest
        if (hostname.includes('pinterest.com')) {
            return 'Pinterest';
        }
        // Vimeo
        if (hostname.includes('vimeo.com')) {
            return 'Vimeo';
        }
        // Dailymotion
        if (hostname.includes('dailymotion.com')) {
            return 'Dailymotion';
        }

        return null;
    } catch (_) {
        return null;
    }
}

// Facebook Video Download Handler
async function handleFacebookDownload(url) {
    showLoading();
    
    try {
        appendMessage(`Processing Facebook video: ${url}`, false, null, false);
        
        const response = await fetch(`${FB_DOWNLOADER_API}?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error('Failed to process video');
        }

        // Get all available download URLs
        let downloadUrls = [];
        if (data.links && Array.isArray(data.links)) {
            downloadUrls = data.links;
        } else if (data.url && Array.isArray(data.url)) {
            downloadUrls = data.url;
        } else if (typeof data.url === 'string') {
            downloadUrls = [{
                quality: 'Default Quality',
                url: data.url
            }];
        }

        if (downloadUrls.length === 0) {
            throw new Error('No download options available');
        }

        // Map and sort download options by quality
        const downloadOptions = downloadUrls
            .map(item => ({
                quality: item.quality || item.label || 'Default Quality',
                downloadUrl: item.url || item.downloadUrl || item
            }))
            .filter(item => item.downloadUrl) // Filter out invalid URLs
            .sort((a, b) => {
                const getResolution = (quality) => {
                    const match = quality.match(/(\d+)p/);
                    return match ? parseInt(match[1]) : 0;
                };
                return getResolution(b.quality) - getResolution(a.quality);
            });

        if (downloadOptions.length === 0) {
            throw new Error('No valid download URLs available');
        }

        // Get highest quality URL
        const bestQuality = downloadOptions[0];
        handleDownload(bestQuality.downloadUrl);
        appendMessage(`Starting download in ${bestQuality.quality}...`, false, null, false);
        
    } catch (error) {
        console.error('Download error:', error);
        appendMessage('Sorry, there was an error processing this video. Please try again later.', false);
    } finally {
        hideLoading();
    }
}

function handleDownload(url) {
    if (!url) {
        appendMessage('No valid download URL available', false, null, false);
        return;
    }
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'facebook_video.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    appendMessage('Download started!', false, null, false);
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

function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}