// utils.js - Utility functions shared across different components

/**
 * Show a feedback message to the user
 * @param {string} message - The message to display
 * @param {boolean} isSuccess - Whether the message is a success or error message
 * @param {string} className - Optional custom class name for the feedback element
 * @param {number} duration - How long to show the message in milliseconds
 */
function showFeedback(message, isSuccess = true, className = 'feedback', duration = 4000) {
    // Create the feedback div with floating styling
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = className;
    feedbackDiv.textContent = message;
    
    // Apply different styling based on success/error status
    if (isSuccess) {
        feedbackDiv.style.backgroundColor = 'rgba(25, 135, 84, 0.9)'; // Success green
    } else {
        feedbackDiv.style.backgroundColor = 'rgba(220, 53, 69, 0.9)'; // Error red
    }
    
    // Remove existing feedback with the same class
    const existingFeedback = document.querySelector(`.${className}`);
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    // Add to body
    document.body.appendChild(feedbackDiv);
    
    // Auto-remove after the specified duration with smooth animation
    setTimeout(() => {
        feedbackDiv.style.animation = 'fadeOutDown 0.5s ease forwards';
        
        // Remove from DOM after fade effect
        setTimeout(() => {
            feedbackDiv.remove();
        }, 500);
    }, duration);
}

function applyTheme() {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;

    // Check for theme preference in storage
    if (window.storage) {
        window.storage.get("theme").then(result => {
            const currentTheme = result.theme;
            if (currentTheme === "dark") {
                document.body.classList.add("dark-theme");
            }
        });
    } else {
        // Fallback to localStorage if storage.js not available
        const currentTheme = localStorage.getItem("theme");
        if (currentTheme === "dark") {
            document.body.classList.add("dark-theme");
        }
    }
}

// Function to set up keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Don't trigger shortcuts if user is typing in an input field or textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Simple key shortcuts (no modifiers)
        switch(e.key.toLowerCase()) {
            case 'r': // Refresh background
                e.preventDefault();
                if (typeof updateBackground === 'function') {
                    // Get current background source and display mode before refresh
                    if (window.storage) {
                        Promise.all([
                            window.storage.get('backgroundSource'),
                            window.storage.get('backgroundImageDisplayMode')
                        ]).then(results => {
                            const source = results[0].backgroundSource || 'reddit';
                            const displayMode = results[1].backgroundImageDisplayMode || 'cover';
                            
                            // Update background
                            updateBackground(source, true);
                            console.log('Background refreshed');
                            
                            // Set up observer to watch for new image and apply mode
                            const bgContainer = document.getElementById('background-container');
                            if (bgContainer) {
                                // Create an observer instance
                                const observer = new MutationObserver((mutations, obs) => {
                                    for (const mutation of mutations) {
                                        if (mutation.type === 'childList') {
                                            const addedImg = Array.from(mutation.addedNodes).find(node => 
                                                node.nodeName === 'IMG');
                                            
                                            if (addedImg) {
                                                // Image found, apply mode after a small delay to ensure it's fully loaded
                                                setTimeout(() => {
                                                    if (typeof window.updateBackgroundImageMode === 'function') {
                                                        window.updateBackgroundImageMode(displayMode);
                                                        console.log(`Applied ${displayMode} mode to refreshed background`);
                                                    }
                                                    obs.disconnect(); // Stop observing
                                                }, 100);
                                                return;
                                            }
                                        }
                                    }
                                });
                                
                                // Start observing
                                observer.observe(bgContainer, { 
                                    childList: true,
                                    subtree: true
                                });
                                
                                // Fallback timeout in case observer doesn't catch the change
                                setTimeout(() => {
                                    observer.disconnect();
                                    if (typeof window.updateBackgroundImageMode === 'function') {
                                        window.updateBackgroundImageMode(displayMode);
                                        console.log(`Applied ${displayMode} mode (fallback) to refreshed background`);
                                    }
                                }, 1000);
                            }
                        });
                    }
                }
                break;
                
            case 'b': // Refresh quote
                e.preventDefault();
                if (typeof loadQuotes === 'function') {
                    loadQuotes();
                    console.log('Quote refreshed');
                }
                break;
                
            case 'q': // Toggle quote visibility
                e.preventDefault();
                const quoteContainer = document.getElementById('quote-container');
                if (quoteContainer) {
                    const currentDisplay = window.getComputedStyle(quoteContainer).display;
                    quoteContainer.style.display = currentDisplay === 'none' ? 'flex' : 'none';
                    console.log('Quote visibility toggled');
                    
                    // Save preference to storage if available
                    if (window.storage && window.quoteSettings) {
                        const updatedSettings = {...window.quoteSettings, enabled: currentDisplay === 'none'};
                        window.storage.set({quoteSettings: updatedSettings})
                            .then(() => {
                                window.quoteSettings = updatedSettings;
                            })
                            .catch(err => console.error('Error saving quote visibility setting:', err));
                    }
                }
                break;
                
            case 'g': // Focus Google search
                e.preventDefault();
                const searchInput = document.getElementById('googleSearchInput');
                if (searchInput) {
                    searchInput.focus();
                    console.log('Google search focused');
                }
                break;
                
            case 's': // Toggle Spotify tile
                e.preventDefault();
                const spotifyWrapper = document.getElementById('spotifyWrapper');
                const toggleExpandBtn = document.getElementById('toggleExpandBtn');
                if (toggleExpandBtn && spotifyWrapper) {
                    toggleExpandBtn.click();
                    console.log('Spotify tile toggled');
                }
                break;
            case 'a': // Toggle Gemini chat
                e.preventDefault();
                const geminiToggleBtn = document.getElementById('geminiToggleBtn');
                if (geminiToggleBtn) {
                    geminiToggleBtn.click();
                    console.log('Gemini chat toggled');
                }
                break;            case 'd': // Toggle OpenRouter chat
                e.preventDefault();
                const openrouterToggleBtn = document.getElementById('openrouterToggleBtn');
                if (openrouterToggleBtn) {
                    openrouterToggleBtn.click();
                    console.log('OpenRouter chat toggled');
                }
                break;
                
            // Number keys 1-9 for quick links
            case '1': case '2': case '3': case '4': case '5':
            case '6': case '7': case '8': case '9':
                const linkIndex = parseInt(e.key) - 1; // Convert to 0-based index
                e.preventDefault(); // Prevent default behavior before checking shift key
                // Get all bookmark tiles with the data-url attribute
                const bookmarkTiles = document.querySelectorAll('.bookmark-tile[data-url]');
                
                if (bookmarkTiles && bookmarkTiles.length > linkIndex) {
                    const url = bookmarkTiles[linkIndex].getAttribute('data-url');
                    if (url) {
                        // Open the URL in a new tab if shift key is pressed
                        const target = e.ctrlKey ? "_blank" : "_self";
                        window.open(url, target);
                        console.log(`Opened quick link #${linkIndex + 1} in ${e.shiftKey ? 'new tab' : 'same tab'}: ${url}`);
                    }
                }
                break;
        }
    });
}

/**
 * Creates or updates the location-info element
 * @param {string} locationText - The location text to display
 * @param {string|null} linkUrl - Optional URL for location link
 * @param {string|null} linkText - Optional text for location link
 * @returns {HTMLElement} - The location info element
 */
function createOrUpdateLocationInfo(locationText, linkUrl = null, linkText = null) {
    // Remove any existing location info to prevent duplicates
    const existingLocationInfo = document.querySelector('.location-info');
    if (existingLocationInfo) {
        existingLocationInfo.remove();
    }
    
    // Create new location info element
    const locationInfo = document.createElement('div');
    locationInfo.className = 'location-info';
    
    // Create content for the location info
    let content = `<p>${locationText || 'Unknown Location'}</p>`;
    
    // Add link if provided
    if (linkUrl && linkText) {
        content += `<a href="${linkUrl}" target="_blank">${linkText}</a>`;
    }
    
    locationInfo.innerHTML = content;
    
    // Get the location buttons container
    const locationButtonsContainer = document.getElementById('locationButtonsContainer');
    
    // Insert the location info at the beginning of the container
    locationButtonsContainer.insertBefore(locationInfo, locationButtonsContainer.firstChild);
    
    // Apply visibility setting
    if (window.storage) {
        window.storage.get('showLocationInfo').then(result => {
            const showLocationInfo = result.showLocationInfo !== false;
            locationInfo.style.display = showLocationInfo ? '' : 'none';
        });
    } else {
        // Fallback to localStorage if storage.js is not available
        const showLocationInfo = localStorage.getItem('showLocationInfo') !== 'false';
        locationInfo.style.display = showLocationInfo ? '' : 'none';
    }
    
    return locationInfo;
}

// For backward compatibility, also expose showFeedback directly
window.showFeedback = showFeedback;

// Expose the function to the window object
window.createOrUpdateLocationInfo = createOrUpdateLocationInfo;

// ESC key handler for containers
document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            // Handle Spotify container
            const expandableContent = document.getElementById('expandableContent');
            if (expandableContent && expandableContent.style.maxHeight !== "0px") {
                expandableContent.style.maxHeight = "0px";
                expandableContent.style.overflow = "hidden";
                console.log('Spotify container closed with ESC key');
            }
            
            // Handle image gallery container
            const imageGalleryPanel = document.getElementById('imageGalleryPanel');
            if (imageGalleryPanel && imageGalleryPanel.classList.contains('visible')) {
                imageGalleryPanel.classList.remove('visible');
                console.log('Image gallery closed with ESC key');
            }
              // Handle favorites quote container
            const quoteFavoritesContainer = document.getElementById('quote-favorites-container');
            if (quoteFavoritesContainer && (quoteFavoritesContainer.classList.contains('show') || quoteFavoritesContainer.style.display === 'flex')) {
                quoteFavoritesContainer.classList.remove('show');
                quoteFavoritesContainer.style.display = 'none';
                
                const favoritesBtn = document.getElementById('quote-favorites-btn');
                if (favoritesBtn) {
                    favoritesBtn.classList.remove('active');
                }
                console.log('Quote favorites closed with ESC key');
            }
        }
    });
});
