const client_id = '015c0ff426a744dca0b535156ab48932';
// Use chrome.identity.getRedirectURL() to get the proper redirect URI
const redirect_uri = chrome.identity.getRedirectURL('callback');
const scopes = [
    'user-read-private',
    'playlist-read-private',
    'playlist-modify-private',
    'playlist-modify-public',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming'
];
const SPOTIFY_STANDALONE_MODE = true; // Enable standalone mode that doesn't rely on background script

// Store the current playback state
let currentPlaybackState = {
    content: null,
    type: null,
    isPlaying: false
};

// Code verifier and challenge for PKCE
let codeVerifier = null;

// Function to generate a random string for the code verifier
function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Function to generate code challenge from verifier
async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

// Listen for tab creation events
chrome.tabs.onCreated.addListener((tab) => {
    if (tab.pendingUrl === chrome.runtime.getURL('newtab.html')) {
        // Check if we need to refresh the token
        checkAndRefreshToken();
    }
});

// Function to handle Spotify login with Authorization Code Flow + PKCE
async function authenticateSpotify(callback) {
    console.log(redirect_uri);
    try {
        console.log('Starting Spotify authentication...');
        // Generate code verifier and challenge
        codeVerifier = generateRandomString(128);
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        
        console.log('PKCE challenge generated, preparing auth URL');
        // Using Authorization Code Flow with PKCE
        const auth_url = `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=code&redirect_uri=${encodeURIComponent(redirect_uri)}&code_challenge_method=S256&code_challenge=${codeChallenge}&scope=${encodeURIComponent(scopes.join(' '))}&show_dialog=true`;

        console.log('Launching web auth flow...');
        chrome.identity.launchWebAuthFlow({
                url: auth_url,
                interactive: true
            },
            async (redirect_url) => {
                if (chrome.runtime.lastError) {
                    console.error('Authentication failed:', chrome.runtime.lastError.message);
                    if (callback) callback(new Error(`Authentication failed: ${chrome.runtime.lastError.message}`));
                    return;
                }

                if (!redirect_url) {
                    console.error('Authentication failed: No redirect URL received');
                    if (callback) callback(new Error("Authentication failed: No redirect URL received"));
                    return;
                }

                console.log('Received redirect URL:', redirect_url);
                // Extract authorization code from URL
                const url = new URL(redirect_url);
                const code = url.searchParams.get('code');
                
                if (code) {
                    console.log('Authorization code received, exchanging for tokens...');
                    try {
                        // Exchange code for tokens
                        const response = await fetch('https://accounts.spotify.com/api/token', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            body: new URLSearchParams({
                                client_id: client_id,
                                grant_type: 'authorization_code',
                                code: code,
                                redirect_uri: redirect_uri,
                                code_verifier: codeVerifier
                            })
                        });
                        
                        const data = await response.json();
                        
                        if (data.access_token) {
                            console.log('Token exchange successful, storing tokens');
                            storeTokens(data);
                            if (callback) callback(null, data.access_token);
                        } else {
                            console.error('Token exchange failed:', data);
                            if (callback) callback(new Error(`Token exchange failed: ${JSON.stringify(data)}`));
                        }
                    } catch (error) {
                        console.error('Error exchanging code for tokens:', error);
                        if (callback) callback(error);
                    }
                } else {
                    console.error('Authorization code not found in the redirect URL:', redirect_url);
                    if (callback) callback(new Error("No authorization code found in redirect URL"));
                }
            }
        );
    } catch (error) {
        console.error('Authentication setup failed:', error);
        if (callback) callback(error);
    }
}

function storeTokens(data) {
    const access_token = data.access_token;
    const refresh_token = data.refresh_token;
    const expires_in = data.expires_in || 3600; // Default 1 hour if not provided
    const expiry = Date.now() + (expires_in * 1000); // Calculate expiry
    
    // Store tokens using the Storage API
    const tokenData = {
        'spotify_access_token': access_token,
        'spotify_token_expiry': expiry
    };
    
    if (refresh_token) {
        tokenData['spotify_refresh_token'] = refresh_token;
    }
    
    // Use the centralized Storage API
    window.storage.set(tokenData)
        .then(() => {
            console.log('Spotify tokens stored successfully using Storage API');
        })
        .catch(error => {
            console.error('Error storing tokens:', error);
        });
}

// Function to refresh the Spotify access token
async function refreshSpotifyToken() {
    return new Promise((resolve, reject) => {
        window.storage.get('spotify_refresh_token')
            .then(async (data) => {
                if (!data.spotify_refresh_token) {
                    reject(new Error('No refresh token available'));
                    return;
                }
                
                try {
                    console.log('Attempting to refresh token...');
                    const response = await fetch('https://accounts.spotify.com/api/token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: new URLSearchParams({
                            client_id: client_id,
                            grant_type: 'refresh_token',
                            refresh_token: data.spotify_refresh_token
                        })
                    });
                    
                    const tokenData = await response.json();
                    
                    if (tokenData.access_token) {
                        console.log('Token refresh successful');
                        // Store new tokens (some response might not include a new refresh token)
                        const newData = {
                            access_token: tokenData.access_token,
                            expires_in: tokenData.expires_in
                        };
                        
                        if (tokenData.refresh_token) {
                            newData.refresh_token = tokenData.refresh_token;
                        } else {
                            newData.refresh_token = data.spotify_refresh_token;
                        }
                        
                        storeTokens(newData);
                        resolve(tokenData.access_token);
                    } else {
                        console.error('Token refresh failed:', tokenData);
                        reject(new Error('Token refresh failed'));
                    }
                } catch (error) {
                    console.error('Error refreshing token:', error);
                    reject(error);
                }
            })
            .catch(error => {
                console.error('Error getting refresh token from storage:', error);
                reject(error);
            });
    });
}

// Function to check if token needs refreshing and refresh it if needed
function checkAndRefreshToken() {
    window.storage.get(['spotify_access_token', 'spotify_token_expiry', 'spotify_refresh_token'])
        .then(async (data) => {
            const currentTime = Date.now();
            const tokenExpiry = data.spotify_token_expiry || 0;
            
            // If token expires in less than 5 minutes or has already expired
            if (data.spotify_refresh_token && data.spotify_access_token && currentTime > tokenExpiry - 300000) {
                console.log('Token needs refreshing, attempting refresh...');
                try {
                    await refreshSpotifyToken();
                } catch (error) {
                    console.error('Proactive token refresh failed:', error);
                }
            }
        })
        .catch(error => {
            console.error('Error checking token status:', error);
        });
}

// Set up alarm to check token status every 5 minutes
chrome.alarms.create('checkTokenStatus', { periodInMinutes: 5 });

// Listen for alarm to check token status
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkTokenStatus') {
        checkAndRefreshToken();
    }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'initiateSpotifyLogin') {
        authenticateSpotify((error, token) => {
            if (error) {
                sendResponse({
                    success: false,
                    error: error.message
                });
            } else {
                sendResponse({
                    success: true,
                    token: token
                });
            }
        });
        return true; // Indicates we will send a response asynchronously
    } else if (request.action === 'checkSpotifyLogin') {
        // Check if token exists, if it's valid, and if it hasn't expired
        window.storage.get(['spotify_access_token', 'spotify_token_expiry', 'spotify_refresh_token'])
            .then(async (data) => {
                const currentTime = Date.now();
                const tokenExpiry = data.spotify_token_expiry || 0;
                const isLoggedIn = !!data.spotify_access_token;
                
                let validToken = data.spotify_access_token;
                
                // If token is expired but we have a refresh token, try to refresh it
                if (isLoggedIn && currentTime > tokenExpiry && data.spotify_refresh_token) {
                    try {
                        validToken = await refreshSpotifyToken();
                    } catch (error) {
                        console.error('Token refresh failed:', error);
                        validToken = null;
                    }
                }
                
                // If token is close to expiring (within 5 minutes), also refresh it proactively
                else if (isLoggedIn && data.spotify_refresh_token && tokenExpiry - currentTime < 300000) {
                    try {
                        validToken = await refreshSpotifyToken();
                    } catch (error) {
                        console.error('Proactive token refresh failed:', error);
                    }
                }
                
                sendResponse({
                    isLoggedIn: !!validToken
                });
            })
            .catch(error => {
                console.error('Error checking login status:', error);
                sendResponse({
                    isLoggedIn: false,
                    error: error.message
                });
            });
        return true;
    } else if (request.action === 'refreshToken') {
        refreshSpotifyToken()
            .then(token => {
                sendResponse({ success: true, token: token });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    } else if (request.action === 'logoutSpotify') {
        window.storage.remove([
            'spotify_access_token', 
            'spotify_refresh_token',
            'spotify_token_expiry'
        ])
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('Error logging out:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    } else if (request.action === 'updatePlaybackState') {
        currentPlaybackState = request.state;
    } else if (request.action === 'getPlaybackState') {
        sendResponse({
            state: currentPlaybackState
        });
        return true;
    }
});

function loginToSpotify() {
    // Prevent duplicate auth attempts
    if (window.spotifyAuthInProgress) {
        return;
    }
    
    window.spotifyAuthInProgress = true;
    
    // Display a loading state in the UI
    const playerContainer = document.getElementById('playerContainer');
    if (playerContainer) {
        playerContainer.innerHTML = `
            <div class="spotify-login-prompt">
                <p>Connecting to Spotify...</p>
                <div class="loading-spinner"></div>
            </div>
        `;
    }
    
    // Show "logging in" message in the settings too
    const loggedOutDiv = document.getElementById('spotify-logged-out');
    if (loggedOutDiv) {
        loggedOutDiv.innerHTML = `<p>Connecting to Spotify...</p><div class="loading-spinner"></div>`;
    }
    
    // Use the Authorization Code Flow with PKCE
    authenticateSpotify((error, token) => {
        window.spotifyAuthInProgress = false;
        
        if (error) {
            console.error('Spotify login failed:', error);
            
            // Show a helpful error message
            alert('Spotify login failed: ' + (error.message || 'Unknown error'));
            
            // Reset UI to logged out state
            displayLoggedOutUI();
            
            // Reset login UI in settings panel
            const loggedOutDiv = document.getElementById('spotify-logged-out');
            if (loggedOutDiv) {
                loggedOutDiv.innerHTML = `
                    <p>You are not logged in to Spotify</p>
                    <button id="spotify-login-btn" class="settings-button">Login to Spotify</button>
                `;
                const loginBtn = document.getElementById('spotify-login-btn');
                if (loginBtn) {
                    loginBtn.addEventListener('click', loginToSpotify);
                }
            }
            return;
        }
        
        // Update UI immediately
        displayLoggedInUI();
        
        // Fetch user playlists if token is available
        fetchUserPlaylists(token);
        
        // Reload the page after a short delay
        setTimeout(() => window.location.reload(), 1000);
    });
}

function displayLoggedInUI() {
    // Prepare the UI for logged-in state
    document.getElementById('playlistDropdown').style.display = 'block';
    document.getElementById('search').style.display = 'flex';
    
    // Show logged in state
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.textContent = 'Logout';
        loginBtn.removeEventListener('click', loginToSpotify);
        loginBtn.addEventListener('click', logoutFromSpotify);
    }
    
    // Update expandable content height to reflect the new content
    setTimeout(() => {
        const content = document.getElementById('expandableContent');
        if (content && content.style.maxHeight !== "0px") {
            // Calculate the full content height including the newly displayed elements
            let fullHeight = 0;
            Array.from(content.children).forEach(function(child) {
                fullHeight += child.scrollHeight;
            });
            
            // Add padding and margins
            fullHeight += 8;
            
            // Set the final height for the expanded state
            content.style.maxHeight = fullHeight + "px";
            content.style.height = fullHeight + "px";
        }
    }, 50); // Small delay to ensure DOM is updated
}

function displayLoggedOutUI() {
    // Hide content that requires login
    document.getElementById('playlistDropdown').style.display = 'none';
    document.getElementById('search').style.display = 'none';
    
    // Show a login interface
    const playerContainer = document.getElementById('playerContainer');
    if (playerContainer) {
        playerContainer.innerHTML = `
            <div class="spotify-login-prompt">
                <p>Login to access Spotify features</p>
                <button id="loginBtn" class="spotify-button">Login</button>
            </div>
        `;
        
        // Add event listener to the newly created button
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', loginToSpotify);
        }
    }
    
    // Update expandable content height after logout to reflect the simplified content
    setTimeout(() => {
        const content = document.getElementById('expandableContent');
        if (content && content.style.maxHeight !== "0px") {
            // Recalculate the content height with only the login interface
            let fullHeight = 0;
            Array.from(content.children).forEach(function(child) {
                fullHeight += child.scrollHeight;
            });
            
            // Add padding and margins
            fullHeight += 8;
            
            // Set the final height for the expanded state
            content.style.maxHeight = fullHeight + "px";
            content.style.height = fullHeight + "px";
        }
    }, 50); // Small delay to ensure DOM is updated
}

function logoutFromSpotify() {
    // Clear tokens using Storage API
    window.storage.remove([
        'spotify_access_token',
        'spotify_refresh_token',
        'spotify_token_expiry'
    ])
    .then(() => {
        // Reload the page to reset the UI completely
        window.location.reload();
    })
    .catch(error => {
        console.error('Error during logout:', error);
        // Still try to reload even if there was an error
        window.location.reload();
    });
}

function fetchSpotifyData(endpoint, method, accessToken, body = null) {
    const url = `https://api.spotify.com/v1/${endpoint}`;
    return fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : null
        })
        .then(async response => { // Make async to use await for refresh
            if (response.status === 401) {
                try {
                    // Use checkAndRefreshToken
                    const newToken = checkAndRefreshToken();
                    // Retry the original request with the new token
                    return fetchSpotifyData(endpoint, method, newToken, body);
                } catch (refreshError) {
                    logoutFromSpotify(); // Call direct logout
                    throw new Error('Token expired and refresh failed'); // Throw error to stop promise chain
                }
            }
            if (response.status === 429) { // Rate limit exceeded
                const retryAfter = response.headers.get('retry-after') || 60;
                console.error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
                return new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
                    .then(() => fetchSpotifyData(endpoint, method, accessToken, body));
            }
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        });
}

function fetchUserPlaylists(accessToken) {
    fetchSpotifyData('me/playlists?offset=0&limit=50', 'GET', accessToken)
        .then(data => populatePlaylistDropdown(data.items))
        .catch(error => console.error('Error fetching playlists:', error));
}

function populatePlaylistDropdown(playlists) {
    const dropdown = document.getElementById('playlistDropdown');
    // Clear existing options except the first one
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
    
    playlists.forEach(playlist => {
        if (!playlist || !playlist.name || !playlist.id) {
            return; // Skip invalid playlist objects
        }

        const option = new Option(playlist.name, playlist.id);
        option.title = playlist.name; // Add title for tooltip

        if (playlist.name.length > 35) // Adjust this length as needed
            option.textContent = playlist.name.slice(0, 33) + '...'; // Truncate text

        dropdown.add(option);
    });
}


function displaySelectedPlaylist(playlistId) {
    const frameContainer = document.getElementById('playerContainer');
    frameContainer.innerHTML = ''; // Clear previous results

    if (!playlistId) {
        frameContainer.innerHTML = ''; // Clear the frame if no playlist is selected
    } else {
        const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
        frameContainer.innerHTML = `<iframe src="${embedUrl}" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;

        window.storage.setLocal({
            'currently_playing_content': playlistId,
            'currently_playing_type': 'playlist'
        });
    }
}

let searchCache = {};

function performSearch(query = null) {
    const searchQuery = query || document.getElementById('searchInput').value;
    const searchType = document.querySelector('input[name="search_type"]:checked').value;

    let types = [];
    if (searchType === 'track' || searchType === 'all') types.push('track');
    if (searchType === 'album' || searchType === 'all') types.push('album');
    if (searchType === 'playlist' || searchType === 'all') types.push('playlist');
    const searchTypeQuery = `type=${types.join(',')}`;

    if (searchCache[searchQuery] && searchCache[searchQuery][searchType]) {
        displaySearchResults(searchCache[searchQuery][searchType]); // Use cached results based on type
        return;
    }

    window.storage.getLocal(['spotify_access_token']).then(data => {
        if (!searchQuery || !data.spotify_access_token) {
            if (!data.spotify_access_token) {
                // User is not logged in, show login prompt
                const frameContainer = document.getElementById('playerContainer');
                frameContainer.innerHTML = `
                    <div class="spotify-login-prompt">
                        <p>Please log in to search Spotify</p>
                        <button id="loginBtn" class="spotify-button">Login</button>
                    </div>
                `;
                
                // Add event listener to the newly created button
                const loginBtn = document.getElementById('loginBtn');
                if (loginBtn) {
                    loginBtn.addEventListener('click', loginToSpotify);
                }
            }
            return;
        }
        
        fetchSpotifyData(`search?${searchTypeQuery}&q=${encodeURIComponent(searchQuery)}`, 'GET', data.spotify_access_token)
            .then(data => {
                searchCache[searchQuery] = searchCache[searchQuery] || {};
                searchCache[searchQuery][searchType] = data; // Cache the new results by type
                displaySearchResults(data);
            })
            .catch(error => console.error('Error searching Spotify:', error));
    }).catch(error => {
        console.error('Error getting Spotify access token:', error);
    });
}

function displaySearchResults(data) {
    const frameContainer = document.getElementById('playerContainer');
    frameContainer.innerHTML = ''; // Clear previous results

    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'results-container';
    frameContainer.appendChild(resultsDiv);

    if (data.albums && data.albums.items.length > 0) {
        const albumHeader = document.createElement('h2');
        albumHeader.textContent = 'Albums';
        albumHeader.className = 'result-header';
        resultsDiv.appendChild(albumHeader);

        data.albums.items.forEach(album => {
            const albumDiv = document.createElement('div');
            albumDiv.className = 'result-item album';

            const albumImage = document.createElement('img');
            albumImage.src = album.images[0]?.url || '/path/to/default-album-image.jpg';
            albumImage.className = 'item-image';
            albumImage.alt = `${album.name} cover`;

            const albumInfo = document.createElement('div');
            albumInfo.className = 'item-info';

            const albumName = document.createElement('div');
            albumName.className = 'item-name';
            albumName.textContent = album.name;

            const artistName = document.createElement('div');
            artistName.className = 'item-artist';
            artistName.textContent = album.artists.map(artist => artist.name).join(', ');

            albumInfo.appendChild(albumName);
            albumInfo.appendChild(artistName);

            albumDiv.appendChild(albumImage);
            albumDiv.appendChild(albumInfo);

            albumDiv.onclick = () => loadSpotifyContent(album.id, 'album');
            resultsDiv.appendChild(albumDiv);
        });
    }


    if (data.tracks && data.tracks.items.length > 0) {
        const trackHeader = document.createElement('h2');
        trackHeader.textContent = 'Tracks';
        trackHeader.className = 'result-header';
        resultsDiv.appendChild(trackHeader);

        data.tracks.items.forEach(track => {
            const trackDiv = document.createElement('div');
            trackDiv.className = 'result-item track';

            const trackImage = document.createElement('img');
            trackImage.src = track.album.images[0]?.url || '/path/to/default-track-image.jpg';
            trackImage.className = 'item-image';
            trackImage.alt = `${track.name} cover`;

            const trackInfo = document.createElement('div');
            trackInfo.className = 'item-info';

            const trackName = document.createElement('span');
            trackName.className = 'item-name';
            trackName.textContent = track.name;

            const artistName = document.createElement('span');
            artistName.className = 'item-artist';
            artistName.textContent = track.artists.map(artist => artist.name).join(', ');

            trackInfo.appendChild(trackName);
            trackInfo.appendChild(artistName);


            trackDiv.appendChild(trackImage);
            trackDiv.appendChild(trackInfo);

            trackDiv.onclick = () => loadSpotifyContent(track.id, 'track');
            resultsDiv.appendChild(trackDiv);
        });
    }

    if (data.playlists && data.playlists.items.length > 0) {
        const playlistHeader = document.createElement('h2');
        playlistHeader.textContent = 'Playlists';
        playlistHeader.className = 'result-header';
        resultsDiv.appendChild(playlistHeader);

        data.playlists.items.forEach(playlist => {
            if (!playlist || !playlist.images) return;

            const playlistDiv = document.createElement('div');
            playlistDiv.className = 'result-item playlist';

            const playlistImage = document.createElement('img');
            playlistImage.src = playlist?.images?.[0]?.url || '/assets/images/Spotify_Logo.png';
            playlistImage.className = 'item-image';
            playlistImage.alt = `${playlist.name} cover`;

            const playlistInfo = document.createElement('div');
            playlistInfo.className = 'item-info';

            const playlistName = document.createElement('div');
            playlistName.className = 'item-name';
            playlistName.textContent = playlist.name;

            playlistInfo.appendChild(playlistName);
            playlistDiv.appendChild(playlistImage);
            playlistDiv.appendChild(playlistInfo);
            playlistDiv.onclick = () => loadSpotifyContent(playlist.id, 'playlist');
            resultsDiv.appendChild(playlistDiv);
        });
    }

    if ((!data.albums || data.albums.items.length === 0) && (!data.tracks || data.tracks.items.length === 0)) {
        const noResults = document.createElement('p');
        noResults.textContent = 'No results found.';
        noResults.className = 'no-results';
        resultsDiv.appendChild(noResults);
    }
}

// Function to load and play specific Spotify content such as a track or an album
function loadSpotifyContent(id, type) { // Add the 'type' parameter here
    const frameContainer = document.getElementById('playerContainer');
    frameContainer.innerHTML = `<iframe src="https://open.spotify.com/embed/${type}/${id}" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;

    // Update storage with new content identifier
    window.storage.setLocal({
        'currently_playing_content': id,
        'currently_playing_type': type
    });
}

// Listen for playback state updates from other tabs
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncPlaybackState') {
        updateIframeContent(request.state.content, request.state.type);
    }
});

// Modify the updateIframeContent function to broadcast state changes
function updateIframeContent(id, type) {
    const frameContainer = document.getElementById('playerContainer');
    if (frameContainer) {
        let embedUrl = `https://open.spotify.com/embed/${type}/${id}`;

        frameContainer.innerHTML = `<iframe src="${embedUrl}" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;

        // Update storage with new content identifier
        window.storage.setLocal({
            'currently_playing_content': id,
            'currently_playing_type': type
        });
    }
}

// Function to toggle theme manually
function toggleTheme() {
    const body = document.body;
    body.classList.toggle("dark-theme");
    const theme = body.classList.contains("dark-theme") ? "dark" : "light";
    localStorage.setItem("theme", theme);
}

// Add a function to periodically check and refresh the token
function setupTokenRefreshInterval() {
    // Check token status every 10 minutes (600000 ms)
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            checkAndRefreshToken();
        }
    }, 600000);
    
    // Also check when the page becomes visible again
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkAndRefreshToken();
        }
    });
}

// Function to update UI components based on login state
function updateSpotifyUIState(isLoggedIn, accessToken) {
    // Update components in the settings panel
    const loggedInDiv = document.getElementById('spotify-logged-in');
    const loggedOutDiv = document.getElementById('spotify-logged-out');
    
    if (loggedInDiv && loggedOutDiv) {
        if (isLoggedIn) {
            loggedInDiv.classList.remove('hidden');
            loggedOutDiv.classList.add('hidden');
        } else {
            loggedInDiv.classList.add('hidden');
            loggedOutDiv.classList.remove('hidden');
        }
    }
    
    // Update the main Spotify UI
    if (isLoggedIn) {
        // User is logged in - show player UI and fetch playlists
        displayLoggedInUI();
        fetchUserPlaylists(accessToken);
    } else {
        // User is not logged in - show login prompt
        displayLoggedOutUI();
    }
    
    // If the user has an active session, check and load last played content
    if (isLoggedIn) {
        window.storage.get(['currently_playing_content', 'currently_playing_type'])
            .then(data => {
                if (data.currently_playing_content && data.currently_playing_type) {
                    updateIframeContent(data.currently_playing_content, data.currently_playing_type);
                }
            })
            .catch(error => {
                console.error('Error loading previous content:', error);
            });
    }
}

// Initialize Spotify UI state on page load - now works independently of background script
function initializeSpotifyUI() {
    // Check if token needs refresh before checking UI state
    checkAndRefreshToken();
    
    // Get tokens from storage API consistently
    window.storage.get(['spotify_access_token', 'spotify_token_expiry'])
        .then(data => {
            const accessToken = data.spotify_access_token;
            const tokenExpiry = data.spotify_token_expiry;
            const currentTime = Date.now();
            const hasValidToken = accessToken && tokenExpiry && currentTime < parseInt(tokenExpiry);

            // Apply UI updates
            updateSpotifyUIState(hasValidToken, accessToken);
            
            // Set up search button and playlist dropdown event listeners
            setupSpotifyControlListeners();
        })
        .catch(error => {
            console.error('Error getting Spotify token data:', error);
            // Assume not logged in on error
            updateSpotifyUIState(false, null);
            // Set up listeners anyway
            setupSpotifyControlListeners();
        });
}

// Add event listeners for Spotify controls
function setupSpotifyControlListeners() {
    // Search button listener
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => performSearch());
    }
    
    // Search input enter key listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    // Playlist dropdown change listener
    const playlistDropdown = document.getElementById('playlistDropdown');
    if (playlistDropdown) {
        playlistDropdown.addEventListener('change', () => {
            const selectedPlaylistId = playlistDropdown.value;
            if (selectedPlaylistId) {
                displaySelectedPlaylist(selectedPlaylistId);
            }
        });
    }
    
    // Login button in settings
    const loginBtn = document.getElementById('spotify-login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', loginToSpotify);
    }
    
    // Logout button in settings
    const logoutBtn = document.getElementById('spotify-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutFromSpotify);
    }
    
    // Close button for Spotify expandable tile
    const closeSpotifyBtn = document.querySelector('.close-spotify-btn');
    if (closeSpotifyBtn) {
        closeSpotifyBtn.addEventListener('click', function() {
            const expandableContent = document.getElementById('expandableContent');
            if (expandableContent) {
                expandableContent.style.maxHeight = "0px";
            }
        });
    }
}

// Call this during DOM content loaded
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeSpotifyUI();
            setupTokenRefreshInterval();  // Add the interval check
            setupSpotifyControlListeners(); // Set up event listeners
        });
    } else {
        // If document is already loaded (e.g., when injecting this script dynamically)
        initializeSpotifyUI();
        setupTokenRefreshInterval();  // Add the interval check
        setupSpotifyControlListeners(); // Set up event listeners
    }
}
