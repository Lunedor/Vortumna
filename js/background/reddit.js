// List of subreddits for wallpapers/backgrounds
const SUBREDDIT_LIST = [
    'Cinemagraphs', 'EarthPorn', 'SpacePorn', 'ArtPorn', 'SkyPorn', 'AerialPorn', 'NatureIsFuckingLit',
    'WeatherPorn', 'WaterPorn', 'WinterPorn', 'AutumnPorn', 'SpringPorn', 'BeachPorn',
    'VillagePorn', 'AgriculturePorn', 'CityPorn', 'DesignPorn', 'ExposurePorn',
    'lightpainting', 'Wallpaper', 'WidescreenWallpaper', 'WQHD_Wallpaper',
    'ultrawidewallpapers', 'NaturePhotography', 'NaturePics', 'Sexy4KWallpaper', 'NSFW_Wallpapers',
	'blacked', 'TurkishCeleb', 'TurkishCelebrityReal', 'TiktokBabesTurkish'
];

// Function to fetch and display an image from a subreddit RSS feed
function fetchAndDisplayImage(onImageLoad = null) {
    return new Promise((resolve, reject) => {
        // Get the selected subreddit from storage or use default (EarthPorn)
        storage.get('selectedSubreddit').then(result => {
            const selectedSubreddit = result && result.selectedSubreddit ? result.selectedSubreddit : 'EarthPorn';
            const httpRequest = new XMLHttpRequest();
            const url = `https://www.reddit.com/r/${selectedSubreddit}.rss?limit=100`;

            httpRequest.onreadystatechange = function () {
                if (this.readyState === 4) {
                    if (this.status === 200) {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(this.responseText, "text/xml");
                        const entries = xmlDoc.getElementsByTagName('entry');
                        let imageUrls = [];
                        let titles = {};

                        for (let entry of entries) {
                            const content = entry.getElementsByTagName('content')[0].textContent;
                            const title = entry.getElementsByTagName('title')[0].textContent;
                            const imgRegex = /href="https:\/\/i\.redd\.it\/([^"]+\.(jpg|jpeg|png|gif))"/i;
                            const match = imgRegex.exec(content);

                            if (match && match[1]) {
                                const imageUrl = `https://i.redd.it/${match[1]}`;
                                imageUrls.push(imageUrl);
                                titles[imageUrl] = title;
                            }
                        }

                        if (imageUrls.length > 0) {
                            const randomIndex = Math.floor(Math.random() * imageUrls.length);
                            const selectedImageUrl = imageUrls[randomIndex];
                            let selectedTitle = titles[selectedImageUrl];

                            // Clean up the title by removing square brackets and their contents
                            selectedTitle = selectedTitle.replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim();

                            // Store the clean title and subreddit globally for the gallery
                            window.currentRedditTitle = selectedTitle;
                            window.currentRedditSubreddit = selectedSubreddit;

                            // Create image element
                            const imgElement = document.createElement('img');
                            imgElement.className = 'background-image';

                            // Set up onload event to handle the loading indicator
                            imgElement.onload = () => {
                                if (onImageLoad) {
                                    // Use callback to handle the image loading
                                    onImageLoad(imgElement);
                                } else {
                                    // Fallback to original behavior if no callback provided
                                    const bgContainer = document.getElementById('background-container');
                                    bgContainer.innerHTML = '';

                                    // Apply display mode if manager is available
                                    if (window.backgroundManager && typeof window.backgroundManager.applyDisplayModeToImage === 'function') {
                                        window.backgroundManager.applyDisplayModeToImage(imgElement).then(() => {
                                            bgContainer.appendChild(imgElement);
                                        });
                                    } else {
                                        bgContainer.appendChild(imgElement);
                                    }
                                }

                                // Create or update location info with subreddit info using the utility function
                                window.createOrUpdateLocationInfo(
                                    selectedTitle || 'Reddit Image',
                                    `https://www.reddit.com/r/${selectedSubreddit}`,
                                    `r/${selectedSubreddit}`
                                );

                                resolve();
                            };

                            // Set image source to trigger the load
                            imgElement.src = selectedImageUrl;

                        } else {
                            reject(new Error('No valid images found in the feed'));
                        }
                    } else {
                        console.error('Failed to fetch RSS feed:', this.status);
                        reject(new Error(`Failed to fetch RSS feed: ${this.status}`));
                    }
                }
            };

            httpRequest.open("GET", url, true);
            httpRequest.send();
        });
    });
}

// Helper function to populate subreddit dropdown
function populateSubredditDropdown(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    // Create select element
    const select = document.createElement('select');
    select.id = 'subreddit-select';
    select.className = 'settings-dropdown';

    // Add options for each subreddit
    SUBREDDIT_LIST.forEach(subreddit => {
        const option = document.createElement('option');
        option.value = subreddit;
        option.textContent = `r/${subreddit}`;
        select.appendChild(option);
    });

    // Set selected value based on storage
    storage.get('selectedSubreddit').then(result => {
        const selectedSubreddit = result && result.selectedSubreddit ? result.selectedSubreddit : 'EarthPorn';
        select.value = selectedSubreddit;
    });

    // Add change event listener
    select.addEventListener('change', function () {
        storage.set({ selectedSubreddit: this.value }).then(() => {
            storage.get('backgroundSource').then(result => {
                const backgroundSource = result && result.backgroundSource;
                if (backgroundSource === 'reddit') {
                    // Call fetchAndDisplayImage with proper callback to handle loading indicator
                    fetchAndDisplayImage().catch(error => {
                        console.error('Error loading Reddit image:', error);
                        const loader = document.querySelector('.background-loader');
                        if (loader) {
                            loader.innerHTML = 'Error loading background. Reload to try again.';
                        }
                    });
                }
            });
        });
    });

    // Append to container
    container.appendChild(select);
}

/**
 * Load a background image from Reddit
 * @param {boolean} forceUpdate - Whether to force a new image regardless of cache
 * @returns {Promise<boolean>} True if successful
 */
function loadRedditBackground(forceUpdate = false) {
    console.log(`Loading Reddit background (force: ${forceUpdate})`);
    const bgContainer = document.getElementById('background-container');

    return new Promise((resolve) => {
        // Check cache first unless forced to update
        if (!forceUpdate && window.backgroundCache) {
            window.backgroundCache.isExpired('reddit', 3600000) // 1 hour cache
                .then(isExpired => {
                    if (!isExpired) {
                        console.log('Using cached Reddit background');
                        window.backgroundCache.applyBackground('reddit', bgContainer)
                            .then(success => {
                                if (success) {
                                    resolve(true);
                                    return;
                                }
                                // Fall through to fetch if cache apply fails
                                fetchAndDisplayImage()
                                    .then(() => resolve(true))
                                    .catch(() => resolve(false));
                            })
                            .catch(() => {
                                // Cache error - fetch new image
                                fetchAndDisplayImage()
                                    .then(() => resolve(true))
                                    .catch(() => resolve(false));
                            });
                    } else {
                        // Cache expired - fetch new image
                        fetchAndDisplayImage()
                            .then(() => resolve(true))
                            .catch(() => resolve(false));
                    }
                })
                .catch(() => {
                    // Cache check failed - fetch new image
                    fetchAndDisplayImage()
                        .then(() => resolve(true))
                        .catch(() => resolve(false));
                });
        } else {
            // No cache or forced update - fetch new image
            fetchAndDisplayImage()
                .then(() => resolve(true))
                .catch(() => resolve(false));
        }
    });
}

// Make loadRedditBackground globally available
window.loadRedditBackground = loadRedditBackground;