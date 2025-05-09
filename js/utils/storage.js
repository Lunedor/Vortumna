// storage.js - Central storage management for the extension

/**
 * Storage class that provides a centralized interface for Chrome extension storage
 * Handles all data storage and retrieval operations using chrome.storage.sync and chrome.storage.local
 */
class Storage {
    constructor() {
        // Default preferences that will be synchronized across devices        
        this.defaultSyncPrefs = {
            // Display settings
            showAll: true,
            showGoogleSearch: true,
            showLocationInfo: true,
            showBackground: true,
            showBookmarks: true,
            bookmarksHoverHide: false,
            showWeather: true,
            showQuotes: true,
            showClock: true,
            
            // Background settings
            backgroundSource: 'reddit',
            bgOpacity: 1,
            selectedSubreddit: 'EarthPorn',
            unsplashCategories: 'landscape,nature,scenic',
            
            // Weather settings
            useAutoLocation: true,
            customCity: '',
            
            // Quote settings
            quoteContentType: 'tr_books' 
        };
        
        // Values that should be stored locally (not synced)
        this.localStorageKeys = [
            'openweather-api-key',
            'unsplashApiKey',
            'geminiApiKey',
            'openrouterApiKey',
            'spotify_access_token',
            'spotify_refresh_token',
            'spotify_token_expiry',
            'weatherCache',
            'bookmarks',
            'geminiConversation',
            'openrouterConversation',
            'savedImages',
            'geminiModelCache',         // Added to fix sync storage error
            'geminiModelCacheTimestamp' // Added to fix sync storage error
        ];
        
        // Flag to track initialization state
        this.initialized = false;
        
        // Initialize immediately
        this.initialize().then(() => {
            this.initialized = true;
            // Dispatch event so other modules know storage is ready
            document.dispatchEvent(new Event('storage-ready'));
        }).catch(error => {
            console.error('Error initializing storage:', error);
        });
    }
    
    /**
     * Initialize storage with default values if they don't exist
     * @returns {Promise} Resolves when initialization is complete
     */
    async initialize() {
        try {
            // Initialize sync storage with defaults
            const syncItems = await this.getSync(Object.keys(this.defaultSyncPrefs));
            const missingItems = {};
            
            for (const [key, defaultValue] of Object.entries(this.defaultSyncPrefs)) {
                if (syncItems[key] === undefined) {
                    missingItems[key] = defaultValue;
                }
            }
            
            // Set any missing default values
            if (Object.keys(missingItems).length > 0) {
                await this.setSync(missingItems);
                console.log('Storage initialized with default values:', missingItems);
            }
            
            // Copy values from localStorage for compatibility
            this.migrateFromLocalStorage();
            
            return true;
        } catch (error) {
            console.error('Error initializing storage:', error);
            throw error;
        }
    }
    
    /**
     * Migrate values from localStorage to chrome.storage for compatibility
     */
    migrateFromLocalStorage() {
        try {
            // Handle sync items
            const syncItems = {};
            for (const key in this.defaultSyncPrefs) {
                const localValue = localStorage.getItem(key);
                if (localValue !== null) {
                    try {
                        syncItems[key] = JSON.parse(localValue);
                    } catch (e) {
                        syncItems[key] = localValue === 'true' ? true : (localValue === 'false' ? false : localValue);
                    }
                }
            }
            
            // Handle local items
            const localItems = {};
            for (const key of this.localStorageKeys) {
                const localValue = localStorage.getItem(key);
                if (localValue !== null) {
                    try {
                        localItems[key] = JSON.parse(localValue);
                    } catch (e) {
                        localItems[key] = localValue;
                    }
                }
            }
            
            // Set items in chrome.storage
            if (Object.keys(syncItems).length > 0) {
                this.setSync(syncItems);
            }
            if (Object.keys(localItems).length > 0) {
                this.setLocal(localItems);
            }
        } catch (error) {
            console.error('Error migrating from localStorage:', error);
        }
    }
       
    /**
     * Get values from chrome.storage.sync
     * @param {string|Array<string>} keys - Key(s) to retrieve
     * @returns {Promise<Object>} Object containing the requested keys and values
     */
    getSync(keys) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.get(keys, (result) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    resolve(result);
                });
            } catch (error) {
                // Fallback to localStorage in case Chrome API is not available
                console.warn('Chrome storage API not available, falling back to localStorage');
                const result = {};
                if (Array.isArray(keys)) {
                    keys.forEach(key => {
                        const value = localStorage.getItem(key);
                        if (value !== null) {
                            try {
                                result[key] = JSON.parse(value);
                            } catch (e) {
                                result[key] = value === 'true' ? true : (value === 'false' ? false : value);
                            }
                        }
                    });
                } else if (typeof keys === 'string') {
                    const value = localStorage.getItem(keys);
                    if (value !== null) {
                        try {
                            result[keys] = JSON.parse(value);
                        } catch (e) {
                            result[keys] = value === 'true' ? true : (value === 'false' ? false : value);
                        }
                    }
                } else if (keys === null || keys === undefined) {
                    // Get all items from localStorage
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (!this.localStorageKeys.includes(key)) {
                            try {
                                const value = localStorage.getItem(key);
                                result[key] = JSON.parse(value);
                            } catch (e) {
                                const value = localStorage.getItem(key);
                                result[key] = value === 'true' ? true : (value === 'false' ? false : value);
                            }
                        }
                    }
                }
                resolve(result);
            }
        });
    }
    
    /**
     * Set values in chrome.storage.sync
     * @param {Object} items - Object with keys and values to set
     * @returns {Promise} Resolves when the operation is complete
     */
    setSync(items) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.set(items, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    
                    // Also store in localStorage for compatibility
                    Object.entries(items).forEach(([key, value]) => {
                        try {
                            localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
                        } catch (e) {
                            console.warn(`Error saving ${key} to localStorage:`, e);
                        }
                    });
                    
                    // Dispatch an event with the changes so other components can react
                    document.dispatchEvent(new CustomEvent('storage-changed', {
                        detail: { changes: items }
                    }));
                    
                    resolve();
                });
            } catch (error) {
                // Fallback to localStorage in case Chrome API is not available
                console.warn('Chrome storage API not available, falling back to localStorage');
                // Store values in localStorage
                Object.entries(items).forEach(([key, value]) => {
                    try {
                        localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
                    } catch (e) {
                        console.warn(`Error saving ${key} to localStorage:`, e);
                    }
                });
                
                // Dispatch an event with the changes so other components can react
                document.dispatchEvent(new CustomEvent('storage-changed', {
                    detail: { changes: items }
                }));
                
                resolve();
            }
        });
    }
    
    /**
     * Remove keys from chrome.storage.sync
     * @param {string|Array<string>} keys - Key(s) to remove
     * @returns {Promise} Resolves when the operation is complete
     */
    removeSync(keys) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.remove(keys, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    
                    // Also remove from localStorage for compatibility
                    if (Array.isArray(keys)) {
                        keys.forEach(key => localStorage.removeItem(key));
                    } else {
                        localStorage.removeItem(keys);
                    }
                    
                    resolve();
                });
            } catch (error) {
                // Fallback to localStorage in case Chrome API is not available
                console.warn('Chrome storage API not available, falling back to localStorage');
                try {
                    if (Array.isArray(keys)) {
                        keys.forEach(key => localStorage.removeItem(key));
                    } else {
                        localStorage.removeItem(keys);
                    }
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }
        });
    }
    
    /**
     * Get values from chrome.storage.local
     * @param {string|Array<string>} keys - Key(s) to retrieve
     * @returns {Promise<Object>} Object containing the requested keys and values
     */
    getLocal(keys) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(keys, (result) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    resolve(result);
                });
            } catch (error) {
                // Fallback to localStorage in case Chrome API is not available
                console.warn('Chrome storage API not available, falling back to localStorage');
                const result = {};
                if (Array.isArray(keys)) {
                    keys.forEach(key => {
                        const value = localStorage.getItem(key);
                        if (value !== null) {
                            try {
                                result[key] = JSON.parse(value);
                            } catch (e) {
                                result[key] = value === 'true' ? true : (value === 'false' ? false : value);
                            }
                        }
                    });
                } else if (typeof keys === 'string') {
                    const value = localStorage.getItem(keys);
                    if (value !== null) {
                        try {
                            result[keys] = JSON.parse(value);
                        } catch (e) {
                            result[keys] = value === 'true' ? true : (value === 'false' ? false : value);
                        }
                    }
                } else if (keys === null || keys === undefined) {
                    // Get all local items from localStorage
                    this.localStorageKeys.forEach(key => {
                        const value = localStorage.getItem(key);
                        if (value !== null) {
                            try {
                                result[key] = JSON.parse(value);
                            } catch (e) {
                                result[key] = value === 'true' ? true : (value === 'false' ? false : value);
                            }
                        }
                    });
                }
                resolve(result);
            }
        });
    }
    
    /**
     * Set values in chrome.storage.local
     * @param {Object} items - Object with keys and values to set
     * @returns {Promise} Resolves when the operation is complete
     */
    setLocal(items) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set(items, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    
                    // Also store in localStorage for compatibility
                    Object.entries(items).forEach(([key, value]) => {
                        try {
                            localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
                        } catch (e) {
                            console.warn(`Error saving ${key} to localStorage:`, e);
                        }
                    });
                    
                    resolve();
                });
            } catch (error) {
                // Fallback to localStorage in case Chrome API is not available
                console.warn('Chrome storage API not available, falling back to localStorage');
                try {
                    Object.entries(items).forEach(([key, value]) => {
                        localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
                    });
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }
        });
    }
    
    /**
     * Remove keys from chrome.storage.local
     * @param {string|Array<string>} keys - Key(s) to remove
     * @returns {Promise} Resolves when the operation is complete
     */
    removeLocal(keys) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.remove(keys, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    
                    // Also remove from localStorage for compatibility
                    if (Array.isArray(keys)) {
                        keys.forEach(key => localStorage.removeItem(key));
                    } else {
                        localStorage.removeItem(keys);
                    }
                    
                    resolve();
                });
            } catch (error) {
                // Fallback to localStorage in case Chrome API is not available
                console.warn('Chrome storage API not available, falling back to localStorage');
                try {
                    if (Array.isArray(keys)) {
                        keys.forEach(key => localStorage.removeItem(key));
                    } else {
                        localStorage.removeItem(keys);
                    }
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }
        });
    }
    
    /**
     * Get values from either sync or local storage based on the key
     * @param {string|Array<string>} keys - Key(s) to retrieve
     * @returns {Promise<Object>} Object containing the requested keys and values
     */
    async get(keys) {
        try {
            // Wait for initialization if not completed yet
            if (!this.initialized) {
                await this.waitForInit();
            }
            
            if (!Array.isArray(keys)) {
                keys = [keys];
            }
            
            const localKeys = keys.filter(key => this.localStorageKeys.includes(key));
            const syncKeys = keys.filter(key => !this.localStorageKeys.includes(key));
            
            const results = {};
            
            // Get values from local storage
            if (localKeys.length > 0) {
                const localResults = await this.getLocal(localKeys);
                Object.assign(results, localResults);
            }
            
            // Get values from sync storage
            if (syncKeys.length > 0) {
                const syncResults = await this.getSync(syncKeys);
                Object.assign(results, syncResults);
            }
            
            return results;
        } catch (error) {
            console.error('Error getting values from storage:', error);
            throw error;
        }
    }
    
    /**
     * Set values in the appropriate storage area based on the keys
     * @param {Object} items - Object with keys and values to set
     * @returns {Promise} Resolves when all operations are complete
     */
    async set(items) {
        try {
            // Wait for initialization if not completed yet
            if (!this.initialized) {
                await this.waitForInit();
            }
            
            // Validate input
            if (!items || typeof items !== 'object') {
                console.error('Invalid input to set(): Expected an object');
                return false;
            }
            
            // Split items into local and sync storage
            const localItems = {};
            const syncItems = {};
            
            Object.entries(items).forEach(([key, value]) => {
                if (this.localStorageKeys.includes(key)) {
                    localItems[key] = value;
                } else {
                    syncItems[key] = value;
                }
            });
            
            const promises = [];
            
            // Set values in local storage
            if (Object.keys(localItems).length > 0) {
                promises.push(this.setLocal(localItems).catch(err => {
                    console.error(`Error setting local storage items: ${JSON.stringify(Object.keys(localItems))}`, err);
                    throw err;
                }));
            }
            
            // Set values in sync storage
            if (Object.keys(syncItems).length > 0) {
                promises.push(this.setSync(syncItems).catch(err => {
                    console.error(`Error setting sync storage items: ${JSON.stringify(Object.keys(syncItems))}`, err);
                    throw err;
                }));
            }
            
            if (promises.length === 0) {
                return true; // No items to save
            }
            
            try {
                await Promise.all(promises);
                return true;
            } catch (promiseError) {
                console.error('Error in one of the storage operations:', promiseError);
                throw promiseError;
            }
        } catch (error) {
            console.error('Error setting values in storage:', error);
            // Return false instead of throwing to prevent unhandled promise rejections
            return false;
        }
    }
    
    /**
     * Wait for storage initialization to complete
     * @returns {Promise} Resolves when initialization is complete
     */
    waitForInit() {
        return new Promise(resolve => {
            if (this.initialized) {
                resolve();
            } else {
                document.addEventListener('storage-ready', () => resolve(), { once: true });
            }
        });
    }
    
    /**
     * Remove keys from the appropriate storage area
     * @param {string|Array<string>} keys - Key(s) to remove
     * @returns {Promise} Resolves when all operations are complete
     */
    async remove(keys) {
        try {
            // Wait for initialization if not completed yet
            if (!this.initialized) {
                await this.waitForInit();
            }
            
            if (!Array.isArray(keys)) {
                keys = [keys];
            }
            
            const localKeys = keys.filter(key => this.localStorageKeys.includes(key));
            const syncKeys = keys.filter(key => !this.localStorageKeys.includes(key));
            
            const promises = [];
            
            // Remove from local storage
            if (localKeys.length > 0) {
                promises.push(this.removeLocal(localKeys));
            }
            
            // Remove from sync storage
            if (syncKeys.length > 0) {
                promises.push(this.removeSync(syncKeys));
            }
            
            await Promise.all(promises);
            return true;
        } catch (error) {
            console.error('Error removing keys from storage:', error);
            throw error;
        }
    }
    
    /**
     * Check if specific preferences exist
     * @param {string|Array<string>} keys - Key(s) to check
     * @returns {Promise<boolean>} True if all keys exist, false otherwise
     */
    async hasKeys(keys) {
        try {
            if (!this.initialized) {
                await this.waitForInit();
            }
            
            if (!Array.isArray(keys)) {
                keys = [keys];
            }
            
            const values = await this.get(keys);
            return keys.every(key => values[key] !== undefined);
        } catch (error) {
            console.error('Error checking if keys exist:', error);
            return false;
        }
    }
    
    /**
     * Clear all storage (both sync and local)
     * @returns {Promise} Resolves when all operations are complete
     */
    async clearAll() {
        try {
            if (!this.initialized) {
                await this.waitForInit();
            }
            
            const promises = [
                this.clearSync(),
                this.clearLocal()
            ];
            await Promise.all(promises);
            
            // Also clear localStorage for compatibility
            localStorage.clear();
            
            return true;
        } catch (error) {
            console.error('Error clearing all storage:', error);
            throw error;
        }
    }
    
    /**
     * Clear all sync storage
     * @returns {Promise} Resolves when the operation is complete
     */
    clearSync() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.clear(() => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    
                    // Also clear localStorage items except local items for compatibility
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                        const key = localStorage.key(i);
                        if (!this.localStorageKeys.includes(key)) {
                            localStorage.removeItem(key);
                        }
                    }
                    
                    resolve();
                });
            } catch (error) {
                console.warn('Chrome storage API not available, falling back to localStorage');
                try {
                    // Remove all sync items from localStorage
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                        const key = localStorage.key(i);
                        if (!this.localStorageKeys.includes(key)) {
                            localStorage.removeItem(key);
                        }
                    }
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }
        });
    }
    
    /**
     * Clear all local storage
     * @returns {Promise} Resolves when the operation is complete
     */
    clearLocal() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.clear(() => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    
                    // Also clear localStorage local items for compatibility
                    this.localStorageKeys.forEach(key => {
                        localStorage.removeItem(key);
                    });
                    
                    resolve();
                });
            } catch (error) {
                console.warn('Chrome storage API not available, falling back to localStorage');
                try {
                    // Remove all local items from localStorage
                    this.localStorageKeys.forEach(key => {
                        localStorage.removeItem(key);
                    });
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }
        });
    }
}

// Create and export a singleton instance
const storage = new Storage();

// Add event listeners for storage changes
try {
    chrome.storage.onChanged.addListener((changes, area) => {
        // Update localStorage for compatibility
        Object.entries(changes).forEach(([key, change]) => {
            if (change.newValue !== undefined) {
                try {
                    localStorage.setItem(key, typeof change.newValue === 'object' ? JSON.stringify(change.newValue) : change.newValue.toString());
                } catch (e) {
                    console.warn(`Error updating localStorage for ${key}:`, e);
                }
            } else {
                localStorage.removeItem(key);
            }
        });
        
        // Dispatch a custom event that other scripts can listen for
        const event = new CustomEvent('storage-changed', {
            detail: { changes, area }
        });
        document.dispatchEvent(event);
    });
} catch (error) {
    console.warn('Chrome storage API not available, storage change events will not be tracked');
    
    // Polyfill for localStorage to dispatch similar events
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        const oldValue = localStorage.getItem(key);
        originalSetItem.call(this, key, value);
        
        // Determine which area (sync or local) the key belongs to
        let area = 'sync';
        if (storage.localStorageKeys.includes(key)) {
            area = 'local';
        }
        
        // Process the value for compatibility
        let processedOldValue = oldValue;
        let processedNewValue = value;
        
        try {
            if (oldValue !== null) {
                processedOldValue = JSON.parse(oldValue);
            }
        } catch (e) {
            processedOldValue = oldValue === 'true' ? true : (oldValue === 'false' ? false : oldValue);
        }
        
        try {
            if (value !== null) {
                processedNewValue = JSON.parse(value);
            }
        } catch (e) {
            processedNewValue = value === 'true' ? true : (value === 'false' ? false : value);
        }
        
        // Dispatch a custom event similar to chrome.storage.onChanged
        const event = new CustomEvent('storage-changed', {
            detail: {
                changes: {
                    [key]: {
                        oldValue: processedOldValue,
                        newValue: processedNewValue
                    }
                },
                area
            }
        });
        document.dispatchEvent(event);
    };
    
    // Also handle removeItem for completeness
    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function(key) {
        const oldValue = localStorage.getItem(key);
        originalRemoveItem.call(this, key);
        
        if (oldValue !== null) {
            // Determine which area (sync or local) the key belongs to
            let area = 'sync';
            if (storage.localStorageKeys.includes(key)) {
                area = 'local';
            }
            
            // Process the value for compatibility
            let processedOldValue = oldValue;
            
            try {
                processedOldValue = JSON.parse(oldValue);
            } catch (e) {
                processedOldValue = oldValue === 'true' ? true : (oldValue === 'false' ? false : oldValue);
            }
            
            // Dispatch a custom event similar to chrome.storage.onChanged
            const event = new CustomEvent('storage-changed', {
                detail: {
                    changes: {
                        [key]: {
                            oldValue: processedOldValue,
                            newValue: undefined
                        }
                    },
                    area
                }
            });
            document.dispatchEvent(event);
        }
    };
}

// Export the storage instance
window.storage = storage;