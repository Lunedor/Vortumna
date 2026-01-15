// bookmarks.js - Manages bookmark functionality

// Functions for managing the bookmark UI
function showAddBookmarkForm() {
    document.getElementById('bookmarkModal').style.display = 'flex';
    document.getElementById('bookmarkUrl').focus();
}

function hideAddBookmarkForm() {
    const modal = document.getElementById('bookmarkModal');
    modal.style.display = 'none';
    document.getElementById('bookmarkForm').reset();
}

function handleBookmarkSubmit(event) {
    event.preventDefault();
    
    const url = document.getElementById('bookmarkUrl').value;
    const title = document.getElementById('bookmarkTitle').value || extractDomainFromUrl(url);
    console.log(url, title);
    // Validate URL (simple validation)
    try {
        new URL(url); // Attempt to construct a URL object
    } catch (e) {
        alert('Please enter a valid URL.');
        return;
    }
    
    addBookmark(url, title);
    hideAddBookmarkForm();
}

// Extract domain name from URL for default title
function extractDomainFromUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch (e) {
        return url;
    }
}

// Generate favicon URL from domain with protocol consistency
function getFaviconUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const domain = parsedUrl.hostname.replace('www.', '');
        
        return [
		
			// Secondary method: Use actual favicon URL from target site
            `${parsedUrl.origin}/favicon.ico`,
			
            // Primary method: Google's S2 service with direct domain
            `https://www.google.com/s2/favicons?domain=${parsedUrl.origin}&sz=64`,
                      
            // Fallback to Clearbit's logo API (no API key needed)
            `https://logo.clearbit.com/${domain}`,
            
            // Legacy Google service with URL encoding
            `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=${encodeURIComponent(url)}&size=64`,
            
            // Additional fallbacks
            `https://icon.horse/icon/${domain}`,
            `https://${domain}/apple-touch-icon.png`,
            'icon.png' // Local fallback
        ].filter((url, index) => {
            if (index === 0) {
            // Check if the primary method returns a placeholder (16x16)
            const img = new Image();
            img.src = url;
            img.onload = function () {
                if (img.width === 16 && img.height === 16) {
                // Placeholder detected, skip this URL
                return false;
                }
            };
            }
            return true;
        });
    } catch (e) {
        return ['/assets/images/icon.png'];
    }
}

// Enhanced function to fetch favicon directly from website HTML if other methods fail
function fetchFaviconFromHTML(url) {
    return new Promise((resolve, reject) => {
        // Create a hidden iframe to load the page
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        // Set a timeout to prevent hanging
        const timeout = setTimeout(() => {
            document.body.removeChild(iframe);
            resolve(null); // Return null if timeout
        }, 3000);
        
        iframe.onload = function() {
            clearTimeout(timeout);
            try {
                const doc = iframe.contentDocument;
                if (!doc) {
                    document.body.removeChild(iframe);
                    resolve(null);
                    return;
                }
                
                // Try to find favicon links in the page
                const links = doc.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]');
                let iconUrl = null;
                
                if (links.length > 0) {
                    // Sort by size preference if sizes are specified
                    const sortedLinks = Array.from(links).sort((a, b) => {
                        const sizeA = a.getAttribute('sizes');
                        const sizeB = b.getAttribute('sizes');
                        if (!sizeA && !sizeB) return 0;
                        if (!sizeA) return 1;
                        if (!sizeB) return -1;
                        
                        // Extract the first number from sizes attribute
                        const getSize = (sizes) => {
                            const match = sizes.match(/(\d+)/);
                            return match ? parseInt(match[1], 10) : 0;
                        };
                        
                        return getSize(sizeB) - getSize(sizeA); // Prefer larger icons
                    });
                    
                    // Use the href from the best link
                    const link = sortedLinks[0];
                    const href = link.getAttribute('href');
                    
                    if (href) {
                        // Convert relative URL to absolute if needed
                        if (href.startsWith('/') || !href.includes('://')) {
                            const base = new URL(url);
                            iconUrl = new URL(href, base.origin).href;
                        } else {
                            iconUrl = href;
                        }
                    }
                }
                
                document.body.removeChild(iframe);
                resolve(iconUrl);
            } catch (e) {
                document.body.removeChild(iframe);
                resolve(null);
            }
        };
        
        iframe.onerror = function() {
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve(null);
        };
        
        // Set iframe source to the URL
        try {
            iframe.src = url;
        } catch (e) {
            document.body.removeChild(iframe);
            resolve(null);
        }
    });
}

// Functions for managing bookmarks data
async function loadBookmarks() {
    try {
        // Use the centralized storage module
        if (window.storage) {
            const data = await window.storage.getLocal('bookmarks');
            handleBookmarksData(data.bookmarks || []);
        } else {
            console.warn('Storage module not available - using fallback');
            // Fallback to direct Chrome storage API
            chrome.storage.local.get('bookmarks', function(data) {
                handleBookmarksData(data.bookmarks || []);
            });
        }
    } catch (e) {
        console.error('Error loading bookmarks:', e);
        // Fallback to an empty array if all else fails
        handleBookmarksData([]);
    }
}

function handleBookmarksData(bookmarks) {
    // If order property doesn't exist on any bookmark, add it
    if (bookmarks.length > 0 && typeof bookmarks[0].order === 'undefined') {
        bookmarks = bookmarks.map((bookmark, index) => ({
            ...bookmark,
            order: index
        }));
        saveBookmarks(bookmarks, false); // Save with updated order, don't re-render
    }
    
    // Sort bookmarks by order
    bookmarks.sort((a, b) => a.order - b.order);
    
    renderBookmarks(bookmarks);
}

async function saveBookmarks(bookmarks, shouldRender = true) {
    try {
        // Use the centralized storage module
        if (window.storage) {
            await window.storage.setLocal({ bookmarks });
            if (shouldRender) {
                renderBookmarks(bookmarks);
            }
        } else {
            console.warn('Storage module not available - using fallback');
            // Fallback to direct Chrome storage API
            chrome.storage.local.set({ 'bookmarks': bookmarks }, function() {
                if (shouldRender) {
                    renderBookmarks(bookmarks);
                }
            });
        }
    } catch (e) {
        console.error('Error saving bookmarks:', e);
    }
}

async function addBookmark(url, title) {
    try {
        // Function to create and add the bookmark
        const createAndAddBookmark = async (bookmarks) => {
            // Check if bookmark already exists
            const exists = bookmarks.some(bookmark => bookmark.url === url);
            if (exists) {
                alert('This bookmark already exists!');
                return;
            }
            
            // Determine the highest order value
            const maxOrder = bookmarks.length > 0 
                ? Math.max(...bookmarks.map(b => b.order)) 
                : -1;
            
            try {
                // Try to fetch favicon from HTML if available
                const htmlFavicon = await fetchFaviconFromHTML(url);
                
                // Add new bookmark with next order value
                const newBookmark = {
                    url: url,
                    title: title,
                    faviconUrls: getFaviconUrl(url),
                    htmlFavicon: htmlFavicon, // Store HTML-extracted favicon if available
                    dateAdded: new Date().toISOString(),
                    order: maxOrder + 1
                };
                
                bookmarks.push(newBookmark);
                await saveBookmarks(bookmarks);
            } catch (e) {
                // If HTML fetch fails, just use the standard favicon URLs
                const newBookmark = {
                    url: url,
                    title: title,
                    faviconUrls: getFaviconUrl(url),
                    dateAdded: new Date().toISOString(),
                    order: maxOrder + 1
                };
                
                bookmarks.push(newBookmark);
                await saveBookmarks(bookmarks);
            }
        };
        
        // Get existing bookmarks
        if (window.storage) {
            const data = await window.storage.getLocal('bookmarks');
            await createAndAddBookmark(data.bookmarks || []);
        } else {
            // Fallback to direct Chrome storage
            chrome.storage.local.get('bookmarks', async function(data) {
                await createAndAddBookmark(data.bookmarks || []);
            });
        }
    } catch (e) {
        console.error('Error adding bookmark:', e);
    }
}

async function removeBookmark(url) {
    if (confirm('Are you sure you want to remove this bookmark?')) {
        try {
            // Function to remove and reorder bookmarks
            const removeAndReorderBookmarks = async (bookmarks) => {
                const updatedBookmarks = bookmarks.filter(bookmark => bookmark.url !== url);
                
                // Re-order bookmarks to ensure no gaps
                updatedBookmarks.forEach((bookmark, index) => {
                    bookmark.order = index;
                });
                
                await saveBookmarks(updatedBookmarks);
            };
            
            // Get existing bookmarks
            if (window.storage) {
                const data = await window.storage.getLocal('bookmarks');
                await removeAndReorderBookmarks(data.bookmarks || []);
            } else {
                // Fallback to direct Chrome storage
                chrome.storage.local.get('bookmarks', async function(data) {
                    await removeAndReorderBookmarks(data.bookmarks || []);
                });
            }
        } catch (e) {
            console.error('Error removing bookmark:', e);
        }
    }
}

// Update the order of bookmarks after drag and drop
async function updateBookmarkOrder(draggedId, targetId) {
    try {
        // Function to update bookmark order
        const updateOrder = async (bookmarks) => {
            // Find the dragged and target bookmarks
            const draggedBookmark = bookmarks.find(b => b.url === draggedId);
            const targetBookmark = bookmarks.find(b => b.url === targetId);
            
            if (!draggedBookmark || !targetBookmark) return;
            
            const oldOrder = draggedBookmark.order;
            const newOrder = targetBookmark.order;
            
            // Update orders
            if (oldOrder < newOrder) {
                // Moving forward: decrease order of items in between
                bookmarks.forEach(bookmark => {
                    if (bookmark.order > oldOrder && bookmark.order <= newOrder) {
                        bookmark.order--;
                    }
                });
            } else if (oldOrder > newOrder) {
                // Moving backward: increase order of items in between
                bookmarks.forEach(bookmark => {
                    if (bookmark.order >= newOrder && bookmark.order < oldOrder) {
                        bookmark.order++;
                    }
                });
            }
            
            // Set dragged item to target position
            draggedBookmark.order = newOrder;
            
            // Sort and save
            bookmarks.sort((a, b) => a.order - b.order);
            await saveBookmarks(bookmarks);
        };
        
        // Get existing bookmarks
        if (window.storage) {
            const data = await window.storage.getLocal('bookmarks');
            await updateOrder(data.bookmarks || []);
        } else {
            // Fallback to direct Chrome storage
            chrome.storage.local.get('bookmarks', async function(data) {
                await updateOrder(data.bookmarks || []);
            });
        }
    } catch (e) {
        console.error('Error updating bookmark order:', e);
    }
}

// Create and render bookmark elements
function renderBookmarks(bookmarks) {
    const container = document.getElementById('bookmarksContainer');
    container.innerHTML = ''; // Clear existing bookmarks
    
    if (bookmarks.length === 0) {
        // Show empty state message
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-bookmarks';
        emptyState.textContent = 'No bookmarks yet. Click "+" to add your favorite sites.';
        container.appendChild(emptyState);
    } else {
        // Create bookmark tiles
        bookmarks.forEach(bookmark => {
            const bookmarkTile = createBookmarkTile(bookmark);
            container.appendChild(bookmarkTile);
        });
    }
    
    // Add the square "+" button at the end of the grid
    const addBtn = document.createElement('button');
    addBtn.id = 'addBookmarkBtn';
    addBtn.title = 'Add bookmark';
    addBtn.addEventListener('click', showAddBookmarkForm);
    
    container.appendChild(addBtn);
}

function createBookmarkTile(bookmark) {
    const tile = document.createElement('div');
    tile.className = 'bookmark-tile';
    tile.setAttribute('data-url', bookmark.url);
    
    // Make draggable
    tile.draggable = true;
    
    // Add drag event listeners
    tile.addEventListener('dragstart', handleDragStart);
    tile.addEventListener('dragover', handleDragOver);
    tile.addEventListener('dragenter', handleDragEnter);
    tile.addEventListener('dragleave', handleDragLeave);
    tile.addEventListener('drop', handleDrop);
    tile.addEventListener('dragend', handleDragEnd);
    
    // Create tile content
    const tileContent = document.createElement('div');
    tileContent.className = 'bookmark-content';
    tileContent.addEventListener('click', function() {
        window.location.href = bookmark.url;
    });
    
    // Create favicon with fallback mechanism
    const favicon = document.createElement('img');
    favicon.className = 'bookmark-favicon';
    favicon.alt = '';
    
    // Try to load favicon using our mechanism
    loadFaviconFromSources(favicon, bookmark);
    
    // Create title
    const title = document.createElement('div');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title;
    
    // Add content to tile
    tileContent.appendChild(favicon);
    tileContent.appendChild(title);
    tile.appendChild(tileContent);
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'bookmark-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = 'Remove bookmark';
    deleteBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        removeBookmark(bookmark.url);
    });
    
    tile.appendChild(deleteBtn);
    
    return tile;
}

async function loadFaviconFromSources(favicon, bookmark) {
    if (window.storage) {
        const storageKey = `favicon_${bookmark.url}`;
        try {
            const cache = await window.storage.getLocal(storageKey);
            if (cache[storageKey]) {
                favicon.src = cache[storageKey];
                favicon.onerror = function() {
                    // If cached favicon fails, try other methods
                    tryFaviconUrls(favicon, bookmark, storageKey);
                };
                return;
            }
        } catch (e) {
            console.error('Error getting cached favicon:', e);
        }
    }
    
    // Try HTML favicon first if available
    if (bookmark.htmlFavicon) {
        favicon.src = bookmark.htmlFavicon;
        favicon.onerror = function() {
            tryFaviconUrls(favicon, bookmark);
        };
    } else {
        tryFaviconUrls(favicon, bookmark);
    }
}

// Try favicon URLs array or fallback to default
function tryFaviconUrls(imgElement, bookmark, storageKey) {
    // Check for legacy favicon
    if (bookmark.favicon) {
        imgElement.src = bookmark.favicon;
        imgElement.onerror = function() {
            imgElement.src = '/assets/images/icon.png'; // Default fallback
        };
        return;
    }
    
    // Use favicon URLs array with fallbacks
    if (bookmark.faviconUrls && bookmark.faviconUrls.length > 0) {
        loadFaviconWithFallbacks(imgElement, bookmark.faviconUrls, 0, bookmark.url);
    } else {
        // Last resort fallback
        imgElement.src = '/assets/images/icon.png';
    }
}

// Helper: fetch favicon as base64 using background.js utility (via extension messaging)
async function fetchAndCacheFaviconBase64(faviconUrl, bookmarkUrl) {
    return new Promise((resolve, reject) => {
        // Use Chrome extension messaging to call background.js
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'fetchImage', imageUrl: faviconUrl }, async (response) => {
                if (response && response.success && response.imageData) {
                    // Cache the base64 data
                    if (window.storage) {
                        const storageKey = `favicon_${bookmarkUrl}`;
                        await window.storage.setLocal({ [storageKey]: response.imageData });
                    } else {
                        // Fallback to chrome.storage
                        const storageKey = `favicon_${bookmarkUrl}`;
                        const obj = {};
                        obj[storageKey] = response.imageData;
                        chrome.storage.local.set(obj);
                    }
                    resolve(response.imageData);
                } else {
                    reject(response && response.error ? response.error : 'Failed to fetch favicon as base64');
                }
            });
        } else {
            reject('chrome.runtime.sendMessage not available');
        }
    });
}

// Improved recursive fallback function
async function loadFaviconWithFallbacks(imgElement, faviconUrls, currentIndex, bookmarkUrl) {
    if (currentIndex >= faviconUrls.length) {
        // If we've tried all URLs, use default icon
        imgElement.src = '/assets/images/icon.png';
        return;
    }

    // Set current favicon URL
    const currentFaviconUrl = faviconUrls[currentIndex];
    imgElement.src = currentFaviconUrl;

    imgElement.onerror = async function() {
        // Try next favicon in sequence
        await loadFaviconWithFallbacks(imgElement, faviconUrls, currentIndex + 1, bookmarkUrl);
    };

    imgElement.onload = async function() {
        // Cache the favicon as base64 on successful load
        try {
            // Only cache if not already cached
            if (window.storage) {
                const storageKey = `favicon_${bookmarkUrl}`;
                const cache = await window.storage.getLocal(storageKey);
                if (!cache[storageKey]) {
                    // Fetch and cache as base64
                    await fetchAndCacheFaviconBase64(currentFaviconUrl, bookmarkUrl);
                }
            }
        } catch (e) {
            console.error('Error caching favicon as base64:', e);
        }
    };
}

// Drag and Drop handlers
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    
    // Set data for drag operation
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-url'));
    
    // Create a custom drag image (optional)
    const dragImage = this.cloneNode(true);
    dragImage.style.opacity = '0.7';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 50, 50);
    
    // Clean up the clone after drag starts
    setTimeout(() => {
        document.body.removeChild(dragImage);
    }, 0);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault(); // Allows dropping
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    
    // Get the dragged bookmark URL
    const draggedUrl = e.dataTransfer.getData('text/plain');
    const targetUrl = this.getAttribute('data-url');
    
    if (draggedUrl !== targetUrl) {
        updateBookmarkOrder(draggedUrl, targetUrl);
    }
    
    this.classList.remove('drag-over');
    return false;
}

function handleDragEnd(e) {
    // Remove all drag styling classes
    document.querySelectorAll('.bookmark-tile').forEach(tile => {
        tile.classList.remove('dragging', 'drag-over');
    });
}

function updateBookmarksHoverHide(enabled) {
    const bookmarksContainer = document.getElementById('bookmarksContainer');
    if (bookmarksContainer) {
        if (enabled) {
            bookmarksContainer.classList.add('hover-hide-mode');
        } else {
            bookmarksContainer.classList.remove('hover-hide-mode');
        }
    }
}

// Expose the function to the window object
window.updateBookmarksHoverHide = updateBookmarksHoverHide;

// Initialize bookmarks when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load bookmarks
    loadBookmarks();
    
    // Set up event listeners
    const bookmarkForm = document.getElementById('bookmarkForm');
    const cancelAddBookmarkBtn = document.getElementById('cancelAddBookmark');
    
   
    if (cancelAddBookmarkBtn) {
        cancelAddBookmarkBtn.addEventListener('click', hideAddBookmarkForm);
    }
});