// aicomponents.js - Shared functionality for AI chat components (Gemini and OpenRouter)
window.AIChatComponents = (function() {
    // Shared constants
    const CONSTANTS = {
        MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB max file size
        MAX_FILES: 10, // Maximum number of files that can be attached at once
        RATE_LIMIT_DELAY: 1000, // 1 second between requests to avoid rate limiting
        ONE_DAY_MS: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        SUPPORTED_FILE_TYPES: {
            images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
            documents: [
                'text/plain', 
                'application/pdf', 
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
                'application/msword', // .doc
                'text/csv',
                'application/json',
                'text/javascript', // .js
                'text/css', // .css
                'text/html', // .html
            ]
        }
    };

    // Create file preview for uploads
    function createFilePreview(fileInfo, containerSelector) {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'file-preview-container';
        previewContainer.dataset.fileName = fileInfo.name;
        
        if (fileInfo.fileType === 'image') {
            // Create image preview
            const preview = document.createElement('img');
            preview.className = 'file-preview-image';
            preview.src = fileInfo.data;
            preview.alt = fileInfo.name;
            previewContainer.appendChild(preview);
        } else {
            // Create document preview
            const preview = document.createElement('div');
            preview.className = 'file-preview-document';
            
            // Add icon based on file type
            const iconSpan = document.createElement('span');
            iconSpan.className = 'file-icon';
            
            if (fileInfo.type === 'application/pdf') {
                iconSpan.textContent = '📕';
            } else if (fileInfo.type.includes('word') || fileInfo.type === 'application/msword') {
                iconSpan.textContent = '📘';
            } else if (fileInfo.type === 'text/csv') {
                iconSpan.textContent = '📊';
            } else if (fileInfo.type === 'application/json') {
                iconSpan.textContent = '📋';
            } else {
                iconSpan.textContent = '📄';
            }
            
            preview.appendChild(iconSpan);
            
            // Add file name
            const fileName = document.createElement('span');
            fileName.textContent = fileInfo.name;
            fileName.className = 'file-name';
            preview.appendChild(fileName);
            
            previewContainer.appendChild(preview);
        }
        
        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file-btn';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove file';
        removeBtn.dataset.fileName = fileInfo.name;
        
        previewContainer.appendChild(removeBtn);
        
        // Add to UI
        const actionsContainer = document.querySelector(containerSelector);
        if (actionsContainer) {
            actionsContainer.prepend(previewContainer);
        }
        
        return previewContainer;
    }

    // Handle multiple file uploads
    function handleFileUploads(files, fileType, uploadedFiles, containerSelector, callback) {
        // Check if adding these files would exceed the maximum
        if (uploadedFiles.length + files.length > CONSTANTS.MAX_FILES) {
            showFeedback(`You can only attach up to ${CONSTANTS.MAX_FILES} files at once.`, false);
            return;
        }
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check file size
            if (file.size > CONSTANTS.MAX_FILE_SIZE) {
                showFeedback(`File "${file.name}" exceeds the maximum size of 20MB.`, false);
                continue;
            }
            
            // Check if the file type is supported
            if (fileType === 'image' && !CONSTANTS.SUPPORTED_FILE_TYPES.images.includes(file.type)) {
                showFeedback(`File type "${file.type}" is not supported for images.`, false);
                continue;
            } else if (fileType === 'document' && !CONSTANTS.SUPPORTED_FILE_TYPES.documents.includes(file.type)) {
                showFeedback(`File type "${file.type}" is not supported for documents.`, false);
                continue;
            }
            
            // Read and process the file
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const fileData = e.target.result;
                
                // Store file information
                const fileInfo = {
                    data: fileData,
                    name: file.name,
                    type: file.type,
                    fileType: fileType // 'image' or 'document'
                };
                
                // Add to uploaded files array
                uploadedFiles.push(fileInfo);
                
                // Create and add preview to UI
                createFilePreview(fileInfo, containerSelector);
                
                // Callback if provided
                if (typeof callback === 'function') {
                    callback(fileInfo);
                }
            };
            
            // Read file as appropriate format
            if (fileType === 'image' || file.type === 'application/pdf' || 
                file.type.includes('word') || file.type === 'application/msword') {
                reader.readAsDataURL(file);
            } else {
                // For text and other document types
                reader.readAsText(file);
            }
        }
    }

    // Add file drag-and-drop support to an element
    function addDropZoneSupport(containerSelector, uploadedFiles, actionsContainerSelector, callback) {
        const dropZone = document.querySelector(containerSelector);
        if (!dropZone) return;
        
        // Prevent default behavior for drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Add highlighting during drag
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });
        
        function highlight() {
            dropZone.classList.add('highlight-drop-zone');
        }
        
        function unhighlight() {
            dropZone.classList.remove('highlight-drop-zone');
        }
        
        // Handle dropped files
        dropZone.addEventListener('drop', handleDrop, false);
        
        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                // Determine file type based on first file
                const fileType = files[0].type.startsWith('image/') ? 'image' : 'document';
                handleFileUploads(files, fileType, uploadedFiles, actionsContainerSelector, callback);
            }
        }
    }

    // Add message to chat
    function addMessageToChat(sender, text, messagesContainerId) {
        const messagesContainer = document.getElementById(messagesContainerId);
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `${messagesContainerId.replace('Messages', '-message')} ${sender}`;
        
        // Add copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-message-btn';
        copyButton.innerHTML = '📋'; // Clipboard icon
        copyButton.title = 'Copy message';
        
        // Add click handler to copy text
        copyButton.addEventListener('click', function() {
            let textToCopy;
            
            if (sender === 'ai') {
                // For AI messages, get the raw markdown text
                textToCopy = text;
            } else {
                // For user messages, properly extract plain text
                // Create a temporary div to extract text properly
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = text;
                textToCopy = tempDiv.textContent || tempDiv.innerText;
            }
            
            // Copy to clipboard
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    showFeedback("Message copied to clipboard", true);
                    copyButton.innerHTML = '✓'; // Change to checkmark temporarily
                    setTimeout(() => copyButton.innerHTML = '📋', 1000);
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                    showFeedback("Failed to copy message", false);
                });
        });
        
        if (sender === 'ai') {
            // For AI messages, use Marked.js to render proper Markdown
            const markdownContent = document.createElement('div');
            markdownContent.className = 'markdown-content';
            markdownContent.innerHTML = (typeof marked !== 'undefined') ? marked.parse(text) : text;

            // For security, sanitize links to open in new tab with noopener
            const links = markdownContent.querySelectorAll('a');
            links.forEach(link => {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            });

            messageDiv.appendChild(markdownContent);
        } else {
            // For user messages, keep the simpler formatting
            messageDiv.innerHTML = text;
        }
        
        // Append the copy button - after message content is added
        messageDiv.appendChild(copyButton);
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Add image to chat
    function addImageToChat(sender, imageData, messagesContainerId, servicePrefix) {
        const messagesContainer = document.getElementById(messagesContainerId);
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `${messagesContainerId.replace('Messages', '-message')} ${sender}`;
        
        const img = document.createElement('img');
        // Handle both base64 and data URLs
        img.src = imageData.startsWith('data:') ? 
            imageData : 
            `data:image/png;base64,${imageData}`;
        
        img.alt = 'Image';
        img.classList.add(`${servicePrefix}-chat-image`);
        
        // Add download button for AI-generated images
        if (sender === 'ai') {
            const downloadContainer = document.createElement('div');
            downloadContainer.className = 'image-download-container';
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'image-download-btn';
            downloadBtn.innerHTML = '💾';
            downloadBtn.title = 'Download this image';
            downloadBtn.addEventListener('click', function() {
                // Create a temporary anchor element
                const a = document.createElement('a');
                a.href = img.src;
                a.download = `${servicePrefix}-image-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
            
            downloadContainer.appendChild(downloadBtn);
            messageDiv.appendChild(downloadContainer);
        }
        
        messageDiv.appendChild(img);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Show typing indicator
    function showTypingIndicator(messagesContainerId) {
        const messagesContainer = document.getElementById(messagesContainerId);
        if (!messagesContainer) return null;
        
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message-typing';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            typingIndicator.appendChild(dot);
        }
        
        messagesContainer.appendChild(typingIndicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return typingIndicator;
    }

    // Hide typing indicator
    function hideTypingIndicator(typingIndicator) {
        if (typingIndicator) {
            typingIndicator.remove();
            return null;
        }
        return typingIndicator;
    }

    // Toggle search mode
    function toggleSearchMode(isSearchMode, searchBtn, inputField, sendBtn) {
        isSearchMode = !isSearchMode;
        
        if (isSearchMode) {
            searchBtn.classList.add('search-mode-active');
            inputField.placeholder = "What would you like to search for?";
            sendBtn.textContent = "Search";
            showFeedback("Search mode active. Enter your search query.", true);
        } else {
            searchBtn.classList.remove('search-mode-active');
            inputField.placeholder = "Ask something...";
            sendBtn.textContent = "Send";
        }
        
        return isSearchMode;
    }

    // Save API key with visibility toggle
    function setupAPIKeyHandling(apiKey, apiKeyInput, saveApiKeyBtn, toggleBtn, checkboxId, onSave, onForget) {
        if (apiKey) {
            // Show toggle button when API key exists
            if (toggleBtn) toggleBtn.style.display = 'block';
            
            // Update checkbox state
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) checkbox.disabled = false;
            
            // Update button appearance
            if (apiKeyInput) apiKeyInput.value = apiKey;
            if (saveApiKeyBtn) {
                saveApiKeyBtn.textContent = 'Forget';
                saveApiKeyBtn.style.backgroundColor = '#dc3545';
            }
            
            // Call onSave callback if provided
            if (typeof onSave === 'function') onSave(apiKey);
        } else {
            // Hide toggle button when no API key
            if (toggleBtn) toggleBtn.style.display = 'none';
            
            // Update checkbox state
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) checkbox.disabled = true;
            
            // Update button appearance
            if (apiKeyInput) apiKeyInput.value = '';
            if (saveApiKeyBtn) {
                saveApiKeyBtn.textContent = 'Save';
                saveApiKeyBtn.style.backgroundColor = 'rgb(29, 186, 84)';
            }
            
            // Call onForget callback if provided
            if (typeof onForget === 'function') onForget();
        }
    }

    // Initialize visibility based on settings
    function initializeVisibility(storageKey, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (window.storage) {
            window.storage.get(storageKey).then(result => {
                const isVisible = result[storageKey] !== false;
                container.style.display = isVisible ? 'block' : 'none';
            });
        } else {
            // Fallback to localStorage
            const isVisible = localStorage.getItem(storageKey) !== 'false';
            container.style.display = isVisible ? 'block' : 'none';
        }
    }

    // Update visibility state
    function updateVisibility(isVisible, storageKey, containerId, checkboxId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (window.storage) {
            window.storage.set({ [storageKey]: isVisible });
        } else {
            localStorage.setItem(storageKey, isVisible.toString());
        }
        
        container.style.display = isVisible ? 'block' : 'none';
        
        // Update checkbox if it exists
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.checked = isVisible;
        }
    }

    // Clean conversation
    function cleanConversation(messagesContainerId, uploadedFiles, conversationCache) {
        const messagesContainer = document.getElementById(messagesContainerId);
        if (!messagesContainer) return;
        
        // Clear messages
        messagesContainer.innerHTML = '';
        
        // Clear uploaded files
        if (Array.isArray(uploadedFiles)) {
            uploadedFiles.length = 0;
        }
        
        // Clear conversation Cache
        if (Array.isArray(conversationCache)) {
            conversationCache.length = 0;
        }
        
        // Remove any previews
        const existingPreviews = document.querySelectorAll('.file-preview-container');
        existingPreviews.forEach(preview => preview.remove());
        
        showFeedback("Conversation cleared", true);
    }

    // Shared model dropdown population
    function populateModelDropdown(models, selectElement, storageKey, defaultModel) {
        if (!selectElement) return;
        
        const saveModel = (modelName) => {
            if (window.storage) {
                window.storage.set({ [storageKey]: modelName });
            } else {
                localStorage.setItem(storageKey, modelName);
            }
        };
        
        const getSelectedModel = () => {
            return new Promise((resolve) => {
                if (window.storage) {
                    window.storage.get(storageKey).then(result => {
                        resolve(result[storageKey] || defaultModel);
                    });
                } else {
                    resolve(localStorage.getItem(storageKey) || defaultModel);
                }
            });
        };
        
        // Get previously selected model
        getSelectedModel().then(savedModel => {            // Create options for each model
            selectElement.innerHTML = models.map(model => {
                // Format the display name
                const displayName = model.displayName || model.name.replace('models/', '');
                const isSelected = model.name === savedModel;
                
                return `\
                    <option value="${model.name}" ${isSelected ? 'selected' : ''}>
                        ${displayName}
                    </option>
                `;
            }).join('');
              // Add event listener to save model selection
            selectElement.addEventListener('change', function() {
                saveModel(this.value);
                // Image compatibility check will be handled directly in gemini.js
            });
        });
    }

    // City Autocomplete Feature
    function setupCityAutocomplete(inputSelector, apiKey, limit = 5) {
        const inputElement = document.querySelector(inputSelector);
        if (!inputElement) return;

        // Create autocomplete container
        const autocompleteContainer = document.createElement('div');
        autocompleteContainer.className = 'city-autocomplete-container';
        autocompleteContainer.style.display = 'none';
        inputElement.parentNode.insertBefore(autocompleteContainer, inputElement.nextSibling);

        document.head.appendChild(styleElement);

        // Keep track of selected index for keyboard navigation
        let selectedIndex = -1;
        
        // Debounce function to limit API calls
        let debounceTimer;
        const debounce = (callback, time) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(callback, time);
        };

        // Function to fetch city suggestions from OpenWeather API
        async function fetchCitySuggestions(query) {
            if (!query || query.length < 3 || !apiKey) return [];
            
            try {
                const apiUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=${limit}&appid=${apiKey}`;
                const response = await fetch(apiUrl);
                
                if (!response.ok) {
                    throw new Error(`City search API error: ${response.status}`);
                }
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Failed to fetch city suggestions:', error);
                return [];
            }
        }

        // Function to render suggestions
        function renderSuggestions(suggestions) {
            autocompleteContainer.innerHTML = '';
            
            if (suggestions.length === 0) {
                autocompleteContainer.style.display = 'none';
                return;
            }
            
            suggestions.forEach((suggestion, index) => {
                const item = document.createElement('div');
                item.className = 'city-autocomplete-item';
                
                // Format city name with country and state (if available)
                let displayText = suggestion.name;
                if (suggestion.state) {
                    displayText += `, ${suggestion.state}`;
                }
                if (suggestion.country) {
                    displayText += `, ${suggestion.country}`;
                }
                
                item.textContent = displayText;
                
                // Add click handler
                item.addEventListener('click', () => {
                    inputElement.value = displayText;
                    autocompleteContainer.style.display = 'none';
                    inputElement.focus();
                });
                
                autocompleteContainer.appendChild(item);
            });
            
            autocompleteContainer.style.display = 'block';
            selectedIndex = -1; // Reset selection
        }
        
        // Input event handler for search
        inputElement.addEventListener('input', () => {
            const query = inputElement.value.trim();
            
            if (query.length < 3) {
                autocompleteContainer.style.display = 'none';
                return;
            }
            
            // Debounce to avoid too many API calls
            debounce(async () => {
                const suggestions = await fetchCitySuggestions(query);
                renderSuggestions(suggestions);
            }, 300);
        });
        
        // Handle keyboard navigation
        inputElement.addEventListener('keydown', (e) => {
            const items = autocompleteContainer.querySelectorAll('.city-autocomplete-item');
            
            // If no suggestions are shown, do nothing
            if (items.length === 0 || autocompleteContainer.style.display === 'none') {
                return;
            }
            
            // Remove previous selection
            if (selectedIndex >= 0 && selectedIndex < items.length) {
                items[selectedIndex].classList.remove('selected');
            }
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = (selectedIndex + 1) % items.length;
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
                    break;
                case 'Enter':
                    if (selectedIndex >= 0 && selectedIndex < items.length) {
                        e.preventDefault();
                        items[selectedIndex].click();
                    }
                    return;
                case 'Escape':
                    autocompleteContainer.style.display = 'none';
                    selectedIndex = -1;
                    return;
                default:
                    return;
            }
            
            // Apply new selection
            if (selectedIndex >= 0 && selectedIndex < items.length) {
                items[selectedIndex].classList.add('selected');
                items[selectedIndex].scrollIntoView({ block: 'nearest' });
            }
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!inputElement.contains(e.target) && !autocompleteContainer.contains(e.target)) {
                autocompleteContainer.style.display = 'none';
            }
        });
        
        // Hide autocomplete when input loses focus
        inputElement.addEventListener('blur', () => {
            // Small delay to allow clicks on suggestions to register
            setTimeout(() => {
                if (!autocompleteContainer.contains(document.activeElement)) {
                    autocompleteContainer.style.display = 'none';
                }
            }, 150);
        });
        
        // Show autocomplete when input gains focus if there's content
        inputElement.addEventListener('focus', () => {
            const query = inputElement.value.trim();
            if (query.length >= 3) {
                debounce(async () => {
                    const suggestions = await fetchCitySuggestions(query);
                    renderSuggestions(suggestions);
                }, 300);
            }
        });

        return {
            // Public methods if needed
            clear: () => {
                autocompleteContainer.innerHTML = '';
                autocompleteContainer.style.display = 'none';
            }
        };
    }

    // Return public API
    return {
        constants: CONSTANTS,
        showFeedback,
        createFilePreview,
        handleFileUploads,
        addDropZoneSupport,
        addMessageToChat,
        addImageToChat,
        showTypingIndicator,
        hideTypingIndicator,
        toggleSearchMode,
        setupAPIKeyHandling,
        initializeVisibility,
        updateVisibility,
        cleanConversation,
        populateModelDropdown,
        setupCityAutocomplete
    };
})();