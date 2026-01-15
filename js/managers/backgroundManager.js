(function () {
    'use strict';

    window.backgroundManager = {
        updateBackgroundInProgress: false,
        updateBackgroundTimer: null,

        /**
         * Updates the background image based on the source and settings.
         * @param {string} source The source of the background (e.g., 'reddit', 'unsplash').
         * @param {boolean} forceUpdate If true, bypasses cache and forces a new image load.
         */
        updateBackground: async function (source, forceUpdate = false) {
            // If a timer is already running, clear it
            if (this.updateBackgroundTimer) {
                clearTimeout(this.updateBackgroundTimer);
            }

            // Set a new timer to wait a short period before actually updating
            this.updateBackgroundTimer = setTimeout(async () => {
                // Only proceed if not already in progress
                if (this.updateBackgroundInProgress) {
                    console.log('Background update already in progress, skipping');
                    return;
                }

                this.updateBackgroundInProgress = true;

                try {
                    // Check background settings
                    const result = await window.storage.get([
                        'showBackground',
                        'backgroundChangeInterval',
                        'localImageSource',
                        'backgroundSchedule'
                    ]);

                    if (result.showBackground === false) {
                        this.updateBackgroundInProgress = false;
                        return; // Don't load any background if disabled
                    }

                    // Get background container
                    const bgContainer = document.getElementById('background-container');

                    // Special case for gallery + every-session: Clear the container immediately 
                    // to avoid flickering when switching images
                    if (source === 'local' &&
                        result.localImageSource === 'gallery' &&
                        result.backgroundSchedule === 'every-session') {

                        console.log('Gallery with every-session: Immediately clearing background container');
                        bgContainer.innerHTML = '';

                        // Also clear any existing location info
                        const existingLocationInfo = document.querySelector('.location-info');
                        if (existingLocationInfo) {
                            existingLocationInfo.remove();
                        }
                    }

                    // Default change interval is 1 hour (in milliseconds)
                    const changeInterval = result.backgroundChangeInterval || (60 * 60 * 1000);

                    // If forceUpdate is true, we need to skip the cache check completely
                    if (forceUpdate) {
                        console.log('Force update requested, bypassing cache check');
                        await this.loadFreshBackground(source, bgContainer);
                        return; // Exit early - loadFreshBackground handles setting updateBackgroundInProgress = false
                    }

                    // Check if background cache is expired using the backgroundCache
                    const isExpired = await window.backgroundCache.isExpired(source, changeInterval);

                    // If we have a valid cache and it hasn't expired
                    if (!isExpired) {
                        // Apply the cached background image using the system
                        const success = await window.backgroundCache.applyBackground(source, bgContainer);

                        if (success) {
                            // Apply display mode to the cached image
                            this.applyDisplayModeToContainer(bgContainer);
                            this.updateBackgroundInProgress = false;
                            return;
                        }

                        // If cache application failed, continue to load a new image
                        console.log('Cache application failed, loading new image');
                    }

                    // If we get here, we need to load a fresh background (either because cache expired or failed to apply)
                    await this.loadFreshBackground(source, bgContainer);

                } catch (error) {
                    console.error('Error loading background:', error);
                    this.updateBackgroundInProgress = false;
                }
            }, 300); // 300ms debounce time
        },

        /**
         * Loads a fresh background image from the specified source.
         * @param {string} source The source of the background.
         * @param {HTMLElement} bgContainer The container element for the background.
         */
        loadFreshBackground: async function (source, bgContainer) {
            // Clear existing content immediately to prevent old image from showing
            bgContainer.innerHTML = '';

            // Remove any existing location info immediately
            const existingLocationInfo = document.querySelector('.location-info');
            if (existingLocationInfo) {
                existingLocationInfo.remove();
            }

            // Show loading indicator for all sources
            const loader = document.createElement('div');
            loader.className = 'background-loader';
            loader.innerHTML = 'Loading background...';
            bgContainer.appendChild(loader);

            // Helper to handle image load and display mode application
            const handleImageLoad = async (imgElement, cacheData, imageUrl) => {
                // Apply display mode BEFORE appending to DOM to prevent flickering
                await this.applyDisplayModeToImage(imgElement);

                bgContainer.innerHTML = ''; // Remove loader
                bgContainer.appendChild(imgElement);

                // Cache the current background data
                if (cacheData) {
                    await window.backgroundCache.cacheBackground(source, cacheData, imageUrl || imgElement.src);
                }

                this.updateBackgroundInProgress = false;
            };

            if (source === 'imgur') {
                // Check if the imgur.js script is loaded
                if (typeof ImgurFetcher !== 'function') {
                    console.warn('ImgurFetcher not available, loading imgur.js');
                    try {
                        // Try to load the imgur.js script if not already loaded
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = '/js/background/imgur.js';
                            script.onload = resolve;
                            script.onerror = reject;
                            document.head.appendChild(script);
                        });
                        console.log('Successfully loaded imgur.js');
                    } catch (error) {
                        console.error('Failed to load imgur.js:', error);
                        loader.innerHTML = 'Error loading Imgur functionality';
                        this.updateBackgroundInProgress = false;
                        return;
                    }
                }

                // Get the URL from storage
                try {
                    const result = await window.storage.get('imgurUrl');
                    const imgurUrl = result?.imgurUrl;

                    if (!imgurUrl) {
                        loader.innerHTML = 'Please enter an Imgur URL in settings to use this background source';
                        this.updateBackgroundInProgress = false;
                        return;
                    }

                    const imgurFetcher = new ImgurFetcher();
                    const imageData = await imgurFetcher.getRandomImage(imgurUrl);

                    if (!imageData) {
                        loader.innerHTML = 'Failed to fetch image from Imgur. Please check your URL';
                        this.updateBackgroundInProgress = false;
                        return;
                    }

                    // Create image element
                    const imgElement = document.createElement('img');
                    imgElement.className = 'background-image';

                    // Preload image
                    imgElement.onload = async () => {
                        // Save current info for "Save Image" feature
                        window.currentImgurTitle = imageData.title || 'Imgur Image';
                        window.currentImgurLocation = imageData.location || 'Imgur';

                        // Update location info
                        window.createOrUpdateLocationInfo(
                            imageData.location || 'Imgur Image',
                            imageData.link,
                            imageData.title || 'Imgur Image'
                        );

                        await handleImageLoad(imgElement, {
                            title: imageData.title,
                            location: imageData.location,
                            link: imageData.link
                        }, imageData.imageUrl);
                    };

                    // Set image source to trigger the load
                    imgElement.src = imageData.imageUrl;

                } catch (error) {
                    console.error('Error loading Imgur image:', error);
                    loader.innerHTML = 'Error loading background from Imgur';
                    this.updateBackgroundInProgress = false;
                }
            } else if (source === 'reddit') {
                // Modified to handle the loader and caching with the new system
                const onImageLoad = async (imgElement) => {
                    const title = window.currentRedditTitle || 'Reddit Image';
                    await handleImageLoad(imgElement, { title });
                };

                fetchAndDisplayImage(onImageLoad).catch(error => {
                    console.error('Error loading Reddit image:', error);
                    loader.innerHTML = 'Error loading background. Reload to try again.';
                    this.updateBackgroundInProgress = false;
                });
            } else if (source === 'earth') {
                const earthView = new EarthViewFetcher();
                try {
                    const result = await earthView.getRandomEarthView();

                    if (result) {
                        // Create image element
                        const imgElement = document.createElement('img');
                        imgElement.className = 'background-image';

                        // Preload image
                        imgElement.onload = async () => {
                            // Save current location for "Save Image" feature
                            window.currentEarthViewLocation = `${result.location.region ? `${result.location.region}` : ''}${result.location.region && result.location.country ? `, ` : ''}${result.location.country ? `${result.location.country}` : ''}`;

                            // Create a proper location string that includes both region and country when available
                            const locationText = result.location.region && result.location.country
                                ? `${result.location.region}, ${result.location.country}`
                                : (result.location.region || result.location.country || 'Unknown Location');

                            window.createOrUpdateLocationInfo(
                                locationText,
                                result.earthLink,
                                'View in Google Earth'
                            );

                            await handleImageLoad(imgElement, {
                                location: result.location,
                                earthLink: result.earthLink
                            }, result.imageUrl);
                        };

                        // Set image source to trigger the load
                        imgElement.src = result.imageUrl;
                    } else {
                        this.updateBackgroundInProgress = false;
                    }
                } catch (error) {
                    console.error('Error loading Earth View image:', error);
                    loader.innerHTML = 'Error loading background. Reload to try again.';
                    this.updateBackgroundInProgress = false;
                }
            } else if (source === 'unsplash') {
                const unsplash = new UnsplashFetcher();

                // Check if we have a valid API key first
                try {
                    const hasKey = await unsplash.hasValidApiKey();

                    if (!hasKey) {
                        loader.innerHTML = 'Please enter a valid Unsplash API key in settings to use this background source.';
                        this.updateBackgroundInProgress = false;
                        return;
                    }

                    const result = await unsplash.getRandomImage();

                    if (result) {
                        // Create image element
                        const imgElement = document.createElement('img');
                        imgElement.className = 'background-image';

                        // Preload image
                        imgElement.onload = async () => {
                            // Get actual location name and photographer information
                            const locationName = result.location.region ? result.location.region : 'Beautiful scene';
                            const photographerName = result.credit.name;

                            // Save current location and photographer for "Save Image" feature
                            window.currentUnsplashLocation = locationName;
                            window.currentUnsplashPhotographer = photographerName;

                            // Use the utility function to create or update location info with proper location name
                            window.createOrUpdateLocationInfo(
                                locationName,
                                result.credit.link,
                                `Photo by ${photographerName} on Unsplash`
                            );

                            // Track download (required by Unsplash API terms)
                            unsplash.trackDownload(result.downloadLocation);

                            await handleImageLoad(imgElement, {
                                location: result.location,
                                credit: result.credit,
                                downloadLocation: result.downloadLocation
                            }, result.imageUrl);
                        };

                        // Set image source to trigger the load
                        imgElement.src = result.imageUrl;
                    } else {
                        loader.innerHTML = 'Error loading Unsplash image. Please check your API key.';
                        this.updateBackgroundInProgress = false;
                    }
                } catch (error) {
                    console.error('Error loading Unsplash image:', error);
                    loader.innerHTML = 'Error loading background. Please check your Unsplash API key.';
                    this.updateBackgroundInProgress = false;
                }
            } else if (source === 'pixabay') {
                const pixabay = new PixabayFetcher();

                // Check if we have a valid API key first
                try {
                    const hasKey = await pixabay.hasValidApiKey();

                    if (!hasKey) {
                        loader.innerHTML = 'Please enter a valid Pixabay API key in settings to use this background source.';
                        this.updateBackgroundInProgress = false;
                        return;
                    }

                    const result = await pixabay.getRandomImage();

                    if (result) {
                        // Create image element
                        const imgElement = document.createElement('img');
                        imgElement.className = 'background-image';

                        // Preload image
                        imgElement.onload = async () => {
                            // Get actual location name and photographer information
                            const locationName = result.location ? result.location : 'Beautiful scene';
                            const photographerName = result.photographer || 'Unknown Photographer';

                            // Save current location and photographer for "Save Image" feature
                            window.currentPixabayLocation = locationName;
                            window.currentPixabayPhotographer = photographerName;

                            // Use the utility function to create or update location info with proper location name
                            window.createOrUpdateLocationInfo(
                                locationName,
                                result.pageURL,
                                `Photo by ${photographerName} on Pixabay`
                            );

                            // Track download (required by Pixabay API terms)
                            pixabay.trackDownload(result.id);

                            await handleImageLoad(imgElement, {
                                location: result.location,
                                photographer: result.photographer,
                                pageURL: result.pageURL
                            }, result.webformatURL);
                        };

                        // Set image source to trigger the load
                        imgElement.src = result.webformatURL;
                    } else {
                        loader.innerHTML = 'Error loading Pixabay image. Please check your API key.';
                        this.updateBackgroundInProgress = false;
                    }
                } catch (error) {
                    console.error('Error loading Pixabay image:', error);
                    loader.innerHTML = 'Error loading background. Please check your Pixabay API key.';
                    this.updateBackgroundInProgress = false;
                }
            } else if (source === 'local') {
                // For local source, first check if we're using gallery or single image
                try {
                    const result = await window.storage.get([
                        'localImageSource',
                        'backgroundSchedule'
                    ]);

                    const imageSource = result.localImageSource || 'single';
                    const scheduleOption = result.backgroundSchedule || 'manual';

                    console.log(`Loading fresh local background with source: ${imageSource}, schedule: ${scheduleOption}`);

                    // If using gallery and every-session schedule, bypass the applyLocalBackground 
                    // function to ensure we get a truly random image
                    if (imageSource === 'gallery' && scheduleOption === 'every-session') {
                        console.log('Gallery with every-session: Directly selecting a random image');

                        // Get random image with timestamp to ensure randomness
                        if (typeof window.getRandomGalleryImage === 'function') {
                            try {
                                const image = await window.getRandomGalleryImage(Date.now());

                                if (image) {
                                    console.log('Successfully selected a random gallery image');

                                    // Create a blob URL for the image
                                    let imageUrl;
                                    if (image.imageBlob) {
                                        imageUrl = URL.createObjectURL(image.imageBlob);
                                    } else {
                                        imageUrl = image.imageData || image.url;
                                    }

                                    // Create and display the image
                                    const imgElement = document.createElement('img');
                                    imgElement.className = 'background-image';
                                    imgElement.src = imageUrl;

                                    // Set onload handler
                                    imgElement.onload = async () => {
                                        // Make sure the background container still has the loading class
                                        if (!bgContainer.classList.contains('gallery-loading')) {
                                            bgContainer.classList.add('gallery-loading');
                                        }

                                        // Update location info
                                        const location = image.location || 'Gallery image';
                                        if (window.createOrUpdateLocationInfo) {
                                            window.createOrUpdateLocationInfo(location);
                                        }

                                        // Save for "Save Image" feature
                                        window.currentLocalImageLocation = location;

                                        await handleImageLoad(imgElement, { location }, imageUrl);

                                        // Delay before showing the image to ensure complete load
                                        setTimeout(() => {
                                            // Remove the loading class and add the fade-in class
                                            bgContainer.classList.remove('gallery-loading');
                                            bgContainer.classList.add('gallery-fade-in');

                                            // Remove the fade-in class after animation completes
                                            setTimeout(() => {
                                                bgContainer.classList.remove('gallery-fade-in');
                                            }, 500);
                                        }, 50);
                                    };

                                    // Handle load error
                                    imgElement.onerror = () => {
                                        console.error('Error loading gallery image');
                                        loader.innerHTML = 'Error loading gallery image. Reload to try again.';
                                        this.updateBackgroundInProgress = false;
                                    };

                                    return; // Exit early - we're handling the completion in onload
                                } else {
                                    console.warn('No images found in gallery');
                                    loader.innerHTML = 'No images found in gallery. Please add some images first.';
                                }
                            } catch (error) {
                                console.error('Error getting random gallery image:', error);
                                loader.innerHTML = 'Error accessing gallery. Please try again.';
                            }
                        } else {
                            console.warn('getRandomGalleryImage function not available');
                            loader.innerHTML = 'Gallery function not available. Falling back to regular method.';
                        }
                    }

                    // Fall back to normal local image handling for all other cases
                    if (window.applyLocalBackground) {
                        window.applyLocalBackground();

                        // Wait for local background to apply, then cache it
                        setTimeout(async () => {
                            const bgImage = bgContainer.querySelector('img');

                            if (bgImage) {
                                // Apply display mode
                                await this.applyDisplayModeToImage(bgImage);

                                // Cache the local image
                                const location = window.currentLocalImageLocation || 'Local Image';
                                await window.backgroundCache.cacheBackground(
                                    source,
                                    { location },
                                    bgImage.src
                                );
                            }

                            this.updateBackgroundInProgress = false;
                        }, 500);
                    } else {
                        // Handle case where applyLocalBackground is not available
                        if (!window.localImagesLoaded) {
                            console.warn('Local background functionality not available, attempting to load it');
                            await this.loadLocalImagesScript();

                            if (window.applyLocalBackground) {
                                window.applyLocalBackground();
                                this.updateBackgroundInProgress = false;
                            } else {
                                console.error('Local background functionality still not available after loading script');
                                loader.innerHTML = 'Error: Could not load local background functionality';
                                this.updateBackgroundInProgress = false;
                            }
                        } else {
                            console.error('Local background functionality not available despite script being loaded');
                            loader.innerHTML = 'Error: Local background functionality not available';
                            this.updateBackgroundInProgress = false;
                        }
                    }
                } catch (error) {
                    console.error('Error handling local background:', error);
                    loader.innerHTML = 'Error loading local background';
                    this.updateBackgroundInProgress = false;
                }
            } else {
                this.updateBackgroundInProgress = false;
            }
        },

        /**
         * Applies the display mode (cover/contain) to the image element.
         * @param {HTMLImageElement} imgElement The image element.
         */
        applyDisplayModeToImage: async function (imgElement) {
            if (!imgElement) return;

            try {
                const result = await window.storage.get('backgroundImageDisplayMode');
                const mode = result.backgroundImageDisplayMode || 'cover';

                if (mode === 'contain') {
                    imgElement.classList.add('contain-mode');
                    imgElement.classList.remove('cover-mode');
                    imgElement.style.objectFit = 'contain';

                    // Add background color to container if needed
                    const bgContainer = document.getElementById('background-container');
                    if (bgContainer) {
                        bgContainer.style.backgroundColor = '#000';
                    }
                } else {
                    imgElement.classList.remove('contain-mode');
                    imgElement.classList.add('cover-mode');
                    imgElement.style.objectFit = 'cover';

                    const bgContainer = document.getElementById('background-container');
                    if (bgContainer) {
                        bgContainer.style.backgroundColor = '';
                    }
                }
                imgElement.dataset.modeApplied = 'true';
            } catch (err) {
                console.error("Error applying display mode:", err);
            }
        },

        /**
         * Applies the display mode to the image within the container.
         * @param {HTMLElement} container The background container.
         */
        applyDisplayModeToContainer: function (container) {
            const img = container.querySelector('img');
            if (img) {
                this.applyDisplayModeToImage(img);
            }
        },

        updateBackgroundOpacity: function (opacity) {
            const bgContainer = document.getElementById('background-container');
            if (bgContainer) {
                bgContainer.style.opacity = opacity;
            }
        },

        updateBackgroundImageMode: function (mode) {
            const backgroundContainer = document.getElementById('background-container');
            if (!backgroundContainer) {
                console.warn("Background container not found in updateBackgroundImageMode.");
                return;
            }
            const currentImage = backgroundContainer.querySelector('img');
            if (!currentImage) {
                return;
            }
            if (mode === 'contain') {
                currentImage.classList.add('contain-mode');
                currentImage.classList.remove('cover-mode');
                currentImage.style.objectFit = 'contain';
                backgroundContainer.style.backgroundColor = '#000';
            } else {
                currentImage.classList.remove('contain-mode');
                currentImage.classList.add('cover-mode');
                currentImage.style.objectFit = 'cover';
                backgroundContainer.style.backgroundColor = '';
            }
            currentImage.dataset.modeApplied = 'true';
        },

        clearBackgroundCache: function () {
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
        },

        loadLocalImagesScript: async function () {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = '/js/localImages.js';
                script.onload = () => {
                    console.log('Successfully loaded localImages.js');
                    window.localImagesLoaded = true;
                    setTimeout(resolve, 200);
                };
                script.onerror = () => {
                    console.error('Failed to load localImages.js');
                    reject(new Error('Failed to load localImages.js'));
                };
                document.head.appendChild(script);
            });
        }
    };

    // Expose functions globally for compatibility
    window.updateBackground = window.backgroundManager.updateBackground.bind(window.backgroundManager);
    window.updateBackgroundOpacity = window.backgroundManager.updateBackgroundOpacity.bind(window.backgroundManager);
    window.updateBackgroundImageMode = window.backgroundManager.updateBackgroundImageMode.bind(window.backgroundManager);
    window.clearBackgroundCache = window.backgroundManager.clearBackgroundCache.bind(window.backgroundManager);

})();
