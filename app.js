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

// Add this at the beginning of your JavaScript file, after the DOM Elements section
const toolbarStyles = document.createElement('style');
toolbarStyles.textContent = `
    .toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: var(--background-primary);
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        padding: 0 20px;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .toolbar-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
        color: var(--text-primary);
    }

    .toolbar-logo {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        object-fit: cover;
    }

    .toolbar-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    /* Adjust main content to account for toolbar */
    #chat-container {
        padding-top: 60px !important;
        height: calc(100vh - 60px) !important;
        position: relative;
        overflow-y: auto;
    }

    #chat-messages {
        padding-bottom: 80px;
    }

    .chat-input-container {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--background-primary);
        padding: 1rem;
        border-top: 1px solid var(--border-color);
    }

    @media (max-width: 768px) {
        .toolbar {
            height: 50px;
            padding: 0 16px;
        }

        .toolbar-logo {
            width: 28px;
            height: 28px;
        }

        .toolbar-title {
            font-size: 1.1rem;
        }

        #chat-container {
            padding-top: 50px !important;
            height: calc(100vh - 50px) !important;
        }

        #chat-messages {
            padding-bottom: 70px;
        }

        .chat-input-container {
            padding: 0.75rem;
        }
    }
`;

// Remove any existing toolbar styles
const existingToolbarStyles = document.querySelector('style[data-toolbar-styles]');
if (existingToolbarStyles) {
    existingToolbarStyles.remove();
}

// Add the data attribute to identify the styles
toolbarStyles.setAttribute('data-toolbar-styles', '');
document.head.appendChild(toolbarStyles);

// Create and add the toolbar to the DOM
const toolbar = document.createElement('div');
toolbar.className = 'toolbar';
toolbar.innerHTML = `
    <a href="/" class="toolbar-brand">
        <img src="stormy.jpg" alt="Stormy" class="toolbar-logo">
        <span class="toolbar-title">Stormy</span>
    </a>
`;

// Insert the toolbar at the beginning of the body
document.body.insertBefore(toolbar, document.body.firstChild);

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

// Add the new API endpoint constant
const CLAUDE_SONNET_API_URL = 'https://api.paxsenix.biz.id/ai/claudeSonnet';
const MIXTRAL_API_URL = 'https://api.paxsenix.biz.id/ai/mixtral';
const LLAMA3_API_URL = 'https://api.paxsenix.biz.id/ai/llama3';

// Update the API endpoint constant
const MIDJOURNEY_API_URL = 'https://api.paxsenix.biz.id/ai-image/midjourney';

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
    
    // Add click handler for images
    const images = messageElement.querySelectorAll('img');
    images.forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => {
            const modal = document.querySelector('.image-modal');
            const modalImg = modal.querySelector('.modal-image');
            modalImg.src = img.src;
            modal.classList.add('active');
        });
    });
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Save to history if needed
    if (saveToHistory) {
        chatHistory.push({
            content,
            isUser,
            timestamp: new Date().toISOString()
        });
        
        if (chatHistory.length > MAX_HISTORY) {
            chatHistory = chatHistory.slice(chatHistory.length - MAX_HISTORY);
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
        const args = commandMatch[2] ? commandMatch[2].trim() : '';

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
            
            // Only include conversation history for Gemini Flash
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
        } else if (currentModel === 'claude_sonnet' || currentModel === 'mixtral' || currentModel === 'llama3') {
            // Claude Sonnet, Mixtral, and Llama3 implementation (they use the same format)
            apiUrl = currentModel === 'claude_sonnet' ? `${CLAUDE_SONNET_API_URL}?text=${encodeURIComponent(message)}` :
                    currentModel === 'mixtral' ? `${MIXTRAL_API_URL}?text=${encodeURIComponent(message)}` :
                    `${LLAMA3_API_URL}?text=${encodeURIComponent(message)}`;
            
            options = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        } else {
            // For Pax Senix models, just send the current message without history
            apiUrl = currentModel === 'gpt4o' ? `${GPT4O_API_URL}?text=${encodeURIComponent(message)}` :
                    currentModel === 'gpt4omini' ? `${GPT4O_MINI_API_URL}?text=${encodeURIComponent(message)}` :
                    `${GEMINI_REALTIME_API_URL}?text=${encodeURIComponent(message)}`;
            
            options = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }

        // Update lastRequestTime for non-Gemini models
        if (currentModel !== 'gemini_flash') {
            const now = Date.now();
            const timeSinceLastRequest = now - lastRequestTime;
            
            if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
                throw new Error(`Please wait ${Math.ceil((RATE_LIMIT_DELAY - timeSinceLastRequest) / 1000)} seconds before sending another message.`);
            }
            
            lastRequestTime = now;
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
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="loading-icon">
            <circle class="loading-circle" cx="12" cy="12" r="3"/>
            <path class="loading-wave" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10">
                <animate attributeName="d" 
                    dur="1.5s" 
                    repeatCount="indefinite" 
                    values="
                        M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10;
                        M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10;
                        M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10"
                />
            </path>
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

// Add these styles for the loading animation
const loadingStyles = document.createElement('style');
loadingStyles.textContent = `
    .loading-icon {
        transform-origin: center;
        animation: pulse 1s ease-in-out infinite;
    }

    .loading-circle {
        fill: var(--accent-color);
        animation: bounce 1s ease-in-out infinite;
    }

    .loading-wave {
        stroke: currentColor;
        stroke-linecap: round;
        opacity: 0.5;
        animation: wave 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(0.95); }
    }

    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
    }

    @keyframes wave {
        0% { 
            transform: rotate(0deg);
            opacity: 0.3;
        }
        50% { 
            transform: rotate(180deg);
            opacity: 0.6;
        }
        100% { 
            transform: rotate(360deg);
            opacity: 0.3;
        }
    }

    .play-button svg {
        transition: transform 0.2s ease;
    }

    .play-button:active svg {
        transform: scale(0.9);
    }

    /* Update loading overlay animation */
    .loading-spinner {
        width: 50px;
        height: 50px;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .loading-spinner:before,
    .loading-spinner:after {
        content: '';
        position: absolute;
        border-radius: 50%;
        animation: ripple 1.5s ease-in-out infinite;
    }

    .loading-spinner:before {
        width: 30px;
        height: 30px;
        background: var(--accent-color);
        animation-delay: 0s;
    }

    .loading-spinner:after {
        width: 20px;
        height: 20px;
        background: white;
        animation-delay: 0.3s;
    }

    @keyframes ripple {
        0% {
            transform: scale(0.5);
            opacity: 1;
        }
        50% {
            transform: scale(1.2);
            opacity: 0.5;
        }
        100% {
            transform: scale(0.5);
            opacity: 1;
        }
    }
`;
document.head.appendChild(loadingStyles);

// Also update the loading overlay animation
const loadingOverlayStyles = document.createElement('style');
loadingOverlayStyles.textContent = `
    #loadingOverlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        position: relative;
    }

    .loading-spinner:before {
        content: '';
        box-sizing: border-box;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: #fff;
        border-radius: 50%;
        animation: loading-spin 0.8s ease-in-out infinite;
    }

    @keyframes loading-spin {
        to {
            transform: rotate(360deg);
        }
    }
`;
document.head.appendChild(loadingOverlayStyles);

// Add styles for the generated images
const imageStyles = document.createElement('style');
imageStyles.textContent = `
    .bot-message img {
        max-width: 100%;
        border-radius: 8px;
        margin: 10px 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    @media (max-width: 768px) {
        .bot-message img {
            border-radius: 6px;
            margin: 8px 0;
        }
    }
`;
document.head.appendChild(imageStyles);

// Add style options constant
const MIDJOURNEY_STYLES = [
    "single-portrait",
    "anime",
    "watercolor",
    "photo-realistic",
    "logo",
    "fantasy",
    "minimalist",
    "cinematic",
    "isometric",
    "group-portrait"
];

// Update the handleImagineCommand function
async function handleImagineCommand(prompt) {
    try {
        // Create style selector message
        const styleMessage = `Select a style for your image:
${MIDJOURNEY_STYLES.map((style, index) => `${index + 1}. ${style}`).join('\n')}`;
        
        appendMessage(styleMessage, false);

        // Create style selector UI
        const styleSelector = document.createElement('div');
        styleSelector.className = 'style-selector';
        styleSelector.innerHTML = MIDJOURNEY_STYLES.map(style => `
            <button class="style-option" data-style="${style}">
                ${style}
            </button>
        `).join('');

        // Add style selector to the last message
        const lastMessage = document.querySelector('.bot-message:last-child');
        lastMessage.appendChild(styleSelector);

        // Wait for style selection
        const selectedStyle = await new Promise(resolve => {
            styleSelector.addEventListener('click', (e) => {
                const button = e.target.closest('.style-option');
                if (button) {
                    styleSelector.remove();
                    resolve(button.dataset.style);
                }
            });
        });

        appendMessage(`Generating ${selectedStyle} image for: "${prompt}"`, false);
        
        // Show loading only after style is selected and before API call
        showLoading();
        
        const response = await fetch(`${MIDJOURNEY_API_URL}?text=${encodeURIComponent(prompt)}&style=${selectedStyle}`);
        
        if (!response.ok) {
            throw new Error(`Image generation failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.ok && data.task_url) {
            appendMessage(`Image generation started. Please wait...`, false);
            
            // Poll the task URL until the image is ready
            let attempts = 0;
            const maxAttempts = 30;
            
            while (attempts < maxAttempts) {
                const taskResponse = await fetch(data.task_url);
                const taskData = await taskResponse.json();
                
                console.log('Task status:', taskData); // For debugging
                
                if (taskData.ok) {
                    if (taskData.status === 'done' && taskData.url) {
                        const imageMessage = `Generated ${selectedStyle} image for: "${prompt}"

![Generated Image](${taskData.url})`;
                        appendMessage(imageMessage, false);
                        return; // Success! Exit the function
                    } else if (taskData.status === 'pending' || !taskData.status) {
                        // Still processing or status not available yet
                        await new Promise(resolve => setTimeout(resolve, 10000));
                        attempts++;
                        continue;
                    }
                }
                
                // If we get here, something went wrong
                await new Promise(resolve => setTimeout(resolve, 10000));
                attempts++;
            }
            
            if (attempts >= maxAttempts) {
                throw new Error('Image generation timed out. Please try again.');
            }
        } else {
            throw new Error(data.message || 'Failed to start image generation');
        }
    } catch (error) {
        console.error('Image generation error:', error);
        appendMessage(`Error generating image: ${error.message}`, false);
    } finally {
        hideLoading();
    }
}

// Add styles for the style selector
const styleSelectorStyles = document.createElement('style');
styleSelectorStyles.textContent = `
    .style-selector {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 8px;
        margin: 10px 0;
    }

    .style-option {
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        background: var(--background-primary);
        color: var(--text-primary);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
        text-transform: capitalize;
    }

    .style-option:hover {
        background: var(--accent-color);
        color: white;
        border-color: var(--accent-color);
    }

    .style-option:active {
        transform: scale(0.98);
    }

    @media (max-width: 768px) {
        .style-selector {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        }

        .style-option {
            padding: 6px 10px;
            font-size: 0.85rem;
        }
    }
`;
document.head.appendChild(styleSelectorStyles);

// Add this after your existing styles
const imageModalStyles = document.createElement('style');
imageModalStyles.textContent = `
    .image-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        z-index: 2000;
        padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
        box-sizing: border-box;
        -webkit-backdrop-filter: blur(5px);
        backdrop-filter: blur(5px);
        overscroll-behavior: contain;
        touch-action: none;
    }

    .image-modal.active {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .modal-image {
        max-width: 90%;
        max-height: 80vh;
        object-fit: contain;
        border-radius: 8px;
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
    }

    .modal-controls {
        display: flex;
        gap: 10px;
        margin-top: 15px;
    }

    .modal-button {
        -webkit-appearance: none;
        appearance: none;
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        background: var(--accent-color);
        color: white;
        cursor: pointer;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        touch-action: manipulation;
    }

    /* Add iOS-specific touch feedback */
    @supports (-webkit-touch-callout: none) {
        .modal-button:active {
            opacity: 0.7;
        }
    }
`;
document.head.appendChild(imageModalStyles);

// Add modal HTML to the body
const modalHTML = `
<div class="image-modal">
    <button class="modal-close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    </button>
    <img class="modal-image" src="" alt="Full size image">
    <div class="modal-controls">
        <button class="modal-button download-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download
        </button>
        <button class="modal-button share-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            Share
        </button>
    </div>
</div>`;

document.body.insertAdjacentHTML('beforeend', modalHTML);

// Add modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.querySelector('.image-modal');
    const closeBtn = modal.querySelector('.modal-close');
    const downloadBtn = modal.querySelector('.download-btn');
    const shareBtn = modal.querySelector('.share-btn');
    
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    downloadBtn.addEventListener('click', async () => {
        const img = modal.querySelector('.modal-image');
        try {
            // For iOS Safari, open image in new tab
            if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
                window.open(img.src, '_blank');
                return;
            }

            // For other browsers, try download
            try {
                const response = await fetch(img.src);
                const blob = await response.blob();
                
                // Check if iOS
                if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                    // Create object URL and open in new tab
                    const url = window.URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => window.URL.revokeObjectURL(url), 100);
                } else {
                    // Normal download for other browsers
                    downloadBlob(blob, 'generated-image.png');
                }
            } catch (error) {
                // Fallback to direct link
                window.open(img.src, '_blank');
            }
        } catch (error) {
            console.error('Download failed:', error);
            alert('Please long press the image and choose "Save Image" to download.');
        }
    });
    
    shareBtn.addEventListener('click', async () => {
        const img = modal.querySelector('.modal-image');
        try {
            // Try native share first (works well on iOS)
            if (navigator.share) {
                await navigator.share({
                    title: 'Generated Image',
                    text: 'Check out this AI-generated image!',
                    url: img.src
                });
            } else if (navigator.clipboard) {
                // Fallback to clipboard
                await navigator.clipboard.writeText(img.src);
                alert('Image URL copied to clipboard!');
            } else {
                // Final fallback
                const textArea = document.createElement('textarea');
                textArea.value = img.src;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Image URL copied to clipboard!');
            }
        } catch (error) {
            console.error('Share failed:', error);
            alert('Please long press the image to share.');
        }
    });
});

// Add helper function for blob download
function downloadBlob(blob, fileName) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}

// Add iOS-specific meta tags to index.html
document.head.insertAdjacentHTML('beforeend', `
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
`);

// Add iOS scroll bounce fix
document.body.style.overscrollBehavior = 'none';
chatMessages.style.overscrollBehavior = 'contain';

// Add these constants at the top of your file
const SPEECH_RECOGNITION = window.SpeechRecognition || window.webkitSpeechRecognition;
const hasSpeechRecognition = !!SPEECH_RECOGNITION;

// Update the chat input container styles
const micStyles = document.createElement('style');
micStyles.textContent = `
    .chat-input-container {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 12px 16px;
        background: var(--background-primary);
        border-top: 1px solid var(--border-color);
        position: fixed;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 90%;
        max-width: 800px;
        margin: 0 auto;
    }

    .chat-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        flex: 1;
        background: var(--background-secondary);
        border-radius: 24px;
        padding: 6px;
        border: 1px solid var(--border-color);
        min-height: 48px;
    }

    .mic-button {
        width: 36px;
        height: 36px;
        padding: 0;
        background: transparent;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        flex-shrink: 0;
    }

    .mic-button svg {
        width: 20px;
        height: 20px;
    }

    #chat-input {
        flex: 1;
        border: none;
        background: transparent;
        color: var(--text-primary);
        font-size: 0.95rem;
        line-height: 24px;
        padding: 6px 8px;
        margin: 0;
        min-height: 24px;
        max-height: 150px;
        resize: none;
        outline: none;
        align-self: center;
    }

    #send-button {
        width: 36px;
        height: 36px;
        min-width: 36px;
        min-height: 36px;
        padding: 0;
        margin: 0;
        background: var(--accent-color);
        border: none;
        border-radius: 50%;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    #send-button svg {
        width: 20px;
        height: 20px;
        margin-left: 2px;
    }

    @media (max-width: 768px) {
        .chat-input-container {
            width: 95%;
            padding: 8px 0;
        }

        .chat-input-wrapper {
            min-height: 44px;
            padding: 4px;
        }

        #chat-input {
            font-size: 0.9rem;
            line-height: 22px;
            padding: 5px 8px;
        }

        .mic-button, #send-button {
            width: 34px;
            height: 34px;
            min-width: 34px;
            min-height: 34px;
        }

        .mic-button svg, #send-button svg {
            width: 18px;
            height: 18px;
        }
    }
`;

// Remove any existing mic styles
const existingMicStyles = document.querySelector('style[data-mic-styles]');
if (existingMicStyles) {
    existingMicStyles.remove();
}

// Add the data attribute to identify the styles
micStyles.setAttribute('data-mic-styles', '');
document.head.appendChild(micStyles);

// Wrap the chat input in a container
const chatInputContainer = chatInput.parentElement;
const inputWrapper = document.createElement('div');
inputWrapper.className = 'chat-input-wrapper';
chatInputContainer.insertBefore(inputWrapper, chatInput);
inputWrapper.appendChild(chatInput);

// Add microphone button
const micButton = document.createElement('button');
micButton.className = `mic-button ${!hasSpeechRecognition ? 'hidden' : ''}`;
micButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
`;
inputWrapper.insertBefore(micButton, chatInput);

// Initialize speech recognition if available
let recognition = null;
if (hasSpeechRecognition) {
    recognition = new SPEECH_RECOGNITION();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US'; // You can make this configurable

    recognition.onstart = () => {
        micButton.classList.add('recording');
    };

    recognition.onend = () => {
        micButton.classList.remove('recording');
    };

    recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
        
        chatInput.value = transcript;
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        micButton.classList.remove('recording');
        if (event.error === 'not-allowed') {
            alert('Please enable microphone access to use speech-to-text.');
        }
    };

    // Handle mic button click
    micButton.addEventListener('click', () => {
        if (micButton.classList.contains('recording')) {
            recognition.stop();
        } else {
            chatInput.value = '';
            recognition.start();
        }
    });
}