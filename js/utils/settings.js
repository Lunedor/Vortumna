// settings.js - Manages settings menu functionality

// Settings container
const settingsContainer = document.getElementById('settingsDropdown');
const settingsButton = document.getElementById('settingsButton');

// Toggle settings visibility when settings button is clicked
if (settingsButton) {
    settingsButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (settingsContainer) {
            settingsContainer.classList.toggle('active');
        }
    });
    
    // Close settings when clicking outside
    document.addEventListener('click', function(e) {
        if (settingsContainer && !settingsContainer.contains(e.target) && e.target !== settingsButton) {
            settingsContainer.classList.remove('active');
        }
    });
}

// Add class to body to indicate settings are loading
document.body.classList.add('settings-loading');

// Add visibility-managed class to elements that should be hidden during loading
document.addEventListener('DOMContentLoaded', () => {
    // Add the visibility-managed class to all elements that might be hidden based on settings
    const visibilityManagedElements = [
        document.getElementById('weatherStatus'),
        document.getElementById('googleSearch'),
        document.getElementById('bookmarksSection'),
        document.getElementById('quote-container'),
        document.querySelector('.location-info')
    ];
    
    // Apply class to all elements that exist
    visibilityManagedElements.forEach(element => {
        if (element) element.classList.add('visibility-managed');
    });
});

// Functions to update UI based on settings
function updateBackgroundVisibility(visible) {
    const bgContainer = document.getElementById('background-container');
    const locationInfo = document.querySelector('.location-info');
    
    if (visible) {
        bgContainer.style.display = '';
        // Restore opacity when showing
        window.storage.get('bgOpacity').then(result => {
            const opacity = result.bgOpacity || 1;
            updateBackgroundOpacity(parseFloat(opacity));
            
            // When background is shown, only show location info and gallery buttons 
            // if their own settings allow it
            window.storage.get('showLocationInfo').then(result => {
                const showLocationInfo = result.showLocationInfo !== false;
                updateLocationInfoVisibility(showLocationInfo);
            });
        });
    } else {
        bgContainer.style.display = 'none';
        
        // When background is hidden, force location info and gallery buttons to hide
        // but don't change their storage settings
        if (locationInfo) locationInfo.style.display = 'none';
    }
}

// Function to update clean UI settings
function updateCleanUI(enabled) {
    if (enabled) {
        // Apply clean UI styles
        document.documentElement.style.setProperty('--item-background-color', 'transparent');
        document.documentElement.style.setProperty('--border', 'none');
        document.documentElement.style.setProperty('--background-filter', 'blur(0px)');
        document.documentElement.style.setProperty('--box-shadow', 'none');
        document.documentElement.style.setProperty('--border-bottom', '2px solid rgba(255, 255, 255, 0.5)');
    } else {
        // Restore default styles
        document.documentElement.style.setProperty('--item-background-color', 'rgba(255, 255, 255, 0.1)');
        document.documentElement.style.setProperty('--border', '1px solid rgba(0, 0, 0, 0.75)');
        document.documentElement.style.setProperty('--background-filter', 'blur(2px)');
        document.documentElement.style.setProperty('--box-shadow', '0 0px 8px rgba(0, 0, 0, 0.3)');
        document.documentElement.style.setProperty('--border-bottom', 'none');
    }
}

// Function to manage saved Imgur URLs
function manageSavedImgurUrls() {
    const urlInput = document.getElementById('imgur-url');
    const nameInput = document.getElementById('imgur-url-name');
    const urlSelect = document.getElementById('imgur-url-select');
    const saveButton = document.getElementById('save-imgur-url');
    const deleteButton = document.getElementById('delete-imgur-url');
    
    if (!urlInput || !nameInput || !urlSelect || !saveButton || !deleteButton) {
        console.warn('Imgur URL management elements not found');
        return;
    }
    
    // Load saved URLs from storage
    function loadSavedImgurUrls() {
        // Get both saved URLs and the current imgurUrl/backgroundSource
        Promise.all([
            window.storage.get('savedImgurUrls'),
            window.storage.get(['imgurUrl', 'backgroundSource'])
        ]).then(([savedResult, currentResult]) => {
            const savedUrls = savedResult.savedImgurUrls || [];
            const currentImgurUrl = currentResult.imgurUrl || '';
            const currentSource = currentResult.backgroundSource;

            // Clear existing options except the first placeholder
            while (urlSelect.options.length > 1) {
                urlSelect.remove(1);
            }

            // Add options for each saved URL
            savedUrls.forEach(item => {
                const option = document.createElement('option');
                option.value = item.url;
                option.textContent = item.name;
                urlSelect.appendChild(option);
            });

            // If there are no saved URLs, disable the select and delete button
            if (savedUrls.length === 0) {
                urlSelect.disabled = true;
                deleteButton.disabled = true;
            } else {
                urlSelect.disabled = false;
                deleteButton.disabled = false;
            }

            // If Imgur is the current source, select the current imgurUrl
            if (currentSource === 'imgur' && currentImgurUrl) {
                urlSelect.value = currentImgurUrl;
                urlInput.value = currentImgurUrl;
                // Set the name input if the URL is in the saved list
                const selectedItem = savedUrls.find(item => item.url === currentImgurUrl);
                if (selectedItem) {
                    nameInput.value = selectedItem.name;
                } else {
                    nameInput.value = '';
                }
            }
        });
    }
    
    // Set up event listener for the URL select dropdown
    urlSelect.addEventListener('change', () => {
        if (urlSelect.value) {
            urlInput.value = urlSelect.value;
            
            // Find the name for the selected URL
            window.storage.get('savedImgurUrls').then(result => {
                const savedUrls = result.savedImgurUrls || [];
                const selectedItem = savedUrls.find(item => item.url === urlSelect.value);
                if (selectedItem) {
                    nameInput.value = selectedItem.name;
                }
            });
            
            // If currently using Imgur background, update it with the selected URL
            window.storage.get(['backgroundSource', 'imgurUrl']).then(result => {
                if (result.backgroundSource === 'imgur') {
                    // Only update if the URL has actually changed
                    if (result.imgurUrl !== urlSelect.value) {
                        window.storage.set({ imgurUrl: urlSelect.value }).then(() => {
                            updateBackground('imgur', true);
                            
                            // Show feedback
                            if (typeof showFeedback === 'function') {
                                showFeedback('Imgur URL updated successfully', true);
                            }
                        });
                    }
                }
            });
        }
    });
    
    // Set up event listener for the save button
    saveButton.addEventListener('click', () => {
        const url = urlInput.value.trim();
        let name = nameInput.value.trim();
        
        if (!url) {
            if (typeof showFeedback === 'function') {
                showFeedback('Please enter a URL', false);
            }
            return;
        }
        
        // If no name is provided, try to extract one from the URL
        if (!name) {
            // Extract album ID, gallery ID, tag name, etc. from the URL as a fallback name
            const urlParts = url.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            name = lastPart || 'Imgur URL';
        }
        
        window.storage.get('savedImgurUrls').then(result => {
            let savedUrls = result.savedImgurUrls || [];
            
            // Check if this URL already exists
            const existingIndex = savedUrls.findIndex(item => item.url === url);
            
            if (existingIndex >= 0) {
                // Update existing entry
                savedUrls[existingIndex].name = name;
                if (typeof showFeedback === 'function') {
                    showFeedback('URL name updated', true);
                }
            } else {
                // Add new entry
                savedUrls.push({ url, name });
                if (typeof showFeedback === 'function') {
                    showFeedback('URL saved successfully', true);
                }
            }
            
            // Save updated list
            window.storage.set({ 
                savedImgurUrls: savedUrls,
                imgurUrl: url // Also update the current Imgur URL
            }).then(() => {
                // Reload the dropdown
                loadSavedImgurUrls();
                
                // If currently using Imgur background, update it
                window.storage.get('backgroundSource').then(result => {
                    if (result.backgroundSource === 'imgur') {
                        updateBackground('imgur', true);
                    }
                });
            });
        });
    });
    
    // Set up event listener for the delete button
    deleteButton.addEventListener('click', () => {
        const selectedUrl = urlSelect.value;
        if (!selectedUrl) {
            if (typeof showFeedback === 'function') {
                showFeedback('Please select a URL to delete', false);
            }
            return;
        }
        
        window.storage.get('savedImgurUrls').then(result => {
            let savedUrls = result.savedImgurUrls || [];
            
            // Remove the selected URL
            savedUrls = savedUrls.filter(item => item.url !== selectedUrl);
            
            // Save updated list
            window.storage.set({ savedImgurUrls: savedUrls }).then(() => {
                // Reload the dropdown
                loadSavedImgurUrls();
                
                // Clear the inputs
                urlInput.value = '';
                nameInput.value = '';
                
                if (typeof showFeedback === 'function') {
                    showFeedback('URL deleted successfully', true);
                }
            });
        });
    });
    
    // Initial load of saved URLs
    loadSavedImgurUrls();
    
    return { loadSavedImgurUrls };
}

function updateBackgroundOpacity(opacity) {
    const bgContainer = document.getElementById('background-container');
    bgContainer.style.opacity = opacity;
}

function updateBookmarksVisibility(visible) {
    const bookmarksSection = document.getElementById('bookmarksSection');
    if (visible) {
        bookmarksSection.classList.remove('hidden');
        
        // Enable hover hide checkbox if bookmarks are visible
        const hoverHideCheckbox = document.getElementById('bookmarks-hover-hide');
        if (hoverHideCheckbox) {
            hoverHideCheckbox.disabled = false;
        }
    } else {
        bookmarksSection.classList.add('hidden');
        
        // Disable hover hide checkbox if bookmarks are hidden
        const hoverHideCheckbox = document.getElementById('bookmarks-hover-hide');
        if (hoverHideCheckbox) {
            hoverHideCheckbox.disabled = true;
        }
    }
}

function updateWeatherVisibility(visible) {
    const weatherStatus = document.getElementById('weatherStatus');
    if (weatherStatus) {
        // Get the current clock visibility setting
        window.storage.get(['showClock', 'showGreeting']).then(result => {
            const showClock = result.showClock !== false;
            const showGreeting = result.showGreeting === true;
            
            // If greeting is active, don't show weather regardless of setting
            if (showGreeting) {
                weatherStatus.classList.remove('weather-only');
                weatherStatus.classList.remove('clock-only');
                
                // Let greeting handle its own visibility
                return;
            }
            
            if (visible) {
                // Weather should be visible
                weatherStatus.classList.remove('hidden');
                weatherStatus.classList.remove('weather-only');
                
                // If clock is hidden, add weather-only class
                if (!showClock) {
                    weatherStatus.classList.add('weather-only');
                }
                
                // Always remove clock-only when showing weather
                weatherStatus.classList.remove('clock-only');
                
                // Refresh weather data if it should be visible
                if (typeof getLocationAndWeather === 'function') {
                    getLocationAndWeather();
                }
            } else {
                // Weather should be hidden
                if (showClock) {
                    // Only clock should be shown
                    weatherStatus.classList.remove('hidden');
                    weatherStatus.classList.remove('weather-only');
                    weatherStatus.classList.add('clock-only');
                } else {
                    // Neither weather nor clock should be shown
                    weatherStatus.classList.add('hidden');
                    weatherStatus.classList.remove('clock-only');
                    weatherStatus.classList.remove('weather-only');
                }
            }
        });
    }
}

// Function to update Clock visibility
function updateClockVisibility(visible) {
    const weatherStatus = document.getElementById('weatherStatus');
    if (weatherStatus) {
        // Get the current weather visibility setting
        window.storage.get(['showWeather', 'showGreeting']).then(result => {
            const showWeather = result.showWeather !== false;
            const showGreeting = result.showGreeting === true;
            
            // If greeting is active, don't show clock regardless of setting
            if (showGreeting) {
                weatherStatus.classList.remove('weather-only');
                weatherStatus.classList.remove('clock-only');
                
                // Let greeting handle its own visibility
                return;
            }
            
            if (visible) {
                // Clock should be visible
                weatherStatus.classList.remove('hidden');
                weatherStatus.classList.remove('clock-only');
                
                // If weather is hidden, add clock-only class
                if (!showWeather) {
                    weatherStatus.classList.add('clock-only');
                }
                
                // Always remove weather-only when showing clock
                weatherStatus.classList.remove('weather-only');
            } else {
                // Clock should be hidden
                if (showWeather) {
                    // Only weather should be shown
                    weatherStatus.classList.remove('hidden');
                    weatherStatus.classList.remove('clock-only');
                    weatherStatus.classList.add('weather-only');
                } else {
                    // Neither clock nor weather should be shown
                    weatherStatus.classList.add('hidden');
                    weatherStatus.classList.remove('clock-only');
                    weatherStatus.classList.remove('weather-only');
                }
            }
        });
    }
}

// Function to update Google Search visibility
function updateGoogleSearchVisibility(visible) {
    const googleSearch = document.getElementById('googleSearch');
    if (visible) {
        googleSearch.classList.remove('hidden');
    } else {
        googleSearch.classList.add('hidden');
    }
}

// Function to update Location Info visibility
function updateLocationInfoVisibility(visible) {
    const locationInfo = document.querySelector('.location-info');
    if (locationInfo) {
        if (visible) {
            locationInfo.style.display = '';
        } else {
            locationInfo.style.display = 'none';
        }
    }
}

// Function to update OpenRouter visibility
function updateOpenRouterVisibility(visible) {
    const openrouterContainer = document.getElementById('openrouterChatContainer');
    if (openrouterContainer) {
        openrouterContainer.style.display = visible ? 'block' : 'none';
    }
}

// Function to update Gemini visibility
function updateGeminiVisibility(visible) {
    const geminiContainer = document.getElementById('geminiChatContainer');
    if (geminiContainer) {
        geminiContainer.style.display = visible ? 'block' : 'none';
    }
}

// Function to update Greeting visibility
function updateGreetingVisibility(visible) {
    const greetingContainer = document.getElementById('greetingContainer');
    const weatherContainer = document.getElementById('weatherStatus');
    
    if (!window.storage) return;
    
    window.storage.get(['geminiApiKey']).then(settings => {
        // Only show greetings if both the setting is enabled AND an API key exists
        const showGreeting = visible && settings.geminiApiKey;
        
        if (showGreeting) {
            if (weatherContainer) {
                weatherContainer.classList.add('greeting-visible');
            }
            if (greetingContainer) {
                greetingContainer.style.display = 'flex';
            }
            
            // Hide weather and clock
            updateWeatherVisibility(false);
            updateClockVisibility(false);
        } else {
            if (weatherContainer) {
                weatherContainer.classList.remove('greeting-visible');
            }
            if (greetingContainer) {
                greetingContainer.style.display = 'none';
            }
            
            // Show weather and clock based on their settings
            window.storage.get(['showWeather', 'showClock']).then(result => {
                const showWeather = result.showWeather !== false;
                const showClock = result.showClock !== false;
                
                updateWeatherVisibility(showWeather);
                updateClockVisibility(showClock);
            });
        }
    }).catch(error => {
        console.error('Error updating greeting visibility:', error);
    });
}

// Function to update the "show all" checkbox state
function updateShowAllCheckbox() {
    const showAllCheckbox = document.getElementById('show-all');
    const checkboxes = [
        'show-bookmarks', 'show-weather', 'show-clock',
        'show-google-search', 'show-location-info', 'show-background', 'show-quotes',
        'show-greeting'
    ];
    
    const allChecked = checkboxes.every(id => document.getElementById(id).checked);
    showAllCheckbox.checked = allChecked;
}

// Function to update checkbox state when Gemini API key changes
function updateGeminiSettingsStateBasedOnApiKey(apiKey) {
    const showGreetingElement = document.getElementById('show-greeting');
    
    if (!showGreetingElement) return;
    
    if (!apiKey) {
        // If API key is removed or not available, disable the greeting option
        showGreetingElement.disabled = true;
        showGreetingElement.parentElement.classList.add('disabled-option');
        showGreetingElement.parentElement.setAttribute('title', 'Requires Gemini API key to enable');
        
        // Also uncheck it and update storage
        if (showGreetingElement.checked) {
            showGreetingElement.checked = false;
            window.storage.set({ showGreeting: false });
        }
    } else {
        // If API key is available, enable the option
        showGreetingElement.disabled = false;
        showGreetingElement.parentElement.classList.remove('disabled-option');
        showGreetingElement.parentElement.removeAttribute('title');
    }
}

// Load settings from chrome.storage
async function loadSettings() {
    try {
        // Ensure storage is initialized
        if (!window.storage || !window.storage.initialized) {
            console.warn('Storage not initialized yet, waiting...');
            
            // Try a better approach - wait for the storage-ready event
            const storageReady = await new Promise(resolve => {
                // If storage is already initialized, resolve immediately
                if (window.storage && window.storage.initialized) {
                    resolve(true);
                    return;
                }
                
                // Otherwise, set up a one-time event listener
                const handleStorageReady = () => {
                    document.removeEventListener('storage-ready', handleStorageReady);
                    resolve(true);
                };
                
                document.addEventListener('storage-ready', handleStorageReady);
                
                // Set a timeout to prevent infinite wait
                setTimeout(() => {
                    document.removeEventListener('storage-ready', handleStorageReady);
                    console.warn('Timed out waiting for storage-ready event, proceeding anyway');
                    resolve(false);
                }, 3000);
            });
            
            // If we timed out and storage still isn't available, retry with delay
            if (!storageReady && (!window.storage || !window.storage.initialized)) {
                console.warn('Storage still not initialized after waiting for event, retrying with delay...');
                setTimeout(loadSettings, 500);
                return;
            }
        }        // Get all settings at once for efficiency        
        const settings = await window.storage.get([
            'showAll', 'showGoogleSearch', 'showLocationInfo',
            'showBackground', 'showBookmarks', 'bookmarksHoverHide', 'showWeather',
            'showGemini', 'showQuotes', 'showClock', 'showOpenRouter', 'showGreeting',
            'openweather-api-key', 'unsplashApiKey', 'geminiApiKey', 
            'customCity', 'useAutoLocation', 'backgroundSource', 'bgOpacity',
            'selectedSubreddit', 'unsplashCategories', 'cleanUI', 'userName', 'greetingMood',
            'imgurUrl', 'pixabayApiKey'
        ]);
        
        // Load API keys
        const openWeatherApiKey = settings['openweather-api-key'] || '';
        const openWeatherKeyElement = document.getElementById('openweather-api-key');
        if (openWeatherKeyElement) {
            openWeatherKeyElement.value = openWeatherApiKey;
        }
        
        const unsplashApiKey = settings.unsplashApiKey || '';
        const unsplashKeyElement = document.getElementById('unsplash-api-key');
        if (unsplashKeyElement) {
            unsplashKeyElement.value = unsplashApiKey;
        }
        
        const geminiApiKey = settings.geminiApiKey || '';
        const geminiKeyElement = document.getElementById('gemini-api-key');
        if (geminiKeyElement) {
            geminiKeyElement.value = geminiApiKey;
        }
          // Update Gemini settings state based on API key
        updateGeminiSettingsStateBasedOnApiKey(geminiApiKey);
        
        // Load Imgur URL
        const imgurUrl = settings.imgurUrl || '';
        const imgurUrlElement = document.getElementById('imgur-url');
        if (imgurUrlElement) {
            imgurUrlElement.value = imgurUrl;
        }
        
        // Load Pixabay API key
        const pixabayApiKey = settings.pixabayApiKey || '';
        const pixabayKeyElement = document.getElementById('pixabay-api-key');
        if (pixabayKeyElement) {
            pixabayKeyElement.value = pixabayApiKey;
        }
        
        // Load Unsplash categories
        const unsplashCategories = settings.unsplashCategories || 'landscape,nature,scenic';
        const unsplashCategoriesElement = document.getElementById('unsplash-categories');
        if (unsplashCategoriesElement) {
            unsplashCategoriesElement.value = unsplashCategories;
        }
        
        // Load Show All state first
        const showAll = settings.showAll !== false;
        const showAllElement = document.getElementById('show-all');
        if (showAllElement) {
            showAllElement.checked = showAll;
        }
        
        // Load Google Search visibility setting
        const showGoogleSearch = settings.showGoogleSearch !== false;
        const showGoogleSearchElement = document.getElementById('show-google-search');
        if (showGoogleSearchElement) {
            showGoogleSearchElement.checked = showGoogleSearch;
        }
        updateGoogleSearchVisibility(showGoogleSearch);
        
        // Load Location Info visibility setting - this needs to be loaded after background is set
        const showLocationInfo = settings.showLocationInfo !== false;
        const showLocationInfoElement = document.getElementById('show-location-info');
        if (showLocationInfoElement) {
            showLocationInfoElement.checked = showLocationInfo;
        }
                        
        // Load quotes visibility setting
        const showQuotes = settings.showQuotes !== false;
        const showQuotesElement = document.getElementById('show-quotes');
        if (showQuotesElement) {
            showQuotesElement.checked = showQuotes;
        }
        updateQuotesVisibility(showQuotes);
        
        // Load quote language setting
        if (window.quoteSettings && window.quoteSettings.language) {
            const quoteLanguage = document.getElementById('quote-language');
            if (quoteLanguage) {
                quoteLanguage.value = window.quoteSettings.language;
            }
        }

        // Load quote source setting
        if (window.quoteSettings && window.quoteSettings.sourceType) {
            const quoteSource = document.getElementById('quote-source');
            if (quoteSource) {
                quoteSource.value = window.quoteSettings.sourceType;
            }
        }

        // Load quote content setting
        if (window.quoteSettings && window.quoteSettings.contentType) {
            const quoteContent = document.getElementById('quote-content');
            if (quoteContent) {
                quoteContent.value = window.quoteSettings.contentType;
            }
        }

        // Load background settings
        const showBackground = settings.showBackground !== false;
        const showBackgroundElement = document.getElementById('show-background');
        if (showBackgroundElement) {
            showBackgroundElement.checked = showBackground;
        }
        updateBackgroundVisibility(showBackground);
        
        // Load background opacity setting
        const bgOpacity = settings.bgOpacity || 1;
        const parsedOpacity = parseFloat(bgOpacity);
        const bgOpacityElement = document.getElementById('bg-opacity');
        const opacityValueElement = document.getElementById('opacity-value');
        if (bgOpacityElement) {
            bgOpacityElement.value = parsedOpacity;
        }
        if (opacityValueElement) {
            opacityValueElement.textContent = `${Math.round(parsedOpacity * 100)}%`;
        }
        updateBackgroundOpacity(parsedOpacity);
          // Load bookmarks visibility setting
        const showBookmarks = settings.showBookmarks !== false;
        const showBookmarksElement = document.getElementById('show-bookmarks');
        if (showBookmarksElement) {
            showBookmarksElement.checked = showBookmarks;
        }
        updateBookmarksVisibility(showBookmarks);
          // Load bookmarks hover-hide setting
        const bookmarksHoverHide = settings.bookmarksHoverHide === true;
        const bookmarksHoverHideElement = document.getElementById('bookmarks-hover-hide');
        if (bookmarksHoverHideElement) {
            bookmarksHoverHideElement.checked = bookmarksHoverHide;
            // Ensure the checkbox is enabled/disabled based on showBookmarks state
            bookmarksHoverHideElement.disabled = !showBookmarks;
        }
        // Apply the hover-hide effect if enabled and bookmarks are visible
        if (showBookmarks && bookmarksHoverHide) {
            updateBookmarksHoverHide(true);
        } else {
            updateBookmarksHoverHide(false);
        }
        
        // Load weather visibility setting
        const showWeather = settings.showWeather !== false;
        const showWeatherElement = document.getElementById('show-weather');
        if (showWeatherElement) {
            showWeatherElement.checked = showWeather;
        }
        
        // Load clock visibility setting
        const showClock = settings.showClock !== false;
        const showClockElement = document.getElementById('show-clock');
        if (showClockElement) {
            showClockElement.checked = showClock;
        }
        
        // Load greeting visibility setting
        const showGreeting = settings.showGreeting === true;
        const showGreetingElement = document.getElementById('show-greeting');
        if (showGreetingElement) {
            showGreetingElement.checked = showGreeting;
            
            // If there's no Gemini API key, disable the greeting option
            if (!geminiApiKey) {
                showGreetingElement.disabled = true;
                showGreetingElement.parentElement.classList.add('disabled-option');
                showGreetingElement.parentElement.setAttribute('title', 'Requires Gemini API key to enable');
            } else {
                showGreetingElement.disabled = false;
                showGreetingElement.parentElement.classList.remove('disabled-option');
                showGreetingElement.parentElement.removeAttribute('title');
            }
            
            // If greeting is enabled, disable weather and clock checkboxes
            if (showGreeting && geminiApiKey) {
                if (showWeatherElement) {
                    showWeatherElement.disabled = true;
                    showWeatherElement.parentElement.classList.add('disabled-option');
                    showWeatherElement.parentElement.setAttribute('title', 'Disabled when AI greeting is active');
                }
                if (showClockElement) {
                    showClockElement.disabled = true;
                    showClockElement.parentElement.classList.add('disabled-option');
                    showClockElement.parentElement.setAttribute('title', 'Disabled when AI greeting is active');
                }
            } else {
                if (showWeatherElement) {
                    showWeatherElement.disabled = false;
                    showWeatherElement.parentElement.classList.remove('disabled-option');
                    showWeatherElement.parentElement.removeAttribute('title');
                }
                if (showClockElement) {
                    showClockElement.disabled = false;
                    showClockElement.parentElement.classList.remove('disabled-option');
                    showClockElement.parentElement.removeAttribute('title');
                }
            }
        }
        
        // Load user name for greeting
        const userName = settings.userName || '';
        const userNameInput = document.getElementById('user-name-input');
        if (userNameInput) {
            userNameInput.value = userName;
        }
        
        // Load greeting mood setting
        const greetingMood = settings.greetingMood || 'normal';
        const greetingMoodElement = document.getElementById('greeting-mood');
        if (greetingMoodElement) {
            greetingMoodElement.value = greetingMood;
        }
        
        // Apply visibility after loading settings
        if (showGreeting && geminiApiKey) {
            // Show greeting instead of weather/clock
            window.updateGreetingVisibility(true);
        } else {
            // Restore weather and clock visibility
            updateWeatherVisibility(showWeather);
            updateClockVisibility(showClock);
        }
        
        // Load location type setting
        const customCity = settings.customCity;
        const useAutoLocation = settings.useAutoLocation;
        const customLocationElement = document.getElementById('custom-location');
        const autoLocationElement = document.getElementById('auto-location');
        const customLocationInputElement = document.getElementById('custom-location-input');
        if (customCity && !useAutoLocation) {
            if (customLocationElement) {
                customLocationElement.checked = true;
            }
            if (customLocationInputElement) {
                customLocationInputElement.classList.remove('hidden');
            }
        } else {
            if (autoLocationElement) {
                autoLocationElement.checked = true;
            }
            if (customLocationInputElement) {
                customLocationInputElement.classList.add('hidden');
            }
            // If switching to auto-location, clear weather cache to force fresh location detection
            if (useAutoLocation) {
                window.storage.get('weatherCache').then(result => {
                    if (result.weatherCache) {
                        window.storage.remove('weatherCache').then(() => {
                            if (typeof getLocationAndWeather === 'function') {
                                getLocationAndWeather();
                            }
                        });
                    }
                });
            }
        }

        // Load background source setting and initialize background
        const backgroundSource = settings.backgroundSource || 'reddit';
        const backgroundSourceElement = document.getElementById(`${backgroundSource}-background`);
        if (backgroundSourceElement) {
            backgroundSourceElement.checked = true;
        }
        
        // Show appropriate source-specific settings
        updateBackgroundSourceSettings(backgroundSource);
        
        // Update subreddit dropdown if needed
        if (backgroundSource === 'reddit') {
            const select = document.getElementById('subreddit-select');
            if (select) {
                const selectedSubreddit = settings.selectedSubreddit || 'EarthPorn';
                select.value = selectedSubreddit;
            }
        }
        
        // Initialize background
        updateBackground(backgroundSource);
        
        // Apply location info visibility after background is loaded
        setTimeout(() => {
            updateLocationInfoVisibility(showLocationInfo);
        }, 500);
        
        // Load clean UI setting
        const cleanUI = settings.cleanUI || false;
        const cleanUIElement = document.getElementById('clean-ui');
        if (cleanUIElement) {
            cleanUIElement.checked = cleanUI;
        }
        updateCleanUI(cleanUI);
        
        // Update the "show all" checkbox state
        updateShowAllCheckbox();
        
        // Update Spotify login status
        updateSpotifyLoginStatus();
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Spotify login status management
function updateSpotifyLoginStatus() {
    window.storage.get(['spotify_access_token'])
        .then(result => {
            const spotifyLoggedOut = document.getElementById('spotify-logged-out');
            const spotifyLoggedIn = document.getElementById('spotify-logged-in');
            const spotifyLoginSection = document.getElementById('spotify-login-status');
            const playlistDropdown = document.getElementById('playlistDropdown');
            
            if (!spotifyLoggedOut || !spotifyLoggedIn || !spotifyLoginSection) {
                console.warn("Spotify login status elements not found in DOM");
                return;
            }
            
            if (result.spotify_access_token) {
                // User is logged in
                spotifyLoggedOut.classList.add('hidden');
                spotifyLoggedIn.classList.remove('hidden');
                spotifyLoginSection.classList.remove('hidden');
                
                // Always ensure the playlist dropdown is visible when logged in
                if (playlistDropdown) {
                    playlistDropdown.style.display = 'block';
                }
            } else {
                // User is logged out
                spotifyLoggedOut.classList.remove('hidden');
                spotifyLoggedIn.classList.add('hidden');
                spotifyLoginSection.classList.remove('hidden');
                
                // Hide the playlist dropdown
                if (playlistDropdown) {
                    playlistDropdown.style.display = 'none';
                }
            }
        })
        .catch(error => {
            console.error('Error checking Spotify login status:', error);
        });
}

// Function to update Quotes visibility
function updateQuotesVisibility(visible) {
    const quoteContainer = document.getElementById('quote-container');
    if (quoteContainer) {
        quoteContainer.style.display = visible ? 'flex' : 'none';
    }
    
    // Also hide the favorites container if quotes are hidden
    const favoritesContainer = document.getElementById('quote-favorites-container');
    if (favoritesContainer) {
        if (!visible) {
            favoritesContainer.classList.remove('show');
        }
    }
}

// Variable to track if updateBackground is currently in progress
let updateBackgroundInProgress = false;
// Debounce timer for updateBackground
let updateBackgroundTimer = null;

function updateBackground(source, forceUpdate = false) {
    // If a timer is already running, clear it
    if (updateBackgroundTimer) {
        clearTimeout(updateBackgroundTimer);
    }
    
    // Set a new timer to wait a short period before actually updating
    updateBackgroundTimer = setTimeout(async () => {
        // Only proceed if not already in progress
        if (updateBackgroundInProgress) {
            console.log('Background update already in progress, skipping');
            return;
        }
        
        updateBackgroundInProgress = true;
        
        try {
            // Check background settings
            const result = await window.storage.get([
                'showBackground', 
                'backgroundChangeInterval', 
                'localImageSource', 
                'backgroundSchedule'
            ]);
            
            if (result.showBackground === false) {
                updateBackgroundInProgress = false;
                return; // Don't load any background if disabled
            }
            
            // Get background container
            const bgContainer = document.getElementById('background-container');
            
            // Special case for gallery + every-session: Clear the container immediately 
            // to avoid flickering when switching images
            if (source === 'local' && 
                result.localImageSource === 'gallery' && 
                result.backgroundSchedule === 'every-session') {
                
                console.log('Gallery with every-session: Immediately clearing background container');
                bgContainer.innerHTML = '';
                
                // Also clear any existing location info
                const existingLocationInfo = document.querySelector('.location-info');
                if (existingLocationInfo) {
                    existingLocationInfo.remove();
                }
            }
            
            // Default change interval is 1 hour (in milliseconds)
            const changeInterval = result.backgroundChangeInterval || (60 * 60 * 1000);
            
            // If forceUpdate is true, we need to skip the cache check completely
            if (forceUpdate) {
                console.log('Force update requested, bypassing cache check');
                await loadFreshBackground(source, bgContainer);
                return; // Exit early - loadFreshBackground handles setting updateBackgroundInProgress = false
            }
            
            // Check if background cache is expired using the backgroundCache
            const isExpired = await window.backgroundCache.isExpired(source, changeInterval);
            
            // If we have a valid cache and it hasn't expired
            if (!isExpired) {
                // Apply the cached background image using the system
                const success = await window.backgroundCache.applyBackground(source, bgContainer);
                
                if (success) {
                    updateBackgroundInProgress = false;
                    return;
                }
                
                // If cache application failed, continue to load a new image
                console.log('Cache application failed, loading new image');
            }
            
            // If we get here, we need to load a fresh background (either because cache expired or failed to apply)
            await loadFreshBackground(source, bgContainer);
            
        } catch (error) {
            console.error('Error loading background:', error);
            updateBackgroundInProgress = false;
        }
    }, 300); // 300ms debounce time
}

// New helper function to load a fresh background image
async function loadFreshBackground(source, bgContainer) {
    // Clear existing content immediately to prevent old image from showing
    bgContainer.innerHTML = '';
    
    // Remove any existing location info immediately
    const existingLocationInfo = document.querySelector('.location-info');
    if (existingLocationInfo) {
        existingLocationInfo.remove();
    }

    // Show loading indicator for all sources
    const loader = document.createElement('div');
    loader.className = 'background-loader';
    loader.innerHTML = 'Loading background...';
    bgContainer.appendChild(loader);

    if (source === 'imgur') {
        // Check if the imgur.js script is loaded
        if (typeof ImgurFetcher !== 'function') {
            console.warn('ImgurFetcher not available, loading imgur.js');            try {
                // Try to load the imgur.js script if not already loaded
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = '/js/background/imgur.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
                console.log('Successfully loaded imgur.js');
            } catch (error) {
                console.error('Failed to load imgur.js:', error);
                loader.innerHTML = 'Error loading Imgur functionality';
                updateBackgroundInProgress = false;
                return;
            }
        }
        
        // Get the URL from storage
        try {
            const result = await window.storage.get('imgurUrl');
            const imgurUrl = result?.imgurUrl;
            
            if (!imgurUrl) {
                loader.innerHTML = 'Please enter an Imgur URL in settings to use this background source';
                updateBackgroundInProgress = false;
                return;
            }
            
            const imgurFetcher = new ImgurFetcher();
            const imageData = await imgurFetcher.getRandomImage(imgurUrl);
            
            if (!imageData) {
                loader.innerHTML = 'Failed to fetch image from Imgur. Please check your URL';
                updateBackgroundInProgress = false;
                return;
            }
            
            // Create image element
            const imgElement = document.createElement('img');
            imgElement.className = 'background-image';
            
            // Preload image
            imgElement.onload = async () => {
                bgContainer.innerHTML = ''; // Remove loader
                bgContainer.appendChild(imgElement);
                
                // Save current info for "Save Image" feature
                window.currentImgurTitle = imageData.title || 'Imgur Image';
                window.currentImgurLocation = imageData.location || 'Imgur';
                
                // Update location info
                window.createOrUpdateLocationInfo(
                    imageData.location || 'Imgur Image',
                    imageData.link,
                    imageData.title || 'Imgur Image'
                );
                
                // Cache the current background data with the new system
                await window.backgroundCache.cacheBackground(
                    source, 
                    {
                        title: imageData.title,
                        location: imageData.location,
                        link: imageData.link
                    }, 
                    imageData.imageUrl
                );
                
                updateBackgroundInProgress = false;
            };
            
            // Set image source to trigger the load
            imgElement.src = imageData.imageUrl;
            
        } catch (error) {
            console.error('Error loading Imgur image:', error);
            loader.innerHTML = 'Error loading background from Imgur';
            updateBackgroundInProgress = false;
        }
    } else if (source === 'reddit') {
        // Modified to handle the loader and caching with the new system
        const onImageLoad = async (imgElement) => {
            bgContainer.innerHTML = ''; // Remove loader
            bgContainer.appendChild(imgElement);
            
            // Cache the current background data with the new system
            const title = window.currentRedditTitle || 'Reddit Image';
            await window.backgroundCache.cacheBackground(
                source, 
                { title }, 
                imgElement.src
            );
            
            updateBackgroundInProgress = false;
        };
        
        fetchAndDisplayImage(onImageLoad).catch(error => {
            console.error('Error loading Reddit image:', error);
            loader.innerHTML = 'Error loading background. Reload to try again.';
            updateBackgroundInProgress = false;
        });
    } else if (source === 'earth') {
        const earthView = new EarthViewFetcher();
        try {
            const result = await earthView.getRandomEarthView();
            
            if (result) {                
                // Create image element
                const imgElement = document.createElement('img');
                imgElement.className = 'background-image';
                
                // Preload image
                imgElement.onload = async () => {
                    bgContainer.innerHTML = ''; // Remove loader
                    bgContainer.appendChild(imgElement);
                    
                    // Save current location for "Save Image" feature
                    window.currentEarthViewLocation = `${result.location.region ? `${result.location.region}` : ''}${result.location.region && result.location.country ? `, ` : ''}${result.location.country ? `${result.location.country}` : ''}`;
                    
                    // Create a proper location string that includes both region and country when available
                    const locationText = result.location.region && result.location.country 
                        ? `${result.location.region}, ${result.location.country}` 
                        : (result.location.region || result.location.country || 'Unknown Location');
                    
                    window.createOrUpdateLocationInfo(
                        locationText,
                        result.earthLink,
                        'View in Google Earth'
                    );
                    
                    // Cache the current background data with the new system
                    await window.backgroundCache.cacheBackground(
                        source, 
                        { 
                            location: result.location,
                            earthLink: result.earthLink
                        }, 
                        result.imageUrl
                    );
                    
                    updateBackgroundInProgress = false;
                };
                
                // Set image source to trigger the load
                imgElement.src = result.imageUrl;
            } else {
                updateBackgroundInProgress = false;
            }
        } catch (error) {
            console.error('Error loading Earth View image:', error);
            loader.innerHTML = 'Error loading background. Reload to try again.';
            updateBackgroundInProgress = false;
        }
    } else if (source === 'unsplash') {
        const unsplash = new UnsplashFetcher();
        
        // Check if we have a valid API key first
        try {
            const hasKey = await unsplash.hasValidApiKey();
            
            if (!hasKey) {
                loader.innerHTML = 'Please enter a valid Unsplash API key in settings to use this background source.';
                updateBackgroundInProgress = false;
                return;
            }
            
            const result = await unsplash.getRandomImage();
            
            if (result) {
                // Create image element
                const imgElement = document.createElement('img');
                imgElement.className = 'background-image';
                
                // Preload image
                imgElement.onload = async () => {
                    bgContainer.innerHTML = ''; // Remove loader
                    bgContainer.appendChild(imgElement);
                    
                    // Get actual location name and photographer information
                    const locationName = result.location.region ? result.location.region : 'Beautiful scene';
                    const photographerName = result.credit.name;
                    
                    // Save current location and photographer for "Save Image" feature
                    window.currentUnsplashLocation = locationName;
                    window.currentUnsplashPhotographer = photographerName;
                    
                    // Use the utility function to create or update location info with proper location name
                    window.createOrUpdateLocationInfo(
                        locationName,
                        result.credit.link,
                        `Photo by ${photographerName} on Unsplash`
                    );
                    
                    // Track download (required by Unsplash API terms)
                    unsplash.trackDownload(result.downloadLocation);
                    
                    // Cache the current background data with the new system
                    await window.backgroundCache.cacheBackground(
                        source, 
                        {
                            location: result.location,
                            credit: result.credit,
                            downloadLocation: result.downloadLocation
                        }, 
                        result.imageUrl
                    );
                    
                    updateBackgroundInProgress = false;
                };
                
                // Set image source to trigger the load
                imgElement.src = result.imageUrl;
            } else {
                loader.innerHTML = 'Error loading Unsplash image. Please check your API key.';
                updateBackgroundInProgress = false;
            }
        } catch (error) {
            console.error('Error loading Unsplash image:', error);
            loader.innerHTML = 'Error loading background. Please check your Unsplash API key.';
            updateBackgroundInProgress = false;
        }
    } else if (source === 'pixabay') {
        const pixabay = new PixabayFetcher();
        
        // Check if we have a valid API key first
        try {
            const hasKey = await pixabay.hasValidApiKey();
            
            if (!hasKey) {
                loader.innerHTML = 'Please enter a valid Pixabay API key in settings to use this background source.';
                updateBackgroundInProgress = false;
                return;
            }
            
            const result = await pixabay.getRandomImage();
            
            if (result) {
                // Create image element
                const imgElement = document.createElement('img');
                imgElement.className = 'background-image';
                
                // Preload image
                imgElement.onload = async () => {
                    bgContainer.innerHTML = ''; // Remove loader
                    bgContainer.appendChild(imgElement);
                    
                    // Get actual location name and photographer information
                    const locationName = result.location ? result.location : 'Beautiful scene';
                    const photographerName = result.photographer || 'Unknown Photographer';
                    
                    // Save current location and photographer for "Save Image" feature
                    window.currentPixabayLocation = locationName;
                    window.currentPixabayPhotographer = photographerName;
                    
                    // Use the utility function to create or update location info with proper location name
                    window.createOrUpdateLocationInfo(
                        locationName,
                        result.pageURL,
                        `Photo by ${photographerName} on Pixabay`
                    );
                    
                    // Track download (required by Pixabay API terms)
                    pixabay.trackDownload(result.id);
                    
                    // Cache the current background data with the new system
                    await window.backgroundCache.cacheBackground(
                        source, 
                        {
                            location: result.location,
                            photographer: result.photographer,
                            pageURL: result.pageURL
                        }, 
                        result.webformatURL
                    );
                    
                    updateBackgroundInProgress = false;
                };
                
                // Set image source to trigger the load
                imgElement.src = result.webformatURL;
            } else {
                loader.innerHTML = 'Error loading Pixabay image. Please check your API key.';
                updateBackgroundInProgress = false;
            }
        } catch (error) {
            console.error('Error loading Pixabay image:', error);
            loader.innerHTML = 'Error loading background. Please check your Pixabay API key.';
            updateBackgroundInProgress = false;
        }
    } else if (source === 'local') {
        // For local source, first check if we're using gallery or single image
        try {
            const result = await window.storage.get([
                'localImageSource', 
                'backgroundSchedule'
            ]);
            
            const imageSource = result.localImageSource || 'single';
            const scheduleOption = result.backgroundSchedule || 'manual';
            
            console.log(`Loading fresh local background with source: ${imageSource}, schedule: ${scheduleOption}`);
            
            // If using gallery and every-session schedule, bypass the applyLocalBackground 
            // function to ensure we get a truly random image
            if (imageSource === 'gallery' && scheduleOption === 'every-session') {
                console.log('Gallery with every-session: Directly selecting a random image');
                
                // Get random image with timestamp to ensure randomness
                if (typeof window.getRandomGalleryImage === 'function') {
                    try {
                        const image = await window.getRandomGalleryImage(Date.now());
                        
                        if (image) {
                            console.log('Successfully selected a random gallery image');
                            
                            // Create a blob URL for the image
                            let imageUrl;
                            if (image.imageBlob) {
                                imageUrl = URL.createObjectURL(image.imageBlob);
                            } else {
                                imageUrl = image.imageData || image.url;
                            }
                            
                            // Create and display the image
                            const imgElement = document.createElement('img');
                            imgElement.className = 'background-image';
                            imgElement.src = imageUrl;
                            
                            // Set onload handler
                            imgElement.onload = async () => {
                                // Make sure the background container still has the loading class
                                if (!bgContainer.classList.contains('gallery-loading')) {
                                    bgContainer.classList.add('gallery-loading');
                                }
                                
                                // Clear the container first
                                bgContainer.innerHTML = '';
                                
                                // Add the image to the container (while still invisible)
                                bgContainer.appendChild(imgElement);
                                
                                // Update location info
                                const location = image.location || 'Gallery image';
                                if (window.createOrUpdateLocationInfo) {
                                    window.createOrUpdateLocationInfo(location);
                                }
                                
                                // Save for "Save Image" feature
                                window.currentLocalImageLocation = location;
                                
                                // Cache the current selection
                                await window.backgroundCache.cacheBackground(
                                    source,
                                    { location },
                                    imageUrl
                                );
                                
                                // Delay before showing the image to ensure complete load
                                setTimeout(() => {
                                    // Remove the loading class and add the fade-in class
                                    bgContainer.classList.remove('gallery-loading');
                                    bgContainer.classList.add('gallery-fade-in');
                                    
                                    // Remove the fade-in class after animation completes
                                    setTimeout(() => {
                                        bgContainer.classList.remove('gallery-fade-in');
                                    }, 500);
                                    
                                    updateBackgroundInProgress = false;
                                }, 50);
                            };
                            
                            // Handle load error
                            imgElement.onerror = () => {
                                console.error('Error loading gallery image');
                                loader.innerHTML = 'Error loading gallery image. Reload to try again.';
                                updateBackgroundInProgress = false;
                            };
                            
                            return; // Exit early - we're handling the completion in onload
                        } else {
                            console.warn('No images found in gallery');
                            loader.innerHTML = 'No images found in gallery. Please add some images first.';
                        }
                    } catch (error) {
                        console.error('Error getting random gallery image:', error);
                        loader.innerHTML = 'Error accessing gallery. Please try again.';
                    }
                } else {
                    console.warn('getRandomGalleryImage function not available');
                    loader.innerHTML = 'Gallery function not available. Falling back to regular method.';
                }
            }
            
            // Fall back to normal local image handling for all other cases
            if (window.applyLocalBackground) {
                window.applyLocalBackground();
                
                // Wait for local background to apply, then cache it
                setTimeout(async () => {
                    const bgImage = bgContainer.querySelector('img');
                    
                    if (bgImage) {
                        // Cache the local image
                        const location = window.currentLocalImageLocation || 'Local Image';
                        await window.backgroundCache.cacheBackground(
                            source, 
                            { location }, 
                            bgImage.src
                        );
                    }
                    
                    updateBackgroundInProgress = false;
                }, 500);
            } else {
                // Handle case where applyLocalBackground is not available
                if (!window.localImagesLoaded) {
                    console.warn('Local background functionality not available, attempting to load it');
                    await loadLocalImagesScript();
                    
                    if (window.applyLocalBackground) {
                        window.applyLocalBackground();
                        updateBackgroundInProgress = false;
                    } else {
                        console.error('Local background functionality still not available after loading script');
                        loader.innerHTML = 'Error: Could not load local background functionality';
                        updateBackgroundInProgress = false;
                    }
                } else {
                    console.error('Local background functionality not available despite script being loaded');
                    loader.innerHTML = 'Error: Local background functionality not available';
                    updateBackgroundInProgress = false;
                }
            }
        } catch (error) {
            console.error('Error handling local background:', error);
            loader.innerHTML = 'Error loading local background';
            updateBackgroundInProgress = false;
        }
    } else {
        updateBackgroundInProgress = false;
    }
}

// Helper function to load the localImages.js script dynamically
async function loadLocalImagesScript() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/js/localImages.js';
        script.onload = () => {
            console.log('Successfully loaded localImages.js');
            window.localImagesLoaded = true;
            setTimeout(resolve, 200); // Give a small delay for initialization
        };
        script.onerror = () => {
            console.error('Failed to load localImages.js');
            reject(new Error('Failed to load localImages.js'));
        };
        document.head.appendChild(script);
    });
}



// Show/hide source-specific settings
function updateBackgroundSourceSettings(source) {
    // Hide all source-specific settings first
    document.querySelectorAll('.sub-settings').forEach(el => {
        el.style.display = 'none';
    });
    // Show relevant settings based on source
    if (source === 'reddit') {
        document.getElementById('reddit-settings').style.display = 'block';
    } else if (source === 'unsplash') {
        document.getElementById('unsplash-settings').style.display = 'block';
    } else if (source === 'pixabay') {
        document.getElementById('pixabay-settings').style.display = 'block';
    } else if (source === 'imgur') {
        document.getElementById('imgur-settings').style.display = 'block';
        // Refresh Imgur dropdown and selection on source change
        if (window.manageSavedImgurUrls && typeof window.manageSavedImgurUrls().loadSavedImgurUrls === 'function') {
            window.manageSavedImgurUrls().loadSavedImgurUrls();
        }
    } else if (source === 'local') {
        document.getElementById('local-settings').style.display = 'block';
    }
}

// Load settings from storage
document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners for settings changes
    const cleanUICheckbox = document.getElementById('clean-ui');
    if (cleanUICheckbox) {
        cleanUICheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            window.storage.set({ cleanUI: isChecked });
            updateCleanUI(isChecked);
        });
    }
    
    // Set up event listener for bookmarks hover-hide feature
    const bookmarksHoverHideCheckbox = document.getElementById('bookmarks-hover-hide');
    if (bookmarksHoverHideCheckbox) {
        bookmarksHoverHideCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            window.storage.set({ bookmarksHoverHide: isChecked });
            updateBookmarksHoverHide(isChecked);
        });
    }
    
    // Initialize imgur URL management
    const imgurUrlManager = manageSavedImgurUrls();
    
    // Add event listener for Enter key in name input field
    const imgurNameInput = document.getElementById('imgur-url-name');
    if (imgurNameInput) {
        imgurNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const saveImgurUrlBtn = document.getElementById('save-imgur-url');
                if (saveImgurUrlBtn) {
                    saveImgurUrlBtn.click();
                }
            }
        });
    }
    
    // Add event listener for Enter key in URL input field
    const imgurUrlInput = document.getElementById('imgur-url');
    if (imgurUrlInput) {
        imgurUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const saveImgurUrlBtn = document.getElementById('save-imgur-url');
                if (saveImgurUrlBtn) {
                    saveImgurUrlBtn.click();
                }
            }
        });
    }
    
    // Set up greeting checkbox listener
    const greetingCheckbox = document.getElementById('show-greeting');
    if (greetingCheckbox) {
        greetingCheckbox.addEventListener('change', (e) => {
            const showGreeting = e.target.checked;
            
            // Enable/disable weather and clock checkboxes based on greeting state
            const weatherCheckbox = document.getElementById('show-weather');
            const clockCheckbox = document.getElementById('show-clock');
            
            if (showGreeting) {
                if (weatherCheckbox) {
                    weatherCheckbox.disabled = true;
                    weatherCheckbox.parentElement.classList.add('disabled-option');
                    weatherCheckbox.parentElement.setAttribute('title', 'Disabled when AI greeting is active');
                }
                if (clockCheckbox) {
                    clockCheckbox.disabled = true;
                    clockCheckbox.parentElement.classList.add('disabled-option');
                    clockCheckbox.parentElement.setAttribute('title', 'Disabled when AI greeting is active');
                }
            } else {
                if (weatherCheckbox) {
                    weatherCheckbox.disabled = false;
                    weatherCheckbox.parentElement.classList.remove('disabled-option');
                    weatherCheckbox.parentElement.removeAttribute('title');
                }
                if (clockCheckbox) {
                    clockCheckbox.disabled = false;
                    clockCheckbox.parentElement.classList.remove('disabled-option');
                    clockCheckbox.parentElement.removeAttribute('title');
                }
            }
            
            // Update greeting visibility
            window.updateGreetingVisibility(showGreeting);
        });
    }
    
    // Load settings with a slight delay to ensure all DOM elements are ready
    setTimeout(() => {
        loadSettings().then(() => {
            // Remove loading class once all settings are applied
            document.body.classList.remove('settings-loading');
        });
    }, 100);
});