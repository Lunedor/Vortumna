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

            // Re-populate custom model input from storage
            if (window.storage) {
                window.storage.get('openrouterCustomModel').then(result => {
                    if (result.openrouterCustomModel) {
                        const customModelInputField = document.getElementById('openrouterCustomModelInput');
                        if (customModelInputField) {
                            customModelInputField.value = result.openrouterCustomModel;
                        }
                    }
                });
            }
        });
    }

    if (openrouterModelSelect) {
        openrouterModelSelect.addEventListener('change', function() {
            const customModelInput = document.getElementById('openrouterCustomModelInput');
            if (customModelInput) {
                customModelInput.value = ''; // Clear custom input
                // Optional: remove the stored custom model if you want selection to clear persistence
                // if (window.storage) {
                //     window.storage.remove('openrouterCustomModel');
                // }
            }
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
        
        let selectedModel = ''; // Declare selectedModel here
        const customModelInput = document.getElementById('openrouterCustomModelInput');
        const customModelValue = customModelInput ? customModelInput.value.trim() : '';

        if (customModelValue) {
            selectedModel = customModelValue;
            if (window.storage) {
                window.storage.set({ openrouterCustomModel: customModelValue });
            }
        } else {
            // This is the original logic for when custom input is empty
            selectedModel = openrouterModelSelect.value || 'deepseek/deepseek-r1:free';
        }
        
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
                messageContent += "\\n[Image attached but this model doesn't support image input yet]";
            } else if (file.type === 'text/plain' && typeof file.data === 'string') {
                // For text files, add the content directly
                if (messageContent) {
                    // If there's already a message, append the file content
                    messageContent += `\\n\\nContent of ${file.name}:\\n${file.data}`;
                } else {
                    // If no message, use file content as the message
                    messageContent = `Content of ${file.name}:\\n${file.data}`;
                }
            } else if (file.data.startsWith('data:')) {
                // Handle binary file types (not supported by OpenRouter yet)
                messageContent += `\\n[File attached: ${file.name}]`;
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
                let errorMessage = `HTTP error: ${response.status}`;\n                \n                try {\n                    const errorData = JSON.parse(errorText);\n                    if (errorData.error) {\n                        errorMessage = typeof errorData.error === 'string' \n                            ? errorData.error \n                            : (errorData.error.message || JSON.stringify(errorData.error));\n                    }\n                } catch (e) {\n                    // If parsing fails, use the raw text\n                    if (errorText) errorMessage += ` - ${errorText}`;\n                }\n                \n                throw new Error(errorMessage);\n            }\n            \n            const responseData = await response.json();\n            \n            // Store AI response in conversation Cache\n            if (responseData.choices && responseData.choices.length > 0) {\n                const aiMessage = responseData.choices[0].message;\n                if (aiMessage && aiMessage.content) {\n                    conversationCache.push({\n                        role: 'assistant',\n                        content: aiMessage.content\n                    });\n                    return { content: aiMessage.content };\n                }\n            }\n            \n            return { error: \"Invalid response format from OpenRouter API\" };\n        } catch (error) {\n            console.error('API request failed:', error);\n            return { error: error.message || 'Failed to communicate with OpenRouter API' };\n        }\n    }    \n    \n    // Add keyboard shortcut for OpenRouter (Alt+O)\n    document.addEventListener('keydown', function(e) {\n        // Only process if not in an input field or textarea\n        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {\n            return;\n        }\n\n        if (e.key.toLowerCase() === 'o' && e.altKey) { // Alt+O for OpenRouter\n            if (currentApiKey) {\n                e.preventDefault();\n                openrouterChatPanel.classList.add('visible');\n                openrouterInput.focus();\n            }        \n        }\n    });\n\n    // Add event listener for file removal\n    document.addEventListener('click', function(e) {\n        if (e.target.classList.contains('remove-file-btn')) {\n            const fileName = e.target.dataset.fileName;\n            const previewContainer = e.target.closest('.file-preview-container');\n            \n            if (fileName && previewContainer) {\n                // Remove the file from uploadedFiles array\n                const fileIndex = uploadedFiles.findIndex(file => file.name === fileName);\n                if (fileIndex !== -1) {\n                    uploadedFiles.splice(fileIndex, 1);\n                }\n                \n                // Remove the preview from UI\n                previewContainer.remove();\n                \n                // Show feedback\n                AIUtils.showFeedback(`File \"${fileName}\" removed`, true);\n            }\n        }\n    });\n});\n\n// Function to reset OpenRouter components when API key changes\nfunction resetOpenRouterComponents() {\n    // Get necessary DOM elements\n    const openrouterToggleBtn = document.getElementById('openrouterToggleBtn');\n    const openrouterModelSelect = document.getElementById('openrouterModelSelect');\n    const openrouterMessages = document.getElementById('openrouterMessages');\n    \n    // Clear chat Cache\n    if (openrouterMessages) {\n        openrouterMessages.innerHTML = '';\n    }\n    \n    // Check if API key exists\n    window.storage.get('openrouterApiKey').then(result => {\n        const apiKey = result.openrouterApiKey;\n        \n        if (apiKey) {\n            // We have an API key, show chat button\n            if (openrouterToggleBtn) {\n                openrouterToggleBtn.style.display = 'block';\n            }\n            \n            // Ensure the show-openrouter checkbox is enabled\n            const checkbox = document.getElementById('show-openrouter');\n            if (checkbox) checkbox.disabled = false;\n            \n            // Load models (reusing the function from the DOM load event handler)\n            if (typeof loadOpenRouterModels === 'function') {\n                loadOpenRouterModels();\n            }\n        } else {\n            // No API key, hide chat button\n            if (openrouterToggleBtn) {\n                openrouterToggleBtn.style.display = 'none';\n            }\n            \n            // Disable the show-openrouter checkbox\n            const checkbox = document.getElementById('show-openrouter');\n            if (checkbox) checkbox.disabled = true;\n            \n            // Clear model dropdown\n            if (openrouterModelSelect) {\n                openrouterModelSelect.innerHTML = '<option value=\"\">No API key</option>';\n            }\n        }\n    });\n}\n\n// Function to update OpenRouter visibility based on settings\nfunction updateOpenrouterVisibility(isVisible) {\n    const container = document.getElementById('openrouterChatContainer');\n    if (container) {\n        if (window.storage) {\n            window.storage.set({ showOpenRouter: isVisible });\n        } else {\n            // Fallback to localStorage if storage.js is not available\n            localStorage.setItem('showOpenRouter', isVisible);\n        }\n        \n        container.style.display = isVisible ? 'flex' : 'none';\n        \n        // Also update the checkbox in settings if it exists\n        const checkbox = document.getElementById('show-openrouter');\n        if (checkbox) {\n            checkbox.checked = isVisible;\n        }\n    }\n}\n\n// Function to load OpenRouter models (called from settings.js)\nfunction loadOpenRouterModels() {\n    window.storage.get('openrouterApiKey').then(result => {\n        const apiKey = result.openrouterApiKey;\n        if (!apiKey) return;\n        \n        // Get the default models\n        const DEFAULT_MODELS = [\n            { name: 'deepseek/deepseek-r1:free', displayName: 'DeepSeek R1' },\n            { name: 'deepseek/deepseek-chat-v3-0324:free', displayName: 'DeepSeek Chat V3' },\n            { name: 'deepseek/deepseek-r1-distill-llama-70b:free', displayName: 'DeepSeek R1 Distill Llama 70B' },\n            { name: 'deepseek/deepseek-r1-distill-qwen-32b:free', displayName: 'DeepSeek R1 Distill Qwen 32B' },\n            { name: 'nvidia/llama-3.1-nemotron-70b-instruct:free', displayName: 'Llama 3.1 Nemotron 70B' },\n            { name: 'qwen/qwq-32b:free', displayName: 'Qwen 32B' },\n        ];\n        \n        // Populate the model dropdown if it exists\n        const modelSelect = document.getElementById('openrouterModelSelect');\n        if (modelSelect) {\n            window.AIChatComponents.populateModelDropdown(\n                DEFAULT_MODELS, \n                modelSelect, \n                'openrouterSelectedModel', \n                'deepseek/deepseek-r1:free'\n            );\n        }\n    });\n}\n\n// Make functions globally available\nwindow.resetOpenRouterComponents = resetOpenRouterComponents;\nwindow.updateOpenrouterVisibility = updateOpenrouterVisibility;\nwindow.loadOpenRouterModels = loadOpenRouterModels;
