// Default settings
const defaultSettings = {
    voiceCommandsEnabled: true,
    autoDisableMic: true,
    voiceFeedback: true,
    customCommands: [
        { phrase: "clear chat", action: "clearChat" },
        { phrase: "change model", action: "openModelSelector" },
        { phrase: "help", action: "showHelp" }
    ]
};

// Load settings from localStorage or use defaults
let settings = JSON.parse(localStorage.getItem('stormySettings')) || defaultSettings;

// Initialize UI elements
document.addEventListener('DOMContentLoaded', () => {
    // Initialize switches
    document.getElementById('voiceCommandsEnabled').checked = settings.voiceCommandsEnabled;
    document.getElementById('autoDisableMic').checked = settings.autoDisableMic;
    document.getElementById('voiceFeedback').checked = settings.voiceFeedback;

    // Initialize command list
    renderCommandList();

    // Add event listeners
    document.getElementById('voiceCommandsEnabled').addEventListener('change', (e) => {
        settings.voiceCommandsEnabled = e.target.checked;
        saveSettings();
    });

    document.getElementById('autoDisableMic').addEventListener('change', (e) => {
        settings.autoDisableMic = e.target.checked;
        saveSettings();
    });

    document.getElementById('voiceFeedback').addEventListener('change', (e) => {
        settings.voiceFeedback = e.target.checked;
        saveSettings();
    });
});

// Render command list
function renderCommandList() {
    const commandList = document.getElementById('commandList');
    commandList.innerHTML = '';

    settings.customCommands.forEach((command, index) => {
        const commandItem = document.createElement('div');
        commandItem.className = 'command-item';
        commandItem.innerHTML = `
            <input type="text" class="command-phrase" value="${command.phrase}" 
                onchange="updateCommand(${index}, 'phrase', this.value)">
            <input type="text" class="command-action" value="${command.action}"
                onchange="updateCommand(${index}, 'action', this.value)">
            <button onclick="deleteCommand(${index})" style="background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        `;
        commandList.appendChild(commandItem);
    });
}

// Add new command
function addNewCommand() {
    settings.customCommands.push({ phrase: "", action: "" });
    saveSettings();
    renderCommandList();
}

// Update command
function updateCommand(index, field, value) {
    settings.customCommands[index][field] = value;
    saveSettings();
}

// Delete command
function deleteCommand(index) {
    settings.customCommands.splice(index, 1);
    saveSettings();
    renderCommandList();
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('stormySettings', JSON.stringify(settings));
}
