// backgroundCache.js - Handles background image caching using IndexedDB
// This addresses two issues:
// 1. QUOTA_BYTES_PER_ITEM errors with Earth View (large base64 strings)
// 2. Blob URL expiration issues with local images

// Constants for the database - changed to avoid conflicts with localImages.js
const BG_CACHE_DB_NAME = 'backgroundCacheDB';
const BG_CACHE_STORE_NAME = 'backgroundCache';
const BG_CACHE_DB_VERSION = 1; // Changed from DB_VERSION to BG_CACHE_DB_VERSION to avoid conflict

// URL cache map to prevent memory leaks
const urlCache = new Map();

// Special handling for gallery + every-session mode to prevent flickering completely
// We'll add a special CSS transition effect when loading gallery images
const addAntiFlickerStyle = () => {
    // Check if our anti-flicker style already exists
    if (!document.getElementById('anti-flicker-style')) {
        const style = document.createElement('style');
        style.id = 'anti-flicker-style';
        style.textContent = `
            .gallery-loading {
                opacity: 0 !important;
                transition: opacity 0s !important;
            }
            .gallery-fade-in {
                opacity: 1 !important;
                transition: opacity 0.5s ease-in !important;
            }
        `;
        document.head.appendChild(style);
    }
};

class BackgroundCache {
    constructor() {
        this.db = null;
        this.initPromise = null;
        this.isInitializing = false;
        this.lastChangedTimestamps = {}; // Track timestamps by source
    }

    /**
     * Initialize the IndexedDB database
     * @returns {Promise} Resolves when DB is ready
     */
    init() {
        // Return existing promise if already initializing
        if (this.initPromise) {
            return this.initPromise;
        }

        this.isInitializing = true;
        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(BG_CACHE_DB_NAME, BG_CACHE_DB_VERSION);

            request.onerror = (event) => {
                console.error("Background Cache DB error:", event.target.error);
                this.isInitializing = false;
                reject(event.target.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object store for background cache if it doesn't exist
                if (!db.objectStoreNames.contains(BG_CACHE_STORE_NAME)) {
                    const store = db.createObjectStore(BG_CACHE_STORE_NAME, { keyPath: 'source' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isInitializing = false;
                resolve(this.db);
            };
        });

        return this.initPromise;
    }

    /**
     * Clean up old blob URLs
     */
    cleanUrlCache() {
        // Revoke any obsolete blob URLs to prevent memory leaks
        for (const [key, url] of urlCache.entries()) {
            URL.revokeObjectURL(url);
            urlCache.delete(key);
        }
    }

    /**
     * Cache a background image
     * @param {string} source - The source type (reddit, earth, unsplash, local)
     * @param {Object} metadata - Source-specific metadata (location, credits, etc.)
     * @param {string|Blob} imageData - Either a URL, base64 string, or Blob
     * @returns {Promise} Resolves when caching is complete
     */
    async cacheBackground(source, metadata, imageData) {
        try {
            await this.init();

            // Convert image to Blob if it's not already
            let imageBlob;
            if (imageData instanceof Blob) {
                imageBlob = imageData;
            } else {
                // It's a URL or base64 string, fetch and convert to Blob
                try {
                    const response = await fetch(imageData);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
                    }
                    imageBlob = await response.blob();
                } catch (fetchError) {
                    console.warn(`Error fetching image, treating as data URL: ${fetchError.message}`);
                    
                    // Handle base64 data URLs directly
                    if (typeof imageData === 'string' && imageData.startsWith('data:')) {
                        // Convert base64 data URL to blob
                        try {
                            imageBlob = await this.dataURLtoBlob(imageData);
                        } catch (dataUrlError) {
                            console.error("Error converting data URL to blob:", dataUrlError);
                            throw dataUrlError;
                        }
                    } else {
                        throw fetchError;
                    }
                }
            }

            // Prepare cache entry
            const timestamp = Date.now();
            const cacheEntry = {
                source,
                metadata,
                imageBlob,
                timestamp
            };

            // Save to IndexedDB
            const transaction = this.db.transaction([BG_CACHE_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(BG_CACHE_STORE_NAME);

            return new Promise((resolve, reject) => {
                const request = store.put(cacheEntry);
                
                request.onsuccess = () => {
                    // Update the last changed timestamp
                    this.lastChangedTimestamps[source] = timestamp;
                    // Save the timestamp to storage
                    window.storage.set({ backgroundLastChanged: timestamp }).catch(storageError => {
                        console.warn("Error saving timestamp to storage:", storageError);
                    });
                    
                    resolve(true);
                };
                
                request.onerror = (event) => {
                    console.error(`Error caching background for ${source}:`, event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error("Background caching error:", error);
            return false;
        }
    }

    /**
     * Convert a data URL to a Blob
     * @param {string} dataURL - The data URL string
     * @returns {Promise<Blob>} A promise that resolves to a Blob
     */
    dataURLtoBlob(dataURL) {
        return new Promise((resolve, reject) => {
            try {
                // Check if it's a valid data URL
                if (!dataURL.startsWith('data:')) {
                    throw new Error('Invalid data URL');
                }
                
                // Split the data URL to get the content type and base64 data
                const parts = dataURL.split(',');
                const contentType = parts[0].match(/:(.*?);/)[1];
                const base64 = atob(parts[1]);
                const byteChars = new Array(base64.length);
                
                for (let i = 0; i < base64.length; i++) {
                    byteChars[i] = base64.charCodeAt(i);
                }
                
                const byteArray = new Uint8Array(byteChars);
                const blob = new Blob([byteArray], { type: contentType });
                
                resolve(blob);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Get a cached background
     * @param {string} source - The source type (reddit, earth, unsplash, local)
     * @returns {Promise<Object|null>} The cache entry or null if not found
     */
    async getBackground(source) {
        try {
            await this.init();
            
            const transaction = this.db.transaction([BG_CACHE_STORE_NAME], 'readonly');
            const store = transaction.objectStore(BG_CACHE_STORE_NAME);

            return new Promise((resolve, reject) => {
                const request = store.get(source);
                
                request.onsuccess = () => {
                    const cacheEntry = request.result;
                    
                    if (cacheEntry) {
                        // Return the cache entry with a fresh Blob URL
                        const blobUrl = urlCache.get(source) || URL.createObjectURL(cacheEntry.imageBlob);
                        urlCache.set(source, blobUrl);
                        resolve({
                            ...cacheEntry,
                            blobUrl
                        });
                    } else {
                        console.log(`No cached background found for source: ${source}`);
                        resolve(null);
                    }
                };
                
                request.onerror = (event) => {
                    console.error(`Error retrieving cached background for ${source}:`, event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error("Error getting background from cache:", error);
            return null;
        }
    }

    /**
     * Check if a cached background is expired
     * @param {string} source - The source type
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {Promise<boolean>} True if expired or not found, false if still valid
     */
    async isExpired(source, maxAge) {
        try {
            // First check if we're using manual or every-session schedule
            const result = await window.storage.get([BACKGROUND_SCHEDULE_KEY, 'localImageSource']);
            const scheduleOption = result[BACKGROUND_SCHEDULE_KEY] || 'manual';
            const localImageSource = result.localImageSource || 'single';
            
            // Special case: always mark as expired for gallery + every-session
            // This prevents even a brief display of the cached image
            if (source === 'local' && localImageSource === 'gallery' && scheduleOption === 'every-session') {
                console.log('Gallery with every-session mode: Marking cache as expired and clearing existing cache');
                // Immediately try to revoke any existing blob URL
                if (urlCache.has(source)) {
                    URL.revokeObjectURL(urlCache.get(source));
                    urlCache.delete(source);
                }
                
                // Also add our anti-flicker CSS
                addAntiFlickerStyle();
                
                // Apply the gallery-loading class to the background container immediately
                const bgContainer = document.getElementById('background-container');
                if (bgContainer) {
                    bgContainer.classList.add('gallery-loading');
                }
                
                return true; // Always consider expired for gallery + every-session
            }
            
            // For manual mode, cache never expires unless manually refreshed
            if (scheduleOption === 'manual') {
                console.log('Manual mode: Using cache unless manually refreshed');
                return false;
            }
            
            // For every-session mode, cache always expires on page load
            if (scheduleOption === 'every-session') {
                return true;
            }
            
            // For hourly/daily modes, check against the timestamp
            const cacheEntry = await this.getBackground(source);
            
            if (!cacheEntry) {
                return true; // Not found, so consider it expired
            }
            
            const now = Date.now();
            const age = now - cacheEntry.timestamp;
            return age >= maxAge;
        } catch (error) {
            console.error("Error checking cache expiration:", error);
            return true; // Consider expired on error
        }
    }

    /**
     * Clear all cached backgrounds
     * @returns {Promise<boolean>} True if successful
     */
    async clearAll() {
        try {
            await this.init();
            
            const transaction = this.db.transaction([BG_CACHE_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(BG_CACHE_STORE_NAME);

            return new Promise((resolve, reject) => {
                const request = store.clear();
                
                request.onsuccess = () => {
                    console.log("All background caches cleared");
                    this.cleanUrlCache();
                    resolve(true);
                };
                
                request.onerror = (event) => {
                    console.error("Error clearing background caches:", event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error("Error clearing background caches:", error);
            return false;
        }
    }

    /**
     * Apply a cached background to the container
     * @param {string} source - The source type
     * @param {HTMLElement} container - The container element
     * @returns {Promise<boolean>} True if successful
     */
    async applyBackground(source, container) {
        try {
            // Get the cached background
            const cacheEntry = await this.getBackground(source);
            
            if (!cacheEntry) {
                console.log(`No cached background found for source: ${source}`);
                return false;
            }
            // Clear container
            container.innerHTML = '';
            
            // Create image element
            const img = document.createElement('img');
            img.className = 'background-image';
            img.src = cacheEntry.blobUrl;
            
            img.onerror = () => {
                console.error(`Error loading cached image for source: ${source}`);
                container.innerHTML = '<div class="background-loader">Error loading cached image. Refreshing...</div>';
                return false;
            };
            
            // Add image to container
            container.appendChild(img);
            
            // Update location info if available
            if (cacheEntry.metadata && typeof window.createOrUpdateLocationInfo === 'function') {
                const metadata = cacheEntry.metadata;
                
                if (source === 'earth' && metadata.location) {
                    const locationStr = metadata.location.region && metadata.location.country 
                        ? `${metadata.location.region}, ${metadata.location.country}` 
                        : (metadata.location.region || metadata.location.country || 'Unknown Location');
                    
                    window.createOrUpdateLocationInfo(
                        locationStr,
                        metadata.earthLink,
                        'View in Google Earth'
                    );
                    
                    // Save for "Save Image" feature
                    window.currentEarthViewLocation = locationStr;
                    
                } else if (source === 'unsplash' && metadata.location) {
                    const locationName = metadata.location.region || 'Beautiful scene';
                    
                    if (metadata.credit) {
                        window.createOrUpdateLocationInfo(
                            locationName,
                            metadata.credit.link,
                            `Photo by ${metadata.credit.name} on Unsplash`
                        );
                        
                        // Save for "Save Image" feature
                        window.currentUnsplashLocation = locationName;
                        window.currentUnsplashPhotographer = metadata.credit.name;
                    } else {
                        window.createOrUpdateLocationInfo(locationName);
                    }
                    
                } else if (source === 'reddit' && metadata.title) {
                    window.createOrUpdateLocationInfo(metadata.title || 'Reddit Image');
                    window.currentRedditTitle = metadata.title;
                    
                } else if (source === 'local' && metadata.location) {
                    window.createOrUpdateLocationInfo(metadata.location);
                    window.currentLocalImageLocation = metadata.location;
                }
            }
            
            return true;
        } catch (error) {
            console.error("Error applying background from cache:", error);
            return false;
        }
    }
}

// Create and export a singleton instance
const backgroundCache = new BackgroundCache();
window.backgroundCache = backgroundCache;
