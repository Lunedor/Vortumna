// localImages.js - Handles local image functionality and background scheduling

// Constants for storage keys
const LOCAL_IMAGE_PATH_KEY = 'localImagePath'; 
const LOCAL_IMAGE_SOURCE_KEY = 'localImageSource';
const BACKGROUND_SCHEDULE_KEY = 'backgroundSchedule';
const LAST_SCHEDULE_CHANGE_KEY = 'lastBackgroundChange';

// IndexedDB constants from imageGallery.js
const DB_NAME = 'galleryDB';
const DB_VERSION = 3;
const GALLERY_STORE_NAME = 'images';

// Store an alarm name for different schedule types
const SCHEDULE_ALARM_NAMES = {
    hourly: 'hourlyBackgroundChange',
    daily: 'dailyBackgroundChange'
};

// URL cache map to prevent memory leaks on blob URLs
const localImagesUrlCache = new Map();

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const localImageOption = document.getElementById('local-background');
    const localImageSourceSelect = document.getElementById('local-image-source');
    const singleImageSettings = document.getElementById('single-image-settings');
    const gallerySettings = document.getElementById('gallery-settings');
    const localImageUpload = document.getElementById('local-image-upload');
    const backgroundScheduleSelect = document.getElementById('background-schedule-option');
    const localSettings = document.getElementById('local-settings');
    const scheduleSettingsContainer = document.getElementById('schedule-settings-container');
    
    // Initialize storage
    const storage = window.storage;
    
    if (!storage) {
        console.error('Storage module not available for local images');
        return;
    }

    // Add a flag to track if settings are actively being loaded
    let isLoadingSettings = true;
    
    // Load saved settings
    storage.get([
        LOCAL_IMAGE_SOURCE_KEY, 
        BACKGROUND_SCHEDULE_KEY,
        'backgroundSource'
    ]).then(result => {
        // Set local image source
        const imageSource = result[LOCAL_IMAGE_SOURCE_KEY] || 'single';
        if (localImageSourceSelect) {
            localImageSourceSelect.value = imageSource;
            toggleSourceSettings(imageSource);
        }
        
        // Set background schedule
        const scheduleOption = result[BACKGROUND_SCHEDULE_KEY] || 'manual';
        if (backgroundScheduleSelect) {
            backgroundScheduleSelect.value = scheduleOption;
        }
        
        // Apply background schedule (set up alarms if needed)
        applyBackgroundSchedule(scheduleOption);
        
        // Check if we need to apply a local background on load
        if (result.backgroundSource === 'local') {
            // Initialize local background on load
            applyLocalBackground();
        }
        
        // Check for per-session background change on load (applies to ALL background sources)
        checkSessionBackgroundChange();
        
        // Set flag to indicate settings are loaded
        isLoadingSettings = false;
    }).catch(error => {
        console.error('Error loading local image settings:', error);
        isLoadingSettings = false;
    });
    
    // Show local settings when local background source is selected
    document.querySelectorAll('input[name="background-source"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'local') {
                localSettings.style.display = 'block';
            } else {
                localSettings.style.display = 'none';
            }
        });
    });
    
    // Toggle between single image and gallery settings
    localImageSourceSelect.addEventListener('change', function() {
        const source = this.value;
        toggleSourceSettings(source);
        
        // Save selection
        storage.set({ [LOCAL_IMAGE_SOURCE_KEY]: source });
        
        // If we're on local background, apply the change immediately
        storage.get('backgroundSource').then(result => {
            if (result.backgroundSource === 'local') {
                // Apply the change without opening the gallery
                applyLocalBackground();
            }
        });
    });
    
    // Handle image upload - now just store the file name
    localImageUpload.addEventListener('change', function(e) {
        if (!this.files || !this.files[0]) return;
        
        const file = this.files[0];
        
        // Show loading feedback
        if (typeof showFeedback === 'function') {
            showFeedback('Processing image...', true);
        }
        
        // Store just the file name for reference - we'll handle the actual image differently
        const filePath = file.name;
        storage.set({ [LOCAL_IMAGE_PATH_KEY]: filePath }).then(() => {
            // Create object URL for the file
            const objectUrl = URL.createObjectURL(file);
            
            // Store the temporary URL in the cache
            localImagesUrlCache.set(filePath, objectUrl);
            
            // If we are using local background, apply it immediately
            storage.get('backgroundSource').then(result => {
                if (result.backgroundSource === 'local') {
                    // Set the background immediately
                    setBackgroundImage(objectUrl, `Local image: ${file.name}`);
                }
                
                if (typeof showFeedback === 'function') {
                    showFeedback('Image uploaded successfully', true);
                }
            });
        });
    });
    
    // Handle schedule changes - now applies to ALL background sources
    backgroundScheduleSelect.addEventListener('change', function() {
        const scheduleOption = this.value;
        
        // Save schedule option
        storage.set({ [BACKGROUND_SCHEDULE_KEY]: scheduleOption }).then(() => {
            // Apply schedule
            applyBackgroundSchedule(scheduleOption);
            
            // If we're using every-session, maybe update immediately
            if (scheduleOption === 'every-session') {
                // Set the last change time to now
                storage.set({ [LAST_SCHEDULE_CHANGE_KEY]: Date.now() });
                
                // For every-session, we don't refresh immediately, only on next session
                if (typeof showFeedback === 'function') {
                    showFeedback('Background will change on next session', true);
                }
            } else {
                if (typeof showFeedback === 'function') {
                    const message = scheduleOption === 'manual' 
                        ? 'Background will only change when manually refreshed'
                        : `Background will change ${scheduleOption.replace('-', ' ')}`;
                    showFeedback(message, true);
                }
            }
        });
    });
    
    // Listen for chrome alarms to handle scheduled background changes
    chrome.alarms.onAlarm.addListener(handleScheduledBackgroundChange);
});

// Function to toggle between single image and gallery settings
function toggleSourceSettings(source) {
    const singleImageSettings = document.getElementById('single-image-settings');
    const gallerySettings = document.getElementById('gallery-settings');
    
    if (source === 'single') {
        singleImageSettings.style.display = 'block';
        gallerySettings.style.display = 'none';
    } else {
        singleImageSettings.style.display = 'none';
        gallerySettings.style.display = 'block';
    }
}

// Apply the configured background schedule
function applyBackgroundSchedule(scheduleOption) {
    // Clear existing alarms first
    Object.values(SCHEDULE_ALARM_NAMES).forEach(alarmName => {
        chrome.alarms.clear(alarmName);
    });
    
    // Set new alarm based on the selected schedule
    switch(scheduleOption) {
        case 'hourly':
            // Create an alarm that fires every hour
            chrome.alarms.create(SCHEDULE_ALARM_NAMES.hourly, {
                periodInMinutes: 60
            });
            break;
            
        case 'daily':
            // Create an alarm that fires every 24 hours
            chrome.alarms.create(SCHEDULE_ALARM_NAMES.daily, {
                periodInMinutes: 1440 // 24 hours
            });
            break;
            
        // 'manual' and 'every-session' don't need alarms
    }
}

// Handle background change based on schedule - now works for ALL background sources
function handleScheduledBackgroundChange(alarm) {
    // Check if this is a background change alarm
    if (Object.values(SCHEDULE_ALARM_NAMES).includes(alarm.name)) {
        // Update the timestamp when we last changed the background
        window.storage.set({ [LAST_SCHEDULE_CHANGE_KEY]: Date.now() });
        
        // Get current background source and refresh it
        window.storage.get('backgroundSource').then(result => {
            const source = result.backgroundSource || 'reddit';
            
            // Use the centralized updateBackground function from settings.js
            if (typeof window.updateBackground === 'function') {
                window.updateBackground(source);
            }
        });
    }
}

// Apply the local background based on current settings
function applyLocalBackground() {
    // First check if we have a cached image in the backgroundCache system
    if (window.backgroundCache) {
        window.backgroundCache.getBackground('local').then(cacheEntry => {
            // If we have a valid cache entry, use it
            if (cacheEntry && cacheEntry.blobUrl) {
                console.log('Using cached local background image');
                const bgContainer = document.getElementById('background-container');
                
                if (!bgContainer) {
                    console.error('Background container not found');
                    return;
                }
                
                // Set the cached image directly
                const imgElement = document.createElement('img');
                imgElement.className = 'background-image';
                imgElement.src = cacheEntry.blobUrl;
                
                // Clear existing content
                bgContainer.innerHTML = '';
                
                // Add the image to the container
                bgContainer.appendChild(imgElement);
                
                // Apply display mode
                if (window.storage) {
                    window.storage.get('backgroundImageDisplayMode').then(result => {
                        if (result.backgroundImageDisplayMode === 'contain') {
                            imgElement.classList.add('contain-mode');
                            bgContainer.style.backgroundColor = '#000';
                        }
                    });
                }
                
                // Update location info if available
                if (cacheEntry.metadata && cacheEntry.metadata.location) {
                    if (window.createOrUpdateLocationInfo) {
                        window.createOrUpdateLocationInfo(cacheEntry.metadata.location);
                    }
                    window.currentLocalImageLocation = cacheEntry.metadata.location;
                }
                
                return;
            }
            
            // If no cache, proceed with normal loading
            loadLocalBackgroundFromSettings();
        }).catch(error => {
            console.warn('Error checking background cache:', error);
            // Proceed with normal loading on error
            loadLocalBackgroundFromSettings();
        });
    } else {
        // backgroundCache system not available, proceed with normal loading
        loadLocalBackgroundFromSettings();
    }
}

// New function to load local background from settings (extracted from original applyLocalBackground)
function loadLocalBackgroundFromSettings() {
    window.storage.get([
        LOCAL_IMAGE_SOURCE_KEY, 
        LOCAL_IMAGE_PATH_KEY,
        'backgroundSource',
        BACKGROUND_SCHEDULE_KEY
    ]).then(result => {
        // Only proceed if we're using local background
        if (result.backgroundSource !== 'local') return;
        
        const imageSource = result[LOCAL_IMAGE_SOURCE_KEY] || 'single';
        const scheduleOption = result[BACKGROUND_SCHEDULE_KEY] || 'manual';
        
        console.log(`Applying local background with source: ${imageSource}, schedule: ${scheduleOption}`);
        
        // Update the dropdown selection if it doesn't match the stored value
        const localImageSourceSelect = document.getElementById('local-image-source');
        if (localImageSourceSelect && localImageSourceSelect.value !== imageSource) {
            localImageSourceSelect.value = imageSource;
            toggleSourceSettings(imageSource);
        }
        
        if (imageSource === 'single') {
            // Use the stored local image path
            const imagePath = result[LOCAL_IMAGE_PATH_KEY];
            
            // Check if we have this image in the cache
            if (imagePath && localImagesUrlCache.has(imagePath)) {
                setBackgroundImage(localImagesUrlCache.get(imagePath), `Local image: ${imagePath}`);
            } else {
                // No image available or not in cache, show a message
                if (typeof showFeedback === 'function') {
                    showFeedback('Please upload an image in settings', false);
                }
            }
        } else {
            // Using gallery mode - get a random image from the gallery
            // For every-session, we ensure we get a different random image each time
            if (scheduleOption === 'every-session') {
                // Force a random image selection by ignoring any previously cached image
                console.log('Gallery with every-session schedule: getting a fresh random image');
                // Use the timestamp to ensure different selection each time
                getRandomGalleryImage(Date.now()).then(image => {
                    handleGalleryImage(image);
                }).catch(error => {
                    console.error('Error getting random gallery image:', error);
                });
            } else {
                // For other schedule options, get a random image as normal
                getRandomGalleryImage().then(image => {
                    handleGalleryImage(image);
                }).catch(error => {
                    console.error('Error getting random gallery image:', error);
                });
            }
        }
    });
    
    // Helper function to handle gallery image display
    function handleGalleryImage(image) {
        if (image) {
            // Use blob URL if available, fallback to base64 data
            if (image.imageBlob) {
                const blobUrl = localImagesUrlCache.get(image.url) || URL.createObjectURL(image.imageBlob);
                localImagesUrlCache.set(image.url, blobUrl);
                setBackgroundImage(blobUrl, image.location || 'Gallery image');
            } else {
                setBackgroundImage(image.imageData || image.url, image.location || 'Gallery image');
            }
        } else {
            // No images in gallery
            if (typeof showFeedback === 'function') {
                showFeedback('No images in gallery. Save some images first.', false);
            }
        }
    }
}

// Get a random image from the gallery for scheduling
function getRandomGalleryImage(timestamp) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = event => {
            reject('Error opening gallery database');
        };
        
        request.onsuccess = event => {
            const db = event.target.result;
            
            try {
                // Get all images from the gallery
                const transaction = db.transaction([GALLERY_STORE_NAME], 'readonly');
                const objectStore = transaction.objectStore(GALLERY_STORE_NAME);
                const getAllRequest = objectStore.getAll();
                
                getAllRequest.onsuccess = () => {
                    const images = getAllRequest.result;
                    
                    if (images && images.length > 0) {
                        // Pick a random image
                        // Use the timestamp (if provided) to add more randomness
                        let seed = timestamp ? timestamp : Date.now();
                        // Get a more random index by using the timestamp in the calculation
                        const randomIndex = Math.floor((Math.random() * seed) % images.length);
                        console.log(`Selected random image ${randomIndex + 1} of ${images.length} from gallery`);
                        resolve(images[randomIndex]);
                    } else {
                        // No images in gallery
                        resolve(null);
                    }
                };
                
                getAllRequest.onerror = error => {
                    reject('Error retrieving gallery images');
                };
            } catch (error) {
                reject('Error accessing gallery database');
            }
        };
    });
}

// Set the background image
function setBackgroundImage(imageSource, location) {
    const bgContainer = document.getElementById('background-container');
    
    if (!bgContainer) {
        console.error('Background container not found');
        return;
    }
    
    // Clear existing content
    bgContainer.innerHTML = '';
    
    // Create image element
    const imgElement = document.createElement('img');
    imgElement.className = 'background-image';
    imgElement.src = imageSource;
    
    // Preload image
    imgElement.onload = () => {
        bgContainer.appendChild(imgElement);
        
        // Apply display mode
        if (window.storage) {
            window.storage.get('backgroundImageDisplayMode').then(result => {
                if (result.backgroundImageDisplayMode === 'contain') {
                    imgElement.classList.add('contain-mode');
                    bgContainer.style.backgroundColor = '#000';
                }
            });
        }
        
        // Update location info
        if (window.createOrUpdateLocationInfo) {
            window.createOrUpdateLocationInfo(location || 'Local Image');
        }
        
        // Save current location for "Save Image" feature
        window.currentLocalImageLocation = location || 'Local Image';
        
        // Store the current image for caching
        window.storage.set({
            currentLocalImage: imageSource,
            currentLocalImageLocation: location || 'Local Image'
        }).then(() => {
            console.log('Current local image saved for caching');
        });
    };
    
    imgElement.onerror = () => {
        console.error('Error loading image', imageSource);
        if (typeof showFeedback === 'function') {
            showFeedback('Error loading image', false);
        }
    };
}

// Check if we need to change background on session start - applies to ALL sources
function checkSessionBackgroundChange() {
    window.storage.get([
        BACKGROUND_SCHEDULE_KEY,
        LAST_SCHEDULE_CHANGE_KEY,
        'backgroundSource'
    ]).then(result => {
        const scheduleOption = result[BACKGROUND_SCHEDULE_KEY];
        const lastChange = result[LAST_SCHEDULE_CHANGE_KEY];
        const source = result.backgroundSource || 'reddit';
        
        if (scheduleOption === 'every-session') {
            // Update the timestamp for the last change
            window.storage.set({ [LAST_SCHEDULE_CHANGE_KEY]: Date.now() });
            
            // Use the main updateBackground function with forceUpdate=true to bypass cache
            if (typeof window.updateBackground === 'function') {
                window.updateBackground(source, true); // Pass true to force update regardless of cache
            }
        }
    });
}

// Make sure the window.updateBackground function is available
window.addEventListener('load', function() {
    // Check if updateBackground is available in the window object
    if (typeof window.updateBackground !== 'function' && typeof updateBackground === 'function') {
        window.updateBackground = updateBackground;
    }
});

// Add to window object for external access
window.applyLocalBackground = applyLocalBackground;