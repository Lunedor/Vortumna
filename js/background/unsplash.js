// unsplash.js

// List of popular Unsplash categories for the dropdown
const UNSPLASH_CATEGORIES = [
  // --- Broad Nature & Scenery ---
  { value: 'nature,landscape,mountains,forest,trees,scenic,environment', label: 'Nature & Landscapes' },
  { value: 'ocean,sea,beach,coast,water,river,lake,waterfall', label: 'Water & Seascapes' },
  { value: 'sky,clouds,weather,storm,rain,snow,sun', label: 'Skies & Weather' },
  { value: 'seasons,spring,summer,autumn,fall,winter,seasonal', label: 'Seasons' },
  { value: 'plants,flowers,leaves,garden,botanical,floral', label: 'Plants & Flowers' }, // Refined from Flora & Gardening
  { value: 'animals,wildlife,pets,insects,birds,marine', label: 'Animals & Wildlife' }, // Slightly broader keywords
  { value: 'sunset,sunrise,dawn,dusk,goldenhour,sky', label: 'Sunsets & Sunrises' }, // More focused label

  // --- Urban & Built Environment ---
  { value: 'architecture,city,urban,buildings,street,cityscape,skyline', label: 'Architecture & Cityscapes' }, // Merged urban/street focus
  { value: 'interiors,home,decor,room,furniture,design', label: 'Interiors & Decor' }, // Refined from Home & Crafts
  { value: 'travel,explore,adventure,hiking,wanderlust,tourism,destination', label: 'Travel & Adventure' }, // Added destination
  { value: 'night,dark,lowlight,citylights,evening,neon', label: 'Night & Low Light' }, // Refined from Night & Nightlife

  // --- Abstract, Textures & Backgrounds ---
  { value: 'abstract,texture,pattern,background,gradient,shapes,lines', label: 'Abstract & Geometric' }, // Split from Tech
  { value: 'texture,pattern,material,surface,closeup,macro,details', label: 'Textures & Details' }, // Refined from Macro/Closeups
  { value: 'minimal,minimalist,simple,clean,white,neutral', label: 'Minimalism' }, // Added Category
  { value: 'wallpapers,background,desktop,mobile,gradient', label: 'Wallpapers' }, // Added common background search

  // --- Concepts & Themes ---
  { value: 'technology,computer,code,digital,gadgets,innovation,future', label: 'Technology' }, // Split from Abstract
  { value: 'food,drink,cooking,restaurant,cafe,cuisine', label: 'Food & Drinks' }, // Refined keywords
  { value: 'space,stars,galaxy,nebula,astronomy,nightsky', label: 'Space & Astronomy' }, // Refined keywords
  { value: 'sports,fitness,health,exercise,athlete,action', label: 'Sports & Fitness' }, // Kept action, but be aware it can be busy
  { value: 'art,creative,paint,drawing,sculpture,design', label: 'Art & Design' }, // Refined Art & Creativity
  { value: 'culture,heritage,history,traditional,diversity,landmarks', label: 'Culture & Heritage' }, // Refined keywords
  { value: 'transport,car,vehicle,plane,train,road,bike', label: 'Transportation' }, // Split from Aerial
  { value: 'aerial,drone,overview,birdseyeview,landscapefromabove', label: 'Aerial Views' }, // Added Perspective Category
  { value: 'fashion,style,clothing,apparel,accessories,beauty', label: 'Fashion & Style' }, // Refined keywords
  { value: 'music,concert,instruments,festival,performance', label: 'Music & Events' }, // Refined Events & Music
  { value: 'wellness,health,calm,meditation,yoga,spa,relaxation', label: 'Wellness & Calm' }, // Refined label

  // --- People (Use with caution for general backgrounds) ---
  { value: 'people,portrait,man,woman,group,lifestyle,silhouette', label: 'People & Portraits' } // Simplified keywords, added silhouette
];

// Populate the categories dropdown when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    const categoriesDropdown = document.getElementById('unsplash-categories');
    if (categoriesDropdown) {
        // Populate options
        UNSPLASH_CATEGORIES.forEach(category => {
            const option = document.createElement('option');
            option.value = category.value;
            option.textContent = category.label;
            categoriesDropdown.appendChild(option);
        });
        
        // Set the selected value from storage
        storage.get('unsplashCategories').then(result => {
            if (result && result.unsplashCategories) {
                categoriesDropdown.value = result.unsplashCategories;
            }
        });
        
        // Add change event listener
        categoriesDropdown.addEventListener('change', function() {
            // Save the selected category
            storage.set({ unsplashCategories: this.value }).then(() => {
                // If Unsplash is the current background source, refresh the background
                storage.get('backgroundSource').then(result => {
                    if (result && result.backgroundSource === 'unsplash') {
                        if (typeof updateBackground === 'function') {
                            console.log('Categories changed, requesting background update');
                            updateBackground('unsplash');
                        }
                    }
                });
            });
        });
    }
});

class UnsplashFetcher {
    constructor() {
        // Get categories from storage or use default
        storage.get('unsplashCategories').then(result => {
            this.defaultQuery = result && result.unsplashCategories ? result.unsplashCategories : 'landscape,nature,scenic';
        });
        this.defaultQuery = 'landscape,nature,scenic'; // Default until async call completes
    }

    // Check if a valid API key exists
    async hasValidApiKey() {
        const result = await storage.get('unsplashApiKey');
        return result && result.unsplashApiKey && result.unsplashApiKey.trim().length > 0;
    }

    // Get the API key from storage
    async getApiKey() {
        const result = await storage.get('unsplashApiKey');
        return result ? result.unsplashApiKey : null;
    }

    async getRandomImage(query = this.defaultQuery) {
        try {
            // Check if we have a valid API key first
            if (!await this.hasValidApiKey()) {
                console.error('No valid Unsplash API key found');
                return null;
            }

            const apiKey = await this.getApiKey();
            const response = await fetch(`https://api.unsplash.com/photos/random?query=${query}&orientation=landscape`, {
                headers: {
                    'Authorization': `Client-ID ${apiKey}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch image from Unsplash');
            
            const data = await response.json();
            
            // Store the location/photographer data globally for the gallery
            window.currentUnsplashLocation = data.location?.name || data?.description || 'Unknown Location';
            window.currentUnsplashPhotographer = data.user?.name || 'Unknown Photographer';
            
            return {
                imageUrl: data.urls.full,
                location: {
                    region: data.location?.name || data?.description || 'Unsplash',
                    country: data.location?.country || ''
                },
                credit: {
                    name: data.user.name,
                    username: data.user.username,
                    link: data.user.links.html
                },
                downloadLocation: data.links.download_location,
                unsplashLink: data.links.html
            };
        } catch (error) {
            console.error('Failed to fetch Unsplash image:', error);
            window.currentUnsplashLocation = 'Unknown Location';
            return null;
        }
    }

    // Notify Unsplash that the image was downloaded (required by API terms)
    async trackDownload(downloadLocation) {
        if (!downloadLocation || !(await this.hasValidApiKey())) return;
        
        try {
            const apiKey = await this.getApiKey();
            await fetch(downloadLocation, {
                headers: {
                    'Authorization': `Client-ID ${apiKey}`
                }
            });
            console.log('Unsplash download tracked successfully');
        } catch (error) {
            console.error('Failed to track Unsplash download:', error);
        }
    }
}

// Create a singleton instance
const unsplashFetcher = new UnsplashFetcher();

/**
 * Display an image from Unsplash as background
 * @param {Object} imageData - Data returned from the Unsplash API
 * @returns {Promise<boolean>} - True if successful
 */
async function displayUnsplashImage(imageData) {
    return new Promise((resolve, reject) => {
        if (!imageData || !imageData.imageUrl) {
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
            
            // Track the download (required by Unsplash API terms)
            unsplashFetcher.trackDownload(imageData.downloadLocation);
              // Create or update location info
            if (window.createOrUpdateLocationInfo && imageData.location) {
                const locationName = imageData.location.region || 'Beautiful scene';
                const photographerName = imageData.credit?.name || 'Unknown Photographer';
                
                window.createOrUpdateLocationInfo(
                    locationName,
                    imageData.credit?.link || imageData.unsplashLink || 'https://unsplash.com',
                    `Photo by ${photographerName} on Unsplash`
                );
            }
            
            // Apply the saved display mode for Unsplash images
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
        
        // Set up error handler
        img.onerror = () => {
            reject(new Error('Failed to load Unsplash image'));
        };
        
        // Set image source to start loading
        img.src = imageData.imageUrl;
    });
}

/**
 * Load a background image from Unsplash
 * @param {boolean} forceUpdate - Whether to force a new image regardless of cache
 * @returns {Promise<boolean>} True if successful
 */
async function loadUnsplashBackground(forceUpdate = false) {
    console.log(`Loading Unsplash background (force: ${forceUpdate})`);
    const bgContainer = document.getElementById('background-container');
    
    try {
        // API key check 
        const hasApiKey = await unsplashFetcher.hasValidApiKey();
        if (!hasApiKey) {
            const msg = 'Unsplash API key not found. Please add one in settings.';
            console.error(msg);
            bgContainer.innerHTML = `<div class="background-loader">${msg}</div>`;
            return false;
        }
        
        // Check cache first
        if (!forceUpdate && window.backgroundCache) {
            try {
                const isExpired = await window.backgroundCache.isExpired('unsplash', 3600000); // 1 hour cache
                if (!isExpired) {
                    console.log('Using cached Unsplash background');
                    const success = await window.backgroundCache.applyBackground('unsplash', bgContainer);
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
        
        // Get the query from storage
        const result = await storage.get('unsplashCategories');
        const query = result?.unsplashCategories || 'landscape,nature,scenic';
        
        // Fetch new image
        const imageData = await unsplashFetcher.getRandomImage(query);
        if (!imageData) {
            throw new Error('Failed to fetch image from Unsplash');
        }
        
        // Display the image
        await displayUnsplashImage(imageData);
        
        // Cache the image if caching is available
        if (window.backgroundCache) {
            try {
                await window.backgroundCache.cacheBackground('unsplash', 
                    {
                        location: imageData.location,
                        credit: imageData.credit
                    }, 
                    imageData.imageUrl
                );
            } catch (cacheError) {
                console.warn('Error caching Unsplash background:', cacheError);
                // Continue as this is non-critical
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error loading Unsplash background:', error);
        bgContainer.innerHTML = `<div class="background-loader">Error: ${error.message}</div>`;
        return false;
    }
}

// Make loadUnsplashBackground globally available
window.loadUnsplashBackground = loadUnsplashBackground;