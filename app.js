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

    // Function to handle URL detection and download
    const handleUrlMessage = async (url) => {
        // Clean the URL first
        url = cleanUrl(url);
        
        // Check for valid URL format
        if (!isValidUrl(url)) {
            return false;
        }

        // Check for social media platforms
        const platform = detectSocialPlatform(url);
        if (platform === 'facebook') {
            await handleFacebookDownload(url);
            return true;
        } else if (platform) {
            appendMessage(`Detected ${platform} URL. To download videos, use the 'download' command. Note: Only Facebook downloads are currently supported.`, false);
            return false;
        }
        return false;
    };

    // Check if it's a download command
    if (message.toLowerCase().startsWith('download ')) {
        let url = message.slice(9).trim();
        url = cleanUrl(url); // Clean the URL
        
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

    // Check if the message contains URLs
    const urlRegex = /(https?:\/\/[^\s<>)"']+)/g;
    const urls = message.match(urlRegex);
    
    if (urls) {
        for (const url of urls) {
            // If it's a supported social media URL, handle it
            const wasHandled = await handleUrlMessage(url);
            if (wasHandled) {
                return; // URL was handled, don't send to AI
            }
        }
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
        // Clean up the URL first
        url = cleanUrl(url);
        
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const pathname = urlObj.pathname.toLowerCase();

        // Facebook - handle various formats
        if (hostname.includes('facebook.com') || 
            hostname.includes('fb.watch') ||
            hostname.includes('fb.me') ||
            hostname.includes('m.facebook.com') ||
            hostname.includes('web.facebook.com') ||
            hostname.includes('l.facebook.com') ||
            hostname.includes('mbasic.facebook.com')) {
            
            // Skip non-video Facebook URLs
            if (pathname.includes('/profile.php') || 
                pathname === '/' || 
                pathname.includes('/home')) {
                return null;
            }
            
            return 'facebook';
        }
        
        // Instagram
        if (hostname.includes('instagram.com') || hostname.includes('ig.me')) {
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

function cleanUrl(url) {
    try {
        // Remove any leading/trailing whitespace
        url = url.trim();

        // Handle iOS-specific URL encoding
        try {
            url = decodeURIComponent(url);
        } catch (e) {
            // If decoding fails, try with the original URL
            console.log('Decoding failed, using original URL');
        }

        // Handle iOS-specific URL patterns
        if (url.includes('sharer.php')) {
            // Extract URL from Facebook sharer
            const urlParam = new URLSearchParams(url.split('?')[1]).get('u');
            if (urlParam) url = urlParam;
        }

        // Handle URLs that are wrapped in other URLs (common in iOS sharing)
        const urlMatch = url.match(/https?:\/\/[^\s<>)"']+/g);
        if (urlMatch && urlMatch.length > 0) {
            // Get the last URL in case it's wrapped
            url = urlMatch[urlMatch.length - 1];
        }

        // Handle special iOS cases
        url = url
            .replace(/\\u002F/g, '/') // Replace unicode forward slashes
            .replace(/\\\//g, '/') // Replace escaped forward slashes
            .replace(/&amp;/g, '&') // Replace HTML entities
            .replace(/\[.*?\]/g, '') // Remove square brackets and content
            .replace(/[[\]]/g, '') // Remove any remaining brackets
            .replace(/[.,;!]$/, ''); // Remove trailing punctuation

        // Handle mobile redirects
        if (url.includes('l.facebook.com/l.php')) {
            const urlParam = new URLSearchParams(url.split('?')[1]).get('u');
            if (urlParam) url = urlParam;
        }

        // Convert mobile URLs to regular URLs
        url = url
            .replace('m.facebook.com', 'www.facebook.com')
            .replace('web.facebook.com', 'www.facebook.com')
            .replace('mbasic.facebook.com', 'www.facebook.com');

        // If it's a Facebook URL, keep parameters (they're important for video URLs)
        if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
            url = url.split('?')[0].split('#')[0];
        }

        console.log('Cleaned URL:', url); // Debug log
        return url;
    } catch (e) {
        console.error('Error cleaning URL:', e);
        return url;
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

// Add these optimizations after the existing style element creation
const mobileOptimizationStyles = document.createElement('style');
mobileOptimizationStyles.textContent = `
    @media (max-width: 768px) {
        /* Chat container optimizations */
        .chat-container {
            padding-bottom: 80px; /* More space for input area */
        }

        /* Message optimizations */
        .message {
            padding: 1rem;
            margin: 0.5rem 0;
            font-size: 0.95rem;
        }

        /* Code block optimizations */
        .message-content pre {
            max-width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding: 0.75rem;
            font-size: 0.85rem;
        }

        /* Input area optimizations */
        .chat-input-container {
            padding: 0.75rem;
            background-color: var(--background-primary);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }

        #chat-input {
            font-size: 1rem;
            padding: 0.5rem 2rem 0.5rem 0.5rem;
            max-height: 120px; /* Smaller max height on mobile */
        }

        /* Model selector optimization */
        .model-dropdown {
            font-size: 0.7rem;
            padding: 3px 6px;
            top: -25px;
        }

        /* Send button optimization */
        #send-button {
            right: 1.25rem;
            bottom: 1.5rem;
            padding: 0.35rem;
        }

        /* Download options optimization */
        .download-options {
            flex-direction: column;
            gap: 8px;
            padding: 8px;
        }

        .download-options select,
        .download-button {
            width: 100%;
            padding: 8px;
            font-size: 0.9rem;
        }
    }

    /* iOS specific optimizations */
    @supports (-webkit-touch-callout: none) {
        .chat-input-container {
            padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
        }

        #chat-input {
            font-size: 16px; /* Prevents iOS zoom on focus */
        }
    }
`;
document.head.appendChild(mobileOptimizationStyles);

// Add touch event handling for better mobile interaction
document.addEventListener('DOMContentLoaded', () => {
    // Prevent double-tap zoom on buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            button.click();
        });
    });

    // Improve scroll behavior on mobile
    chatMessages.style.WebkitOverflowScrolling = 'touch';

    // Adjust textarea behavior on mobile
    chatInput.addEventListener('focus', () => {
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
            window.scrollTo(0, document.body.scrollHeight);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 300);
    });

    // Handle mobile keyboard hide
    window.addEventListener('resize', () => {
        if (document.activeElement === chatInput) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
});

// Optimize the existing appendMessage function for mobile
const originalAppendMessage = appendMessage;
appendMessage = function(content, isUser, options = null, saveToHistory = true) {
    originalAppendMessage(content, isUser, options, saveToHistory);
    
    // Ensure smooth scrolling on mobile
    requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
};