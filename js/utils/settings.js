// settings.js - Manages settings menu functionality

// Settings container
const settingsContainer = document.getElementById('settingsDropdown');
const settingsButton = document.getElementById('settingsButton');

// Toggle settings visibility when settings button is clicked
if (settingsButton) {
    settingsButton.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (settingsContainer) {
            settingsContainer.classList.toggle('active');
        }
    });

    // Close settings when clicking outside
    document.addEventListener('click', function (e) {
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
            if (window.updateBackgroundOpacity) {
                window.updateBackgroundOpacity(parseFloat(opacity));
            } else {
                bgContainer.style.opacity = parseFloat(opacity);
            }

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
                            if (window.updateBackground) {
                                window.updateBackground('imgur', true);
                            }

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
                        if (window.updateBackground) {
                            window.updateBackground('imgur', true);
                        }
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
        if (window.updateBackgroundOpacity) {
            window.updateBackgroundOpacity(parsedOpacity);
        }

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
        if (window.updateBackground) {
            window.updateBackground(backgroundSource);
        }

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

        // Remove loading class to show widgets
        document.body.classList.remove('settings-loading');
    } catch (error) {
        console.error('Error loading settings:', error);
        // Ensure widgets are shown even if there's an error
        document.body.classList.remove('settings-loading');
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
        });
    }
});