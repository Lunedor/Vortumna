// Initialize gallery functionality
document.addEventListener('DOMContentLoaded', () => {
    const GALLERY_DB_NAME = 'galleryDB';
    const GALLERY_STORE_NAME = 'images';
    const DB_VERSION = 3; // Increased version to handle schema change to Blob storage
    let db;

    // URL cache for Blob URLs
    const urlCache = new Map();

    const galleryToggleBtn = document.getElementById('galleryToggleBtn');
    const imageGalleryPanel = document.getElementById('imageGalleryPanel');
    const saveImageBtn = document.querySelector('.save-image-btn');
    const galleryContent = document.querySelector('.gallery-content');
    const previewModal = document.getElementById('imagePreviewModal');
    const previewImage = previewModal.querySelector('img');
    const closePreviewBtn = previewModal.querySelector('.close-preview');

    // Create feedback element
    const saveFeedback = document.createElement('div');
    saveFeedback.className = 'save-feedback';
    document.body.appendChild(saveFeedback);

    // Initialize IndexedDB
    const request = indexedDB.open(GALLERY_DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error("Database error:", event.target.error);
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        const oldVersion = event.oldVersion;
        
        if (oldVersion < 1) {
            // Create the store for first-time users
            const store = db.createObjectStore(GALLERY_STORE_NAME, { keyPath: 'url' });
            store.createIndex('date', 'date', { unique: false });
        }
        
        if (oldVersion < 2) {
            // For users upgrading from version 1 to 2, add the imageData field
            const transaction = event.target.transaction;
            const store = transaction.objectStore(GALLERY_STORE_NAME);
            
            if (!store.indexNames.contains('imageData')) {
                store.createIndex('imageData', 'imageData', { unique: false });
            }
        }
        
        if (oldVersion < 3) {
            // For users upgrading from version 2 to 3, add the imageBlob field
            const transaction = event.target.transaction;
            const store = transaction.objectStore(GALLERY_STORE_NAME);
            
            if (!store.indexNames.contains('imageBlob')) {
                store.createIndex('imageBlob', 'imageBlob', { unique: false });
            }
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        
        // Check if we need to migrate data
        if (event.oldVersion < 3 && event.newVersion >= 3) {
            migrateToBlobs();
        }
        
        // Load gallery
        loadGallery();
    };

    // Function to migrate old images to include Blob data
    async function migrateToBlobs() {
        const transaction = db.transaction([GALLERY_STORE_NAME], 'readonly');
        const store = transaction.objectStore(GALLERY_STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = async () => {
            const images = request.result;
            let migratedCount = 0;
            
            for (const image of images) {
                // Skip images that already have Blob data
                if (image.imageBlob) continue;
                
                try {
                    // Fetch image and convert to Blob
                    const response = await fetch(image.url);
                    if (!response.ok) continue; // Skip if image can't be fetched
                    
                    const blob = await response.blob();
                    
                    // Save the updated image data
                    const updateTransaction = db.transaction([GALLERY_STORE_NAME], 'readwrite');
                    const updateStore = updateTransaction.objectStore(GALLERY_STORE_NAME);
                    
                    image.imageBlob = blob;
                    await updateStore.put(image);
                    migratedCount++;
                } catch (error) {
                    console.error(`Error migrating image ${image.url}:`, error);
                }
            }
            
            if (migratedCount > 0) {
                console.log(`Successfully migrated ${migratedCount} images to include Blob data`);
            }
        };
    }    // Toggle gallery visibility
    galleryToggleBtn.addEventListener('click', () => {
        // Show gallery immediately with loading indicator
        imageGalleryPanel.classList.toggle('visible');
        
        // If gallery is becoming visible and we don't already have a loading indicator
        if (imageGalleryPanel.classList.contains('visible') && !document.querySelector('.gallery-loading')) {
            // Add loading indicator before loading images
            const galleryLoading = document.createElement('div');
            galleryLoading.className = 'gallery-loading';
            galleryLoading.innerHTML = `
                <div class="gallery-spinner"></div>
                <p>Loading your images...</p>
            `;
            galleryContent.innerHTML = '';
            galleryContent.appendChild(galleryLoading);
            
            // Load gallery with a small delay to ensure UI renders first
            setTimeout(() => {
                loadGallery();
            }, 50);
        }
    });

    // Gallery close button
    const closeGalleryBtn = document.querySelector('.close-gallery');
    if (closeGalleryBtn) {
        closeGalleryBtn.addEventListener('click', () => {
            imageGalleryPanel.classList.remove('visible');
        });
    }

    // Add click outside handler
    document.addEventListener('click', (e) => {
        if (imageGalleryPanel.classList.contains('visible')) {
            // Check if the click is outside both the panel and the toggle button
            if (!imageGalleryPanel.contains(e.target) && !galleryToggleBtn.contains(e.target)) {
                imageGalleryPanel.classList.remove('visible');
            }
        }
    });

    // Stop click propagation on panel to prevent closing when clicking inside
    imageGalleryPanel.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Save current background image
    saveImageBtn.addEventListener('click', () => {
        const currentBg = document.querySelector('#background-container img');
        if (currentBg) {
            let locationName = 'Unknown Location';
            
            if (document.getElementById('earth-background')?.checked) {
                locationName = window.currentEarthViewLocation || 'Unknown Location';
            } else if (document.getElementById('reddit-background')?.checked) {
                locationName = window.currentRedditTitle || 'Unknown Location';
            } else if (document.getElementById('unsplash-background')?.checked) {
                // For Unsplash images, use both location and photographer name
                const location = window.currentUnsplashLocation || 'Unknown Location';
                const photographer = window.currentUnsplashPhotographer || 'Unknown Photographer';
                locationName = `${location} - Photo by ${photographer}`;
            } else if (document.getElementById('local-background')?.checked) {
                // For local images, use the stored location name
                locationName = window.currentLocalImageLocation || 'Local Image';
            }
            
            saveImage(currentBg.src, locationName);
        }
    });

    // Close preview modal
    closePreviewBtn.addEventListener('click', () => {
        previewModal.classList.remove('visible');
    });

    // Close preview modal when clicking outside
    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            previewModal.classList.remove('visible');
        }
    });    async function saveImage(imageUrl, location) {
        try {
            showSaveFeedback('Saving image...', true, true);
            
            // Check if we've reached the maximum number of saved images (20)
            const MAX_GALLERY_IMAGES = 50;
            const countTransaction = db.transaction([GALLERY_STORE_NAME], 'readonly');
            const countStore = countTransaction.objectStore(GALLERY_STORE_NAME);
            const countRequest = countStore.count();
            
            const imageCount = await new Promise((resolve, reject) => {
                countRequest.onsuccess = () => resolve(countRequest.result);
                countRequest.onerror = () => reject(new Error('Failed to count images'));
            });
            
            // If we already have the maximum number of images, show an error and exit
            if (imageCount >= MAX_GALLERY_IMAGES) {
                showSaveFeedback(`Gallery limit reached (${MAX_GALLERY_IMAGES} images)`, false);
                return;
            }
            
            // Try to get the blob without fetching again
            let blob;
            
            // First check if we already have this image in our urlCache
            if (urlCache.has(imageUrl)) {
                try {
                    // Convert cached blob URL back to a blob
                    const cachedBlobUrl = urlCache.get(imageUrl);
                    const response = await fetch(cachedBlobUrl);
                    blob = await response.blob();
                } catch (error) {
                    console.log('Could not convert cached URL to blob:', error);
                }
            }
            
            // If no cached blob, try to get the image from the current DOM
            if (!blob) {
                const currentBg = document.querySelector(`#background-container img[src="${imageUrl}"]`);
                if (currentBg) {
                    try {
                        // Create a canvas to convert the image to a blob
                        const canvas = document.createElement('canvas');
                        canvas.width = currentBg.naturalWidth;
                        canvas.height = currentBg.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(currentBg, 0, 0);
                        blob = await new Promise(resolve => canvas.toBlob(resolve));
                    } catch (error) {
                        console.log('Could not convert DOM image to blob:', error);
                    }
                }
            }
            
            // If we still don't have a blob, check if localImages module has this image
            if (!blob && window.localImagesCache && window.localImagesCache.has(imageUrl)) {
                blob = window.localImagesCache.get(imageUrl);
            }
            
            // As a last resort, fetch the image
            if (!blob) {
                const response = await fetch(imageUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
                }
                blob = await response.blob();
            }
            
            // Store the image with Blob and no base64
            const image = {
                url: imageUrl,
                imageBlob: blob,
                location: location,
                date: new Date().toLocaleDateString()
            };

            const transaction = db.transaction([GALLERY_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(GALLERY_STORE_NAME);

            try {
                await store.put(image);
                showSaveFeedback('Image saved');
                loadGallery();
            } catch (error) {
                console.error('Error saving image:', error);
                showSaveFeedback('Failed to save image', false);
            }
        } catch (error) {
            console.error('Error fetching image:', error);
            showSaveFeedback('Failed to fetch image', false);
        }
    }    async function loadGallery() {
        const transaction = db.transaction([GALLERY_STORE_NAME], 'readonly');
        const store = transaction.objectStore(GALLERY_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const images = request.result;
            
            // Sort images by date from newest to oldest
            images.sort((a, b) => {
                // Parse European date format DD.MM.YYYY
                const parseDate = (dateStr) => {
                    const [day, month, year] = dateStr.split('.');
                    return new Date(year, month - 1, day); // month is 0-indexed in JS Date
                };
                
                const dateA = parseDate(a.date);
                const dateB = parseDate(b.date);
                return dateB - dateA; // Descending order (newest first)
            });
            
            // Clear gallery content (removing loading indicator if present)
            galleryContent.innerHTML = '';

            // Show empty state message if no images
            if (images.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-gallery';
                emptyState.innerHTML = `
                    <div class="empty-gallery-icon">🖼️</div>
                    <p>Your gallery is empty</p>
                    <p class="empty-gallery-hint">Click the save button to add the current background image</p>
                `;
                galleryContent.appendChild(emptyState);
                return;
            }

            images.forEach((image) => {
                const galleryItem = document.createElement('div');
                galleryItem.className = 'gallery-item';
                
                const img = document.createElement('img');
                // Use Blob URL if available, fallback to base64 or URL if not
                if (image.imageBlob) {
                    const blobUrl = urlCache.get(image.url) || URL.createObjectURL(image.imageBlob);
                    urlCache.set(image.url, blobUrl);
                    img.src = blobUrl;
                } else {
                    img.src = image.imageData || image.url;
                }
                img.title = "Ctrl+Click to set as background";
                img.alt = 'Saved background';
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-image';
                deleteBtn.innerHTML = '×';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteImage(image.url, galleryItem);
                });

                const imageInfo = document.createElement('div');
                imageInfo.className = 'image-info';
                
                const locationSpan = document.createElement('span');
                locationSpan.className = 'location-name';
                locationSpan.textContent = image.location;
                
                const dateSpan = document.createElement('span');
                dateSpan.className = 'save-date';
                dateSpan.textContent = image.date;
                
                imageInfo.appendChild(locationSpan);
                imageInfo.appendChild(dateSpan);
                
                galleryItem.appendChild(img);
                galleryItem.appendChild(deleteBtn);
                galleryItem.appendChild(imageInfo);

                galleryItem.addEventListener('click', (event) => {
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        setAsBackground(image.url, image.imageBlob || image.imageData);
                    } else {
                        // Only show preview if not Ctrl/Cmd clicking
                        if (image.imageBlob) {
                            const blobUrl = urlCache.get(image.url) || URL.createObjectURL(image.imageBlob);
                            urlCache.set(image.url, blobUrl);
                            previewImage.src = blobUrl;
                        } else {
                            previewImage.src = image.imageData || image.url;
                        }
                        let previewInfo = previewModal.querySelector('.preview-info');
                        if (!previewInfo) {
                            previewInfo = document.createElement('div');
                            previewInfo.className = 'preview-info';
                            previewModal.querySelector('.preview-content').appendChild(previewInfo);
                        }
                        previewInfo.innerHTML = `
                            <span class="location-name">${image.location}</span>
                            <span class="save-date">${image.date}</span>
                        `;
                        previewModal.classList.add('visible');
                    }
                });

                galleryContent.appendChild(galleryItem);
            });
        };
    }

    async function deleteImage(imageUrl, galleryItem) {
        galleryItem.classList.add('deleting');
        const transaction = db.transaction([GALLERY_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(GALLERY_STORE_NAME);
        
        try {
            await store.delete(imageUrl);
            galleryItem.remove();
            if (urlCache.has(imageUrl)) {
                URL.revokeObjectURL(urlCache.get(imageUrl));
                urlCache.delete(imageUrl);
            }
            
            // Check if that was the last image
            const countTransaction = db.transaction([GALLERY_STORE_NAME], 'readonly');
            const countStore = countTransaction.objectStore(GALLERY_STORE_NAME);
            const countRequest = countStore.count();
            
            countRequest.onsuccess = () => {
                if (countRequest.result === 0) {
                    // This was the last image, show empty state
                    galleryContent.innerHTML = '';
                    const emptyState = document.createElement('div');
                    emptyState.className = 'empty-gallery';
                    emptyState.innerHTML = `
                        <div class="empty-gallery-icon">🖼️</div>
                        <p>Your gallery is empty</p>
                        <p class="empty-gallery-hint">Click the save button to add the current background image</p>
                    `;
                    galleryContent.appendChild(emptyState);
                }
            };
        } catch (error) {
            console.error('Error deleting image:', error);
            galleryItem.classList.remove('deleting');
            showSaveFeedback('Failed to delete image', false);
        }
    }

    function setAsBackground(imageUrl, imageDataOrBlob) {
        const bgContainer = document.getElementById('background-container');
        const bgImage = bgContainer.querySelector('img') || document.createElement('img');
        if (imageDataOrBlob instanceof Blob) {
            const blobUrl = urlCache.get(imageUrl) || URL.createObjectURL(imageDataOrBlob);
            urlCache.set(imageUrl, blobUrl);
            bgImage.src = blobUrl;
        } else {
            bgImage.src = imageDataOrBlob || imageUrl;
        }
        bgImage.className = 'background-image';
        
        // Get the saved display mode from storage
        if (window.storage) {
            window.storage.get('backgroundImageDisplayMode').then(result => {
                const savedDisplayMode = result.backgroundImageDisplayMode || 'cover';
                displayMode = savedDisplayMode;
                
                // Update radio button selection
                const radioOption = document.getElementById(`display-${savedDisplayMode}`);
                if (radioOption) {
                    radioOption.checked = true;
                }
            });
            
            // Update background source to 'local' and set to use gallery images
            window.storage.set({
                'backgroundSource': 'local',
                'localImageSource': 'gallery'
            }).then(() => {
                // Update radio button selection
                const localBackgroundRadio = document.getElementById('local-background');
                if (localBackgroundRadio) {
                    localBackgroundRadio.checked = true;
                }
                
                // Update local image source dropdown
                const localImageSourceSelect = document.getElementById('local-image-source');
                if (localImageSourceSelect) {
                    localImageSourceSelect.value = 'gallery';
                }
                
                // Update UI to show local settings
                if (typeof updateBackgroundSourceSettings === 'function') {
                    updateBackgroundSourceSettings('local');
                }
            });
        } else {
            // Fallback to localStorage if storage.js not available
            const savedDisplayMode = localStorage.getItem('backgroundImageDisplayMode') || 'cover';
            displayMode = savedDisplayMode;
            
            // Update radio button selection
            const radioOption = document.getElementById(`display-${savedDisplayMode}`);
            if (radioOption) {
                radioOption.checked = true;
            }
        }
          // Apply the display mode properly and ensure the toggle button is updated
        if (typeof window.updateBackgroundImageMode === 'function') {
            window.updateBackgroundImageMode(displayMode);
        }
        if (typeof window.updateToggleButtonIcon === 'function') {
            window.updateToggleButtonIcon(displayMode);
        }
        
        if (!bgImage.parentElement) {
            bgContainer.appendChild(bgImage);
        }
        
        // Get the image information from the database and update location info
        updateLocationInfoForImage(imageUrl);
        
        // Show feedback that the background has been changed
        if (typeof showFeedback === 'function') {
            showFeedback('Background changed to gallery image', true);
        }
        
        previewModal.classList.remove('visible');
    }
    
    async function updateLocationInfoForImage(imageUrl) {
        try {
            // Get image data from the database
            const transaction = db.transaction([GALLERY_STORE_NAME], 'readonly');
            const store = transaction.objectStore(GALLERY_STORE_NAME);
            const request = store.get(imageUrl);
            
            request.onsuccess = (event) => {
                const imageData = event.target.result;
                if (imageData) {
                    // Use the centralized utility function to create or update location info
                    window.createOrUpdateLocationInfo(imageData.location || 'Unknown Location');
                }
            };
        } catch (error) {
            console.error('Error updating location info:', error);
        }
    }

    function showSaveFeedback(message, success = true, isLoading = false) {
        saveFeedback.textContent = message;
        
        if (isLoading) {
            saveFeedback.style.backgroundColor = 'rgba(70, 130, 180, 0.9)'; // Blue for loading
        } else {
            saveFeedback.style.backgroundColor = success ? 'rgba(29, 185, 84, 0.9)' : 'rgba(231, 76, 60, 0.9)';
        }
        
        saveFeedback.classList.add('visible');
        
        if (!isLoading) {
            setTimeout(() => {
                saveFeedback.classList.remove('visible');
            }, 2000);
        }
    }

});