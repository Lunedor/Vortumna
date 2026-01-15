(function () {
    'use strict';

    // --- Helper Functions ---

    /**
     * Safely executes a function if it exists and is callable.
     * @param {Function|undefined} fn The function to execute.
     * @param {string} fnName The name of the function (for logging).
     * @param {boolean} isCritical Log error instead of warning if true.
     * @param {...any} args Arguments to pass to the function.
     * @returns {any|undefined} The result of the function or undefined if execution failed.
     */
    window.safeExecute = function (fn, fnName, isCritical = false, ...args) {
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
    };

    /**
     * Finds an element and adds an event listener safely.
     * @param {string} selector CSS selector for the element.
     * @param {string} event The event type (e.g., 'click', 'change').
     * @param {Function} handler The event handler function.
     * @param {boolean} required Log error if element not found and required is true.
     * @returns {Element|null} The found element or null.
     */
    window.safeAddEventListener = function (selector, event, handler, required = false) {
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
    };

    /**
     * Adds an event listener to an already found element.
     * @param {Element|null} element The DOM element.
     * @param {string} elementName A descriptive name for the element (for logging).
     * @param {string} event The event type.
     * @param {Function} handler The event handler function.
     */
    window.addListenerToElement = function (element, elementName, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element variable '${elementName}' is null or undefined, cannot add ${event} listener.`);
        }
    };

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

    document.addEventListener('DOMContentLoaded', async function () {
        const body = document.querySelector('body');
        const html = document.querySelector('html');

        if (!body || !html) {
            console.error("CRITICAL: Could not find <body> or <html> elements. Aborting initialization.");
            return;
        }

        // Hide body immediately to prevent flash of unstyled content
        body.style.display = 'none';
        html.style.backgroundColor = '#171717';

        // --- 1. Initial Setup & Clearing Caches ---
        window.safeExecute(window.clearBackgroundCache, 'clearBackgroundCache');

        // --- 2. Core Settings Loading ---

        // First ensure storage is initialized - using a proper Promise-based approach
        await ensureStorageInitialized();

        // Now that storage is guaranteed to be initialized, load settings
        if (window.safeExecute(window.loadSettings, 'loadSettings', true) !== undefined) { // loadSettings is critical
            // Ensure quote settings are initialized after loadSettings potentially runs
            if (!window.quoteSettings) {
                console.warn("window.quoteSettings not initialized by loadSettings(). Providing default.");
                window.quoteSettings = { contentType: 'stoic' };
            }
        } else {
            console.error("CRITICAL: loadSettings failed or not found. Using default settings.");
            window.quoteSettings = window.quoteSettings || { contentType: 'stoic' }; // Ensure default if load fails
        }

        // Apply visual styles from settings
        window.safeExecute(window.applyTheme, 'applyTheme');

        // Apply display mode
        const bgContainer = document.getElementById('background-container');
        if (bgContainer && window.backgroundManager && window.backgroundManager.applyDisplayModeToContainer) {
            window.safeExecute(window.backgroundManager.applyDisplayModeToContainer, 'backgroundManager.applyDisplayModeToContainer', false, bgContainer);
        }

        // --- 3. UI Component Setup ---
        // Use the new UI Manager
        if (window.uiManager) {
            // Use the bound global function to ensure 'this' context is correct
            window.safeExecute(window.setupUIEventListeners, 'setupUIEventListeners');
        } else {
            console.error("CRITICAL: uiManager not found.");
        }

        window.safeExecute(window.populateSubredditDropdown, 'populateSubredditDropdown', false, 'subreddit-dropdown-container');

        // --- 4. Component Data Initialization ---
        window.safeExecute(window.getLocationAndWeather, 'getLocationAndWeather');
        window.safeExecute(window.initQuotes, 'initQuotes');
        window.safeExecute(window.loadBookmarks, 'loadBookmarks');

        // --- 5. Set up autocomplete features ---
        window.safeExecute(window.setupAutocomplete, 'setupAutocomplete');
        window.safeExecute(window.setupCityAutocomplete, 'setupCityAutocomplete');

        // --- 6. Final UI components ---
        window.safeExecute(window.setupKeyboardShortcuts, 'setupKeyboardShortcuts');

        // --- 7. Chrome API Listeners ---
        window.safeExecute(setupChromeListeners, 'setupChromeListeners'); // Local function

        // Show the body after a delay to allow rendering
        setTimeout(() => {
            body.style.display = 'block';
            html.style.backgroundColor = 'transparent';
        }, 500); // Keep the delay, potentially adjust if needed
    });

    // --- Setup Functions (Defined within IIFE scope) ---

    function setupChromeListeners() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.runtime) {
            // Storage Change Listener
            chrome.storage.onChanged.addListener((changes, namespace) => {
                // Check for specific key changes and call relevant update functions
                if ((changes.currently_playing_content || changes.currently_playing_type) && namespace === 'local') {
                    if (window.storage) {
                        window.storage.getLocal(['currently_playing_content', 'currently_playing_type']).then(result => {
                            if (result.currently_playing_content && result.currently_playing_type) {
                                window.safeExecute(window.updateIframeContent, 'updateIframeContent (from storage change)', false, result.currently_playing_content, result.currently_playing_type);
                            }
                        }).catch(err => console.error("Error getting Spotify content after storage change:", err));
                    } else {
                        console.warn("Storage unavailable for Spotify update on storage change.");
                    }
                }

                if (changes.theme && namespace === 'sync') { // Assuming theme is in sync storage
                    window.safeExecute(window.applyTheme, 'applyTheme (from storage change)');
                }

                if (changes.quoteSettings && namespace === 'sync') { // Assuming quote settings are in sync
                    console.log("Quote settings changed in storage, re-initializing quotes.");
                    window.safeExecute(window.initQuotes, 'initQuotes (from storage change)');
                }

                // Add other storage change handlers as needed...
                if (changes.backgroundImageDisplayMode && namespace === 'sync') {
                    const newMode = changes.backgroundImageDisplayMode.newValue;
                    if (newMode) {
                        window.safeExecute(window.updateBackgroundImageMode, 'updateBackgroundImageMode (from storage change)', false, newMode);
                        window.safeExecute(window.updateToggleButtonIcon, 'updateToggleButtonIcon (from storage change)', false, newMode);
                    }
                }
            });

            // Message Listener
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                console.log("Received message:", { request, sender });

                if (request && request.action) {
                    switch (request.action) {
                        case 'quoteSettingsUpdated':
                            console.log("Received quoteSettingsUpdated message, re-initializing quotes.");
                            window.safeExecute(window.initQuotes, 'initQuotes (from message)');
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

    // --- Global Event Listeners defined within IIFE ---

    // Listen for custom storage change events if your storage module dispatches them
    document.addEventListener('storage-changed', function (event) {
        if (!event.detail || !event.detail.changes) {
            console.warn("Received 'storage-changed' event with invalid detail structure.");
            return;
        }
        const { changes } = event.detail;

        // Check if geminiApiKey was changed
        if (changes.geminiApiKey !== undefined) {
            const newApiKey = changes.geminiApiKey.newValue || null;
            console.log(`Gemini API key changed. New value exists: ${!!newApiKey}`);
            window.safeExecute(window.updateGeminiSettingsStateBasedOnApiKey, 'updateGeminiSettingsStateBasedOnApiKey', false, newApiKey);
            // Update greeting visibility immediately based on key presence
            window.safeExecute(window.updateGreetingVisibility, 'updateGreetingVisibility (after Gemini key change)');
        }

        // Check if OpenWeather key was changed (relevant for city autocomplete)
        if (changes['openweather-api-key'] !== undefined) {
            console.log("OpenWeather API key changed. Re-evaluating city autocomplete.");
            window.safeExecute(window.setupCityAutocomplete, 'setupCityAutocomplete (after OpenWeather key change)');
        }
    });

})();