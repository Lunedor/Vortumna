// OpenRouter chat functionality
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const openrouterChatContainer = document.getElementById('openrouterChatContainer');
    const openrouterToggleBtn = document.getElementById('openrouterToggleBtn');
    const openrouterChatPanel = document.getElementById('openrouterChatPanel');
    const openrouterModelSelect = document.getElementById('openrouterModelSelect');
    const openrouterInput = document.getElementById('openrouterInput');
    const openrouterSendBtn = document.getElementById('openrouterSendBtn');
    const closeOpenrouterBtn = document.querySelector('.close-openrouter');
    const cleanOpenrouterBtn = document.querySelector('.clean-openrouter-chat');
    const imageUpload = document.getElementById('openrouterImageUpload');
    const docUpload = document.getElementById('openrouterDocUpload');
    const openrouterSearchBtn = document.getElementById('openrouterSearchBtn');
    
    // Reference to shared component utilities
    const AIUtils = window.AIChatComponents;
    
    // State
    let currentApiKey = '';
    let uploadedFiles = []; // Array to store file references
    let modelsLoaded = false;
    let typingIndicator = null;
    let lastRequestTime = 0;
    let conversationCache = []; // Store conversation Cache
    let isSearchMode = false; // Flag for search mode
    
    // Site information for OpenRouter API
    const SITE_URL = window.location.origin || "chrome-extension://vortumna";
    const SITE_NAME = "Vortumna";
    
    // Default models
    const DEFAULT_MODELS = [
        { name: 'deepseek/deepseek-r1:free', displayName: 'DeepSeek R1' },
        { name: 'deepseek/deepseek-chat-v3-0324:free', displayName: 'DeepSeek Chat V3' },
        { name: 'deepseek/deepseek-r1-distill-llama-70b:free', displayName: 'DeepSeek R1 Distill Llama 70B' },
        { name: 'deepseek/deepseek-r1-distill-qwen-32b:free', displayName: 'DeepSeek R1 Distill Qwen 32B' },
        { name: 'nvidia/llama-3.1-nemotron-70b-instruct:free', displayName: 'Llama 3.1 Nemotron 70B' },
        { name: 'nvidia/llama-3.3-nemotron-super-49b-v1:free', displayName:'Llama 3.3 Nemotron Super 49B V1' },
        { name: 'meta-llama/llama-4-maverick:free', displayName: 'Llama 4 Maverick' },
        { name: 'meta-llama/llama-4-scout:free', displayName: 'Llama 4 Scout' },
        { name: 'qwen/qwq-32b:free', displayName: 'Qwen 32B' },
    ];
    
    // Model caching constants
    const SELECTED_MODEL_KEY = 'openrouterSelectedModel';
    
    // Initialize visibility
    AIUtils.initializeVisibility('showOpenRouter', 'openrouterChatContainer');
    
    // Load API key from storage on startup
    if (window.storage) {
        window.storage.get('openrouterApiKey').then(result => {
            currentApiKey = result.openrouterApiKey || '';
            
            // Initialize API key field and button text using shared utility
            AIUtils.setupAPIKeyHandling(
                currentApiKey,
                document.getElementById('openrouter-api-key'), 
                document.getElementById('save-openrouter-key'),
                openrouterToggleBtn,
                'show-openrouter',
                () => {
                    // If we have an API key, load models
                    loadModels();
                },
                null // No onForget callback needed
            );
        });
    }
    
    // Add clean conversation button functionality
    cleanOpenrouterBtn.addEventListener('click', function() {
        AIUtils.cleanConversation('openrouterMessages', uploadedFiles, conversationCache);
    });  
    
    // Toggle chat panel visibility
    openrouterToggleBtn.addEventListener('click', function() {
        openrouterChatPanel.classList.toggle('visible');
        if (openrouterChatPanel.classList.contains('visible') && currentApiKey) {
            openrouterInput.focus();
        }
    });
    
    // Close chat panel
    closeOpenrouterBtn.addEventListener('click', function() {
        openrouterChatPanel.classList.remove('visible');
    });
    
    // Save/Forget API key
    document.getElementById('save-openrouter-key').addEventListener('click', function() {
        const apiKeyInput = document.getElementById('openrouter-api-key');
        
        if (currentApiKey) {
            // Forget mode
            if (window.storage) {
                window.storage.remove('openrouterApiKey').then(() => {
                    currentApiKey = '';
                    
                    // Update UI elements
                    AIUtils.setupAPIKeyHandling(
                        currentApiKey,
                        apiKeyInput,
                        this,
                        openrouterToggleBtn,
                        'show-openrouter'
                    );
                    
                    AIUtils.showFeedback("API key removed successfully", true);
                });
            }
        } else {
            // Save mode
            const newApiKey = apiKeyInput.value.trim();
            if (newApiKey) {
                if (window.storage) {
                    window.storage.set({ openrouterApiKey: newApiKey }).then(() => {
                        currentApiKey = newApiKey;
                        
                        // Update UI elements
                        AIUtils.setupAPIKeyHandling(
                            currentApiKey,
                            apiKeyInput,
                            this,
                            openrouterToggleBtn,
                            'show-openrouter',
                            loadModels
                        );
                        
                        AIUtils.showFeedback("API key saved successfully", true);
                    });
                }
            } else {
                AIUtils.showFeedback("Please enter a valid API key", false);
            }
        }
    });
    
    // Handle image upload
    imageUpload.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
            AIUtils.handleFileUploads(e.target.files, 'image', uploadedFiles, '.openrouter-actions');
        }
    });
    
    // Handle document upload
    docUpload.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
            AIUtils.handleFileUploads(e.target.files, 'document', uploadedFiles, '.openrouter-actions');
        }
    });
    
    // File drop zone functionality
    AIUtils.addDropZoneSupport('.openrouter-input-container', uploadedFiles, '.openrouter-actions');
    
    // Add search button functionality
    openrouterSearchBtn.addEventListener('click', function() {
        isSearchMode = AIUtils.toggleSearchMode(
            isSearchMode, 
            openrouterSearchBtn, 
            openrouterInput, 
            openrouterSendBtn
        );
    });

    
    openrouterInput.addEventListener("input", function() {
        this.style.height = "50px";
        this.style.width = "600px";
        this.style.borderRadius = "10px";
      });
  
      openrouterInput.addEventListener("blur", function() {
          this.style.height = "20px";
          this.style.width = "370px";
          this.style.borderRadius = "30px";
      });
    
    // Send message
    openrouterSendBtn.addEventListener('click', sendMessage);
    
    openrouterInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Load available models from default or API
    function loadModels() {
        if (!currentApiKey) return;

        // For OpenRouter, we'll use hardcoded models for now
        // In the future, we could fetch models from their API if they provide such an endpoint
        AIUtils.populateModelDropdown(
            DEFAULT_MODELS, 
            openrouterModelSelect, 
            SELECTED_MODEL_KEY, 
            'deepseek/deepseek-r1:free'
        );
        modelsLoaded = true;
    }
    
    // Send message to OpenRouter
    async function sendMessage() {
        const userMessage = openrouterInput.value.trim();
        
        if (!userMessage && uploadedFiles.length === 0) {
            return; // Don't send empty messages without any files
        }
        
        if (!currentApiKey) {
            AIUtils.showFeedback("Please enter your OpenRouter API key in settings", false);
            return;
        }
        
        const selectedModel = openrouterModelSelect.value || 'deepseek/deepseek-r1:free';
        
        // Add user message to chat
        if (userMessage) {
            if (isSearchMode) {
                AIUtils.addMessageToChat('user', `🔍 Search: ${userMessage}`, 'openrouterMessages');
            } else {
                AIUtils.addMessageToChat('user', userMessage, 'openrouterMessages');
            }
        }
        
        // Add file previews to chat
        if (uploadedFiles.length > 0) {
            // For images, add them to the chat
            const imagesToDisplay = uploadedFiles.filter(file => file.fileType === 'image');
            imagesToDisplay.forEach(file => {
                AIUtils.addImageToChat('user', file.data, 'openrouterMessages', 'openrouter');
            });
            
            // For documents, just mention them
            const documentsToMention = uploadedFiles.filter(file => file.fileType === 'document');
            if (documentsToMention.length > 0) {
                const docNames = documentsToMention.map(doc => doc.name).join(', ');
                AIUtils.addMessageToChat('user', `<em>Files attached: ${docNames}</em>`, 'openrouterMessages');
            }
            
            // Remove the previews
            const existingPreviews = document.querySelectorAll('.file-preview-container');
            existingPreviews.forEach(preview => preview.remove());
        }
        
        // Clear input
        openrouterInput.value = '';
        
        // Show typing indicator
        typingIndicator = AIUtils.showTypingIndicator('openrouterMessages');
        
        // Respect rate limit
        const now = Date.now();
        const timeElapsed = now - lastRequestTime;
        if (timeElapsed < AIUtils.constants.RATE_LIMIT_DELAY) {
            await new Promise(resolve => setTimeout(resolve, AIUtils.constants.RATE_LIMIT_DELAY - timeElapsed));
        }
        
        try {
            let response;
            
            if (isSearchMode) {
                // Call search function with OpenRouter
                response = await chatWithOpenRouter(selectedModel, "Search the web for: " + userMessage, uploadedFiles);
                // Automatically exit search mode after performing a search
                isSearchMode = false;
                openrouterSearchBtn.classList.remove('search-mode-active');
                openrouterInput.placeholder = "Ask OpenRouter something...";
                openrouterSendBtn.textContent = "Send";
            } else {
                // Regular chat with model
                response = await chatWithOpenRouter(selectedModel, userMessage, uploadedFiles);
            }
            
            // Hide typing indicator
            typingIndicator = AIUtils.hideTypingIndicator(typingIndicator);
            
            // Process and display response
            if (response.content) {
                AIUtils.addMessageToChat('ai', response.content, 'openrouterMessages');
            } else if (response.error) {
                AIUtils.showFeedback(`Error: ${response.error}`, false);
            } else {
                AIUtils.addMessageToChat('ai', "No response received. Try rephrasing your question.", 'openrouterMessages');
            }
            
            // Reset uploaded files
            uploadedFiles = [];
            
        } catch (error) {
            typingIndicator = AIUtils.hideTypingIndicator(typingIndicator);
            console.error('Error chatting with OpenRouter:', error);
            AIUtils.showFeedback(`Error: ${error.message}`, false);
        }
        
        // Update last request time
        lastRequestTime = Date.now();
    }
    
    // Call the OpenRouter API with the user message and files
    async function chatWithOpenRouter(modelName, userMessage, files = []) {
        // OpenRouter API endpoint
        const url = 'https://openrouter.ai/api/v1/chat/completions';
        
        // Prepare the message content
        let messageContent = userMessage || '';
        
        // Process and add files
        for (const file of files) {
            if (file.fileType === 'image') {
                // Currently OpenRouter doesn't support image upload via API
                // This placeholder would need to be updated when OpenRouter adds support
                messageContent += "\n[Image attached but this model doesn't support image input yet]";
            } else if (file.type === 'text/plain' && typeof file.data === 'string') {
                // For text files, add the content directly
                if (messageContent) {
                    // If there's already a message, append the file content
                    messageContent += `\n\nContent of ${file.name}:\n${file.data}`;
                } else {
                    // If no message, use file content as the message
                    messageContent = `Content of ${file.name}:\n${file.data}`;
                }
            } else if (file.data.startsWith('data:')) {
                // Handle binary file types (not supported by OpenRouter yet)
                messageContent += `\n[File attached: ${file.name}]`;
            }
        }
        
        // Add the current message to conversation Cache
        conversationCache.push({
            role: 'user',
            content: messageContent
        });
        
        // Prepare the payload with full conversation Cache
        const payload = {
            model: modelName,
            messages: conversationCache
        };
        
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${currentApiKey}`,
                    "HTTP-Referer": SITE_URL, // Optional. Site URL for rankings on openrouter.ai
                    "X-Title": SITE_NAME // Optional. Site title for rankings on openrouter.ai
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP error: ${response.status}`;
                
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.error) {
                        errorMessage = typeof errorData.error === 'string' 
                            ? errorData.error 
                            : (errorData.error.message || JSON.stringify(errorData.error));
                    }
                } catch (e) {
                    // If parsing fails, use the raw text
                    if (errorText) errorMessage += ` - ${errorText}`;
                }
                
                throw new Error(errorMessage);
            }
            
            const responseData = await response.json();
            
            // Store AI response in conversation Cache
            if (responseData.choices && responseData.choices.length > 0) {
                const aiMessage = responseData.choices[0].message;
                if (aiMessage && aiMessage.content) {
                    conversationCache.push({
                        role: 'assistant',
                        content: aiMessage.content
                    });
                    return { content: aiMessage.content };
                }
            }
            
            return { error: "Invalid response format from OpenRouter API" };
        } catch (error) {
            console.error('API request failed:', error);
            return { error: error.message || 'Failed to communicate with OpenRouter API' };
        }
    }    
    
    // Add keyboard shortcut for OpenRouter (Alt+O)
    document.addEventListener('keydown', function(e) {
        // Only process if not in an input field or textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key.toLowerCase() === 'o' && e.altKey) { // Alt+O for OpenRouter
            if (currentApiKey) {
                e.preventDefault();
                openrouterChatPanel.classList.add('visible');
                openrouterInput.focus();
            }        
        }
    });

    // Add event listener for file removal
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-file-btn')) {
            const fileName = e.target.dataset.fileName;
            const previewContainer = e.target.closest('.file-preview-container');
            
            if (fileName && previewContainer) {
                // Remove the file from uploadedFiles array
                const fileIndex = uploadedFiles.findIndex(file => file.name === fileName);
                if (fileIndex !== -1) {
                    uploadedFiles.splice(fileIndex, 1);
                }
                
                // Remove the preview from UI
                previewContainer.remove();
                
                // Show feedback
                AIUtils.showFeedback(`File "${fileName}" removed`, true);
            }
        }
    });
});

// Function to reset OpenRouter components when API key changes
function resetOpenRouterComponents() {
    // Get necessary DOM elements
    const openrouterToggleBtn = document.getElementById('openrouterToggleBtn');
    const openrouterModelSelect = document.getElementById('openrouterModelSelect');
    const openrouterMessages = document.getElementById('openrouterMessages');
    
    // Clear chat Cache
    if (openrouterMessages) {
        openrouterMessages.innerHTML = '';
    }
    
    // Check if API key exists
    window.storage.get('openrouterApiKey').then(result => {
        const apiKey = result.openrouterApiKey;
        
        if (apiKey) {
            // We have an API key, show chat button
            if (openrouterToggleBtn) {
                openrouterToggleBtn.style.display = 'block';
            }
            
            // Ensure the show-openrouter checkbox is enabled
            const checkbox = document.getElementById('show-openrouter');
            if (checkbox) checkbox.disabled = false;
            
            // Load models (reusing the function from the DOM load event handler)
            if (typeof loadOpenRouterModels === 'function') {
                loadOpenRouterModels();
            }
        } else {
            // No API key, hide chat button
            if (openrouterToggleBtn) {
                openrouterToggleBtn.style.display = 'none';
            }
            
            // Disable the show-openrouter checkbox
            const checkbox = document.getElementById('show-openrouter');
            if (checkbox) checkbox.disabled = true;
            
            // Clear model dropdown
            if (openrouterModelSelect) {
                openrouterModelSelect.innerHTML = '<option value="">No API key</option>';
            }
        }
    });
}

// Function to update OpenRouter visibility based on settings
function updateOpenrouterVisibility(isVisible) {
    const container = document.getElementById('openrouterChatContainer');
    if (container) {
        if (window.storage) {
            window.storage.set({ showOpenRouter: isVisible });
        } else {
            // Fallback to localStorage if storage.js is not available
            localStorage.setItem('showOpenRouter', isVisible);
        }
        
        container.style.display = isVisible ? 'flex' : 'none';
        
        // Also update the checkbox in settings if it exists
        const checkbox = document.getElementById('show-openrouter');
        if (checkbox) {
            checkbox.checked = isVisible;
        }
    }
}

// Function to load OpenRouter models (called from settings.js)
function loadOpenRouterModels() {
    window.storage.get('openrouterApiKey').then(result => {
        const apiKey = result.openrouterApiKey;
        if (!apiKey) return;
        
        // Get the default models
        const DEFAULT_MODELS = [
            { name: 'deepseek/deepseek-r1:free', displayName: 'DeepSeek R1' },
            { name: 'deepseek/deepseek-chat-v3-0324:free', displayName: 'DeepSeek Chat V3' },
            { name: 'deepseek/deepseek-r1-distill-llama-70b:free', displayName: 'DeepSeek R1 Distill Llama 70B' },
            { name: 'deepseek/deepseek-r1-distill-qwen-32b:free', displayName: 'DeepSeek R1 Distill Qwen 32B' },
            { name: 'nvidia/llama-3.1-nemotron-70b-instruct:free', displayName: 'Llama 3.1 Nemotron 70B' },
            { name: 'qwen/qwq-32b:free', displayName: 'Qwen 32B' },
        ];
        
        // Populate the model dropdown if it exists
        const modelSelect = document.getElementById('openrouterModelSelect');
        if (modelSelect) {
            window.AIChatComponents.populateModelDropdown(
                DEFAULT_MODELS, 
                modelSelect, 
                'openrouterSelectedModel', 
                'deepseek/deepseek-r1:free'
            );
        }
    });
}

// Make functions globally available
window.resetOpenRouterComponents = resetOpenRouterComponents;
window.updateOpenrouterVisibility = updateOpenrouterVisibility;
window.loadOpenRouterModels = loadOpenRouterModels;