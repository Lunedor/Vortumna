// Pixabay background image provider

// List of available image qualities
const PIXABAY_QUALITIES = [
    { value: 'regular', label: 'Regular (640px)' },
    { value: 'large', label: 'Large (1280px)' },
    { value: 'fullHD', label: 'Full HD (1920px)' },
    { value: 'original', label: 'Original (Max Resolution)' }
];

// List of Pixabay categories for the dropdown
const PIXABAY_CATEGORIES = [
    { value: '', label: 'All' },
    // High relevance for wallpapers
    { value: 'backgrounds', label: 'Backgrounds' },
    { value: 'nature', label: 'Nature' },
    { value: 'travel', label: 'Travel' },
    { value: 'animals', label: 'Animals' },
    { value: 'buildings', label: 'Architecture' },
    { value: 'computer', label: 'Technology' },
    { value: 'places', label: 'Places' },
    { value: 'music', label: 'Music' },
    
    // Medium relevance
    { value: 'sports', label: 'Sports' },
    { value: 'food', label: 'Food' },
    { value: 'transportation', label: 'Transportation' },
    { value: 'science', label: 'Science' },
    
    // Lower relevance (but kept for completeness)
    { value: 'people', label: 'People' },
    { value: 'business', label: 'Business' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'education', label: 'Education' },
    { value: 'feelings', label: 'Feelings' },
    { value: 'health', label: 'Health' },
    { value: 'industry', label: 'Industry' },
    { value: 'religion', label: 'Religion' }
];

// Populate the categories dropdown when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Populate Pixabay categories dropdown
    const categoriesDropdown = document.getElementById('pixabay-categories');
    if (categoriesDropdown) {
        // Populate options
        PIXABAY_CATEGORIES.forEach(category => {
            const option = document.createElement('option');
            option.value = category.value;
            option.textContent = category.label;
            categoriesDropdown.appendChild(option);
        });
        
        // Set the selected value from storage
        storage.get('pixabayCategory').then(result => {
            if (result && result.pixabayCategory) {
                categoriesDropdown.value = result.pixabayCategory;
            }
        });
        
        // Add change event listener
        categoriesDropdown.addEventListener('change', function() {
            // Save the selected category
            storage.set({ pixabayCategory: this.value }).then(() => {
                // If Pixabay is the current background source, refresh the background
                storage.get('background_source').then(result => {
                    if (result && result.background_source === 'pixabay') {
                        if (typeof updateBackground === 'function') {
                            console.log('Categories changed, requesting background update');
                            updateBackground('pixabay');
                        }
                    }
                });
            });
        });
    }
    
    // Populate Pixabay quality dropdown
    const qualityDropdown = document.getElementById('pixabay-quality');
    if (qualityDropdown) {
        // Populate options
        PIXABAY_QUALITIES.forEach(quality => {
            const option = document.createElement('option');
            option.value = quality.value;
            option.textContent = quality.label;
            qualityDropdown.appendChild(option);
        });
        
        // Set the selected value from storage, default to large if not set
        storage.get('pixabayQuality').then(result => {
            qualityDropdown.value = (result && result.pixabayQuality) ? result.pixabayQuality : 'large';
        });
        
        // Add change event listener
        qualityDropdown.addEventListener('change', function() {
            // Save the selected quality
            storage.set({ pixabayQuality: this.value }).then(() => {
                // If Pixabay is the current background source, refresh the background
                storage.get('background_source').then(result => {
                    if (result && result.background_source === 'pixabay') {
                        if (typeof updateBackground === 'function') {
                            console.log('Quality setting changed, requesting background update');
                            updateBackground('pixabay');
                        }
                    }
                });
            });
        });
    }
    
    // Add event listener for saving API key
    const savePixabayKeyBtn = document.getElementById('save-pixabay-key');
    if (savePixabayKeyBtn) {
        savePixabayKeyBtn.addEventListener('click', function() {
            const apiKeyInput = document.getElementById('pixabay-api-key');
            if (apiKeyInput && apiKeyInput.value && apiKeyInput.value !== '••••••••••••••••') {
                storage.set({ pixabayApiKey: apiKeyInput.value }).then(() => {
                    apiKeyInput.value = '••••••••••••••••';
                    console.log('Pixabay API key saved');
                });
            }
        });
    }
    
    // Check if a key is already stored
    storage.get('pixabayApiKey').then(result => {
        const apiKeyInput = document.getElementById('pixabay-api-key');
        if (apiKeyInput && result && result.pixabayApiKey) {
            apiKeyInput.value = '••••••••••••••••';
        }
    });
    
    // Add event listener for radio button
    const pixabayRadio = document.getElementById('pixabay-background');
    if (pixabayRadio) {
        pixabayRadio.addEventListener('change', function() {
            if (this.checked) {
                storage.set({ background_source: 'pixabay' });
            }
        });
    }
});

class PixabayFetcher {
    constructor() {
        // Get categories from storage or use default
        storage.get('pixabayCategory').then(result => {
            this.category = result && result.pixabayCategory ? result.pixabayCategory : '';
        });
        this.category = ''; // Default until async call completes
    }

    // Check if a valid API key exists
    async hasValidApiKey() {
        const result = await storage.get('pixabayApiKey');
        return result && result.pixabayApiKey && result.pixabayApiKey.trim().length > 0;
    }

    // Get the API key from storage
    async getApiKey() {
        const result = await storage.get('pixabayApiKey');
        return result ? result.pixabayApiKey : null;
    }    async getRandomImage(category = this.category) {
        try {
            // Check if we have a valid API key first
            if (!await this.hasValidApiKey()) {
                console.error('No valid Pixabay API key found');
                return null;
            }

            const apiKey = await this.getApiKey();
            
            // The Pixabay API uses 'q' parameter for search terms instead of using 'category' directly
            // Categories should be passed as search query
            let apiUrl = `https://pixabay.com/api/?key=${apiKey}&per_page=100&safesearch=false&min_width=1920&orientation=horizontal&image_type=photo`;
            
            if (category) {
                // Use the category as a search query parameter
                apiUrl += `&q=${encodeURIComponent(category)}`;
            }
            
            console.log('Fetching from Pixabay API...');
            const response = await fetch(apiUrl);

            if (!response.ok) throw new Error('Failed to fetch image from Pixabay');
            
            const data = await response.json();
            console.log(`Got ${data.hits?.length || 0} images from Pixabay`);
            
            if (!data.hits || data.hits.length === 0) {
                throw new Error('No images found on Pixabay');
            }
            
            // Select a random image from the results
            const randomIndex = Math.floor(Math.random() * data.hits.length);
            const image = data.hits[randomIndex];
            
            // Store the image info globally for the gallery
            window.currentPixabayTags = image.tags || 'Pixabay Image';
            window.currentPixabayUser = image.user || 'Unknown User';
            
            // Get preferred image quality
            const qualityResult = await storage.get('pixabayQuality');
            const preferredQuality = qualityResult?.pixabayQuality || 'large';
            
            // Determine image URL based on quality preference
            let imageUrl;
            switch (preferredQuality) {
                case 'original':
                    // imageURL is the original full resolution (only available with full API access)
                    imageUrl = image.imageURL || image.fullHDURL || image.largeImageURL || image.webformatURL;
                    break;
                case 'fullHD':
                    // fullHDURL is 1920px (only available with full API access)
                    imageUrl = image.fullHDURL || image.largeImageURL || image.webformatURL;
                    break;
                case 'large':
                    // largeImageURL is 1280px
                    imageUrl = image.largeImageURL || image.webformatURL;
                    break;
                case 'regular':
                default:
                    // webformatURL is 640px
                    imageUrl = image.webformatURL;
                    break;
            }
            
            console.log(`Using image quality: ${preferredQuality}`);
            
            return {
                imageUrl: imageUrl,
                webformatURL: image.webformatURL,
                largeImageURL: image.largeImageURL,
                fullHDURL: image.fullHDURL,
                originalImageURL: image.imageURL,
                tags: image.tags,
                user: image.user,
                userId: image.user_id,
                pageURL: image.pageURL,
                id: image.id
            };
        } catch (error) {
            console.error('Failed to fetch Pixabay image:', error);
            return null;
        }
    }

    // Add tracking method for consistency with Unsplash (though not required by Pixabay)
    async trackDownload(imageId) {
        // Pixabay doesn't require tracking downloads, but we add this method for consistency
        if (imageId) {
            console.log(`Image download tracked (ID: ${imageId})`);
        }
    }
}

// Create a singleton instance
const pixabayFetcher = new PixabayFetcher();

/**
 * Display an image from Pixabay as background
 * @param {Object} imageData - Data returned from the Pixabay API
 * @returns {Promise<boolean>} - True if successful
 */
async function displayPixabayImage(imageData) {
    return new Promise((resolve, reject) => {
        if (!imageData || (!imageData.imageUrl && !imageData.webformatURL)) {
            reject(new Error('Invalid image data provided'));
            return;
        }
        
        const bgContainer = document.getElementById('background-container');
        if (!bgContainer) {
            reject(new Error('Background container not found'));
            return;
        }
        
        // Create image element
        const img = document.createElement('img');
        img.className = 'background-image';
        
        // Set up onload handler
        img.onload = () => {
            bgContainer.innerHTML = '';
            bgContainer.appendChild(img);
            
            // Create or update location info
            if (window.createOrUpdateLocationInfo) {
                const tags = imageData.tags || 'Pixabay Image';
                const user = imageData.user || 'Unknown User';
                const qualityResult = storage.get('pixabayQuality');
                
                window.createOrUpdateLocationInfo(
                    tags,
                    imageData.pageURL || 'https://pixabay.com',
                    `Photo by ${user} on Pixabay`
                );
            }
            
            // Apply the saved display mode
            if (window.storage && typeof window.updateBackgroundImageMode === 'function') {
                window.storage.get('backgroundImageDisplayMode').then(result => {
                    const displayMode = result.backgroundImageDisplayMode || 'cover';
                    window.updateBackgroundImageMode(displayMode);
                    if (typeof window.updateToggleButtonIcon === 'function') {
                        window.updateToggleButtonIcon(displayMode);
                    }
                });
            }
            
            resolve(true);
        };
        
        // Set up error handler with intelligent fallback sequence
        img.onerror = (e) => {
            console.error('Failed to load Pixabay image:', e);
            
            // Advanced fallback logic based on available URLs
            // Try in descending order of quality: fullHD -> large -> webformat
            if (imageData.fullHDURL && imageData.fullHDURL !== img.src) {
                console.log('Trying fullHD version as fallback...');
                img.src = imageData.fullHDURL;
            } else if (imageData.largeImageURL && imageData.largeImageURL !== img.src) {
                console.log('Trying large version as fallback...');
                img.src = imageData.largeImageURL;
            } else if (imageData.webformatURL && imageData.webformatURL !== img.src) {
                console.log('Trying webformat version as fallback...');
                img.src = imageData.webformatURL;
            } else {
                // If all fallbacks have been tried or are unavailable
                reject(new Error('Failed to load Pixabay image after trying all fallback sources'));
            }
        };
        
        // Set image source to start loading (use the URL provided by getRandomImage)
        img.src = imageData.imageUrl;
        console.log('Loading image from:', img.src);
    });
}

/**
 * Load a background image from Pixabay
 * @param {boolean} forceUpdate - Whether to force a new image regardless of cache
 * @returns {Promise<boolean>} True if successful
 */
async function loadPixabayBackground(forceUpdate = false) {
    console.log(`Loading Pixabay background (force: ${forceUpdate})`);
    const bgContainer = document.getElementById('background-container');
    
    // Show loading indicator
    bgContainer.innerHTML = '<div class="background-loader">Loading Pixabay image...</div>';
    
    try {
        // API key check 
        const hasApiKey = await pixabayFetcher.hasValidApiKey();
        if (!hasApiKey) {
            const msg = 'Pixabay API key not found. Please add one in settings.';
            console.error(msg);
            bgContainer.innerHTML = `<div class="background-loader">${msg}</div>`;
            return false;
        }
        
        // Check cache first
        if (!forceUpdate && window.backgroundCache) {
            try {
                const isExpired = await window.backgroundCache.isExpired('pixabay', 3600000); // 1 hour cache
                if (!isExpired) {
                    console.log('Using cached Pixabay background');
                    const success = await window.backgroundCache.applyBackground('pixabay', bgContainer);
                    if (success) {
                        return true;
                    }
                    // Fall through to fetch new image if cache apply fails
                }
            } catch (cacheError) {
                console.warn('Error checking background cache:', cacheError);
                // Continue to fetch new image
            }
        }
        
        // Get the category from storage
        const result = await storage.get('pixabayCategory');
        const category = result?.pixabayCategory || '';
        
        // Fetch new image
        const imageData = await pixabayFetcher.getRandomImage(category);
        if (!imageData) {
            throw new Error('Failed to fetch image from Pixabay');
        }
        
        // Display the image
        await displayPixabayImage(imageData);
        
        // Cache the image if caching is available
        if (window.backgroundCache) {
            try {
                await window.backgroundCache.cacheBackground('pixabay', 
                    {
                        tags: imageData.tags,
                        user: imageData.user,
                        pageURL: imageData.pageURL
                    }, 
                    imageData.imageUrl || imageData.webformatURL
                );
            } catch (cacheError) {
                console.warn('Error caching Pixabay background:', cacheError);
                // Continue as this is non-critical
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error loading Pixabay background:', error);
        bgContainer.innerHTML = `<div class="background-loader">Error: ${error.message}</div>`;
        return false;
    }
}

// Make loadPixabayBackground globally available
window.loadPixabayBackground = loadPixabayBackground;
