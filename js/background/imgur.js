/**
 * ImgurFetcher - Fetches images from Imgur API
 * Part of the Vortumna new tab extension
 */

// Constants
const IMGUR_API_BASE = 'https://api.imgur.com/3';
const CLIENT_ID = '62c62b25935ca59'; // Anonymous usage client ID

class ImgurFetcher {
    constructor() {
        this.currentImageData = null;
    }

    /**
     * Extract the Imgur Hash ID from a string that might include a slug
     * @param {string} potentialSlugOrHash - The string containing the hash
     * @returns {string} The extracted hash ID or original string if extraction fails
     */
    extractImgurHash(potentialSlugOrHash) {
        if (!potentialSlugOrHash) return '';
        
        // Split by '-' and take the last part (common slug pattern)
        const parts = potentialSlugOrHash.split('-');
        const lastPart = parts[parts.length - 1];

        // Check if the last part looks like a typical hash (5-10 alphanumeric characters)
        if (lastPart && /^[a-zA-Z0-9]{5,10}$/.test(lastPart)) {
            return lastPart;
        }
        
        // If splitting didn't yield a likely hash, check if the whole string is the hash
        if (/^[a-zA-Z0-9]{5,10}$/.test(potentialSlugOrHash)) {
            console.log(`Using '${potentialSlugOrHash}' as the hash itself.`);
            return potentialSlugOrHash;
        }

        // Fallback: return the last part anyway, or original if split failed
        console.warn(`Could not reliably extract hash from '${potentialSlugOrHash}'. Using last part '${lastPart}' as fallback.`);
        return lastPart || potentialSlugOrHash;
    }

    /**
     * Get an image from a direct Imgur image URL
     * @param {string} url - The direct Imgur image URL
     * @returns {Promise<Object|null>} Image data object or null if failed
     */
    async getDirectImage(url) {
        try {
            // For direct image links (i.imgur.com), we don't need an API call
            // Just extract the image ID and create a return object
            const urlObject = new URL(url);
            const pathParts = urlObject.pathname.split('/');
            const filename = pathParts[pathParts.length - 1];
            const imgurId = filename.split('.')[0]; // Remove extension
            
            return {
                id: imgurId,
                title: 'Imgur Image',
                description: 'Direct image from Imgur',
                link: url,
                imageUrl: url,
                source: 'direct',
                location: 'Imgur Direct Image'
            };
        } catch (error) {
            console.error('Error parsing direct Imgur URL:', error);
            return null;
        }
    }

    /**
     * Determine the type of Imgur URL and extract relevant identifiers
     * @param {string} url - The Imgur URL to parse
     * @returns {Object|null} URL info or null if parsing failed
     */
    parseImgurUrl(url) {
        try {
            const urlObject = new URL(url);
            const pathParts = urlObject.pathname.split('/').filter(part => part);

            // Direct image link
            if (urlObject.hostname === 'i.imgur.com' || 
                /\.(jpe?g|png|gif|webp|bmp|tiff)$/i.test(urlObject.pathname)) {
                return {
                    type: 'direct',
                    url: url
                };
            }

            if (urlObject.hostname !== 'imgur.com') {
                console.error('URL must be from imgur.com');
                return null;
            }

            if (pathParts.length === 0) {
                console.error('Invalid imgur.com URL (no path)');
                return null;
            }

            // Tag (e.g., /t/wallpaper)
            if (pathParts.length >= 2 && pathParts[0].toLowerCase() === 't') {
                const tag = pathParts[1];
                return {
                    type: 'tag',
                    tag: tag,
                    endpoint: `${IMGUR_API_BASE}/gallery/t/${tag}`
                };
            }

            // Album (e.g., /a/abcde)
            if (pathParts.length >= 2 && pathParts[0].toLowerCase() === 'a') {
                const albumId = pathParts[1];
                // Validate album ID format
                if (!/^[a-zA-Z0-9]{5,10}$/.test(albumId)) {
                    console.error(`Invalid Album ID format: '${albumId}'`);
                    return null;
                }
                return {
                    type: 'album',
                    id: albumId,
                    endpoint: `${IMGUR_API_BASE}/album/${albumId}/images`
                };
            }

            // Gallery (e.g., /gallery/hash or /gallery/slug/hash)
            if (pathParts.length >= 2 && pathParts[0].toLowerCase() === 'gallery') {
                const potentialSlugOrHash = pathParts[pathParts.length - 1];
                const hash = this.extractImgurHash(potentialSlugOrHash);
                
                if (!hash) {
                    console.error(`Could not extract valid Hash ID from gallery path: ${potentialSlugOrHash}`);
                    return null;
                }
                
                return {
                    type: 'gallery',
                    id: hash,
                    endpoint: `${IMGUR_API_BASE}/gallery/album/${hash}`,
                    fallbackEndpoint: `${IMGUR_API_BASE}/gallery/image/${hash}`
                };
            }

            // Single image page (e.g., /abcde) - must check after others
            if (pathParts.length === 1) {
                const imageId = pathParts[0];
                // Validate image ID format
                if (!/^[a-zA-Z0-9]{5,10}$/.test(imageId)) {
                    console.error(`Invalid Image ID format: '${imageId}'`);
                    return null;
                }
                return {
                    type: 'image',
                    id: imageId,
                    endpoint: `${IMGUR_API_BASE}/image/${imageId}`
                };
            }

            console.error('Could not recognize Imgur URL format');
            return null;
            
        } catch (error) {
            console.error('Error parsing Imgur URL:', error);
            return null;
        }
    }

    /**
     * Fetch images from an Imgur album
     * @param {string} albumId - The album ID
     * @returns {Promise<Array|null>} Array of image objects or null if failed
     */
    async fetchAlbumImages(albumId) {
        try {
            const response = await fetch(`${IMGUR_API_BASE}/album/${albumId}/images`, {
                headers: {
                    'Authorization': `Client-ID ${CLIENT_ID}`
                }
            });

            if (!response.ok) {
                console.error(`Album fetch error: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            if (!data.success || !Array.isArray(data.data)) {
                console.error('Invalid album data returned from API');
                return null;
            }

            // Filter out videos and return only images
            return data.data.filter(img => 
                img.link && !img.type?.startsWith('video')
            ).map(img => ({
                id: img.id,
                title: img.title || 'Imgur Album Image',
                description: img.description || '',
                link: img.link,
                imageUrl: img.link,
                source: 'album',
                location: `Imgur Album: ${albumId}`
            }));
        } catch (error) {
            console.error('Error fetching album images:', error);
            return null;
        }
    }

    /**
     * Fetch images from an Imgur tag gallery
     * @param {string} tag - The tag name
     * @returns {Promise<Array|null>} Array of image objects or null if failed
     */
    async fetchTagImages(tag) {
        try {
            const response = await fetch(`${IMGUR_API_BASE}/gallery/t/${tag}`, {
                headers: {
                    'Authorization': `Client-ID ${CLIENT_ID}`
                }
            });

            if (!response.ok) {
                console.error(`Tag fetch error: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            if (!data.success || !data.data?.items) {
                console.error('Invalid tag data returned from API');
                return null;
            }

            // Process both direct images and albums in the tag
            const images = [];
            data.data.items.forEach(item => {
                if (item.is_album && item.images) {
                    // Add each image from the album
                    item.images.forEach(img => {
                        if (img.link && !img.type?.startsWith('video')) {
                            images.push({
                                id: img.id,
                                title: img.title || item.title || 'Imgur Tag Image',
                                description: img.description || item.description || '',
                                link: img.link,
                                imageUrl: img.link,
                                source: 'tag',
                                location: `Imgur Tag: ${tag}`
                            });
                        }
                    });
                } else if (!item.is_album && item.link && !item.type?.startsWith('video')) {
                    // Add direct image
                    images.push({
                        id: item.id,
                        title: item.title || 'Imgur Tag Image',
                        description: item.description || '',
                        link: item.link,
                        imageUrl: item.link,
                        source: 'tag',
                        location: `Imgur Tag: ${tag}`
                    });
                }
            });

            return images;
        } catch (error) {
            console.error('Error fetching tag images:', error);
            return null;
        }
    }

    /**
     * Fetch a single image from Imgur
     * @param {string} imageId - The image ID
     * @returns {Promise<Object|null>} Image data object or null if failed
     */
    async fetchImage(imageId) {
        try {
            const response = await fetch(`${IMGUR_API_BASE}/image/${imageId}`, {
                headers: {
                    'Authorization': `Client-ID ${CLIENT_ID}`
                }
            });

            if (!response.ok) {
                console.error(`Image fetch error: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            if (!data.success || !data.data || !data.data.link) {
                console.error('Invalid image data returned from API');
                return null;
            }

            // Skip videos
            if (data.data.type?.startsWith('video')) {
                console.error('Skipping video result');
                return null;
            }

            return {
                id: data.data.id,
                title: data.data.title || 'Imgur Image',
                description: data.data.description || '',
                link: data.data.link,
                imageUrl: data.data.link,
                source: 'image',
                location: 'Imgur Image'
            };
        } catch (error) {
            console.error('Error fetching image:', error);
            return null;
        }
    }

    /**
     * Fetch gallery album/image
     * @param {string} hash - The gallery hash
     * @param {boolean} isAlbum - Whether to fetch as album or single image
     * @returns {Promise<Array|Object|null>} Image data or array of images, or null if failed
     */
    async fetchGallery(hash, isAlbum = true) {
        try {
            // Try as album first (most common)
            const endpoint = isAlbum ? 
                `${IMGUR_API_BASE}/gallery/album/${hash}` : 
                `${IMGUR_API_BASE}/gallery/image/${hash}`;
                
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Client-ID ${CLIENT_ID}`
                }
            });

            if (!response.ok) {
                if (response.status === 404 && isAlbum) {
                    // If album not found, try as single image
                    console.log('Album not found in gallery, trying as single image');
                    return this.fetchGallery(hash, false);
                }
                console.error(`Gallery fetch error: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            if (!data.success) {
                console.error('Invalid gallery data returned from API');
                return null;
            }

            // If album with multiple images
            if (isAlbum && Array.isArray(data.data.images)) {
                return data.data.images
                    .filter(img => img.link && !img.type?.startsWith('video'))
                    .map(img => ({
                        id: img.id,
                        title: img.title || data.data.title || 'Imgur Gallery Image',
                        description: img.description || data.data.description || '',
                        link: img.link,
                        imageUrl: img.link,
                        source: 'gallery',
                        location: `Imgur Gallery: ${data.data.title || hash}`
                    }));
            } 
            // If single image (either direct gallery image or album with one image)
            else if (data.data.link && !data.data.type?.startsWith('video')) {
                return [{
                    id: data.data.id,
                    title: data.data.title || 'Imgur Gallery Image',
                    description: data.data.description || '',
                    link: data.data.link,
                    imageUrl: data.data.link,
                    source: 'gallery',
                    location: `Imgur Gallery: ${data.data.title || hash}`
                }];
            }
            
            console.warn('No suitable images found in gallery response');
            return null;
            
        } catch (error) {
            console.error('Error fetching gallery:', error);
            return null;
        }
    }

    /**
     * Get a random image from the provided Imgur URL
     * @param {string} url - The Imgur URL (album, tag, gallery, or direct image)
     * @returns {Promise<Object|null>} Image data object or null if failed
     */
    async getRandomImage(url) {
        try {
            if (!url) {
                console.error('No Imgur URL provided');
                return null;
            }
            
            // Parse the URL to determine the type and endpoints
            const urlInfo = this.parseImgurUrl(url);
            if (!urlInfo) {
                console.error('Could not parse the Imgur URL');
                return null;
            }
            
            // Handle direct image links differently
            if (urlInfo.type === 'direct') {
                return this.getDirectImage(urlInfo.url);
            }
            
            // Fetch images based on the URL type
            let images;
            switch (urlInfo.type) {
                case 'album':
                    images = await this.fetchAlbumImages(urlInfo.id);
                    break;
                case 'tag':
                    images = await this.fetchTagImages(urlInfo.tag);
                    break;
                case 'gallery':
                    images = await this.fetchGallery(urlInfo.id);
                    break;
                case 'image':
                    const image = await this.fetchImage(urlInfo.id);
                    images = image ? [image] : null;
                    break;
                default:
                    console.error(`Unsupported Imgur URL type: ${urlInfo.type}`);
                    return null;
            }
            
            // If no images found or fetch failed
            if (!images || images.length === 0) {
                console.error('No suitable images found or fetch failed');
                return null;
            }
            
            // Select a random image
            const randomImage = images[Math.floor(Math.random() * images.length)];
            this.currentImageData = randomImage;
            return randomImage;
            
        } catch (error) {
            console.error('Error getting random Imgur image:', error);
            return null;
        }
    }
}

/**
 * Display an Imgur image as the background
 * @param {Object} imageData - The image data object
 * @returns {Promise<boolean>} True if successful
 */
async function displayImgurImage(imageData) {
    if (!imageData || !imageData.imageUrl) {
        console.error('Invalid image data provided to displayImgurImage');
        return false;
    }
    
    const bgContainer = document.getElementById('background-container');
    if (!bgContainer) {
        console.error('Background container not found');
        return false;
    }
    
    return new Promise((resolve) => {
        // Create a new image element
        const img = document.createElement('img');
        img.className = 'background-image';
        
        // Set up onload handler
        img.onload = () => {
            // Clear the container and add the image
            bgContainer.innerHTML = '';
            bgContainer.appendChild(img);
            
            // Set title based on the image data
            const title = imageData.title || 'Imgur Image';
            const location = imageData.location || 'Imgur';
            
            // Save current image data for "Save Image" feature
            window.currentImgurTitle = title;
            window.currentImgurLocation = location;
            
            // Update location info if the function is available
            if (window.createOrUpdateLocationInfo) {
                window.createOrUpdateLocationInfo(
                    location,
                    imageData.link,
                    title
                );
            }
            
            resolve(true);
        };
        
        // Set up onerror handler
        img.onerror = () => {
            console.error('Failed to load Imgur image');
            bgContainer.innerHTML = '<div class="background-loader">Error loading image. Try again.</div>';
            resolve(false);
        };
        
        // Start loading the image
        img.src = imageData.imageUrl;
    });
}

/**
 * Load a background image from Imgur
 * @param {boolean} forceUpdate - Whether to force a new image regardless of cache
 * @returns {Promise<boolean>} True if successful
 */
async function loadImgurBackground(forceUpdate = false) {
    console.log(`Loading Imgur background (force: ${forceUpdate})`);
    const bgContainer = document.getElementById('background-container');
    
    // Show loading indicator
    bgContainer.innerHTML = '<div class="background-loader">Loading Imgur image...</div>';
    
    try {
        // Check storage for Imgur URL
        const storage = window.storage;
        if (!storage) {
            console.error('Storage not available');
            bgContainer.innerHTML = '<div class="background-loader">Storage not available</div>';
            return false;
        }
        
        // Check cache first unless forced update
        if (!forceUpdate && window.backgroundCache) {
            try {
                const isExpired = await window.backgroundCache.isExpired('imgur', 3600000); // 1 hour cache
                if (!isExpired) {
                    console.log('Using cached Imgur background');
                    const success = await window.backgroundCache.applyBackground('imgur', bgContainer);
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
        
        // Get Imgur URL from storage
        const result = await storage.get('imgurUrl');
        const imgurUrl = result?.imgurUrl;
        
        if (!imgurUrl) {
            const msg = 'No Imgur URL configured. Please add one in settings.';
            console.warn(msg);
            bgContainer.innerHTML = `<div class="background-loader">${msg}</div>`;
            return false;
        }
        
        // Create ImgurFetcher instance
        const imgurFetcher = new ImgurFetcher();
        
        // Fetch a random image from the URL
        const imageData = await imgurFetcher.getRandomImage(imgurUrl);
        
        if (!imageData) {
            const msg = 'Failed to fetch image from Imgur. Check the URL in settings.';
            console.error(msg);
            bgContainer.innerHTML = `<div class="background-loader">${msg}</div>`;
            return false;
        }
        
        // Display the image
        const displayed = await displayImgurImage(imageData);
        
        // Cache the image if successful and caching is available
        if (displayed && window.backgroundCache) {
            try {
                await window.backgroundCache.cacheBackground('imgur', 
                    {
                        title: imageData.title,
                        location: imageData.location,
                        link: imageData.link
                    }, 
                    imageData.imageUrl
                );
            } catch (cacheError) {
                console.warn('Error caching Imgur background:', cacheError);
                // Continue as this is non-critical
            }
        }
        
        return displayed;
        
    } catch (error) {
        console.error('Error loading Imgur background:', error);
        bgContainer.innerHTML = `<div class="background-loader">Error: ${error.message}</div>`;
        return false;
    }
}

// Make loadImgurBackground globally available
window.loadImgurBackground = loadImgurBackground;
