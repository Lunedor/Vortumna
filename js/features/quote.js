let quoteData = [];
let currentQuote = null;
// Initialize quoteSettings with default values
let quoteSettings = {
    enabled: true,
    refreshOnLoad: true,
    contentType: 'tr_books'
};
// Initialize favoriteQuotes array
let favoriteQuotes = [];

function initializeQuoteSettings() {
    // Define default settings
    const defaultSettings = {
        enabled: true,
        refreshOnLoad: true,
        contentType: 'tr_books'
    };
    
    // First try to load from storage API
    if (window.storage) {
        window.storage.get('quoteSettings')
            .then(result => {
                if (result.quoteSettings) {
                    quoteSettings = result.quoteSettings;
                } else {
                    // Use defaults if nothing in storage
                    quoteSettings = defaultSettings;
                    // Save defaults to storage
                    window.storage.set({ quoteSettings: defaultSettings })
                        .catch(err => console.error('Error saving default quoteSettings:', err));
                }
                
                // Make sure global variable is updated
                window.quoteSettings = quoteSettings;
                
                // Initialize the favorites panel and buttons after settings are loaded
                initializeFavoritesPanel();
            })
            .catch(e => {
                console.error('Error loading quoteSettings from storage:', e);
                // Fall back to defaults if loading fails
                quoteSettings = defaultSettings;
                window.quoteSettings = quoteSettings;
                
                // Initialize the favorites panel even if there was an error
                initializeFavoritesPanel();
            });
    } else {
        console.warn('Storage not available yet for quoteSettings, using defaults');
        window.quoteSettings = quoteSettings;
        
        // Initialize the favorites panel even if storage isn't available
        initializeFavoritesPanel();
    }
}

// Function to initialize favorites panel and buttons
function initializeFavoritesPanel() {
    // Create the favorites panel if it doesn't exist
    createFavoritesButton();
    
    // Set up event listener for favorites button
    const favoritesBtn = document.getElementById('quoteFavoritesBtn');
    if (favoritesBtn) {
        // Remove existing event listeners to prevent duplicates
        favoritesBtn.removeEventListener('click', toggleFavoritesPanel);
        // Add the event listener
        favoritesBtn.addEventListener('click', toggleFavoritesPanel);
    } else {
        console.error('Could not find quoteFavoritesBtn element');
    }
    
    // Set up event listener for close button
    const closeBtn = document.querySelector('.close-quote-favorites');
    if (closeBtn) {
        // Clone the button to remove all existing event listeners
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        // Add the event listener to the new button
        newCloseBtn.addEventListener('click', () => {
            const panel = document.getElementById('quote-favorites-container');
            if (panel) {
                panel.classList.remove('show');
                panel.style.display = 'none';
            }
        });
    } else {
        console.warn('Could not find close-quote-favorites element');
    }
}

// Make these variables and functions accessible globally
window.quoteData = quoteData;
window.quoteSettings = quoteSettings; // Set default immediately before async operations
window.favoriteQuotes = favoriteQuotes; // Make sure favoriteQuotes is globally available
window.initializeQuoteSettings = initializeQuoteSettings;


// Load quotes data
async function loadQuotes() {
    try {
        // Load favorite quotes from localStorage
        loadFavoriteQuotes();
        
        // Choose source file based on content type
        let sourceFile = quoteSettings.contentType === 'movies' ? '/assets/json/movies.json' : '/assets/json/book.json';
        
        // Load quotes based on selected content type
        if (quoteSettings.contentType === 'tr_books' || quoteSettings.contentType === 'movies') {
            // Load quotes from JSON file (either book.json or movies.json)
            const response = await fetch(sourceFile);
            if (!response.ok) {
                throw new Error(`Failed to load quotes data from ${sourceFile}`);
            }
            quoteData = await response.json();
        } else if (quoteSettings.contentType === 'en_books') {
            // Get a random English quote using the external API (only for books)
            await fetchEnglishQuote();
        } else if (quoteSettings.contentType === 'useless_facts') {
            // Get a random useless fact using the external API
            await fetchUselessFact();
        } else if (quoteSettings.contentType === 'fun_facts') {
            await fetchFunFact();
        } else {
            throw new Error('Invalid content type selected');
        }        
        window.quoteData = quoteData; // Update the global reference
        if (quoteSettings.enabled) {
            displayRandomQuote();
        }
    } catch (error) {
        console.error('Error loading quotes:', error);
    }
}

// Fetch a quote from the English API
async function fetchEnglishQuote() {
    try {
        const response = await fetch('https://api.hamatim.com/quote');
        if (!response.ok) {
            throw new Error('Failed to fetch English quote');
        }
        
        const data = await response.json();
        
        // Format the response to match our data structure
        const englishQuote = {
            quote: data.text,
            author: data.author,
            book_title: data.book || 'Unknown',
            image_url: data.author_img || 'https://placehold.co/50x70?text=' + encodeURIComponent(data.author.split(" ").join("\n")) // Placeholder image
        };
        
        // Set as the current quote directly
        currentQuote = englishQuote;
        
        // For English quotes, we'll store just the current quote in the quoteData array
        // This ensures compatibility with functions expecting an array
        quoteData = [englishQuote];
        
        return englishQuote;
    } catch (error) {
        console.error('Error fetching English quote:', error);
        return null;
    }
}

// Fetch a useless fact from the API
async function fetchUselessFact() {
    try {
        const response = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random');
        if (!response.ok) {
            throw new Error('Failed to fetch useless fact');
        }
        
        const data = await response.json();
        
        // Format the response to match our data structure
        const uselessFact = {
            quote: data.text,
            author: '', // Empty as per requirement
            book_title: '', // Empty as per requirement
            image_url: '/assets/images/useless.png' // Local image file as per requirement
        };
        
        // Set as the current quote directly
        currentQuote = uselessFact;
        
        // Store just the current quote in the quoteData array
        quoteData = [uselessFact];
        
        return uselessFact;
    } catch (error) {
        console.error('Error fetching useless fact:', error);
        return null;
    }
}

// Fetch a fun fact from the facts.json file
async function fetchFunFact() {
    try {
        const response = await fetch('/assets/json/facts.json');
        if (!response.ok) {
            throw new Error('Failed to fetch fun facts from facts.json');
        }
        
        const data = await response.json();
        
        // Select a random fact from the loaded data
        const randomIndex = Math.floor(Math.random() * data.length);
        const funFact = data[randomIndex];
        
        // Format the response to match our data structure
        const formattedFact = {
            quote: funFact.quote || '',
            author: '',
            book_title: '',
            image_url: funFact.image_url || '/assets/images/funfact.png'
        };
        
        // Set as the current quote directly
        currentQuote = formattedFact;
        
        // Store just the current quote in the quoteData array for consistency
        quoteData = [formattedFact];
        
        return formattedFact;
    } catch (error) {
        console.error('Error fetching fun fact:', error);
        return null;
    }
}

// Display a random quote
async function displayRandomQuote() {
    // If content type is English books, fetch from API
    if (quoteSettings.contentType === 'en_books') {
        await fetchEnglishQuote();
    } else if (quoteSettings.contentType === 'useless_facts') {
        await fetchUselessFact();
    } else if (quoteSettings.contentType === 'fun_facts') {
        await fetchFunFact();
    } else {
        // For other cases, select a random quote from the loaded data
        const randomIndex = Math.floor(Math.random() * quoteData.length);
        currentQuote = quoteData[randomIndex];
    }
    
    // Update the UI with the current quote
    const quoteContainer = document.getElementById('quote-container');
    const quoteText = document.getElementById('quote-text');
    const quoteAuthor = document.getElementById('quote-author');
    const quoteBook = document.getElementById('quote-book');
    const quoteImage = document.getElementById('quote-image');
    
    if (currentQuote) {
        quoteText.textContent = currentQuote.quote;
        
        // Handle different fields based on content type
        if (quoteSettings.contentType === 'tr_books' || quoteSettings.contentType === 'en_books') {
            quoteAuthor.textContent = currentQuote.author || '';
            quoteBook.textContent = currentQuote.book_title || '';
            quoteImage.src = currentQuote.image_url || '';
        } else if (quoteSettings.contentType === 'movies') {
            quoteAuthor.textContent = currentQuote.actor_name || '';
            quoteBook.textContent = currentQuote.movie_title || '';
            quoteImage.src = currentQuote.poster_url || '';
        } else if (quoteSettings.contentType === 'useless_facts' || quoteSettings.contentType === 'fun_facts') {
            quoteAuthor.textContent = currentQuote.author || '';
            quoteBook.textContent = currentQuote.book_title || '';
            quoteImage.src = currentQuote.image_url || 'https://placehold.co/50x70?text=' + encodeURIComponent(currentQuote.quote.slice(0, 20).split(" ").join("\n"));
        }
        
        // Add or update bookmark button
        addBookmarkButton();
        
        quoteContainer.classList.remove('hidden');
    }
}

// Add bookmark button to quote container
function addBookmarkButton() {
    const quoteContainer = document.getElementById('quote-container');
    
    // Remove existing bookmark button if it exists
    const existingButton = quoteContainer.querySelector('.quote-bookmark-btn');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Create bookmark button
    const bookmarkButton = document.createElement('button');
    bookmarkButton.className = 'quote-bookmark-btn';
    bookmarkButton.title = 'Bookmark this quote';
    
    // Check if current quote is already favorited
    const isFavorite = isQuoteFavorite(currentQuote);
    bookmarkButton.innerHTML = isFavorite ? '★' : '☆';
    if (isFavorite) {
        bookmarkButton.classList.add('active');
    }
    
    bookmarkButton.addEventListener('click', toggleFavoriteQuote);
    quoteContainer.appendChild(bookmarkButton);
}

// Function to check if a quote is already in favorites
function isQuoteFavorite(quote) {
    return favoriteQuotes.some(fav => 
        fav.quote === quote.quote && 
        fav.author === quote.author
    );
}

// Toggle favorite status of current quote
function toggleFavoriteQuote() {
    if (!currentQuote) return;
    
    const bookmarkBtn = document.querySelector('.quote-bookmark-btn');
    
    // Check if already favorited
    const isFavorite = isQuoteFavorite(currentQuote);
    
    if (isFavorite) {
        // Remove from favorites
        favoriteQuotes = favoriteQuotes.filter(quote => 
            !(quote.quote === currentQuote.quote && quote.author === currentQuote.author)
        );
        bookmarkBtn.innerHTML = '☆';
        bookmarkBtn.classList.remove('active');
    } else {
        // Add to favorites
        favoriteQuotes.push({...currentQuote});
        bookmarkBtn.innerHTML = '★';
        bookmarkBtn.classList.add('active');
    }
    
    // Save to storage
    saveFavoriteQuotes();
    
    // Update favorites panel if open
    if (document.getElementById('quote-favorites-container').classList.contains('show')) {
        displayFavoriteQuotes();
    }
}

// Save favorite quotes to storage
function saveFavoriteQuotes() {
    storage.set({ favoriteQuotes: favoriteQuotes });
}

// Load favorite quotes from storage
function loadFavoriteQuotes() {
    storage.get('favoriteQuotes')
        .then(result => {
            if (result.favoriteQuotes) {
                favoriteQuotes = result.favoriteQuotes;
                window.favoriteQuotes = favoriteQuotes;
            }
        })
        .catch(e => {
            console.error('Error loading favoriteQuotes from storage:', e);
        });
}

// Create and display the favorites button - with idempotency checks
function createFavoritesButton() {
    // Track if this function has already been called
    if (window._favoritesButtonCreated) {
        console.log('Favorites button already created, skipping');
        return;
    }
    
    // Create favorites container if it doesn't exist
    if (!document.getElementById('quote-favorites-container')) {
        const bodyWrapper = document.getElementById('bodyWrapper');
        if (!bodyWrapper) {
            console.error('bodyWrapper not found');
            return;
        }
        
        const favoritesContainer = document.createElement('div');
        favoritesContainer.id = 'quote-favorites-container';
        
        // Add header
        const header = document.createElement('div');
        header.className = 'favorites-header';
        header.innerHTML = '<h3>Favorite Quotes</h3><button class="close-quote-favorites">×</button>';
        
        favoritesContainer.appendChild(header);
        
        // Create content area
        const content = document.createElement('div');
        content.id = 'favorites-content';
        favoritesContainer.appendChild(content);
        
        // Add to bodyWrapper
        bodyWrapper.appendChild(favoritesContainer);
        
        // Set up event listener for close button
        const closeBtn = document.querySelector('.close-quote-favorites');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                const panel = document.getElementById('quote-favorites-container');
                if (panel) {
                    panel.style.display = 'none';
                    panel.classList.remove('show');
                }
            });
        }
            
        // Add click event to the document to close panel when clicking outside - using named function for potential removal
        if (!window._documentClickHandler) {
            window._documentClickHandler = function(event) {
                const panel = document.getElementById('quote-favorites-container');
                const button = document.getElementById('quoteFavoritesBtn');
                
                // If panel is open and click is outside panel and not on the favorites button
                if (panel && panel.classList.contains('show') && 
                    !panel.contains(event.target) && 
                    (!button || !button.contains(event.target))) {
                    
                    // Close the panel
                    panel.classList.remove('show');
                }
            };
            document.addEventListener('click', window._documentClickHandler);
        }
    }
    
    // Mark that button has been created to prevent duplicate creation
    window._favoritesButtonCreated = true;
}

// Toggle favorites panel visibility
function toggleFavoritesPanel() {
    const panel = document.getElementById('quote-favorites-container');
    
    if (panel) {
        // Check if the panel is currently visible by checking display style
        const isVisible = panel.style.display === 'flex';
        
        if (isVisible) {
            // Hide the panel
            panel.style.display = 'none';
            panel.classList.remove('show');
            console.log('Panel closed by toggle button');
        } else {
            // Show the panel
            panel.classList.add('show');
            panel.style.display = 'flex';
            displayFavoriteQuotes();
            console.log('Panel opened by toggle button');
            
            // No need to add event listener here as it's already handled in createFavoritesButton
            // and initializeFavoritesPanel functions
        }
    } else {
        console.warn('Panel element not found.');
    }
}

// Display favorite quotes in the panel
function displayFavoriteQuotes() {
    const container = document.getElementById('favorites-content');
    container.innerHTML = '';
    
    if (favoriteQuotes.length === 0) {
        container.innerHTML = '<div class="empty-favorites">No favorite quotes yet. Click the star icon on any quote to add it to your favorites.</div>';
        return;
    }
    
    favoriteQuotes.forEach((quote, index) => {
        const quoteElement = document.createElement('div');
        quoteElement.className = 'favorite-quote-item';
        
        // Add image (book cover or movie poster)
        const quoteImage = document.createElement('img');
        quoteImage.className = 'favorite-quote-image';
        
        // Determine image source based on quote type
        if (quote.image_url) {
            // Book quote
            quoteImage.src = quote.image_url;
            quoteImage.alt = 'Book cover';
        } else if (quote.poster_url) {
            // Movie quote
            quoteImage.src = quote.poster_url;
            quoteImage.alt = 'Movie poster';
        }
        else {
            quoteImage.src = 'https://placehold.co/50x70?text=' + encodeURIComponent(quote.author.split(" ").join("\n"));
            quoteImage.alt = 'Placeholder image';
        }
        
        // Create content container
        const quoteContent = document.createElement('div');
        quoteContent.className = 'favorite-quote-content';
        
        // Create info section
        const quoteInfo = document.createElement('div');
        quoteInfo.className = 'favorite-quote-info';
        
        const author = document.createElement('p');
        author.className = 'favorite-quote-author';
        author.textContent = quote.author || quote.actor_name || '';
        
        const book = document.createElement('p');
        book.className = 'favorite-quote-book';
        book.textContent = quote.book_title || quote.movie_title || '';
        
        quoteInfo.appendChild(author);
        quoteInfo.appendChild(book);
        
        // Add quote text
        const quoteText = document.createElement('p');
        quoteText.className = 'favorite-quote-text';
        quoteText.textContent = quote.quote;
        
        // Add delete button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-favorite';
        removeBtn.innerHTML = '&times;';
        removeBtn.setAttribute('data-index', index);
        removeBtn.title = 'Remove from favorites';
        removeBtn.addEventListener('click', function() {
            removeFavoriteQuote(index);
        });
        
        // Build the structure
        quoteContent.appendChild(quoteInfo);
        quoteContent.appendChild(quoteText);
        
        quoteElement.appendChild(quoteImage);
        quoteElement.appendChild(quoteContent);
        quoteElement.appendChild(removeBtn);
        
        container.appendChild(quoteElement);
    });
}

// Remove a quote from favorites
function removeFavoriteQuote(index) {
    favoriteQuotes.splice(index, 1);
    saveFavoriteQuotes();
    displayFavoriteQuotes();
    
    // Update current quote bookmark button if it's the same quote
    const currentBookmarkBtn = document.querySelector('.quote-bookmark-btn');
    if (currentBookmarkBtn && currentQuote && !isQuoteFavorite(currentQuote)) {
        currentBookmarkBtn.innerHTML = '☆';
        currentBookmarkBtn.classList.remove('active');
    }
}

// Add debounce utility function
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// Make the function globally accessible
const debouncedDisplayRandomQuote = debounce(displayRandomQuote, 500); // 500ms delay
window.displayRandomQuote = debouncedDisplayRandomQuote;

// Hide quote container
function hideQuoteContainer() {
    const quoteContainer = document.getElementById('quote-container');
    quoteContainer.classList.add('hidden');
}

// Initialize quotes feature
function initQuotes() {
    // Initialize quote settings
    initializeQuoteSettings();
        
    // Simply proceed to check visibility, storage.get() will automatically wait for initialization
    checkQuoteVisibility();
}

// Separate function to check quote visibility settings
function checkQuoteVisibility() {
    // Check if quotes should be visible according to main settings
    window.storage.get('showQuotes')
        .then(result => {
            // Update quoteSettings based on the global setting
            if (quoteSettings) {
                quoteSettings.enabled = result.showQuotes !== false;
                // Save to ensure consistency
                saveQuoteSettings();
            }
            
            // Load quotes if enabled - favorites button is already created in initQuotes
            if (quoteSettings && quoteSettings.enabled) {
                loadQuotes();
            }
            
            // No need to add event listeners here as they are already handled in 
            // createFavoritesButton and initializeFavoritesPanel
        })
        .catch(e => {
            console.error('Error getting showQuotes setting:', e);
            // Proceed with default settings - no need to create button again
            if (quoteSettings && quoteSettings.enabled) {
                loadQuotes();
            }
        });
}

// Save quote settings to storage
function saveQuoteSettings() {
    if (quoteSettings) {
        storage.set({ quoteSettings: quoteSettings });
        
        // Ensure global variable is updated
        window.quoteSettings = quoteSettings;
    }
}