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
const GEMINI_FLASH_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';
const GEMINI_FLASH_API_KEY = 'AIzaSyChpeOa4gwBVR6ZcOa8KGQezB8iL7hJuI8';

// API endpoints
const FB_DOWNLOADER_API = 'https://api.paxsenix.biz.id/dl/fb';
const SPOTIFY_SEARCH_API = 'https://api.paxsenix.biz.id/spotify/search';
const SPOTIFY_TRACK_API = 'https://api.paxsenix.biz.id/spotify/track';
const YT_SEARCH_API = 'https://api.paxsenix.biz.id/yt/search';
const YT_DOWNLOAD_API = 'https://api.paxsenix.biz.id/yt/yttomp4';

// Chat history management
const MAX_HISTORY = 15;
let chatHistory = [];

// Rate limiting
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests for non-Gemini models
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

// Add command list
const COMMANDS = {
    download: {
        usage: 'download [url]',
        description: 'Download videos from supported platforms (Currently Facebook)',
        example: 'download https://facebook.com/video/123'
    },
    imagine: {
        usage: 'imagine [prompt]',
        description: 'Generate images based on your description',
        example: 'imagine a sunset over mountains'
    },
    play: {
        usage: 'play [song name]',
        description: 'Search and play music from Spotify',
        example: 'play Shape of You'
    },
    help: {
        usage: 'help [command]',
        description: 'Show all available commands or get help for a specific command',
        example: 'help play'
    }
};

// Helper Functions
function createMessageElement(content, isUser, options = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    // Add message content
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    // Check if content is HTML (for track list) or regular text
    if (content.trim().startsWith('<div class="track-list">')) {
        messageContent.innerHTML = content; // Directly set HTML for track list
    } else {
        messageContent.innerHTML = marked.parse(content); // Use marked for regular messages
    }
    
    messageDiv.appendChild(messageContent);

    // Only add download options if they exist and are valid
    if (options && Array.isArray(options) && options.length > 0 && options.some(opt => opt.downloadUrl)) {
        const downloadOptions = document.createElement('div');
        downloadOptions.className = 'download-options';
        
        const qualitySelector = document.createElement('select');
        qualitySelector.className = 'model-dropdown';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Quality';
        qualitySelector.appendChild(defaultOption);
        
        // Add only valid quality options
        options.forEach(quality => {
            if (quality && quality.downloadUrl) {
                const option = document.createElement('option');
                option.value = quality.downloadUrl;
                option.textContent = quality.quality || 'Default Quality';
                qualitySelector.appendChild(option);
            }
        });

        // Only add the download UI if we have valid options
        if (qualitySelector.children.length > 1) { // More than just the default option
            const downloadButton = document.createElement('button');
            downloadButton.className = 'download-button';
            downloadButton.textContent = 'Download';
            
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
        }
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

    // Command handling
    const commandMatch = message.match(/^(\w+)(?:\s+(.*))?$/);
    if (commandMatch) {
        const command = commandMatch[1].toLowerCase();
        const args = commandMatch[2] || '';

        switch (command) {
            case 'help':
                handleHelpCommand(args);
                return;
            case 'download':
                if (!args) {
                    showCommandHelp('download');
                    return;
                }
                await handleDownloadCommand(args);
                return;
            case 'play':
                if (!args) {
                    showCommandHelp('play');
                    return;
                }
                await handlePlayCommand(args);
                return;
            case 'imagine':
                if (!args) {
                    showCommandHelp('imagine');
                    return;
                }
                await handleImagineCommand(args);
                return;
        }
    }

    // Check rate limiting only for non-Gemini models
    if (currentModel !== 'gemini_flash') {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
            const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

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

        // Update lastRequestTime only for non-Gemini models
        if (currentModel !== 'gemini_flash') {
            lastRequestTime = Date.now();
        }

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

// Command handlers
function handleHelpCommand(args) {
    if (!args) {
        // Show all commands
        const commandList = Object.entries(COMMANDS).map(([name, info]) => {
            return `**/${name}** - ${info.description}\n\`${info.usage}\``;
        }).join('\n\n');
        
        appendMessage(`Available Commands:\n\n${commandList}`, false);
    } else {
        showCommandHelp(args);
    }
}

function showCommandHelp(commandName) {
    const command = COMMANDS[commandName];
    if (!command) {
        appendMessage(`Command "${commandName}" not found. Type \`help\` to see all commands.`, false);
        return;
    }

    const helpMessage = `**/${commandName}**\n${command.description}\n\nUsage: \`${command.usage}\`\nExample: \`${command.example}\``;
    appendMessage(helpMessage, false);
}

// First, add these styles at the beginning of your file with other styles
const trackListStyles = document.createElement('style');
trackListStyles.textContent = `
    .track-list {
        margin: 12px 0;
    }

    .track-item {
        padding: 12px;
        border-bottom: 1px solid var(--border-color);
    }

    .track-header {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .track-thumb {
        width: 60px;
        height: 60px;
        border-radius: 6px;
        object-fit: cover;
    }

    .track-info {
        flex: 1;
        min-width: 0;
        padding-right: 8px;
    }

    .track-name {
        font-weight: 600;
        margin-bottom: 4px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-size: 0.95rem;
        line-height: 1.3;
    }

    .track-artist, .track-duration {
        font-size: 0.8rem;
        color: var(--text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .play-button {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: var(--accent-color);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        padding: 0;
        transition: all 0.2s ease;
    }

    .play-button:active {
        transform: scale(0.95);
    }

    .play-button svg {
        width: 24px;
        height: 24px;
    }

    .quality-selector {
        margin: 8px 0;
        padding: 12px;
        background: var(--background-secondary);
        border-radius: 8px;
    }

    .quality-options {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }

    .quality-option {
        padding: 10px;
        border-radius: 6px;
        background: var(--background-primary);
        border: 1px solid var(--border-color);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .quality-option:active {
        background: var(--accent-color);
        color: white;
        border-color: var(--accent-color);
    }

    .progress-bar {
        height: 4px;
        background: var(--border-color);
        border-radius: 2px;
        margin: 8px 0;
        cursor: pointer;
        position: relative;
    }

    .progress-bar-fill {
        height: 100%;
        background: var(--accent-color);
        border-radius: 2px;
        width: 0;
        transition: width 0.1s linear;
    }

    .time-display {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
        color: var(--text-secondary);
    }

    @media (max-width: 768px) {
        .track-thumb {
            width: 50px;
            height: 50px;
        }

        .track-name {
            font-size: 0.9rem;
        }

        .play-button {
            width: 36px;
            height: 36px;
        }

        .play-button svg {
            width: 20px;
            height: 20px;
        }

        .quality-options {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        }

        .quality-option {
            padding: 8px;
        }
    }
`;
document.head.appendChild(trackListStyles);

// Add these constants
let currentlyPlaying = null;

// Update the handlePlayCommand function
async function handlePlayCommand(query) {
    showLoading();
    try {
        const response = await fetch(`${YT_SEARCH_API}?q=${encodeURIComponent(query)}&type=video`);
        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error(data.message || 'Failed to search videos');
        }

        if (!data.results || data.results.length === 0) {
            appendMessage('No videos found for your search.', false);
            return;
        }

        const videos = data.results.slice(0, 5);
        const trackListHtml = `
            <div class="track-list">
                ${videos.map(video => `
                    <div class="track-item">
                        <div class="track-header">
                            <img class="track-thumb" 
                                src="${video.thumbnails[0].url}" 
                                alt="${video.title}">
                            <div class="track-info">
                                <div class="track-name">${video.title}</div>
                                <div class="track-artist">${video.channelName}</div>
                                <div class="track-duration">${video.viewCount}</div>
                            </div>
                            <button class="play-button" data-video-id="${video.videoId}" onclick="showQualitySelection('${video.videoId}')">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                            </button>
                        </div>
                        <div id="player-${video.videoId}" class="audio-player">
                            <div class="quality-selector">
                                <div class="quality-options"></div>
                            </div>
                            <div class="player-controls">
                                <div class="progress-bar">
                                    <div class="progress-bar-fill"></div>
                                </div>
                                <div class="time-display">
                                    <span class="current-time">0:00</span>
                                    <span class="duration">0:00</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>Here are the top results for "${query}":</p>
                ${trackListHtml}
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

    } catch (error) {
        console.error('Error searching videos:', error);
        appendMessage(`Error: ${error.message}`, false);
    } finally {
        hideLoading();
    }
}

async function showQualitySelection(videoId) {
    const player = document.getElementById(`player-${videoId}`);
    const button = document.querySelector(`[data-video-id="${videoId}"]`);
    const currentAudio = window.currentAudio;

    // If this track is already playing/paused, toggle play/pause
    if (currentlyPlaying === videoId && currentAudio) {
        togglePlay(videoId);
        return;
    }

    try {
        showLoading();
        const response = await fetch(`${YT_DOWNLOAD_API}?url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error(data.message || 'Failed to get audio streams');
        }

        // Clear existing options
        player.querySelector('.quality-options').innerHTML = '';

        // Process all audio options
        const audioOptions = data.audio?.map(stream => {
            // Extract quality info from name
            let quality = '';
            if (stream.name.includes('128Kbps')) {
                quality = '128 Kbps';
            } else if (stream.name.includes('160Kbps')) {
                quality = '160 Kbps';
            } else if (stream.name.includes('70Kbps')) {
                quality = '70 Kbps';
            } else if (stream.name.includes('50Kbps')) {
                quality = '50 Kbps';
            } else {
                quality = 'Standard Quality';
            }

            return {
                url: stream.url,
                quality,
                size: stream.size
            };
        }).filter(option => option.quality !== 'Standard Quality');

        // Sort options by quality (highest first)
        audioOptions.sort((a, b) => {
            const getKbps = (quality) => parseInt(quality.split(' ')[0]) || 0;
            return getKbps(b.quality) - getKbps(a.quality);
        });

        if (audioOptions?.length > 0) {
            audioOptions.forEach(option => {
                const optionElement = document.createElement('div');
                optionElement.className = 'quality-option';
                optionElement.onclick = () => playSelectedQuality(videoId, option.url);
                optionElement.innerHTML = `
                    <div class="quality-name">${option.quality}</div>
                    <div class="quality-size">${option.size}</div>
                `;
                player.querySelector('.quality-options').appendChild(optionElement);
            });
            player.querySelector('.quality-selector').style.display = 'block';
        } else {
            // If no options found, try to play the first available audio stream
            const firstAudio = data.audio?.[0];
            if (firstAudio) {
                playSelectedQuality(videoId, firstAudio.url);
            } else {
                throw new Error('No suitable audio stream found');
            }
        }

    } catch (error) {
        console.error('Error getting audio streams:', error);
        appendMessage(`Error: ${error.message}`, false);
    } finally {
        hideLoading();
    }
}

async function playSelectedQuality(videoId, audioUrl) {
    if (!audioUrl) return;

    const player = document.getElementById(`player-${videoId}`);
    const button = document.querySelector(`[data-video-id="${videoId}"]`);
    const currentAudio = window.currentAudio;
    
    // Stop any currently playing track
    if (currentAudio) {
        currentAudio.pause();
        const oldPlayer = document.getElementById(`player-${currentlyPlaying}`);
        const oldButton = document.querySelector(`[data-video-id="${currentlyPlaying}"]`);
        if (oldPlayer) oldPlayer.classList.remove('active');
        if (oldButton) {
            oldButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>`;
        }
    }

    try {
        // Create and configure audio element
        const audio = new Audio();
        
        // iOS specific settings
        audio.controls = false; // Disable default controls
        audio.playsinline = true; // Enable inline playback
        audio.preload = 'metadata'; // Lighter preload for iOS
        
        // Set up error handling before setting source
        audio.onerror = (e) => {
            console.error('Audio error:', e);
            appendMessage('Error playing audio. Please try another quality or track.', false);
            button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>`;
            player.classList.remove('active');
        };

        // Create a promise to handle audio loading
        const loadPromise = new Promise((resolve, reject) => {
            audio.addEventListener('loadeddata', () => resolve(), { once: true });
            audio.addEventListener('error', (e) => reject(e), { once: true });
        });

        // Set source and load
        audio.src = audioUrl;
        await audio.load(); // Explicitly load for iOS

        // Update UI to show loading state
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-width="2" stroke-dasharray="30 30">
                <animateTransform
                    attributeName="transform"
                    attributeType="XML"
                    type="rotate"
                    from="0 12 12"
                    to="360 12 12"
                    dur="1s"
                    repeatCount="indefinite"
                />
            </circle>
        </svg>`;

        // Wait for the audio to be ready
        await loadPromise;
        
        window.currentAudio = audio;
        currentlyPlaying = videoId;

        // Update UI
        player.classList.add('active');
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
        </svg>`;

        // Start playing with user interaction handling
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                await playPromise;
            }
        } catch (playError) {
            console.error('Play error:', playError);
            if (playError.name === 'NotAllowedError') {
                appendMessage('Please tap to enable audio playback', false);
                // Add tap-to-play for iOS
                const tapToPlay = () => {
                    audio.play().catch(console.error);
                    document.removeEventListener('touchend', tapToPlay);
                };
                document.addEventListener('touchend', tapToPlay);
            }
            throw playError;
        }

        // Set up event listeners
        audio.addEventListener('ended', () => {
            button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>`;
            player.classList.remove('active');
            currentlyPlaying = null;
        });

        // Update progress bar and time display
        audio.addEventListener('timeupdate', () => {
            const progress = (audio.currentTime / audio.duration) * 100;
            player.querySelector('.progress-bar-fill').style.width = `${progress}%`;
            player.querySelector('.current-time').textContent = formatTime(audio.currentTime);
        });

        audio.addEventListener('loadedmetadata', () => {
            player.querySelector('.duration').textContent = formatTime(audio.duration);
        });

        // Handle progress bar clicks and touches
        const progressBar = player.querySelector('.progress-bar');
        const updateProgress = (e) => {
            const rect = progressBar.getBoundingClientRect();
            const x = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const pos = (x - rect.left) / rect.width;
            audio.currentTime = pos * audio.duration;
        };

        progressBar.addEventListener('click', updateProgress);
        progressBar.addEventListener('touchstart', updateProgress);

    } catch (error) {
        console.error('Error playing video:', error);
        appendMessage(`Error: ${error.message}`, false);
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>`;
        player.classList.remove('active');
        currentlyPlaying = null;
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update the togglePlay function to handle play/pause correctly
async function togglePlay(videoId) {
    const player = document.getElementById(`player-${videoId}`);
    const button = document.querySelector(`[data-video-id="${videoId}"]`);
    const currentAudio = window.currentAudio;
    
    if (currentlyPlaying === videoId && currentAudio) {
        if (currentAudio.paused) {
            await currentAudio.play();
            button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>`;
        } else {
            currentAudio.pause();
            button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>`;
        }
        return;
    }

    // Rest of the existing playSelectedQuality function...
}

// Update the styles for the quality selector grid
const qualitySelectorStyles = document.createElement('style');
qualitySelectorStyles.textContent = `
    .quality-selector {
        margin: 8px 0;
        padding: 8px;
        background: var(--background-secondary);
        border-radius: 8px;
        display: none;
    }

    .quality-options {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    }

    .quality-option {
        padding: 10px;
        border-radius: 6px;
        background: var(--background-primary);
        border: 1px solid var(--border-color);
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
    }

    .quality-name {
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--text-primary);
    }

    .quality-size {
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-top: 4px;
    }

    .quality-option:active {
        background: var(--accent-color);
    }
    
    .quality-option:active .quality-name,
    .quality-option:active .quality-size {
        color: white;
    }

    @media (max-width: 768px) {
        .quality-selector {
            margin: 8px 0;
            padding: 6px;
        }

        .quality-options {
            grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
        }

        .quality-option {
            padding: 8px;
        }

        .quality-name {
            font-size: 0.85rem;
        }

        .quality-size {
            font-size: 0.75rem;
        }
    }
`;
document.head.appendChild(qualitySelectorStyles);