const GALLERY_STORAGE_KEY = 'savedImages';

class EarthViewFetcher {
    constructor() {
        // Using the same arrays from the original code
        this.h = { "photoIds":["1003","1004","1006","1007","1008","1010","1012","1014","1017","1018","1019","1021","1022","1023","1024","1026","1027","1032","1033","1034","1035","1036","1037","1038","1039","1040","1041","1046","1047","1048","1049","1050","1052","1053","1054","1055","1056","1057","1063","1064","1065","1066","1067","1068","1069","1070","1071","1074","1075","1077","1078","1080","1081","1082","1084","1085","1086","1087","1089","1091","1092","1093","1094","1095","1096","1097","1098","1099","1101"] };
        this.g = { "photoIds":["11935","11932","13942","13735","13730","13419","12078","14752","14737","14727","14719","14718","14669","14661","14647","14642","14632","14623","14613","14612","14603","14602","14599","14569","14560","14549","14542","14517","14508","14498","14489","14484","14478","14456","14434","14313","14312","14246","14111","14108","14097","14086","14068","14066","14059","14048","14046","14004","13986","13980","13925","13868","13763","13758","13678","13645","13581","13222","13208","13201","12986","12878","12861","12801","12686","12657","12623","14197","14196"] };
        this.allPhotoIds = [...this.h.photoIds, ...this.g.photoIds];
    }

    async getRandomEarthView() {
        try {
            // Get random photo ID
            const randomId = this.allPhotoIds[Math.floor(Math.random() * this.allPhotoIds.length)];
            
            // Fetch image data
            const response = await fetch(`https://www.gstatic.com/prettyearth/assets/data/v3/${randomId}.json`);
            const data = await response.json();

            // Generate Earth link
            const zoom = data.zoom + 1 || 11;
            const latRad = data.lat * (Math.PI / 180);
            const elevation = Math.round(data.elevation || 0);
            const range = Math.round(Math.abs(Math.cos(latRad)) / Math.pow(2, zoom) * 255125480);

            // Make sure the base64 data is properly formatted
            const imageUrl = data.dataUri.startsWith('data:image/')
                ? data.dataUri
                : `data:image/jpeg;base64,${data.dataUri}`;

            const location = {
                region: data.region || data.geocode?.locality || '',
                country: data.country || data.geocode?.country || ''
            };

            // Store the location globally for the gallery
            window.currentEarthViewLocation = location.region && location.country 
                ? `${location.region}, ${location.country}` 
                : (location.region || location.country || 'Unknown Location');

            return {
                imageUrl: imageUrl,
                earthLink: `https://earth.google.com/web/@${data.lat},${data.lng},${elevation}a,${range}d,30y,270h,30t,0r/data=KAI?utm_source=referral&utm_campaign=earthview&utm_term=extension`,
                location: location
            };
        } catch (error) {
            console.error('Failed to fetch Earth View:', error);
            window.currentEarthViewLocation = 'Unknown Location';
            return null;
        }
    }
}

// Create a singleton instance of the Earth View fetcher
const earthViewFetcher = new EarthViewFetcher();

/**
 * Load and display a background image from Earth View
 * @param {boolean} forceUpdate - Force update regardless of cache
 * @returns {Promise<boolean>} - True if successful
 */
async function loadEarthViewBackground(forceUpdate = false) {
    console.log(`Loading Earth View background (force: ${forceUpdate})`);
    const bgContainer = document.getElementById('background-container');
    
    if (!bgContainer) {
        console.error("Background container not found");
        return false;
    }
    
    try {
        // Check cache first unless forced update
        if (!forceUpdate && window.backgroundCache) {
            try {
                const isExpired = await window.backgroundCache.isExpired('earth', 3600000); // 1 hour cache
                if (!isExpired) {
                    console.log('Using cached Earth View background');
                    const success = await window.backgroundCache.applyBackground('earth', bgContainer);
                    if (success) {
                        return true;
                    }
                    // Fall through to fetch new image if cache apply fails
                }
            } catch (error) {
                console.warn('Error checking cache for Earth View:', error);
                // Continue to fetch new image
            }
        }
        
        // Fetch new random Earth View
        const earthViewData = await earthViewFetcher.getRandomEarthView();
        if (!earthViewData) {
            throw new Error('Failed to get Earth View data');
        }
        
        // Create and load the image
        return new Promise((resolve) => {
            const img = document.createElement('img');
            img.className = 'background-image';
            
            img.onload = async () => {
                // Clear container and add the image
                bgContainer.innerHTML = '';
                bgContainer.appendChild(img);
                
                // Update location info if the function is available
                if (typeof window.createOrUpdateLocationInfo === 'function') {
                    const locationStr = earthViewData.location.region && earthViewData.location.country 
                        ? `${earthViewData.location.region}, ${earthViewData.location.country}` 
                        : (earthViewData.location.region || earthViewData.location.country || 'Unknown Location');
                    
                    window.createOrUpdateLocationInfo(
                        locationStr,
                        earthViewData.earthLink,
                        'View in Google Earth'
                    );
                }
                
                // Cache the image if caching is available
                if (window.backgroundCache) {
                    try {
                        await window.backgroundCache.cacheBackground('earth', 
                            {
                                location: earthViewData.location,
                                earthLink: earthViewData.earthLink
                            }, 
                            earthViewData.imageUrl
                        );
                    } catch (cacheError) {
                        console.warn('Error caching Earth View background:', cacheError);
                        // Continue as this is non-critical
                    }
                }
                
                resolve(true);
            };
            
            img.onerror = () => {
                console.error('Failed to load Earth View image');
                bgContainer.innerHTML = '<div class="background-loader">Error loading Earth View. Try again.</div>';
                resolve(false);
            };
            
            // Set the image source to start loading
            img.src = earthViewData.imageUrl;
        });
        
    } catch (error) {
        console.error('Error loading Earth View background:', error);
        bgContainer.innerHTML = `<div class="background-loader">Error: ${error.message}</div>`;
        return false;
    }
}

// Make loadEarthViewBackground globally available
window.loadEarthViewBackground = loadEarthViewBackground;