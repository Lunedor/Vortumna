(function() {
    'use strict'; // Enforce stricter parsing and error handling

    // --- Helper Functions ---

    /**
     * Safely executes a function if it exists and is callable.
     * @param {Function|undefined} fn The function to execute.
     * @param {string} fnName The name of the function (for logging).
     * @param {boolean} isCritical Log error instead of warning if true.
     * @param {...any} args Arguments to pass to the function.
     * @returns {any|undefined} The result of the function or undefined if execution failed.
     */
    function safeExecute(fn, fnName, isCritical = false, ...args) {
        if (typeof fn === 'function') {
            try {
                return fn(...args);
            } catch (error) {
                console.error(`Error executing function '${fnName}':`, error);
                return undefined;
            }
        } else {
            const log = isCritical ? console.error : console.warn;
            log(`Function '${fnName}' not found or is not a function.`);
            return undefined;
        }
    }

    /**
     * Finds an element and adds an event listener safely.
     * @param {string} selector CSS selector for the element.
     * @param {string} event The event type (e.g., 'click', 'change').
     * @param {Function} handler The event handler function.
     * @param {boolean} required Log error if element not found and required is true.
     * @returns {Element|null} The found element or null.
     */
    function safeAddEventListener(selector, event, handler, required = false) {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            const message = `Element with selector '${selector}' not found for event '${event}'.`;
            if (required) {
                console.error(message + " Required functionality may be broken.");
            } else {
                console.warn(message);
            }
        }
        return element; // Return element for potential chaining or reuse
    }

    /**
     * Adds an event listener to an already found element.
     * @param {Element|null} element The DOM element.
     * @param {string} elementName A descriptive name for the element (for logging).
     * @param {string} event The event type.
     * @param {Function} handler The event handler function.
     */
     function addListenerToElement(element, elementName, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element variable '${elementName}' is null or undefined, cannot add ${event} listener.`);
        }
    }

    // --- Core Logic ---
    /**
     * Ensures storage is properly initialized before proceeding
     * @returns {Promise} Resolves when storage is ready
     */
    async function ensureStorageInitialized() {
        return new Promise(resolve => {
            // If storage doesn't exist at all, we have a critical problem
            if (typeof window.storage === 'undefined') {
                console.error("CRITICAL: Storage module not found. Checking if it can be initialized...");
                
                // Wait a moment in case it's being loaded asynchronously
                setTimeout(() => {
                    if (typeof window.storage !== 'undefined') {
                        // Storage appeared, now wait for it to initialize
                        if (window.storage.initialized) {
                            console.log("Storage appeared and is already initialized.");
                            resolve();
                        } else {
                            console.log("Storage appeared but waiting for initialization...");
                            document.addEventListener('storage-ready', () => {
                                console.log("Storage initialization completed via event.");
                                resolve();
                            }, { once: true });
                            
                            // Safety timeout
                            setTimeout(() => {
                                console.warn("Storage initialization timed out, proceeding anyway.");
                                resolve();
                            }, 3000);
                        }
                    } else {
                        // Still no storage, this is critical but we'll continue
                        console.error("CRITICAL: Storage module could not be found. Many features will fail.");
                        resolve();
                    }
                }, 500);
            } else {
                // Storage exists, check if it's initialized
                if (window.storage.initialized) {
                    resolve();
                } else {
                    
                    // Listen for initialization complete event
                    document.addEventListener('storage-ready', () => {
                        resolve();
                    }, { once: true });
                    
                    // Safety timeout
                    setTimeout(() => {
                        //console.warn("Storage initialization timed out, proceeding anyway.");
                        resolve();
                    }, 3000);
                }
            }
        });
    }
    
    document.addEventListener('DOMContentLoaded', async function() {
        const body = document.querySelector('body');
        const html = document.querySelector('html');

        if (!body || !html) {
            console.error("CRITICAL: Could not find <body> or <html> elements. Aborting initialization.");
            return;
        }

        // Hide body immediately to prevent flash of unstyled content
        body.style.display = 'none';
        html.style.backgroundColor = '#171717';// --- 1. Initial Setup & Clearing Caches ---
        safeExecute(clearBackgroundCache, 'clearBackgroundCache');        // --- 2. Core Settings Loading ---
        
        // First ensure storage is initialized - using a proper Promise-based approach
        await ensureStorageInitialized();
        
        // Now that storage is guaranteed to be initialized, load settings
        if (safeExecute(window.loadSettings, 'loadSettings', true) !== undefined) { // loadSettings is critical
            // Ensure quote settings are initialized after loadSettings potentially runs
            if (!window.quoteSettings) {
                console.warn("window.quoteSettings not initialized by loadSettings(). Providing default.");
                window.quoteSettings = { contentType: 'stoic' };
            }
        } else {
            console.error("CRITICAL: loadSettings failed or not found. Using default settings.");
            window.quoteSettings = window.quoteSettings || { contentType: 'stoic' }; // Ensure default if load fails
        }// Apply visual styles from settings
        safeExecute(window.applyTheme, 'applyTheme');
        safeExecute(applyDisplayModeOnLoad, 'applyDisplayModeOnLoad');
        
        // Make updateBackgroundImageMode available globally
        function updateBackgroundImageMode(mode) {
            const backgroundContainer = document.getElementById('background-container');
            if (!backgroundContainer) {
                console.warn("Background container not found in updateBackgroundImageMode.");
                return;
            }
            const currentImage = backgroundContainer.querySelector('img');
            if (!currentImage) {
                // console.log("No image found in background container to apply mode."); // Less noisy log
                return;
            }
            if (mode === 'contain') {
                currentImage.classList.add('contain-mode');
                currentImage.classList.remove('cover-mode'); // Ensure exclusive class if used
                currentImage.style.objectFit = 'contain'; // Explicit style
                backgroundContainer.style.backgroundColor = '#000'; // Add black bars if needed
            } else { // Default to 'cover'
                currentImage.classList.remove('contain-mode');
                currentImage.classList.add('cover-mode'); // Ensure exclusive class if used
                currentImage.style.objectFit = 'cover'; // Explicit style
                backgroundContainer.style.backgroundColor = ''; // Remove background color
            }
            currentImage.dataset.modeApplied = 'true'; // Mark that mode has been applied
        }
        
        // Ensure the function is properly exposed to window scope
        window.updateBackgroundImageMode = updateBackgroundImageMode;

        // Make updateToggleButtonIcon available globally
        function updateToggleButtonIcon(mode) {
            const fullscreenToggleBtn = document.getElementById('fullscreenToggleBtn');
            if (!fullscreenToggleBtn) {
                // console.warn("Fullscreen toggle button not found in updateToggleButtonIcon."); // Less noisy log
                return;
            }
            const iconSpan = fullscreenToggleBtn.querySelector('span'); // Assuming icon is in a span
            if (!iconSpan) {
                 console.warn("Icon span within fullscreen toggle button not found.");
                 return;
            }

            if (mode === 'contain') {
                iconSpan.textContent = '🡘'; // Expand icon
                fullscreenToggleBtn.title = 'Switch to fill screen mode (Cover)';
            } else { // Default to 'cover'
                iconSpan.textContent = '🡙'; // Fit icon
                fullscreenToggleBtn.title = 'Switch to fit image mode (Contain)';
            }
        }
        
        // Ensure the function is properly exposed to window scope
        window.updateToggleButtonIcon = updateToggleButtonIcon;

        // --- 3. UI Component Setup ---
        safeExecute(window.populateSubredditDropdown, 'populateSubredditDropdown', false, 'subreddit-dropdown-container');
        safeExecute(setupApiKeys, 'setupApiKeys'); // Local function, should exist
        safeExecute(setupVisibilityToggles, 'setupVisibilityToggles'); // Local function
        safeExecute(setupUIEventListeners, 'setupUIEventListeners'); // Local function

        // --- 4. Component Data Initialization ---
        safeExecute(window.getLocationAndWeather, 'getLocationAndWeather');
        safeExecute(window.initQuotes, 'initQuotes');
        safeExecute(window.loadBookmarks, 'loadBookmarks');

        // --- 5. Set up autocomplete features ---
        safeExecute(window.setupAutocomplete, 'setupAutocomplete');
        safeExecute(setupCityAutocomplete, 'setupCityAutocomplete'); // Local function        // --- 6. Final UI components ---
        safeExecute(setupFullscreenToggle, 'setupFullscreenToggle');
        safeExecute(setupRefreshButtons, 'setupRefreshButtons'); // Local function
        safeExecute(window.setupKeyboardShortcuts, 'setupKeyboardShortcuts');

        // --- 7. Chrome API Listeners ---
        safeExecute(setupChromeListeners, 'setupChromeListeners'); // Local function

        // Show the body after a delay to allow rendering
        // Note: This timeout is a pragmatic approach. A more complex solution
        // might involve promises tracking all async operations, but this is simpler.
        setTimeout(() => {
            body.style.display = 'block';
            html.style.backgroundColor = 'transparent';
        }, 500); // Keep the delay, potentially adjust if needed
    });

    // --- Setup Functions (Defined within IIFE scope) ---

    function setupApiKeys() {
        // OpenWeather API Key
        setupApiKeyButton(
            'openweather-api-key', 'save-openweather-key', 'openweather-api-key',
            () => {
                safeExecute(window.getLocationAndWeather, 'getLocationAndWeather (after OpenWeather key save)');
                safeExecute(setupCityAutocomplete, 'setupCityAutocomplete (after OpenWeather key save)');
            },
            () => {
                 safeExecute(window.getLocationAndWeather, 'getLocationAndWeather (after OpenWeather key forget)');
            }
        );

        // Unsplash API Key
        setupApiKeyButton(
            'unsplash-api-key', 'save-unsplash-key', 'unsplashApiKey',
            (apiKey) => {
                if (window.storage) {
                    window.storage.get('backgroundSource').then(result => {
                        const backgroundSource = result.backgroundSource;
                        if (backgroundSource === 'unsplash') {
                            safeExecute(window.updateBackground, 'updateBackground (after Unsplash key save)', false, 'unsplash');
                        }
                    }).catch(err => console.error("Error getting backgroundSource after Unsplash key save:", err));
                }
            },
            () => {
                if (window.storage) {
                    window.storage.get('backgroundSource').then(result => {
                        const backgroundSource = result.backgroundSource;
                        if (backgroundSource === 'unsplash') {
                            const redditRadio = document.getElementById('reddit-background');
                            if (redditRadio) redditRadio.checked = true;
                            else console.warn("Reddit background radio button not found during Unsplash key forget.");

                            window.storage.set({ backgroundSource: 'reddit' }).then(() => {
                                safeExecute(window.updateBackground, 'updateBackground (after Unsplash key forget)', false, 'reddit');
                            }).catch(err => console.error("Error setting backgroundSource to reddit:", err));
                        }
                    }).catch(err => console.error("Error getting backgroundSource after Unsplash key forget:", err));
                }
            }
        );

        // Gemini API Key
        setupApiKeyButton(
            'gemini-api-key', 'save-gemini-key', 'geminiApiKey',
            () => {
                safeExecute(window.resetGeminiComponents, 'resetGeminiComponents (after Gemini key save)');
                safeExecute(window.fetchModels, 'fetchModels (after Gemini key save)');
            },
            () => {
                safeExecute(window.resetGeminiComponents, 'resetGeminiComponents (after Gemini key forget)');
            }
        );

        // OpenRouter API Key
        setupApiKeyButton(
            'openrouter-api-key', 'save-openrouter-key', 'openrouterApiKey',
            () => {
                safeExecute(window.resetOpenRouterComponents, 'resetOpenRouterComponents (after OpenRouter key save)');
            },
            () => {
                safeExecute(window.resetOpenRouterComponents, 'resetOpenRouterComponents (after OpenRouter key forget)');
            }
        );

        // User name input
        setupApiKeyButton(
            'user-name-input', 'save-user-name', 'userName',
            () => {
                if (window.aiGreetings && typeof window.aiGreetings.updateGreetingDisplay === 'function') {
                   safeExecute(window.aiGreetings.updateGreetingDisplay, 'aiGreetings.updateGreetingDisplay (after username save)');
                } else { console.warn("window.aiGreetings.updateGreetingDisplay not available after username save."); }
            },
            () => {
                 if (window.aiGreetings) {
                     window.aiGreetings.greetingsCache = null; // Clear cache on forget
                     console.log("Cleared AI greetings cache after username forget.");
                 }
            }
        );        // Add greeting mood selector handling
        safeAddEventListener('#greeting-mood', 'change', function() {
            const selectedMood = this.value;
            if (window.storage) {
                window.storage.set({ greetingMood: selectedMood }).then(() => {
                    // Ensure greeting visibility is maintained
                    window.storage.set({ showGreeting: true }).then(() => {
                        if (window.aiGreetings && typeof window.aiGreetings.updateGreetingDisplay === 'function') {
                            // Make sure greeting is visible
                            if (window.updateGreetingVisibility) {
                                safeExecute(window.updateGreetingVisibility, 'updateGreetingVisibility (before greeting update)', false, true);
                            }
                            safeExecute(window.aiGreetings.updateGreetingDisplay, 'aiGreetings.updateGreetingDisplay (after mood change)');
                        } else { console.warn("window.aiGreetings.updateGreetingDisplay not available after mood change."); }
                    });
                }).catch(err => console.error("Error saving greeting mood:", err));
            } else {
                console.error("Storage module not available for saving greeting mood.");
            }
        });        // Only set up fetch/start button if it exists in the DO
    }

    function setupVisibilityToggles() {
        const visibilityCheckboxes = [
            { id: 'show-bookmarks', key: 'showBookmarks', fn: window.updateBookmarksVisibility, updatesShowAll: true },
            { id: 'show-weather', key: 'showWeather', fn: window.updateWeatherVisibility, updatesShowAll: true },
            { id: 'show-clock', key: 'showClock', fn: window.updateClockVisibility, updatesShowAll: true },
            { id: 'show-greeting', key: 'showGreeting', fn: window.updateGreetingVisibility, updatesShowAll: true },
            { id: 'show-google-search', key: 'showGoogleSearch', fn: window.updateGoogleSearchVisibility, updatesShowAll: true },
            { id: 'show-location-info', key: 'showLocationInfo', fn: window.updateLocationInfoVisibility, updatesShowAll: true },
            { id: 'show-background', key: 'showBackground', fn: window.updateBackgroundVisibility, updatesShowAll: true },
            { id: 'show-quotes', key: 'showQuotes', fn: window.updateQuotesVisibility, updatesShowAll: true },
        ];

        // Setup individual toggles
        visibilityCheckboxes.forEach(config => {
            const checkbox = document.getElementById(config.id);
            if (checkbox) {
                checkbox.addEventListener('change', function() {
                    const isVisible = this.checked;
                    if (!window.storage) {
                        console.error(`Storage module not available for saving visibility: ${config.key}`);
                        this.checked = !isVisible; // Revert UI change
                        return;
                    }
                    window.storage.set({ [config.key]: isVisible }).then(() => {
                        safeExecute(config.fn, `Update function for ${config.id}`, false, isVisible);
                        if (config.updatesShowAll) {
                            safeExecute(window.updateShowAllCheckbox, 'updateShowAllCheckbox');
                        }
                    }).catch(err => {
                         console.error(`Error saving visibility setting ${config.key}:`, err);
                         this.checked = !isVisible; // Revert UI on error
                    });
                });
            } else {
                console.warn(`Visibility checkbox element with ID "${config.id}" not found.`);
            }
        });

        // 'Show All' Toggle
        const showAllCheckbox = document.getElementById('show-all');
        if (showAllCheckbox) {
            showAllCheckbox.addEventListener('change', function() {
                const showAll = this.checked;
                if (!window.storage) {
                    console.error("Storage module not available for 'show all' toggle");
                    this.checked = !showAll; // Revert UI change
                    return;
                }

                const updates = { showAll: showAll };
                visibilityCheckboxes.forEach(config => {
                     if (config.updatesShowAll) { // Only toggle items affected by Show All
                         updates[config.key] = showAll;
                     }
                });

                window.storage.set(updates).then(() => {
                    visibilityCheckboxes.forEach(config => {
                         if (config.updatesShowAll) { // Only update items affected by Show All
                            const checkbox = document.getElementById(config.id);
                            if (checkbox) checkbox.checked = showAll;
                            safeExecute(config.fn, `Update function for ${config.id} in 'show-all'`, false, showAll);
                         }
                    });
                    console.log(`Set 'showAll' state to ${showAll}`);
                }).catch(err => {
                    console.error("Error saving 'show all' settings:", err);
                    this.checked = !showAll; // Revert UI on error
                });
            });
        } else {
            console.warn("Element with ID 'show-all' not found.");
        }
    }

    function setupUIEventListeners() {
        safeExecute(setupSpotifyControls, 'setupSpotifyControls');
        safeExecute(setupQuoteSettings, 'setupQuoteSettings');
        safeExecute(setupSettingsMenu, 'setupSettingsMenu');
        safeExecute(setupLocationSettings, 'setupLocationSettings');
        safeExecute(setupBackgroundSettings, 'setupBackgroundSettings');
        safeExecute(setupSearchFunctionality, 'setupSearchFunctionality');
        safeExecute(setupBookmarkHandlers, 'setupBookmarkHandlers');
    }

    function setupSpotifyControls() {
        safeAddEventListener('#spotify-login-btn', 'click', () => safeExecute(window.loginToSpotify, 'loginToSpotify'), false);
        safeAddEventListener('#spotify-logout-btn', 'click', () => safeExecute(window.logoutFromSpotify, 'logoutFromSpotify'), false);

        safeAddEventListener('#playlistDropdown', 'change', function() {
            const playlistId = this.value;
            if (playlistId) {
                safeExecute(window.displaySelectedPlaylist, 'displaySelectedPlaylist', false, playlistId);
                if (window.storage) {
                    window.storage.setLocal({ 'current_playlist': playlistId, 'current_search': '' })
                        .catch(err => console.error("Error saving current playlist locally:", err));
                } else {
                    console.warn("Local storage unavailable for Spotify playlist selection.");
                }
            }
        }, false); // Dropdown might not always be present if not logged in

        safeExecute(window.updateSpotifyLoginStatus, 'updateSpotifyLoginStatus');

        if (window.storage) {
            window.storage.getLocal(['currently_playing_content', 'currently_playing_type']).then(result => {
                if (result.currently_playing_content && result.currently_playing_type) {
                    safeExecute(window.updateIframeContent, 'updateIframeContent (on load)', false, result.currently_playing_content, result.currently_playing_type);
                } else {
                    console.log("No Spotify content stored as currently playing on load.");
                }
            }).catch(error => {
                console.error("Error loading initial Spotify content:", error);
            });
        } else {
            console.warn("Local storage unavailable for initial Spotify content load.");
        }
    }

    function setupQuoteSettings() {
        const quoteContentSelect = safeAddEventListener('#quote-content', 'change', function(e) {
            const contentType = e.target.value;

            if (!window.quoteSettings) {
                console.error('window.quoteSettings object is missing during change event.');
                return;
            }
            window.quoteSettings.contentType = contentType;

            if (!window.storage) {
                 console.error("Storage module not available for saving quote settings");
                 return;
            }
            window.storage.set({ quoteSettings: window.quoteSettings }).then(() => {
                console.log(`Quote content type set to: ${contentType}`);
                safeExecute(window.loadQuotes, 'loadQuotes (after setting change)');
            }).catch(err => console.error("Error saving quote settings:", err));
        });

        // Initialize dropdown value
        if (quoteContentSelect && window.quoteSettings && window.quoteSettings.contentType) {
             try {
                 quoteContentSelect.value = window.quoteSettings.contentType;
             } catch (e) {
                 console.warn(`Failed to set quote dropdown initial value to ${window.quoteSettings.contentType}:`, e);
             }
        } else if (quoteContentSelect) {
             console.warn("Could not set initial value for quote dropdown - quoteSettings missing or invalid.");
        }
    }    function setupSettingsMenu() {
        const settingsContainer = document.getElementById('settingsContainer');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsDropdown = document.getElementById('settingsDropdown');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');
        const saveOpenWeatherKeyBtn = document.getElementById('save-openweather-key'); // Needed for update on open

        if (!settingsContainer || !settingsBtn || !settingsDropdown) {
            console.warn("Settings menu elements (container, button, or dropdown) not found.");
            return;
        }

        addListenerToElement(settingsBtn, 'settingsBtn', 'click', (e) => {
            e.stopPropagation(); // Prevent click from immediately closing menu
            settingsDropdown.classList.toggle('visible');

            // Update OpenWeather button state when settings are opened
            if (settingsDropdown.classList.contains('visible') && saveOpenWeatherKeyBtn && window.storage) {
                window.storage.get('openweather-api-key').then(result => {
                    const savedKey = result['openweather-api-key'];
                    saveOpenWeatherKeyBtn.textContent = savedKey ? 'Forget' : 'Save';
                    saveOpenWeatherKeyBtn.style.backgroundColor = savedKey ? '#dc3545' : 'rgb(29, 186, 84)';
                }).catch(err => console.error("Error reading OpenWeather key for button state:", err));
            }
        });
        
        // Add event listener for the close button
        if (closeSettingsBtn) {
            addListenerToElement(closeSettingsBtn, 'closeSettingsBtn', 'click', () => {
                settingsDropdown.classList.remove('visible');
            });
        }

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!settingsContainer.contains(e.target) && settingsDropdown.classList.contains('visible')) {
                settingsDropdown.classList.remove('visible');
            }
        });

        // Close menu with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && settingsDropdown.classList.contains('visible')) {
                settingsDropdown.classList.remove('visible');
            }
        });
    }

     function setupLocationSettings() {
        const customLocationRadio = document.getElementById('custom-location');
        const autoLocationRadio = document.getElementById('auto-location');
        const customLocationInputDiv = document.getElementById('custom-location-input');
        const saveLocationBtn = document.getElementById('save-location');
        const cityInput = document.getElementById('city-input');

        if (!customLocationRadio || !autoLocationRadio || !customLocationInputDiv) {
            console.warn("Location setting radio buttons or input div not found.");
            // Don't set up listeners if essential elements are missing
        } else {
            addListenerToElement(customLocationRadio, 'customLocationRadio', 'change', () => {
                customLocationInputDiv.classList.remove('hidden');
                if (window.storage) {
                    window.storage.set({ useAutoLocation: false })
                        .catch(err => console.error("Error saving location setting (custom):", err));
                } else { console.error("Storage module unavailable for location setting."); }
            });

            addListenerToElement(autoLocationRadio, 'autoLocationRadio', 'change', () => {
                customLocationInputDiv.classList.add('hidden');
                if (window.storage) {
                    window.storage.set({ useAutoLocation: true }).then(() => {
                        console.log("Switched to auto location. Clearing custom city and weather cache.");
                        return Promise.all([
                            window.storage.remove('customCity'),
                            window.storage.remove('weatherCache')
                        ]);
                    }).then(() => {
                        safeExecute(window.getLocationAndWeather, 'getLocationAndWeather (after switching to auto)');
                    }).catch(err => console.error("Error saving location setting (auto) or clearing cache:", err));
                } else { console.error("Storage module unavailable for location setting."); }
            });
        }

        if (!saveLocationBtn || !cityInput) {
            console.warn("Save location button or city input element not found.");
        } else {
            const handleSaveLocation = () => {
                const city = cityInput.value.trim();
                if (city) {
                    if (window.storage) {
                        window.storage.set({ customCity: city }).then(() => {
                            safeExecute(window.fetchWeatherByCity, 'fetchWeatherByCity', false, city);
                            cityInput.value = ''; // Clear input after save
                        }).catch(err => console.error("Error saving custom city:", err));
                    } else { console.error("Storage module unavailable for saving custom city."); }
                } else {
                    safeExecute(window.showFeedback, 'showFeedback', false, "Please enter a city name.", false);
                }
            };

            addListenerToElement(saveLocationBtn, 'saveLocationBtn', 'click', handleSaveLocation);
            addListenerToElement(cityInput, 'cityInput', 'keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission if applicable
                    handleSaveLocation();
                }
            });
        }
    }

    function setupBackgroundSettings() {
        // Background Source Selection
        document.querySelectorAll('input[name="background-source"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const source = this.value;
                if (!window.storage) {
                     console.error("Storage module unavailable for saving background source.");
                     // Consider reverting the radio button state here if desired
                     return;
                }
                window.storage.set({ backgroundSource: source }).then(() => {
                    console.log(`Background source set to: ${source}`);
                    safeExecute(window.updateBackground, 'updateBackground (after source change)', false, source);
                    safeExecute(window.updateBackgroundSourceSettings, 'updateBackgroundSourceSettings', false, source);
                }).catch(err => console.error("Error saving background source:", err));
            });
        });

        // Background Opacity Slider
        const bgOpacitySlider = document.getElementById('bg-opacity');
        const opacityValue = document.getElementById('opacity-value');

        if (bgOpacitySlider && opacityValue) {
            const updateOpacityDisplay = (opacity) => {
                 opacityValue.textContent = `${Math.round(opacity * 100)}%`;
                 safeExecute(window.updateBackgroundOpacity, 'updateBackgroundOpacity', false, opacity);
            };

             addListenerToElement(bgOpacitySlider, 'bgOpacitySlider', 'input', function() {
                const opacity = parseFloat(this.value);
                 if (!window.storage) {
                     console.error("Storage module unavailable for saving background opacity.");
                     // Optionally revert slider position
                     return;
                 }
                 window.storage.set({ bgOpacity: opacity }).then(() => {
                     updateOpacityDisplay(opacity);
                 }).catch(err => console.error("Error saving background opacity:", err));
            });

            // Set initial text display for opacity
            if (window.storage) {
                window.storage.get('bgOpacity').then(result => {
                    // Use stored value, or current slider value, or default to 1 if all else fails
                    const initialOpacity = result.bgOpacity !== undefined
                        ? result.bgOpacity
                        : (bgOpacitySlider.value ? parseFloat(bgOpacitySlider.value) : 1.0);
                     bgOpacitySlider.value = initialOpacity; // Ensure slider matches value
                     updateOpacityDisplay(initialOpacity);
                }).catch(err => {
                    console.error("Error loading initial background opacity:", err);
                    // Fallback to current slider value or default
                     const fallbackOpacity = bgOpacitySlider.value ? parseFloat(bgOpacitySlider.value) : 1.0;
                     updateOpacityDisplay(fallbackOpacity);
                });
            } else {
                 console.warn("Storage unavailable for initial opacity load. Using slider default.");
                 const fallbackOpacity = bgOpacitySlider.value ? parseFloat(bgOpacitySlider.value) : 1.0;
                 updateOpacityDisplay(fallbackOpacity);
            }
        } else {
            console.warn("Background opacity slider or value display element not found.");
        }
    }

    function setupSearchFunctionality() {
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchBtn');
        let isSearchAllowed = true;
        const SEARCH_COOLDOWN = 1000; // ms

        if (searchButton && searchInput) {
            const handleSearch = () => {
                if (!isSearchAllowed) {
                    console.log("Search cooldown active.");
                    return;
                }
                isSearchAllowed = false;
                setTimeout(() => { isSearchAllowed = true; }, SEARCH_COOLDOWN);

                safeExecute(window.performSearch, 'performSearch', false, searchInput.value);
            };

            addListenerToElement(searchButton, 'searchButton', 'click', handleSearch);
            addListenerToElement(searchInput, 'searchInput', 'keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent default form submission/newline
                    handleSearch();
                }
            });
        } else {
            console.warn("Search input or button element not found.");
        }

        // Expandable Content Toggle
        const toggleExpandBtn = document.getElementById('toggleExpandBtn');
        const expandableContent = document.getElementById('expandableContent');

        if (toggleExpandBtn && expandableContent) {
             // Initial state: collapsed (CSS should ideally handle this, but JS ensures it)
            expandableContent.style.maxHeight = "0px";
            expandableContent.style.overflow = "hidden"; // Ensure content is clipped
            expandableContent.style.transition = "max-height 0.3s ease-out"; // Smooth transition

            addListenerToElement(toggleExpandBtn, 'toggleExpandBtn', 'click', function() {
                 const isExpanded = expandableContent.style.maxHeight !== "0px";
                if (isExpanded) {
                     // Start closing transition
                     expandableContent.style.maxHeight = expandableContent.scrollHeight + "px"; // Set to current height
                     requestAnimationFrame(() => { // Ensure the height is set before transitioning to 0
                         expandableContent.style.maxHeight = "0px";
                     });
                     toggleExpandBtn.setAttribute('aria-expanded', 'false');
                } else {
                     // Calculate height needed and start opening transition
                    const scrollHeight = expandableContent.scrollHeight;
                    expandableContent.style.maxHeight = scrollHeight + "px";
                    toggleExpandBtn.setAttribute('aria-expanded', 'true');
                }
            });
        } else {
            console.warn("Expand toggle button or content element not found.");
        }
    }

     function setupBookmarkHandlers() {
        safeAddEventListener('#bookmarkForm', 'submit', (e) => safeExecute(window.handleBookmarkSubmit, 'handleBookmarkSubmit', false, e), false);
        safeAddEventListener('#cancelAddBookmark', 'click', () => safeExecute(window.hideAddBookmarkForm, 'hideAddBookmarkForm'), false);
    }

    function setupChromeListeners() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.runtime) {
            // Storage Change Listener
            chrome.storage.onChanged.addListener((changes, namespace) => {
                // Check for specific key changes and call relevant update functions
                if ((changes.currently_playing_content || changes.currently_playing_type) && namespace === 'local') {
                    if (window.storage) {
                        window.storage.getLocal(['currently_playing_content', 'currently_playing_type']).then(result => {
                            if (result.currently_playing_content && result.currently_playing_type) {
                                safeExecute(window.updateIframeContent, 'updateIframeContent (from storage change)', false, result.currently_playing_content, result.currently_playing_type);
                            }
                        }).catch(err => console.error("Error getting Spotify content after storage change:", err));
                    } else {
                         console.warn("Storage unavailable for Spotify update on storage change.");
                    }
                }

                if (changes.theme && namespace === 'sync') { // Assuming theme is in sync storage
                    safeExecute(window.applyTheme, 'applyTheme (from storage change)');
                }

                 if (changes.quoteSettings && namespace === 'sync') { // Assuming quote settings are in sync
                     console.log("Quote settings changed in storage, re-initializing quotes.");
                     safeExecute(window.initQuotes, 'initQuotes (from storage change)');
                 }

                 // Add other storage change handlers as needed...
                 if (changes.backgroundImageDisplayMode && namespace === 'sync') {
                     const newMode = changes.backgroundImageDisplayMode.newValue;
                     if (newMode) {
                         safeExecute(window.updateBackgroundImageMode, 'updateBackgroundImageMode (from storage change)', false, newMode);
                         safeExecute(window.updateToggleButtonIcon, 'updateToggleButtonIcon (from storage change)', false, newMode);
                     }
                 }
            });

            // Message Listener
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                 console.log("Received message:", { request, sender });
                 let isResponseAsync = false; // Flag for async response

                 if (request && request.action) {
                    switch (request.action) {
                        case 'quoteSettingsUpdated':
                            console.log("Received quoteSettingsUpdated message, re-initializing quotes.");
                            safeExecute(window.initQuotes, 'initQuotes (from message)');
                            break;
                        // Add other message actions as needed
                        default:
                             console.log(`Received unhandled message action: ${request.action}`);
                             break;
                    }
                 } else {
                     console.warn("Received invalid message format:", request);
                 }

                // Return true if you intend to send a response asynchronously
                 return true;
            });

        } else {
            console.warn("Chrome APIs (storage/runtime) not available. Listeners not set up.");
        }
    }

    function clearBackgroundCache() {
        const bgContainer = document.getElementById('background-container');
        if (bgContainer) {
            // Clear existing content
            bgContainer.innerHTML = '';
            bgContainer.style.backgroundImage = 'none'; // Clear potential CSS background

            // Add a simple loading indicator
            const loader = document.createElement('div');
            loader.className = 'background-loader'; // Use this class for styling
            loader.textContent = 'Loading background...';
            loader.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ccc; font-size: 1.2em;'; // Basic styling
            bgContainer.appendChild(loader);
        } else {
            console.warn("Element '#background-container' not found for clearing cache.");
        }

        // Remove any existing location info overlay related to the background
        const locationInfo = document.querySelector('.location-info'); // Assuming this class is used
        if (locationInfo) {
            locationInfo.remove();
            console.log("Removed existing background location info.");
        }

        // Clear potentially cached data in the window object (be specific)
        window.currentEarthViewLocation = null;
        window.currentUnsplashLocation = null;
        window.currentUnsplashPhotographer = null;
        window.currentRedditTitle = null;
    }

    function applyDisplayModeOnLoad() {
        if (!window.storage) {
             console.error("Storage module unavailable for loading initial background display mode.");
             safeExecute(window.updateBackgroundImageMode, 'updateBackgroundImageMode (fallback)', false, 'cover'); // Default to cover
             return;
        }

        window.storage.get('backgroundImageDisplayMode').then(result => {
            const savedDisplayMode = result.backgroundImageDisplayMode || 'cover'; // Default to 'cover'

            // Use a MutationObserver for more reliability than setTimeout
            const bgContainer = document.getElementById('background-container');
            if (!bgContainer) {
                 console.warn("Background container not found for display mode observer.");
                 safeExecute(window.updateBackgroundImageMode, 'updateBackgroundImageMode (no container)', false, savedDisplayMode);
                 return;
            }

            const observer = new MutationObserver((mutationsList, observerInstance) => {
                for (const mutation of mutationsList) {
                    if (mutation.type === 'childList') {
                         const addedImage = Array.from(mutation.addedNodes).find(node => node.tagName === 'IMG');
                         if (addedImage) {
                             safeExecute(window.updateBackgroundImageMode, 'updateBackgroundImageMode (on image load)', false, savedDisplayMode);
                             observerInstance.disconnect(); // Stop observing once the image is found and mode applied
                             return;
                         }
                    }
                }
            });

            observer.observe(bgContainer, { childList: true, subtree: true });

            // Fallback timeout in case the image loads extremely fast or observer fails
             setTimeout(() => {
                 observer.disconnect(); // Stop observer after timeout regardless
                 const currentImage = bgContainer.querySelector('img');
                 if (currentImage && !currentImage.dataset.modeApplied) { // Check if mode already applied
                     console.warn("Applying display mode via fallback timeout.");
                     safeExecute(window.updateBackgroundImageMode, 'updateBackgroundImageMode (fallback timeout)', false, savedDisplayMode);
                     currentImage.dataset.modeApplied = 'true';
                 }
             }, 1500); // Increased timeout slightly

        }).catch(err => {
            console.error("Error loading background display mode setting:", err);
            safeExecute(window.updateBackgroundImageMode, 'updateBackgroundImageMode (load error)', false, 'cover'); // Default on error
        });
    }

     // Assumes updateBackgroundImageMode and updateToggleButtonIcon are defined globally or passed in
    function setupFullscreenToggle() {
        const fullscreenToggleBtn = document.getElementById('fullscreenToggleBtn');
        const backgroundContainer = document.getElementById('background-container');

        if (!fullscreenToggleBtn) {
            console.warn("Fullscreen toggle button ('#fullscreenToggleBtn') not found.");
            return;
        }
        if (!backgroundContainer) {
            console.warn("Background container ('#background-container') not found for fullscreen toggle.");
            return;
        }

        // Define the toggle click handler once
        const handleToggleClick = function() {
            const currentImage = backgroundContainer.querySelector('img');
            if (!currentImage) {
                console.warn("No background image found to toggle display mode.");
                return;
            }

            // Determine current mode based on class (more reliable than button state)
            const isContainMode = currentImage.classList.contains('contain-mode');
            const newMode = isContainMode ? 'cover' : 'contain';

            console.log(`Toggling background display mode to: ${newMode}`);
            
            if (window.storage) {
                window.storage.set({ backgroundImageDisplayMode: newMode })
                    .then(() => {
                        safeExecute(window.updateBackgroundImageMode, 'updateBackgroundImageMode', false, newMode);
                        safeExecute(window.updateToggleButtonIcon, 'updateToggleButtonIcon', false, newMode);
                    })
                    .catch(err => console.error("Error saving background display mode:", err));
            } else {
                console.error("Storage unavailable. Applying mode change without saving.");
                safeExecute(window.updateBackgroundImageMode, 'updateBackgroundImageMode', false, newMode);
                safeExecute(window.updateToggleButtonIcon, 'updateToggleButtonIcon', false, newMode);
            }
        };

        // Load initial state and set up listener
        if (window.storage) {
            window.storage.get('backgroundImageDisplayMode')
                .then(result => {
                    const savedDisplayMode = result.backgroundImageDisplayMode || 'cover';
                    safeExecute(window.updateToggleButtonIcon, 'updateToggleButtonIcon (initial)', false, savedDisplayMode);
                    // Add event listener
                    addListenerToElement(fullscreenToggleBtn, 'fullscreenToggleBtn', 'click', handleToggleClick);
                })
                .catch(err => {
                    console.error("Error loading initial display mode for fullscreen toggle:", err);
                    // Fallback to default mode and still set up the listener
                    safeExecute(window.updateToggleButtonIcon, 'updateToggleButtonIcon (load error)', false, 'cover');
                    addListenerToElement(fullscreenToggleBtn, 'fullscreenToggleBtn', 'click', handleToggleClick);
                });
        } else {
            console.error("Storage unavailable for fullscreen toggle setup. Using default 'cover' mode.");
            safeExecute(window.updateToggleButtonIcon, 'updateToggleButtonIcon (no storage)', false, 'cover');
            addListenerToElement(fullscreenToggleBtn, 'fullscreenToggleBtn', 'click', handleToggleClick);
        }
    }

    // --- Global Event Listeners defined within IIFE ---

     // Listen for custom storage change events if your storage module dispatches them
     document.addEventListener('storage-changed', function(event) {
        if (!event.detail || !event.detail.changes) {
             console.warn("Received 'storage-changed' event with invalid detail structure.");
             return;
        }
        const { changes } = event.detail;

        // Check if geminiApiKey was changed
        if (changes.geminiApiKey !== undefined) {
            const newApiKey = changes.geminiApiKey.newValue || null;
            console.log(`Gemini API key changed. New value exists: ${!!newApiKey}`);
            safeExecute(window.updateGeminiSettingsStateBasedOnApiKey, 'updateGeminiSettingsStateBasedOnApiKey', false, newApiKey);
             // Update greeting visibility immediately based on key presence
             safeExecute(window.updateGreetingVisibility, 'updateGreetingVisibility (after Gemini key change)');
        }

         // Check if OpenWeather key was changed (relevant for city autocomplete)
         if (changes['openweather-api-key'] !== undefined) {
             console.log("OpenWeather API key changed. Re-evaluating city autocomplete.");
             safeExecute(setupCityAutocomplete, 'setupCityAutocomplete (after OpenWeather key change)');
         }
    });

    function setupApiKeyButton(inputId, buttonId, storageKey, afterSaveCallback = null, afterForgetCallback = null) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);

        if (!input || !button) {
            console.warn(`API key elements not found for input '${inputId}' or button '${buttonId}'. Cannot set up handler.`);
            return;
        }
        if (!window.storage) {
            console.error(`Storage module not available for API key button setup: ${storageKey}`);
            button.disabled = true; // Disable button if storage is missing
            button.title = "Storage system unavailable";
            return;
        }

        const updateButtonState = (keyExists) => {
            if (keyExists) {
                button.textContent = 'Forget';
                button.style.backgroundColor = '#dc3545'; // Red for forget
                // Mask password/API key fields after loading
                if (input.type !== 'text' || inputId.includes('api-key')) { // Check type or ID convention
                    input.placeholder = '********'; // Show placeholder instead of value
                    input.value = '********'; // Use a dummy value for display
                    input.dataset.realValue = keyExists; // Store actual key presence state if needed elsewhere
                }
            } else {
                button.textContent = 'Save';
                button.style.backgroundColor = 'rgb(29, 186, 84)'; // Green for save
                input.placeholder = `Enter ${storageKey}`;
                 input.value = ''; // Clear input field
                 input.dataset.realValue = '';
            }
            button.disabled = false; // Ensure button is enabled
        };

        // Load initial state
        window.storage.get(storageKey).then(result => {
            const savedKey = result[storageKey];
            // Don't put the actual key in the input.value for password/api types
             if (savedKey && (input.type !== 'text' || inputId.includes('api-key'))) {
                 updateButtonState(true);
             } else {
                 input.value = savedKey || ''; // Set value only for non-sensitive fields like username
                 updateButtonState(!!savedKey);
             }
        }).catch(error => {
            console.error(`Error loading initial state for ${storageKey}:`, error);
            button.disabled = true;
            button.title = "Error loading key state";
        });

         // Handle input focus for password/api fields
         if (input.type !== 'text' || inputId.includes('api-key')) {
             input.addEventListener('focus', () => {
                 if (button.textContent === 'Forget') {
                     input.value = ''; // Clear the '********' placeholder on focus
                     input.placeholder = 'Enter new key to replace, or click Forget';
                 }
             });
             input.addEventListener('blur', () => {
                 // If they blur without entering text and a key exists, restore placeholder
                 if (button.textContent === 'Forget' && input.value === '') {
                     input.placeholder = '********';
                     input.value = '********';
                 }
             });
         }

        // Click handler
        addListenerToElement(button, buttonId, 'click', function() {
             const currentKeyValue = input.value.trim();
             const keyIsCurrentlySaved = button.textContent === 'Forget';

            if (keyIsCurrentlySaved) {
                 // Forget Action
                 window.storage.remove(storageKey).then(() => {
                     updateButtonState(false);
                     safeExecute(window.showFeedback, 'showFeedback', false, `${storageKey} forgotten`, true);
                     safeExecute(afterForgetCallback, `afterForgetCallback for ${storageKey}`);
                 }).catch(err => {
                      console.error(`Error forgetting ${storageKey}:`, err);
                      safeExecute(window.showFeedback, 'showFeedback', false, `Error forgetting ${storageKey}`, false);
                 });
             } else {
                 // Save Action
                 if (currentKeyValue && currentKeyValue !== '********') {
                     window.storage.set({ [storageKey]: currentKeyValue }).then(() => {
                         // Don't display the saved key in the input for sensitive fields
                         if (input.type !== 'text' || inputId.includes('api-key')) {
                             updateButtonState(true); // Updates input to '********'
                         } else {
                              updateButtonState(true); // Updates button but leaves value for non-sensitive
                         }
                         safeExecute(window.showFeedback, 'showFeedback', false, `${storageKey} saved`, true);
                         safeExecute(afterSaveCallback, `afterSaveCallback for ${storageKey}`, false, currentKeyValue);
                     }).catch(err => {
                         console.error(`Error saving ${storageKey}:`, err);
                         safeExecute(window.showFeedback, 'showFeedback', false, `Error saving ${storageKey}`, false);
                     });
                 } else {
                     safeExecute(window.showFeedback, 'showFeedback', false, `Please enter a valid value for ${storageKey}`, false);
                 }
             }
         });
    }

    function setupRefreshButtons() {
        // Quote Refresh Button
        const quoteRefreshBtn = document.querySelector('.quote-refresh-btn');
        if (quoteRefreshBtn) {
             addListenerToElement(quoteRefreshBtn, 'quoteRefreshBtn', 'click', function() {
                 console.log("Refreshing quote...");
                 this.style.transition = 'transform 0.5s ease';
                 this.style.transform = 'rotate(360deg)';
                 safeExecute(window.displayRandomQuote, 'displayRandomQuote');

                 // Reset transform after animation
                 setTimeout(() => { this.style.transform = ''; }, 500);
             });
        } else {
             console.warn("Quote refresh button ('.quote-refresh-btn') not found.");
        }

        // Background Refresh Button
        const backgroundRefreshBtn = document.querySelector('.refresh-background-btn');
        if (backgroundRefreshBtn) {
            addListenerToElement(backgroundRefreshBtn, 'backgroundRefreshBtn', 'click', function() {
                 console.log("Refreshing background...");
                 if (!window.storage) {
                     console.error("Storage module unavailable for refreshing background.");
                     return;
                 }
                 this.style.transition = 'transform 0.5s ease';
                 this.style.transform = 'rotate(360deg)';

                 window.storage.get('backgroundSource').then(result => {
                     const source = result.backgroundSource || 'reddit'; // Default source
                     safeExecute(window.updateBackground, 'updateBackground (manual refresh)', false, source);
                     
                     // Apply the saved display mode after refreshing the background
                     window.storage.get('backgroundImageDisplayMode').then(modeResult => {
                         const displayMode = modeResult.backgroundImageDisplayMode || 'cover';
                         // Use MutationObserver to detect when the new image is loaded
                         const bgContainer = document.getElementById('background-container');
                         if (bgContainer) {
                             const observer = new MutationObserver((mutations, obs) => {
                                 mutations.forEach(mutation => {
                                     if (mutation.type === 'childList' && mutation.addedNodes.length) {
                                         const imageAdded = Array.from(mutation.addedNodes).some(node => 
                                             node.nodeName === 'IMG');
                                         if (imageAdded) {
                                             // Wait a tiny bit for the image to be fully processed
                                             setTimeout(() => {
                                                 safeExecute(window.updateBackgroundImageMode, 
                                                    'updateBackgroundImageMode (after refresh)', 
                                                    false, displayMode);
                                             }, 50);
                                             obs.disconnect();
                                         }
                                     }
                                 });
                             });
                             observer.observe(bgContainer, { childList: true, subtree: true });
                             
                             // Fallback timeout in case MutationObserver doesn't catch the change
                             setTimeout(() => {
                                 observer.disconnect();
                                 safeExecute(window.updateBackgroundImageMode, 
                                    'updateBackgroundImageMode (refresh fallback)', 
                                    false, displayMode);
                             }, 2000);
                         }
                     }).catch(err => console.error("Error getting display mode after refresh:", err));
                 }).catch(err => {
                     console.error("Error getting background source for refresh:", err);
                     // Try refreshing with default anyway? Or show error?
                     safeExecute(window.updateBackground, 'updateBackground (refresh fallback)', false, 'reddit');
                 });

                 setTimeout(() => { this.style.transform = ''; }, 500);
            });
        } else {
             console.warn("Background refresh button ('.refresh-background-btn') not found.");
        }
    }

    function setupCityAutocomplete() {
        if (!window.AIChatComponents || typeof window.AIChatComponents.setupCityAutocomplete !== 'function') {
            console.warn("AIChatComponents or AIChatComponents.setupCityAutocomplete function not found. City autocomplete disabled.");
            return;
        }

        if (!window.storage) {
            console.error("Storage module not available for checking OpenWeather API key (for city autocomplete).");
            return;
        }

        window.storage.get('openweather-api-key').then(result => {
            const apiKey = result['openweather-api-key'];
            if (apiKey) {
                 // Execute the setup function safely
                 safeExecute(window.AIChatComponents.setupCityAutocomplete, 'AIChatComponents.setupCityAutocomplete', false, '#city-input', apiKey, 5); // Assuming 5 results limit
            } else {
                 console.log("OpenWeather API key not found. City autocomplete will not be enabled until key is saved.");
                 // Optionally disable the input or show a message
                 const cityInput = document.getElementById('city-input');
                 if (cityInput) {
                      // cityInput.disabled = true; // Maybe too aggressive
                      cityInput.placeholder = "OpenWeather API Key needed for autocomplete";
                 }
            }
        }).catch(error => {
            console.error("Error checking for OpenWeather API key:", error);
        });
    }

    // --- End of IIFE ---
})();