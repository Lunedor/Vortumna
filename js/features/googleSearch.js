// googleSearch.js
document.getElementById('googleSearchInput').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent default form submission behavior
        performGoogleSearch();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        handleArrowNavigation(event.key);
    }
    
    // Handle "@G" and "@D" commands for Gemini and OpenRouter
    if (event.key === 'g' && (event.ctrlKey || event.metaKey) && document.getElementById('googleSearchInput').value === '@') {
        event.preventDefault();
        openGeminiContainer();
    } else if (event.key === 'd' && (event.ctrlKey || event.metaKey) && document.getElementById('googleSearchInput').value === '@') {
        event.preventDefault();
        openOpenRouterContainer();
    }
});

document.querySelector('.search-icon').addEventListener('click', function() {
    performGoogleSearch();
});

// Function to perform the Google search
function performGoogleSearch() {
    const query = document.getElementById('googleSearchInput').value;
    if (query) {
        // Changed from window.open with '_blank' to location.href to open in same tab
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }
}

// Autocomplete functionality
function setupAutocomplete() {
    const searchInput = document.getElementById('googleSearchInput');
    const autocompleteResults = document.getElementById('autocompleteResults');
    let debounceTimer;
    let selectedIndex = -1;    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();
        
        // Check for command triggers
        if (query === "@G" || query === "@g") {
            autocompleteResults.innerHTML = '';
            autocompleteResults.classList.remove('active');
            openGeminiContainer();
            return;
        } else if (query === "@D" || query === "@d") {
            autocompleteResults.innerHTML = '';
            autocompleteResults.classList.remove('active');
            openOpenRouterContainer();
            return;
        }
        
        debounceTimer = setTimeout(() => {
            if (query.length > 1) {
                fetchAutocompleteResults(query);
            } else {
                autocompleteResults.innerHTML = '';
                autocompleteResults.classList.remove('active');
            }
        }, 300); // Debounce for 300ms
    });

    // Hide autocomplete when clicking outside
    document.addEventListener('click', function(event) {
        if (!searchInput.contains(event.target) && !autocompleteResults.contains(event.target)) {
            autocompleteResults.classList.remove('active');
        }
    });
    
    // Close autocomplete on escape key
    searchInput.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            autocompleteResults.classList.remove('active');
        }
    });
}

// Function to fetch Google search suggestions
async function fetchGoogleSuggestions(query) {
    try {
        const response = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        return data[1] || []; // Return the suggestions array
    } catch (error) {
        console.error('Error fetching Google suggestions:', error);
        return []; // Return empty array on error
    }
}

function fetchAutocompleteResults(query) {
    // Direct fetch without any proxies - Chrome extensions can make cross-origin requests
    // when properly declared in the manifest
    fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data && data[1]) {
                displayAutocompleteResults(data[1]);
            } else {
                displayAutocompleteResults([]);
            }
        })
        .catch(error => {
            console.error('Error fetching suggestions directly:', error);
            // Fall back to background script only if direct fetch fails
            try {
                // Create a unique request ID to track this specific request
                const requestId = Date.now().toString();
                
                // Set up a timeout to handle message port closed errors
                const timeoutId = setTimeout(() => {
                    console.log(`Request ${requestId} timed out - using empty results`);
                    displayAutocompleteResults([]);
                }, 2000); // 2 second timeout
                
                chrome.runtime.sendMessage({
                    action: "fetchGoogleSuggestions",
                    query: query,
                    requestId: requestId
                }, function(response) {
                    // Clear the timeout since we got a response
                    clearTimeout(timeoutId);
                    
                    // Check if runtime.lastError exists
                    if (chrome.runtime.lastError) {
                        console.log("Background communication error:", chrome.runtime.lastError.message);
                        displayAutocompleteResults([]);
                        return;
                    }
                    
                    if (response && response.suggestions) {
                        displayAutocompleteResults(response.suggestions);
                    } else {
                        displayAutocompleteResults([]);
                    }
                });
            } catch (e) {
                console.error("Error with background messaging:", e);
                displayAutocompleteResults([]);
            }
        });
}

function displayAutocompleteResults(suggestions) {
    const autocompleteResults = document.getElementById('autocompleteResults');
    autocompleteResults.innerHTML = '';

    if (!suggestions || suggestions.length === 0) {
        autocompleteResults.classList.remove('active');
        return;
    }

    suggestions.forEach((suggestion, index) => {
        const item = document.createElement('div');
        item.classList.add('autocomplete-item');
        item.textContent = suggestion;
        item.setAttribute('data-index', index);
        
        item.addEventListener('click', function() {
            document.getElementById('googleSearchInput').value = suggestion;
            autocompleteResults.classList.remove('active');
            performGoogleSearch();
        });
        
        autocompleteResults.appendChild(item);
    });

    autocompleteResults.classList.add('active');
    selectedIndex = -1;
}

function handleArrowNavigation(key) {
    const autocompleteResults = document.getElementById('autocompleteResults');
    const items = autocompleteResults.querySelectorAll('.autocomplete-item');
    
    if (!items.length || !autocompleteResults.classList.contains('active')) return;
    
    // Remove any existing selection
    items.forEach(item => item.classList.remove('selected'));
    
    if (key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % items.length;
    } else if (key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    }
    
    // Add selection to the new item
    const selectedItem = items[selectedIndex];
    selectedItem.classList.add('selected');
    
    // Update the input value
    document.getElementById('googleSearchInput').value = selectedItem.textContent;
}

// Function to open Gemini container
function openGeminiContainer() {
    const searchInput = document.getElementById('googleSearchInput');
    const geminiChatPanel = document.getElementById('geminiChatPanel');
    const geminiInput = document.getElementById('geminiInput');
    
    if (geminiChatPanel) {
        geminiChatPanel.classList.add('visible');
        // Clear Google search input after opening Gemini
        searchInput.value = '';
        
        // Focus on Gemini input field
        if (geminiInput) {
            setTimeout(() => geminiInput.focus(), 100);
        }
        
        // Fetch models if we have API key
        if (window.storage && typeof window.fetchModelsIfNeeded === 'function') {
            window.storage.get('geminiApiKey').then(result => {
                if (result.geminiApiKey) {
                    window.fetchModelsIfNeeded();
                }
            });
        }
    }
}

// Function to open OpenRouter container
function openOpenRouterContainer() {
    const searchInput = document.getElementById('googleSearchInput');
    const openrouterChatPanel = document.getElementById('openrouterChatPanel');
    const openrouterInput = document.getElementById('openrouterInput');
    
    if (openrouterChatPanel) {
        openrouterChatPanel.classList.add('visible');
        // Clear Google search input after opening OpenRouter
        searchInput.value = '';
        
        // Focus on OpenRouter input field
        if (openrouterInput) {
            setTimeout(() => openrouterInput.focus(), 100);
        }
    }
}

// Setup event listeners to close containers with ESC key and clean search input
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('googleSearchInput');
    
    // Add event listener to close buttons
    const closeGeminiBtn = document.querySelector('.close-gemini');
    const closeOpenRouterBtn = document.querySelector('.close-openrouter');
    
    if (closeGeminiBtn) {
        closeGeminiBtn.addEventListener('click', function() {
            if (searchInput) {
                searchInput.value = '';
            }
        });
    }
    
    if (closeOpenRouterBtn) {
        closeOpenRouterBtn.addEventListener('click', function() {
            if (searchInput) {
                searchInput.value = '';
            }
        });
    }
    
    // Global ESC key handler
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            // Get panels
            const geminiChatPanel = document.getElementById('geminiChatPanel');
            const openrouterChatPanel = document.getElementById('openrouterChatPanel');
            
            // Check if any panel is visible
            const geminiVisible = geminiChatPanel && geminiChatPanel.classList.contains('visible');
            const openrouterVisible = openrouterChatPanel && openrouterChatPanel.classList.contains('visible');
            
            // If any panel was visible and closed, clean the search input
            if (geminiVisible || openrouterVisible) {
                if (geminiVisible) {
                    geminiChatPanel.classList.remove('visible');
                }
                
                if (openrouterVisible) {
                    openrouterChatPanel.classList.remove('visible');
                }
                
                // Clear search input
                if (searchInput) {
                    searchInput.value = '';
                }
            }
        }
    });
    
    // Initialize autocomplete functionality
    setupAutocomplete();
});