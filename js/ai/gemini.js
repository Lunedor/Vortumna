// Gemini chat functionality
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const geminiToggleBtn = document.getElementById('geminiToggleBtn');
    const geminiChatPanel = document.getElementById('geminiChatPanel');
    const geminiModelSelect = document.getElementById('geminiModelSelect');
    const geminiInput = document.getElementById('geminiInput');
    const geminiSendBtn = document.getElementById('geminiSendBtn');
    const geminiMessages = document.getElementById('geminiMessages');
    const closeGeminiBtn = document.querySelector('.close-gemini');
    const cleanGeminiBtn = document.querySelector('.clean-gemini-chat');
    const imageUpload = document.getElementById('geminiImageUpload');
    const docUpload = document.getElementById('geminiDocUpload');
    const generateImageBtn = document.getElementById('geminiGenerateImageBtn');
    const geminiSearchBtn = document.getElementById('geminiSearchBtn');
    
    // Reference to shared component utilities
    const AIUtils = window.AIChatComponents;
    
    // State
    let uploadedFiles = []; // Array to store multiple file references
    let modelsLoaded = false;
    let typingIndicator = null;
    let lastRequestTime = 0;
    let conversationCache = []; // Store conversation Cache
    let isSearchMode = false; // Flag for search mode
    let isGeneratingImage = false; // Flag for image generation mode
    
    // Models that support image generation
    const IMAGE_GENERATION_MODELS = ['models/gemini-2.0-flash-exp-image-generation'];
    
    // Model caching constants
    const MODEL_CACHE_KEY = 'geminiModelCache';
    const MODEL_CACHE_TIMESTAMP_KEY = 'geminiModelCacheTimestamp';
    const SELECTED_MODEL_KEY = 'geminiSelectedModel';    // Function to check if the selected model supports image generation
    function checkImageGenerationCompatibility() {
        if (!generateImageBtn) return;
        
        console.log("Checking image compatibility for model:", geminiModelSelect.value);
        
        // Check if the selected model is in the IMAGE_GENERATION_MODELS list
        // or if the model name contains "IMAGE" or "image"
        const isInList = IMAGE_GENERATION_MODELS.includes(geminiModelSelect.value);
        const hasImageInName = typeof geminiModelSelect.value === 'string' && 
                              geminiModelSelect.value.toLowerCase().includes("image");
        const isCompatible = isInList || hasImageInName;
        
        console.log("Is in list:", isInList);
        console.log("Has 'image' in name:", hasImageInName);
        console.log("Is compatible:", isCompatible);
            
        // Show/hide the button based on compatibility
        if (isCompatible) {
            console.log("Setting button display to 'block'");
            generateImageBtn.style.display = 'block';
            generateImageBtn.style.visibility = 'visible';
            generateImageBtn.style.opacity = '1';
        } else {
            // Hide button and exit image generation mode if active
            console.log("Setting button display to 'none'");
            generateImageBtn.style.display = 'none';
            if (isGeneratingImage) {
                toggleImageGenerationMode(); // Exit image generation mode
            }
        }
    }
    
    // Add direct event listener to model dropdown to check compatibility when model changes
    if (geminiModelSelect) {
        geminiModelSelect.addEventListener('change', function() {
            // Check compatibility immediately when model changes
            checkImageGenerationCompatibility();
        });
    }
    
    // Initialize visibility from storage
    AIUtils.initializeVisibility('showGemini', 'geminiChatContainer');

    // Get the API key and check if we need to update the chat button visibility
    window.storage.get('geminiApiKey').then(result => {
        const apiKey = result.geminiApiKey || '';
        AIUtils.setupAPIKeyHandling(
            apiKey,
            document.getElementById('gemini-api-key'), 
            document.getElementById('save-gemini-key'),
            geminiToggleBtn,
            'show-gemini',
            () => {
                // Show chat button and fetch models when API key exists
                if (geminiToggleBtn) {
                    geminiToggleBtn.addEventListener('click', fetchModelsIfNeeded);
                }
                fetchModelsIfNeeded();
                
                // Update the greeting setting UI when API key is saved
                if (typeof window.updateGeminiSettingsStateBasedOnApiKey === 'function') {
                    window.updateGeminiSettingsStateBasedOnApiKey(apiKey);
                }
            },
            () => {
                // Update the greeting setting UI when API key is forgotten
                if (typeof window.updateGeminiSettingsStateBasedOnApiKey === 'function') {
                    window.updateGeminiSettingsStateBasedOnApiKey(null);
                }
            }
        );
    });
      // Add clean conversation button functionality
    if (cleanGeminiBtn) {
        cleanGeminiBtn.addEventListener('click', function() {
            AIUtils.cleanConversation('geminiMessages', uploadedFiles, conversationCache);
            
            // Reset file input elements so they can be used again
            if (imageUpload) imageUpload.value = '';
            if (docUpload) docUpload.value = '';
        });
    }
  
    geminiInput.addEventListener("input", function() {
      this.style.height = "50px";
      this.style.width = "600px";
      this.style.borderRadius = "10px";
    });

    geminiInput.addEventListener("blur", function() {
        this.style.height = "20px";
        this.style.width = "370px";
        this.style.borderRadius = "30px";
    });

    // Add keyboard shortcuts functionality
    document.addEventListener('keydown', function(e) {
        // Only process if not in an input field or textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key.toLowerCase() === 'a') { // Keyboard shortcut for Gemini chat
            if (window.storage) {
                window.storage.get('geminiApiKey').then(result => {
                    if (result.geminiApiKey) {
                        e.preventDefault();
                        geminiChatPanel.classList.add('visible');
                        geminiInput.focus();
                        fetchModelsIfNeeded();
                    }
                });
            }     
        }
    });
    
    // Document upload functionality
    if (docUpload) {
        docUpload.addEventListener('change', function(e) {
            if (e.target.files && e.target.files.length > 0) {
                AIUtils.handleFileUploads(e.target.files, 'document', uploadedFiles, '.gemini-actions');
            }
        });
    }    // Toggle chat panel visibility
    if (geminiToggleBtn) {
        geminiToggleBtn.addEventListener('click', function() {
            geminiChatPanel.classList.toggle('visible');
            if (geminiChatPanel.classList.contains('visible')) {
                geminiInput.focus();
                
                // Get the latest API key from storage when opening the panel
                window.storage.get('geminiApiKey').then(result => {
                    if (result.geminiApiKey) {
                        fetchModelsIfNeeded();
                        
                        // Always check image generation compatibility when panel opens
                        // Use a small delay to ensure models are loaded
                        setTimeout(() => {
                            if (geminiModelSelect.value) {
                                checkImageGenerationCompatibility();
                            }
                        }, 100);
                    }
                });
            }
        });
    }
    
    // Close chat panel
    if (closeGeminiBtn) {
        closeGeminiBtn.addEventListener('click', function() {
            geminiChatPanel.classList.remove('visible');
        });
    }

    // Handle image upload
    if (imageUpload) {
        imageUpload.addEventListener('change', function(e) {
            if (e.target.files && e.target.files.length > 0) {
                AIUtils.handleFileUploads(e.target.files, 'image', uploadedFiles, '.gemini-actions');
            }
        });
    }
    
    // File drop zone functionality
    AIUtils.addDropZoneSupport('.gemini-input-container', uploadedFiles, '.gemini-actions');    // Add image generation button event
    if (generateImageBtn) {
        generateImageBtn.addEventListener('click', toggleImageGenerationMode);
        
        // We'll check compatibility when the panel becomes visible or model changes,
        // not on initial load
    }
    
    // Add search button functionality
    if (geminiSearchBtn) {
        geminiSearchBtn.addEventListener('click', function() {
            isSearchMode = AIUtils.toggleSearchMode(
                isSearchMode, 
                geminiSearchBtn, 
                geminiInput, 
                geminiSendBtn
            );
        });
    }    // Add event listener for file removal
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-file-btn')) {
            const fileName = e.target.dataset.fileName;
            const previewContainer = e.target.closest('.file-preview-container');
            
            if (fileName && previewContainer) {
                // Remove the file from uploadedFiles array
                const fileIndex = uploadedFiles.findIndex(file => file.name === fileName);
                if (fileIndex !== -1) {
                    const removedFile = uploadedFiles[fileIndex];
                    uploadedFiles.splice(fileIndex, 1);
                    
                    // Reset the corresponding file input if it's an image or document
                    if (removedFile.fileType === 'image' && imageUpload) {
                        imageUpload.value = '';
                    } else if (removedFile.fileType === 'document' && docUpload) {
                        docUpload.value = '';
                    }
                }
                
                // Remove the preview from UI
                previewContainer.remove();
                
                // Show feedback
                AIUtils.showFeedback(`File "${fileName}" removed`, true);
            }
        }
    });
    
    // Function to toggle image generation mode
    function toggleImageGenerationMode() {
        isGeneratingImage = !isGeneratingImage;
        
        if (isGeneratingImage) {
            generateImageBtn.classList.add('image-generation-active');
            geminiInput.placeholder = "Describe the image you want to generate...";
            geminiSendBtn.textContent = "Generate";
            AIUtils.showFeedback("Image generation mode active. Describe the image you want to create.", true);
        } else {
            generateImageBtn.classList.remove('image-generation-active');
            geminiInput.placeholder = "Ask Gemini something...";
            geminiSendBtn.textContent = "Send";
        }
    }
    
    // Send message
    if (geminiSendBtn) {
        geminiSendBtn.addEventListener('click', function() {
            if (isGeneratingImage) {
                generateImage();
            } else {
                sendMessage();
            }
        });
    }
    
    if (geminiInput) {
        geminiInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (isGeneratingImage) {
                    generateImage();
                } else {
                    sendMessage();
                }
            }
        });
    }
    
    // Fetch available models from the Gemini API
    async function fetchModels() {
        window.storage.get('geminiApiKey').then(async result => {
            const apiKey = result.geminiApiKey;
            if (!apiKey) return;
            
            // Update the dropdown to show loading state
            if (geminiModelSelect) {
                geminiModelSelect.innerHTML = '<option value="">Loading models...</option>';
            }
            
            try {
                console.log('Fetching Gemini models...');
                
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
                    { mode: 'cors' }
                );
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                const data = await response.json();
                const models = data.models?.filter(m => 
                    m.supportedGenerationMethods?.includes('generateContent')
                ) || [];
                
                if (models.length === 0) {
                    console.warn('No compatible models found for generateContent');
                    if (geminiModelSelect) {
                        geminiModelSelect.innerHTML = '<option value="">No models available</option>';
                    }
                    return;
                }

                // Populate model dropdown using shared utility
                AIUtils.populateModelDropdown(models, geminiModelSelect, SELECTED_MODEL_KEY, 'gemini-pro');
                
            // Cache the models and timestamp
                window.storage.set({
                    [MODEL_CACHE_KEY]: JSON.stringify(models),
                    [MODEL_CACHE_TIMESTAMP_KEY]: Date.now()
                }).catch(err => {
                    console.warn('Failed to cache models, will try again next time:', err);
                });
                
                modelsLoaded = true;
                console.log('Models loaded successfully');
                
                // Check if the selected model supports image generation
                checkImageGenerationCompatibility();
            } catch (error) {
                console.error('Model fetch error:', error);
                
                // Try to use cached models if available
                window.storage.get(MODEL_CACHE_KEY).then(result => {
                    const cachedModels = result[MODEL_CACHE_KEY];
                    if (cachedModels) {
                        try {
                            const models = JSON.parse(cachedModels);
                            console.log('Using cached models due to fetch error');
                            AIUtils.populateModelDropdown(models, geminiModelSelect, SELECTED_MODEL_KEY, 'gemini-pro');
                            modelsLoaded = true;
                        } catch (cacheError) {
                            console.error('Error using cached models:', cacheError);
                            if (geminiModelSelect) {
                                geminiModelSelect.innerHTML = '<option value="">Error loading models</option>';
                            }
                            AIUtils.showFeedback("Error loading models. Check API key/access", false);
                        }
                    } else {
                        if (geminiModelSelect) {
                            geminiModelSelect.innerHTML = '<option value="">Error loading models</option>';
                        }
                        AIUtils.showFeedback("Error loading models. Check API key/access", false);
                    }
                });
            }
        });
    }

    function fetchModelsIfNeeded() {
        if (modelsLoaded) return; // Already loaded in this session
        
        // Check if we have cached models
        window.storage.get([MODEL_CACHE_KEY, MODEL_CACHE_TIMESTAMP_KEY]).then(result => {
            const cachedModels = result[MODEL_CACHE_KEY];
            const cacheTimestamp = result[MODEL_CACHE_TIMESTAMP_KEY];
            const now = Date.now();
            
            if (cachedModels && cacheTimestamp) {
                const cacheAge = now - parseInt(cacheTimestamp);
                
                // If cache is less than 24 hours old, use it
                if (cacheAge < AIUtils.constants.ONE_DAY_MS) {
                    try {
                        // Check if the cachedModels is already an object (not a string)
                        const models = typeof cachedModels === 'object' && cachedModels !== null ? 
                            cachedModels : JSON.parse(cachedModels);
                            
                        AIUtils.populateModelDropdown(models, geminiModelSelect, SELECTED_MODEL_KEY, 'gemini-pro');
                        modelsLoaded = true;
                        return;
                    } catch (error) {
                        console.error('Error parsing cached models:', error);
                        // Continue to fetch fresh models if parsing fails
                    }
                }
            }
            
            // If we got here, we need to fetch fresh models
            fetchModels();
        });
    }    
    
    // Send message to Gemini
    async function sendMessage() {
        const userMessage = geminiInput.value.trim();
        
        if (!userMessage && uploadedFiles.length === 0) {
            return; // Don't send empty messages without any files
        }
        
        // Get the API key from storage
        window.storage.get('geminiApiKey').then(async result => {
            const apiKey = result.geminiApiKey;
            if (!apiKey) {
                AIUtils.showFeedback("Please enter your Gemini API key in settings", false);
                return;
            }
            
            if (!modelsLoaded) {
                await fetchModels();
            }
            
            const selectedModel = geminiModelSelect.value;
            if (!selectedModel) {
                AIUtils.showFeedback("Please select a model", false);
                return;
            }
            
            // Add user message to chat
            if (userMessage) {
                if (isSearchMode) {
                    AIUtils.addMessageToChat('user', `🔍 Search: ${userMessage}`, 'geminiMessages');
                } else {
                    AIUtils.addMessageToChat('user', userMessage, 'geminiMessages');
                }
            }
            
            // Add file previews to chat
            if (uploadedFiles.length > 0) {
                // For images, add them to the chat
                const imagesToDisplay = uploadedFiles.filter(file => file.fileType === 'image');
                imagesToDisplay.forEach(file => {
                    AIUtils.addImageToChat('user', file.data, 'geminiMessages', 'gemini');
                });
                
                // For documents, just mention them
                const documentsToMention = uploadedFiles.filter(file => file.fileType === 'document');
                if (documentsToMention.length > 0) {
                    const docNames = documentsToMention.map(doc => doc.name).join(', ');
                    AIUtils.addMessageToChat('user', `<em>Files attached: ${docNames}</em>`, 'geminiMessages');
                }
                
                // Remove the previews
                const existingPreviews = document.querySelectorAll('.file-preview-container');
                existingPreviews.forEach(preview => preview.remove());
            }
            
            // Clear input
            geminiInput.value = '';
            
            // Show typing indicator
            typingIndicator = AIUtils.showTypingIndicator('geminiMessages');
            
            // Respect rate limit
            const now = Date.now();
            const timeElapsed = now - lastRequestTime;
            if (timeElapsed < AIUtils.constants.RATE_LIMIT_DELAY) {
                await new Promise(resolve => setTimeout(resolve, AIUtils.constants.RATE_LIMIT_DELAY - timeElapsed));
            }
            
            try {
                let response;
                
                if (isSearchMode) {
                    // Call search function with Gemini model
                    response = await searchWithGemini(selectedModel, userMessage, uploadedFiles, apiKey);
                    // Automatically exit search mode after performing a search
                    isSearchMode = false;
                    geminiSearchBtn.classList.remove('search-mode-active');
                    geminiInput.placeholder = "Ask Gemini something...";
                    geminiSendBtn.textContent = "Send";
                } else {
                    // Regular chat with model
                    response = await chatWithModelWithFiles(selectedModel, userMessage, uploadedFiles, apiKey);
                }
                
                // Hide typing indicator
                typingIndicator = AIUtils.hideTypingIndicator(typingIndicator);
                
                // Process and display response
                if (response.candidates && response.candidates.length > 0) {
                    const candidate = response.candidates[0];
                    
                    if (candidate.content && candidate.content.parts) {
                        candidate.content.parts.forEach(part => {
                            if (part.text) {
                                AIUtils.addMessageToChat('ai', part.text, 'geminiMessages');
                            } else if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                                AIUtils.addImageToChat('ai', part.inlineData.data, 'geminiMessages', 'gemini');
                            }
                        });
                    }
                } else if (response.promptFeedback) {
                    // Handle content filtered by safety settings
                    AIUtils.showFeedback(`Message blocked: ${response.promptFeedback.blockReason || 'Content policy violation'}`, false);
                } else {
                    AIUtils.addMessageToChat('ai', "No response received. Try rephrasing your question.", 'geminiMessages');
                }
                
                // Reset uploaded files
                uploadedFiles = [];
                
            } catch (error) {
                typingIndicator = AIUtils.hideTypingIndicator(typingIndicator);
                console.error('Error chatting with model:', error);
                AIUtils.showFeedback(`Error: ${error.message}`, false);
            }
            
            // Update last request time
            lastRequestTime = Date.now();
        });
    }
    
    // Call the selected model endpoint with the user message and files
    async function chatWithModelWithFiles(modelName, userMessage, files = [], apiKey) {
        // Fix the URL format - remove double 'models/' if present
        let modelPath = modelName;
        if (modelPath.startsWith('models/models/')) {
            modelPath = modelPath.replace('models/models/', 'models/');
        }
        
        const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;
        
        // Prepare current message content
        const currentParts = [];
        
        // Add text if provided
        if (userMessage) {
            currentParts.push({ text: userMessage });
        }
        
        // Process and add files
        for (const file of files) {
            if (file.fileType === 'image') {
                // Add image data
                currentParts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: file.data.split(',')[1] // Remove data URL prefix
                    }
                });
            } else if (file.type === 'text/plain' && typeof file.data === 'string') {
                // For text files, add the content directly
                if (userMessage) {
                    // If there's already a message, append the file content
                    currentParts.push({ 
                        text: `\n\nContent of ${file.name}:\n${file.data}`
                    });
                } else {
                    // If no message, use file content as the message
                    currentParts.push({ 
                        text: `Content of ${file.name}:\n${file.data}`
                    });
                }
            } else if (file.data.startsWith('data:')) {
                // Handle binary file types as inline data
                currentParts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: file.data.split(',')[1] // Remove data URL prefix
                    }
                });
            }
        }
        
        // Add the current message to conversation Cache
        conversationCache.push({
            role: 'user',
            parts: currentParts
        });
        
        // Prepare the payload with full conversation Cache
        const payload = {
            contents: conversationCache
        };
        
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                mode: 'cors',
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP error: ${response.status}`;
                
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.error && errorData.error.message) {
                        errorMessage = errorData.error.message;
                    }
                } catch (e) {
                    // If parsing fails, use the raw text
                    if (errorText) errorMessage += ` - ${errorText}`;
                }
                
                throw new Error(errorMessage);
            }
            
            const responseData = await response.json();
            
            // Store AI response in conversation Cache
            if (responseData.candidates && responseData.candidates.length > 0) {
                const candidate = responseData.candidates[0];
                if (candidate.content) {
                    conversationCache.push({
                        role: 'model',
                        parts: candidate.content.parts || []
                    });
                }
            }
            
            return responseData;
        } catch (error) {
            console.error('API request failed:', error);
            throw new Error(error.message || 'Failed to communicate with Gemini API');
        }
    }    
    
    // Generate image with Gemini
    async function generateImage() {
        const prompt = geminiInput.value.trim();

        if (!prompt && uploadedFiles.length === 0) {
            AIUtils.showFeedback("Please enter an image description or provide an image to edit.", false);
            return;
        }

        // Get API key from storage
        window.storage.get('geminiApiKey').then(async result => {
            const apiKey = result.geminiApiKey;
            if (!apiKey) {
                AIUtils.showFeedback("Please enter your Gemini API key in settings", false);
                return;
            }
            
            // Add user prompt to chat
            if (prompt) {
                AIUtils.addMessageToChat('user', prompt, 'geminiMessages');
            }

            // Ensure we use the correct model capable of image generation/editing
            const modelName = 'gemini-2.0-flash-exp-image-generation'; // Or select dynamically if needed
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            let base64Image = null;
            let mimeType = null;
            let imageFileToProcess = null;

            // Check if there's an uploaded image to use for editing
            if (uploadedFiles.length > 0) {
                // Find the first image file in the uploaded list
                imageFileToProcess = uploadedFiles.find(file => file.fileType === 'image');

                if (imageFileToProcess) {
                    // Extract base64 data and mimeType
                    // Assumes file.data is a data URL like "data:image/png;base64,..."
                    const parts = imageFileToProcess.data.split(',');
                    if (parts.length === 2) {
                        const mimeTypeMatch = parts[0].match(/:(.*?);/);
                        if (mimeTypeMatch && mimeTypeMatch[1]) {
                            mimeType = mimeTypeMatch[1];
                            base64Image = parts[1];

                            // Add the user's uploaded image to the chat for context
                            AIUtils.addImageToChat('user', imageFileToProcess.data, 'geminiMessages', 'gemini');
                        } else {
                            console.error("Could not parse mime type from image data URL.");
                            AIUtils.showFeedback("Error processing uploaded image format.", false);
                        }
                    } else {
                        console.error("Invalid image data URL format.");
                        AIUtils.showFeedback("Error processing uploaded image data.", false);
                    }
                }
                
                // Handle non-image files if needed, or ignore them for image generation
                const documentsToMention = uploadedFiles.filter(file => file.fileType === 'document');
                if (documentsToMention.length > 0) {
                    const docNames = documentsToMention.map(doc => doc.name).join(', ');
                    AIUtils.addMessageToChat('user', `<em>Files attached (ignored for image generation): ${docNames}</em>`, 'geminiMessages');
                }

                // Remove previews from UI after adding to chat
                const existingPreviews = document.querySelectorAll('.file-preview-container');
                existingPreviews.forEach(preview => preview.remove());
            }

            // Clear input field
            geminiInput.value = '';
            typingIndicator = AIUtils.showTypingIndicator('geminiMessages');

            // Construct the parts for the API call
            const requestParts = [];
            if (base64Image && mimeType) {
                // If editing an image, include inlineData first
                requestParts.push({ inlineData: { mimeType, data: base64Image } });
            }
            if (prompt) {
                // Add the text prompt
                requestParts.push({ text: prompt });
            }

            if (requestParts.length === 0) {
                typingIndicator = AIUtils.hideTypingIndicator(typingIndicator);
                AIUtils.showFeedback("Nothing to generate - provide a prompt or an image.", false);
                uploadedFiles = []; // Clear files as they were processed (or failed)
                return;
            }

            const payload = {
                contents: [{
                    parts: requestParts // Use the dynamically constructed parts
                }],
                // Use uppercase TEXT and IMAGE as per sample and likely API expectation
                generationConfig: {
                    responseModalities: ["TEXT", "IMAGE"]
                },
                safetySettings: [{
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_NONE"
                }]
            };

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                typingIndicator = AIUtils.hideTypingIndicator(typingIndicator);

                if (!response.ok) {
                    // Try to parse the error message from the response body
                    let errorDetails = await response.text();
                    try {
                        const errorJson = JSON.parse(errorDetails);
                        if (errorJson.error && errorJson.error.message) {
                            errorDetails = errorJson.error.message;
                        }
                    } catch (parseError) {
                        // Keep the raw text if JSON parsing fails
                    }
                    throw new Error(`HTTP ${response.status}: ${errorDetails}`);
                }

                const data = await response.json();
                const responseParts = data.candidates?.[0]?.content?.parts;

                if (responseParts) {
                    let imageGenerated = false;
                    for (const part of responseParts) {
                        if (part.text) {
                            // Display any accompanying text from the model
                            AIUtils.addMessageToChat('ai', part.text, 'geminiMessages');
                        } else if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                            // Display the generated/edited image
                            const imageData = part.inlineData.data;
                            AIUtils.addImageToChat('ai', imageData, 'geminiMessages', 'gemini');
                            imageGenerated = true;
                        }
                    }
                    if (!imageGenerated) {
                        // Handle cases where response is valid but contains no image unexpectedly
                        AIUtils.addMessageToChat('ai', "Received a response, but it didn't contain an image.", 'geminiMessages');
                    }
                } else if (data.promptFeedback) {
                    // Handle content filtered by safety settings
                    AIUtils.showFeedback(`Image generation blocked: ${data.promptFeedback.blockReason || 'Content policy violation'}`, false);
                    AIUtils.addMessageToChat('ai', `Sorry, I cannot generate an image based on that request due to safety policies (${data.promptFeedback.blockReason || ''}).`, 'geminiMessages');
                }
                else {
                    console.error("Unexpected response format:", data);
                    AIUtils.showFeedback("Failed to process image generation response", false);
                    AIUtils.addMessageToChat('ai', "Sorry, I couldn't generate an image due to an unexpected issue.", 'geminiMessages');
                }

                // Clear uploaded files *after* successful processing or definite failure
                uploadedFiles = [];

            } catch (error) {
                typingIndicator = AIUtils.hideTypingIndicator(typingIndicator);
                console.error("Image generation error:", error);
                AIUtils.showFeedback(`Image generation error: ${error.message}`, false);
                // Don't clear files on fetch error, user might want to retry
            }
        });
    }

    // Function to perform search with Gemini
    async function searchWithGemini(modelName, searchQuery, files = [], apiKey) {
        // Fix the URL format - remove double 'models/' if present
        let modelPath = modelName;
        if (modelPath.startsWith('models/models/')) {
            modelPath = modelPath.replace('models/models/', 'models/');
        }
        
        const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;
        
        // Prepare search message
        const searchParts = [];
        
        // Add search query
        searchParts.push({ 
            text: searchQuery
        });
        
        // Process and add files if relevant to search context
        for (const file of files) {
            if (file.fileType === 'image') {
                // Add image data for visual search
                searchParts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: file.data.split(',')[1] // Remove data URL prefix
                    }
                });
            } else if (file.type === 'text/plain' && typeof file.data === 'string') {
                // For text files, add the content as context
                searchParts.push({ 
                    text: `Additional context from ${file.name}:\n${file.data}`
                });
            } else if (file.data.startsWith('data:')) {
                // Handle binary file types as inline data
                searchParts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: file.data.split(',')[1] // Remove data URL prefix
                    }
                });
            }
        }
        
        // Prepare the payload with search retrieval tool
        const payload = {
            contents: [{
                role: 'user',
                parts: searchParts
            }],
            tools: [{
                google_search: {} // <--- Correct field name (use empty object to enable with defaults)
            }],
            generationConfig: {
                temperature: 1,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192
            }
        };
        
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                mode: 'cors',
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP error: ${response.status}`;
                
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.error && errorData.error.message) {
                        errorMessage = errorData.error.message;
                    }
                } catch (e) {
                    // If parsing fails, use the raw text
                    if (errorText) errorMessage += ` - ${errorText}`;
                }
                
                throw new Error(errorMessage);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Search API request failed:', error);
            throw new Error(error.message || 'Failed to search with Gemini API');
        }
    }
});

// Function to reset Gemini components when API key changes
function resetGeminiComponents() {
    // Get necessary DOM elements
    const geminiToggleBtn = document.getElementById('geminiToggleBtn');
    const geminiModelSelect = document.getElementById('geminiModelSelect');
    const geminiMessages = document.getElementById('geminiMessages');
    
    // Clear chat Cache
    if (geminiMessages) {
        geminiMessages.innerHTML = '';
    }
    
    // Check if API key exists
    window.storage.get('geminiApiKey').then(result => {
        const apiKey = result.geminiApiKey;
        
        if (apiKey) {
            // We have an API key, show chat button
            if (geminiToggleBtn) {
                geminiToggleBtn.style.display = 'block';
            }
            
            // Enable the show-gemini checkbox if it exists
            const checkbox = document.getElementById('show-gemini');
            if (checkbox) checkbox.disabled = false;
            
            // Fetch models
            if (typeof window.fetchModels === 'function') {
                window.fetchModels();
            }
        } else {
            // No API key, hide chat button
            if (geminiToggleBtn) {
                geminiToggleBtn.style.display = 'none';
            }
            
            // Disable the show-gemini checkbox if it exists
            const checkbox = document.getElementById('show-gemini');
            if (checkbox) checkbox.disabled = true;
            
            // Clear model dropdown
            if (geminiModelSelect) {
                geminiModelSelect.innerHTML = '<option value="">No API key</option>';
            }
        }
    });
}

// Function to update Gemini visibility based on settings
function updateGeminiVisibility(visible) {
    const geminiContainer = document.getElementById('geminiChatContainer');
    if (geminiContainer) {
        geminiContainer.style.display = visible ? 'block' : 'none';
    }
}

// Make functions globally available
window.resetGeminiComponents = resetGeminiComponents;
window.updateGeminiVisibility = updateGeminiVisibility;
window.fetchModels = function() {
    // Reset modelsLoaded flag to force reload when API key changes
    window.modelsLoaded = false;
    
    // Get the API key first to ensure we have it
    window.storage.get('geminiApiKey').then(result => {
        const apiKey = result.geminiApiKey;
        if (!apiKey) {
            console.warn('No Gemini API key available, skipping model fetch');
            return;
        }
        
        // Directly call fetchModels instead of using a simulated click
        // This avoids potential issues with the click simulation
        const geminiModelSelect = document.getElementById('geminiModelSelect');
        if (geminiModelSelect) {
            // Update to loading state
            geminiModelSelect.innerHTML = '<option value="">Loading models...</option>';
            
            // Make the API call to fetch models
            fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { mode: 'cors' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    const models = data.models?.filter(m => 
                        m.supportedGenerationMethods?.includes('generateContent')
                    ) || [];
                    
                    if (models.length === 0) {
                        geminiModelSelect.innerHTML = '<option value="">No models available</option>';
                        return;
                    }
                    
                    // Use the shared utility to populate the dropdown
                    window.AIChatComponents.populateModelDropdown(
                        models, 
                        geminiModelSelect, 
                        'geminiSelectedModel', 
                        'gemini-pro'
                    );
                      // Cache the models for future use
                    window.storage.set({
                        'geminiModelCache': JSON.stringify(models),
                        'geminiModelCacheTimestamp': Date.now()
                    });
                    
                    window.modelsLoaded = true;
                    
                    // Give the dropdown a moment to update its value before checking compatibility
                    setTimeout(() => {
                        if (typeof window.checkImageGenerationCompatibility === 'function') {
                            window.checkImageGenerationCompatibility();
                        }
                    }, 100);
                })
                .catch(error => {
                    console.error('Error fetching models:', error);
                    geminiModelSelect.innerHTML = '<option value="">Error loading models</option>';
                    
                    // Try to use cached models as fallback
                    window.storage.get('geminiModelCache').then(result => {
                        const cachedModels = result.geminiModelCache;
                        if (cachedModels) {
                            try {
                                const models = JSON.parse(cachedModels);
                                window.AIChatComponents.populateModelDropdown(
                                    models, 
                                    geminiModelSelect, 
                                    'geminiSelectedModel', 
                                    'gemini-pro'
                                );
                                window.modelsLoaded = true;
                            } catch (cacheError) {
                                console.error('Error loading cached models:', cacheError);
                                geminiModelSelect.innerHTML = '<option value="">Error loading models</option>';
                            }
                        }
                    });
                });
        }
    });
};