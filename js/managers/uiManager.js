(function () {
    'use strict';

    window.uiManager = {
        /**
         * Sets up all UI event listeners.
         */
        setupUIEventListeners: function () {
            this.setupSpotifyControls();
            this.setupQuoteSettings();
            this.setupSettingsMenu();
            this.setupLocationSettings();
            this.setupBackgroundSettings();
            this.setupSearchFunctionality();
            this.setupBookmarkHandlers();
            this.setupRefreshButtons();
            this.setupFullscreenToggle();
            this.setupVisibilityToggles();
            this.setupApiKeys();
        },

        setupSpotifyControls: function () {
            safeAddEventListener('#spotify-login-btn', 'click', () => safeExecute(window.loginToSpotify, 'loginToSpotify'), false);
            safeAddEventListener('#spotify-logout-btn', 'click', () => safeExecute(window.logoutFromSpotify, 'logoutFromSpotify'), false);

            safeAddEventListener('#playlistDropdown', 'change', function () {
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
            }, false);

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
        },

        setupQuoteSettings: function () {
            const quoteContentSelect = safeAddEventListener('#quote-content', 'change', function (e) {
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
        },

        setupSettingsMenu: function () {
            const settingsContainer = document.getElementById('settingsContainer');
            const settingsBtn = document.getElementById('settingsBtn');
            const settingsDropdown = document.getElementById('settingsDropdown');
            const closeSettingsBtn = document.getElementById('closeSettingsBtn');
            const saveOpenWeatherKeyBtn = document.getElementById('save-openweather-key');

            if (!settingsContainer || !settingsBtn || !settingsDropdown) {
                console.warn("Settings menu elements (container, button, or dropdown) not found.");
                return;
            }

            addListenerToElement(settingsBtn, 'settingsBtn', 'click', (e) => {
                e.stopPropagation();
                settingsDropdown.classList.toggle('visible');

                if (settingsDropdown.classList.contains('visible') && saveOpenWeatherKeyBtn && window.storage) {
                    window.storage.get('openweather-api-key').then(result => {
                        const savedKey = result['openweather-api-key'];
                        saveOpenWeatherKeyBtn.textContent = savedKey ? 'Forget' : 'Save';
                        saveOpenWeatherKeyBtn.style.backgroundColor = savedKey ? '#dc3545' : 'rgb(29, 186, 84)';
                    }).catch(err => console.error("Error reading OpenWeather key for button state:", err));
                }
            });

            if (closeSettingsBtn) {
                addListenerToElement(closeSettingsBtn, 'closeSettingsBtn', 'click', () => {
                    settingsDropdown.classList.remove('visible');
                });
            }

            document.addEventListener('click', (e) => {
                if (!settingsContainer.contains(e.target) && settingsDropdown.classList.contains('visible')) {
                    settingsDropdown.classList.remove('visible');
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && settingsDropdown.classList.contains('visible')) {
                    settingsDropdown.classList.remove('visible');
                }
            });
        },

        setupLocationSettings: function () {
            const customLocationRadio = document.getElementById('custom-location');
            const autoLocationRadio = document.getElementById('auto-location');
            const customLocationInputDiv = document.getElementById('custom-location-input');
            const saveLocationBtn = document.getElementById('save-location');
            const cityInput = document.getElementById('city-input');

            if (!customLocationRadio || !autoLocationRadio || !customLocationInputDiv) {
                console.warn("Location setting radio buttons or input div not found.");
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
                                cityInput.value = '';
                            }).catch(err => console.error("Error saving custom city:", err));
                        } else { console.error("Storage module unavailable for saving custom city."); }
                    } else {
                        safeExecute(window.showFeedback, 'showFeedback', false, "Please enter a city name.", false);
                    }
                };

                addListenerToElement(saveLocationBtn, 'saveLocationBtn', 'click', handleSaveLocation);
                addListenerToElement(cityInput, 'cityInput', 'keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveLocation();
                    }
                });
            }
        },

        setupBackgroundSettings: function () {
            document.querySelectorAll('input[name="background-source"]').forEach(radio => {
                radio.addEventListener('change', function () {
                    const source = this.value;
                    if (!window.storage) {
                        console.error("Storage module unavailable for saving background source.");
                        return;
                    }
                    window.storage.set({ backgroundSource: source }).then(() => {
                        console.log(`Background source set to: ${source}`);
                        safeExecute(window.updateBackground, 'updateBackground (after source change)', false, source);
                        safeExecute(window.updateBackgroundSourceSettings, 'updateBackgroundSourceSettings', false, source);
                    }).catch(err => console.error("Error saving background source:", err));
                });
            });

            const bgOpacitySlider = document.getElementById('bg-opacity');
            const opacityValue = document.getElementById('opacity-value');

            if (bgOpacitySlider && opacityValue) {
                const updateOpacityDisplay = (opacity) => {
                    opacityValue.textContent = `${Math.round(opacity * 100)}%`;
                    safeExecute(window.updateBackgroundOpacity, 'updateBackgroundOpacity', false, opacity);
                };

                addListenerToElement(bgOpacitySlider, 'bgOpacitySlider', 'input', function () {
                    const opacity = parseFloat(this.value);
                    if (!window.storage) {
                        console.error("Storage module unavailable for saving background opacity.");
                        return;
                    }
                    window.storage.set({ bgOpacity: opacity }).then(() => {
                        updateOpacityDisplay(opacity);
                    }).catch(err => console.error("Error saving background opacity:", err));
                });

                if (window.storage) {
                    window.storage.get('bgOpacity').then(result => {
                        const initialOpacity = result.bgOpacity !== undefined
                            ? result.bgOpacity
                            : (bgOpacitySlider.value ? parseFloat(bgOpacitySlider.value) : 1.0);
                        bgOpacitySlider.value = initialOpacity;
                        updateOpacityDisplay(initialOpacity);
                    }).catch(err => {
                        console.error("Error loading initial background opacity:", err);
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
        },

        setupSearchFunctionality: function () {
            const searchInput = document.getElementById('searchInput');
            const searchButton = document.getElementById('searchBtn');
            let isSearchAllowed = true;
            const SEARCH_COOLDOWN = 1000;

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
                        e.preventDefault();
                        handleSearch();
                    }
                });
            } else {
                console.warn("Search input or button element not found.");
            }

            const toggleExpandBtn = document.getElementById('toggleExpandBtn');
            const expandableContent = document.getElementById('expandableContent');

            if (toggleExpandBtn && expandableContent) {
                expandableContent.style.maxHeight = "0px";
                expandableContent.style.overflow = "hidden";
                expandableContent.style.transition = "max-height 0.3s ease-out";

                addListenerToElement(toggleExpandBtn, 'toggleExpandBtn', 'click', function () {
                    const isExpanded = expandableContent.style.maxHeight !== "0px";
                    if (isExpanded) {
                        expandableContent.style.maxHeight = expandableContent.scrollHeight + "px";
                        requestAnimationFrame(() => {
                            expandableContent.style.maxHeight = "0px";
                        });
                        toggleExpandBtn.setAttribute('aria-expanded', 'false');
                    } else {
                        const scrollHeight = expandableContent.scrollHeight;
                        expandableContent.style.maxHeight = scrollHeight + "px";
                        toggleExpandBtn.setAttribute('aria-expanded', 'true');
                    }
                });
            } else {
                console.warn("Expand toggle button or content element not found.");
            }
        },

        setupBookmarkHandlers: function () {
            safeAddEventListener('#bookmarkForm', 'submit', (e) => safeExecute(window.handleBookmarkSubmit, 'handleBookmarkSubmit', false, e), false);
            safeAddEventListener('#cancelAddBookmark', 'click', () => safeExecute(window.hideAddBookmarkForm, 'hideAddBookmarkForm'), false);
        },

        setupRefreshButtons: function () {
            const quoteRefreshBtn = document.querySelector('.quote-refresh-btn');
            if (quoteRefreshBtn) {
                addListenerToElement(quoteRefreshBtn, 'quoteRefreshBtn', 'click', function () {
                    console.log("Refreshing quote...");
                    this.style.transition = 'transform 0.5s ease';
                    this.style.transform = 'rotate(360deg)';
                    safeExecute(window.displayRandomQuote, 'displayRandomQuote');

                    setTimeout(() => { this.style.transform = ''; }, 500);
                });
            } else {
                console.warn("Quote refresh button ('.quote-refresh-btn') not found.");
            }

            const backgroundRefreshBtn = document.querySelector('.refresh-background-btn');
            if (backgroundRefreshBtn) {
                addListenerToElement(backgroundRefreshBtn, 'backgroundRefreshBtn', 'click', function () {
                    console.log("Refreshing background...");
                    if (!window.storage) {
                        console.error("Storage module unavailable for refreshing background.");
                        return;
                    }
                    this.style.transition = 'transform 0.5s ease';
                    this.style.transform = 'rotate(360deg)';

                    window.storage.get('backgroundSource').then(result => {
                        const source = result.backgroundSource || 'reddit';
                        // FIX: Pass true to force update regardless of frequency setting
                        safeExecute(window.updateBackground, 'updateBackground (manual refresh)', false, source, true);
                    }).catch(err => {
                        console.error("Error getting background source for refresh:", err);
                        safeExecute(window.updateBackground, 'updateBackground (refresh fallback)', false, 'reddit', true);
                    });

                    setTimeout(() => { this.style.transform = ''; }, 500);
                });
            } else {
                console.warn("Background refresh button ('.refresh-background-btn') not found.");
            }
        },

        setupFullscreenToggle: function () {
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

            const handleToggleClick = function () {
                const currentImage = backgroundContainer.querySelector('img');
                if (!currentImage) {
                    console.warn("No background image found to toggle display mode.");
                    return;
                }

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

            if (window.storage) {
                window.storage.get('backgroundImageDisplayMode')
                    .then(result => {
                        const savedDisplayMode = result.backgroundImageDisplayMode || 'cover';
                        safeExecute(window.updateToggleButtonIcon, 'updateToggleButtonIcon (initial)', false, savedDisplayMode);
                        addListenerToElement(fullscreenToggleBtn, 'fullscreenToggleBtn', 'click', handleToggleClick);
                    })
                    .catch(err => {
                        console.error("Error loading initial display mode for fullscreen toggle:", err);
                        safeExecute(window.updateToggleButtonIcon, 'updateToggleButtonIcon (load error)', false, 'cover');
                        addListenerToElement(fullscreenToggleBtn, 'fullscreenToggleBtn', 'click', handleToggleClick);
                    });
            } else {
                console.error("Storage unavailable for fullscreen toggle setup. Using default 'cover' mode.");
                safeExecute(window.updateToggleButtonIcon, 'updateToggleButtonIcon (no storage)', false, 'cover');
                addListenerToElement(fullscreenToggleBtn, 'fullscreenToggleBtn', 'click', handleToggleClick);
            }
        },

        updateToggleButtonIcon: function (mode) {
            const fullscreenToggleBtn = document.getElementById('fullscreenToggleBtn');
            if (!fullscreenToggleBtn) {
                return;
            }
            const iconSpan = fullscreenToggleBtn.querySelector('span');
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
        },

        setupCityAutocomplete: function () {
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
        },

        setupApiKeys: function () {
            // Helper function to setup API key buttons
            const setupApiKeyButton = (inputId, buttonId, storageKey, afterSaveCallback = null, afterForgetCallback = null) => {
                const input = document.getElementById(inputId);
                const button = document.getElementById(buttonId);

                if (!input || !button) {
                    console.warn(`API key elements not found for input '${inputId}' or button '${buttonId}'. Cannot set up handler.`);
                    return;
                }
                if (!window.storage) {
                    console.error(`Storage module not available for API key button setup: ${storageKey}`);
                    button.disabled = true;
                    button.title = "Storage system unavailable";
                    return;
                }

                const updateButtonState = (keyExists) => {
                    if (keyExists) {
                        button.textContent = 'Forget';
                        button.style.backgroundColor = '#dc3545';
                        if (input.type !== 'text' || inputId.includes('api-key')) {
                            input.placeholder = '********';
                            input.value = '********';
                            input.dataset.realValue = keyExists;
                        }
                    } else {
                        button.textContent = 'Save';
                        button.style.backgroundColor = 'rgb(29, 186, 84)';
                        input.placeholder = `Enter ${storageKey}`;
                        input.value = '';
                        input.dataset.realValue = '';
                    }
                    button.disabled = false;
                };

                window.storage.get(storageKey).then(result => {
                    const savedKey = result[storageKey];
                    if (savedKey && (input.type !== 'text' || inputId.includes('api-key'))) {
                        updateButtonState(true);
                    } else {
                        input.value = savedKey || '';
                        updateButtonState(!!savedKey);
                    }
                }).catch(error => {
                    console.error(`Error loading initial state for ${storageKey}:`, error);
                    button.disabled = true;
                    button.title = "Error loading key state";
                });

                if (input.type !== 'text' || inputId.includes('api-key')) {
                    input.addEventListener('focus', () => {
                        if (button.textContent === 'Forget') {
                            input.value = '';
                            input.placeholder = 'Enter new key to replace, or click Forget';
                        }
                    });
                    input.addEventListener('blur', () => {
                        if (button.textContent === 'Forget' && input.value === '') {
                            input.placeholder = '********';
                            input.value = '********';
                        }
                    });
                }

                addListenerToElement(button, buttonId, 'click', function () {
                    const currentKeyValue = input.value.trim();
                    const keyIsCurrentlySaved = button.textContent === 'Forget';

                    if (keyIsCurrentlySaved) {
                        window.storage.remove(storageKey).then(() => {
                            updateButtonState(false);
                            safeExecute(window.showFeedback, 'showFeedback', false, `${storageKey} forgotten`, true);
                            safeExecute(afterForgetCallback, `afterForgetCallback for ${storageKey}`);
                        }).catch(err => {
                            console.error(`Error forgetting ${storageKey}:`, err);
                            safeExecute(window.showFeedback, 'showFeedback', false, `Error forgetting ${storageKey}`, false);
                        });
                    } else {
                        if (currentKeyValue && currentKeyValue !== '********') {
                            window.storage.set({ [storageKey]: currentKeyValue }).then(() => {
                                if (input.type !== 'text' || inputId.includes('api-key')) {
                                    updateButtonState(true);
                                } else {
                                    updateButtonState(true);
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
            };

            setupApiKeyButton(
                'openweather-api-key', 'save-openweather-key', 'openweather-api-key',
                () => {
                    safeExecute(window.getLocationAndWeather, 'getLocationAndWeather (after OpenWeather key save)');
                    safeExecute(window.setupCityAutocomplete, 'setupCityAutocomplete (after OpenWeather key save)');
                },
                () => {
                    safeExecute(window.getLocationAndWeather, 'getLocationAndWeather (after OpenWeather key forget)');
                }
            );

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

            setupApiKeyButton(
                'openrouter-api-key', 'save-openrouter-key', 'openrouterApiKey',
                () => {
                    safeExecute(window.resetOpenRouterComponents, 'resetOpenRouterComponents (after OpenRouter key save)');
                },
                () => {
                    safeExecute(window.resetOpenRouterComponents, 'resetOpenRouterComponents (after OpenRouter key forget)');
                }
            );

            setupApiKeyButton(
                'user-name-input', 'save-user-name', 'userName',
                () => {
                    if (window.aiGreetings && typeof window.aiGreetings.updateGreetingDisplay === 'function') {
                        safeExecute(window.aiGreetings.updateGreetingDisplay, 'aiGreetings.updateGreetingDisplay (after username save)');
                    } else { console.warn("window.aiGreetings.updateGreetingDisplay not available after username save."); }
                },
                () => {
                    if (window.aiGreetings) {
                        window.aiGreetings.greetingsCache = null;
                        console.log("Cleared AI greetings cache after username forget.");
                    }
                }
            );

            safeAddEventListener('#greeting-mood', 'change', function () {
                const selectedMood = this.value;
                if (window.storage) {
                    window.storage.set({ greetingMood: selectedMood }).then(() => {
                        window.storage.set({ showGreeting: true }).then(() => {
                            if (window.aiGreetings && typeof window.aiGreetings.updateGreetingDisplay === 'function') {
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
            });
        },

        setupVisibilityToggles: function () {
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

            visibilityCheckboxes.forEach(config => {
                const checkbox = document.getElementById(config.id);
                if (checkbox) {
                    checkbox.addEventListener('change', function () {
                        const isVisible = this.checked;
                        if (!window.storage) {
                            console.error(`Storage module not available for saving visibility: ${config.key}`);
                            this.checked = !isVisible;
                            return;
                        }
                        window.storage.set({ [config.key]: isVisible }).then(() => {
                            safeExecute(config.fn, `Update function for ${config.id}`, false, isVisible);
                            if (config.updatesShowAll) {
                                safeExecute(window.updateShowAllCheckbox, 'updateShowAllCheckbox');
                            }
                        }).catch(err => {
                            console.error(`Error saving visibility setting ${config.key}:`, err);
                            this.checked = !isVisible;
                        });
                    });
                } else {
                    console.warn(`Visibility checkbox element with ID "${config.id}" not found.`);
                }
            });

            const showAllCheckbox = document.getElementById('show-all');
            if (showAllCheckbox) {
                showAllCheckbox.addEventListener('change', function () {
                    const showAll = this.checked;
                    if (!window.storage) {
                        console.error("Storage module not available for 'show all' toggle");
                        this.checked = !showAll;
                        return;
                    }

                    const updates = { showAll: showAll };
                    visibilityCheckboxes.forEach(config => {
                        if (config.updatesShowAll) {
                            updates[config.key] = showAll;
                        }
                    });

                    window.storage.set(updates).then(() => {
                        visibilityCheckboxes.forEach(config => {
                            if (config.updatesShowAll) {
                                const checkbox = document.getElementById(config.id);
                                if (checkbox) checkbox.checked = showAll;
                                safeExecute(config.fn, `Update function for ${config.id} in 'show-all'`, false, showAll);
                            }
                        });
                        console.log(`Set 'showAll' state to ${showAll}`);
                    }).catch(err => {
                        console.error("Error saving 'show all' settings:", err);
                        this.checked = !showAll;
                    });
                });
            } else {
                console.warn("Element with ID 'show-all' not found.");
            }
        }
    };

    // Expose functions globally for compatibility
    window.setupUIEventListeners = window.uiManager.setupUIEventListeners.bind(window.uiManager);
    window.setupSpotifyControls = window.uiManager.setupSpotifyControls.bind(window.uiManager);
    window.setupQuoteSettings = window.uiManager.setupQuoteSettings.bind(window.uiManager);
    window.setupSettingsMenu = window.uiManager.setupSettingsMenu.bind(window.uiManager);
    window.setupLocationSettings = window.uiManager.setupLocationSettings.bind(window.uiManager);
    window.setupBackgroundSettings = window.uiManager.setupBackgroundSettings.bind(window.uiManager);
    window.setupSearchFunctionality = window.uiManager.setupSearchFunctionality.bind(window.uiManager);
    window.setupBookmarkHandlers = window.uiManager.setupBookmarkHandlers.bind(window.uiManager);
    window.setupRefreshButtons = window.uiManager.setupRefreshButtons.bind(window.uiManager);
    window.setupFullscreenToggle = window.uiManager.setupFullscreenToggle.bind(window.uiManager);
    window.updateToggleButtonIcon = window.uiManager.updateToggleButtonIcon.bind(window.uiManager);
    window.setupApiKeys = window.uiManager.setupApiKeys.bind(window.uiManager);
    window.setupVisibilityToggles = window.uiManager.setupVisibilityToggles.bind(window.uiManager);
    window.setupCityAutocomplete = window.uiManager.setupCityAutocomplete.bind(window.uiManager);

})();
