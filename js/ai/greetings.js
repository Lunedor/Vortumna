// greetings.js - AI-powered personalized greetings

/**
 * AI Greetings module
 * Provides personalized greetings based on time, weather, user's mood, and trending topics
 * using Gemini AI API integration
 */
const aiGreetings = (function() {
    // DOM elements
    const greetingContainer = document.getElementById('greetingContainer');
    
    // Cache to store greetings and avoid frequent API calls
    let greetingsCache = null;
    
    // Default fallback greeting if API call fails
    const fallbackGreeting = "Hello there! Welcome to your dashboard.";
    
    // Constants
    const SYSTEM_INSTRUCTIONS = `
Format your response as VALID JSON. Use live data search with search tools to find current trending topics and news to make the greeting relevant for the CURRENT DATE and TIME. Include a mention of a trending topic.

The JSON structure must be:
{
  "greetings": [
    {
      "time": "HH:00",
      "date": "DD.MM.YYYY",
      "mood": "grumpy",
      "template": [
        "Template 1", 
        "Template 2", 
        "Template 3", 
        "Template 4", 
        "Template 5"
      ]
    }
  ]
}

RULES:

Required Elements:
- You must mention current time formatted exactly like [19:00] between square brackets and 24H format
- In your greetings you must mention date of the day as date day of the month(5th, 21st, 31st etc), month(April, February, etc) and as day of the week(Monday, Tuesday,Wendesday). And you can blend it in your greetings. But keep it formatted in json entry as "date": "DD.MM.YYYY".
- Learn hourly forecast for each hour of location and include it in the greeting according to the hour they belonged.
- You must mention current temperature(as degree) and weather condition.
- Include the user's name if given
- MUST include a reference to forecast weather for later today or tomorrow if available
- MUST include a reference to one current trending topic (news, event, or holiday) if there is, and try to do not repeat yourself, find more than one subject and use them in different greetings.
- Find location based trending topics and news if possible our country at least to show.
- ALWAYS USE METRICS FOR TEMPERATURE (Celsius) AND 24-HOUR TIME FORMAT.
- Do not repeat yourself in the greeting for same hour and mood.
- Prepare greetings in language defined with "language" parameter in the prompt.

Mood Implementation:
- Grumpy: sarcastic, ironic, very cynical, harsh and mostly mean.
- Normal: casual but professional.
- Motivated: optimistic and highly energetic.

Content Requirements:
- Make the greeting contextually relevant to the ACTUAL current weather conditions
- Include seasonal references appropriate for the CURRENT MONTH
- NO FICTIONAL WEATHER - only use the actual weather conditions provided
- Reference current trending topics if relevant
- If forecast shows weather changes, mention them (e.g., "It will get cooler later")

Formatting:
- Generate 10 unique templates for each hour starting from the exact CURRENT HOUR for the next 2 hours(Current hour of the hour so consider it as [01:00] even if it is 01:59).
- Create separate templates for each mood (grumpy, normal, motivated)
- Keep templates 15-25 words
- No markdown or emojis
- STRICT JSON SYNTAX - ensure all commas and brackets are valid JSON

IMPORTANT: YOU NEED TO GET NECCESSARY DATAS BY GROUNDING WITH GOOGLE SEARCH THEN PREPARE YOUR RESPONSE. Your response must be ONLY valid JSON with no explanations, comments, or extra text.`;

    /**
     * Initialize the greetings feature
     */
    async function initialize() {
        // Set up event listeners
        document.addEventListener('storage-ready', async () => {
            // Use the centralized window.updateGreetingVisibility function from settings.js
            if (window.updateGreetingVisibility) {
                window.updateGreetingVisibility();
            }
            updateGreetingDisplay();
        });

        // Listen for settings changes
        document.addEventListener('storage-changed', async (e) => {
            const { changes } = e.detail;
            
            if (changes.showGreeting || changes.userName || changes.greetingMood) {
                if (window.updateGreetingVisibility) {
                    window.updateGreetingVisibility();
                }
                updateGreetingDisplay();
            }
        });

        // Initialize greeting on DOM content loaded
        document.addEventListener('DOMContentLoaded', () => {
            if (window.storage) {
                if (window.updateGreetingVisibility) {
                    window.updateGreetingVisibility();
                }
                updateGreetingDisplay();
            }
        });
    }

    /**
     * Helper function to update weather and clock visibility
     */
    async function updateWeatherClockVisibility(show) {
        if (!window.storage) return;
        
        try {
            const settings = await window.storage.get(['showWeather', 'showClock']);
            const showWeather = settings.showWeather !== false;
            const showClock = settings.showClock !== false;
            
            // Call the visibility functions directly
            if (typeof window.updateWeatherVisibility === 'function' && show) {
                window.updateWeatherVisibility(showWeather);
            }
            
            if (typeof window.updateClockVisibility === 'function' && show) {
                window.updateClockVisibility(showClock);
            }
        } catch (error) {
            console.error('Error updating weather/clock visibility:', error);
        }
    }

    /**
     * Update the greeting display based on current settings and weather
     */
    async function updateGreetingDisplay() {
        if (!window.storage) return;
        
        try {
            const settings = await window.storage.get(['showGreeting', 'geminiApiKey', 'userName', 'greetingMood']);
            
            if (!settings.showGreeting || !settings.geminiApiKey) {
                return;
            }
            
            // Only update if greeting container exists
            if (!greetingContainer) return;
            
            // Check if this is a duplicate call (debounce)
            if (greetingContainer.hasAttribute('data-loading')) {
                return;
            }
            
            // Mark as loading to prevent duplicate calls
            greetingContainer.setAttribute('data-loading', 'true');
            greetingContainer.textContent = "Personalizing your greeting...";
            
            // Check if we need to refresh cache
            if (await shouldRefreshCache()) {
                await fetchGreetingsFromGemini();
            } else {
                
            }
            
            // Display greeting from cache
            displayGreetingFromCache(settings.userName, settings.greetingMood);
            
            // Clear loading flag
            greetingContainer.removeAttribute('data-loading');
            
        } catch (error) {
            console.error('Error updating greeting display:', error);
            if (greetingContainer) {
                greetingContainer.removeAttribute('data-loading');
                displayFallbackGreeting();
            }
        }
    }

    /**
     * Check if we need to refresh the greetings cache
     * @returns {Promise<boolean>} True if cache should be refreshed
     */
    async function shouldRefreshCache() {
        // If no in-memory cache exists, try to load from localStorage first
        if (!greetingsCache) {
            const result = await window.storage.getLocal('greetingsCache');
            if (result.greetingsCache) {
                greetingsCache = result.greetingsCache;
            } else {
                console.log('No greeting cache found in storage');
                return true;
            }
        }

        const now = new Date();
        const currentHour = now.getHours();
        const formattedToday = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;

        // Check if we have today's data
        if (greetingsCache.data && greetingsCache.data.greetings) {
            const todayGreetings = greetingsCache.data.greetings.filter(g => g.date === formattedToday);

            if (todayGreetings.length > 0) {
                const currentHourFormatted = `${currentHour.toString().padStart(2, '0')}:00`;

                // Check if there's any greeting for the current hour only
                const currentHourGreetings = todayGreetings.filter(g => g.time === currentHourFormatted);

                if (currentHourGreetings.length > 0) {
                    return false;
                } else {
                    console.log('Cache refresh needed: No matching hour found for today');
                    return true;
                }
            }
        }

        console.log('Cache refresh needed: Missing today\'s data');
        return true;
    }

    /**
     * Fetch new greetings from Gemini API
     */
    async function fetchGreetingsFromGemini() {
        try {
            const settings = await window.storage.get(['geminiApiKey', 'userName', 'customCity', 'useAutoLocation']);
            if (!settings.geminiApiKey) {
                throw new Error('Gemini API key is required');
            }

            // Get weather information for the prompt
            let location = settings.customCity ? settings.customCity : (settings.useAutoLocation ? 'auto location' : 'default location');
            
            // Prepare the prompt
            let prompt = '';
            if (settings.userName) {
                prompt = `name: ${settings.userName}, location: ${location}, language: Turkish`;
            } else {
                prompt = `location: ${location}, language: Turkish`;
            }

            // Call Gemini API
            const response = await callGeminiAPI(settings.geminiApiKey, prompt);
            
            // Process and cache the response
            if (response && response.greetings) {
                const now = new Date();
                const currentHour = now.getHours();
                const currentHourFormatted = `${currentHour.toString().padStart(2, '0')}:00`;

                // Filter the response to only include the current hour's data
                const filteredGreetings = response.greetings.filter(g => g.time === currentHourFormatted);

                greetingsCache = {
                    data: { greetings: filteredGreetings },
                    timestamp: Date.now(),
                };
                
                // Store the cache
                await window.storage.setLocal({ greetingsCache });
                
                return response;
            } else {
                throw new Error('Invalid response format from Gemini API');
            }
        } catch (error) {
            console.error('Error fetching greetings from Gemini:', error);
            
            // Load cache from storage as a fallback
            const result = await window.storage.getLocal('greetingsCache');
            greetingsCache = result.greetingsCache || null;
            
            // If we still have no cache, use the fallback greeting
            if (!greetingsCache) {
                displayFallbackGreeting();
            }
        }
    }

    /**
     * Call the Gemini API with the appropriate parameters
     * @param {string} apiKey - Gemini API key
     * @param {string} prompt - The user prompt
     * @returns {Object} Parsed JSON response
     */
    async function callGeminiAPI(apiKey, prompt) {
        console.log('Calling Gemini API with prompt:', prompt);
        try {
            
            const requestData = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: `${prompt}`
                            }
                        ]
                    }
                ],
                systemInstruction: {
                    parts: [
                        {
                            text: SYSTEM_INSTRUCTIONS
                        }
                    ]
                },
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 8192,
                    responseMimeType: "text/plain"
                },
                tools: [
                    {
                        google_search: {} // Corrected field name with empty object to enable with defaults
                    }
                ],
                "safetySettings": [
                    {
                        "category": "HARM_CATEGORY_CIVIC_INTEGRITY",
                        "threshold": "OFF"
                    },
                ]
            };

            // Add exponential backoff retry logic for rate limiting
            const maxRetries = 3;
            let retryCount = 0;
            let delay = 1000; // Start with 1 second delay
            
            while (retryCount <= maxRetries) {
                try {
                    // Ensure model path is correctly formatted
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        mode: 'cors',
                        body: JSON.stringify(requestData)
                    });
                    
                    // If we get a rate limit error (429)
                    if (response.status === 429) {
                        if (retryCount < maxRetries) {
                            console.log(`Rate limited by Gemini API. Retrying in ${delay/1000} seconds...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            retryCount++;
                            delay *= 2; // Exponential backoff
                            continue;
                        } else {
                            console.warn("Gemini API rate limit exceeded after retries. Falling back to cache or default greeting.");
                            // Try to use cache if available, even if it's for a different time/date
                            return await getFallbackFromCache();
                        }
                    }

                    if (!response.ok) {
                        const errorText = await response.text();
                        let errorMessage = `HTTP error! status: ${response.status}`;
                        
                        try {
                            const errorData = JSON.parse(errorText);
                            if (errorData.error && errorData.error.message) {
                                errorMessage = errorData.error.message;
                            }
                        } catch (e) {
                            // If parsing fails, use the raw text
                            if (errorText) errorMessage += ` - ${errorText}`;
                        }
                        
                        throw new Error(errorMessage);
                    }

                    const responseData = await response.json();
                    
                    if (responseData.candidates && responseData.candidates.length > 0) {
                        const text = responseData.candidates[0].content.parts[0].text;
                        try {
                            // Parse the JSON response, first removing any markdown code block formatting
                            let jsonText = text;
                            
                            // Remove markdown code block formatting if present
                            if (jsonText.startsWith('```json') || jsonText.startsWith('```')) {
                                jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
                            }
                            
                            // Clean up any additional backticks that might be present
                            jsonText = jsonText.replace(/```/g, '');
                            
                            return JSON.parse(jsonText);
                        } catch (e) {
                            console.error('Error parsing Gemini JSON response:', e);
                            console.log('Raw response:', text);
                            return await getFallbackFromCache();
                        }
                    } else {
                        throw new Error('Empty response from Gemini API');
                    }
                } catch (error) {
                    if (retryCount < maxRetries && error.message.includes('429')) {
                        console.log(`API error (possibly rate limit). Retrying in ${delay/1000} seconds...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        retryCount++;
                        delay *= 2; // Exponential backoff
                    } else {
                        throw error; // Re-throw if it's not a rate limit or we've exhausted retries
                    }
                }
            }
            
            throw new Error('Exceeded maximum retries');
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            return await getFallbackFromCache();
        }
    }
    
    /**
     * Get fallback greetings from cache or generate synthetic ones
     * @returns {Object} Fallback greetings data
     */
    async function getFallbackFromCache() {
        // First try to get any cached data, even if it's outdated
        const result = await window.storage.getLocal('greetingsCache');
        if (result.greetingsCache?.data?.greetings && result.greetingsCache.data.greetings.length > 0) {
            console.log('Using existing cache data for greetings despite time mismatch.');
            return result.greetingsCache.data;
        }
        
        // If no cache exists, create synthetic greetings
        const now = new Date();
        const currentHour = now.getHours();
        const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
        
        // Generate time slots for the next 6 hours
        const timeSlots = [];
        for (let i = 0; i < 6; i++) {
            const hour = (currentHour + i) % 24;
            timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        }
        
        // Generate synthetic greetings for all time slots and moods
        const greetings = [];
        const moods = ['grumpy', 'normal', 'motivated'];
        
        for (const timeSlot of timeSlots) {
            for (const mood of moods) {
                greetings.push({
                    time: timeSlot,
                    date: formattedDate,
                    mood: mood,
                    template: [
                        `[${timeSlot}] Hello there! Today is ${now.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'})}. The weather seems nice.`,
                        `[${timeSlot}] Welcome back! It's ${now.toLocaleDateString('en-US', {weekday: 'long'})}. Hope you're having a great day!`,
                        `[${timeSlot}] Good ${getTimeOfDay(parseInt(timeSlot))}! Today is ${now.toLocaleDateString('en-US', {month: 'long', day: 'numeric'})}.`,
                        `[${timeSlot}] Hello! It's ${now.toLocaleDateString('en-US', {weekday: 'long'})}. Let's make today count!`,
                        `[${timeSlot}] Welcome to your dashboard. It's ${now.toLocaleDateString('en-US', {month: 'long', day: 'numeric'})}.`
                    ]
                });
            }
        }
        
        return { greetings };
    }
    
    /**
     * Helper function to get time of day description
     * @param {number} hour - Hour in 24-hour format
     * @returns {string} Time of day description
     */
    function getTimeOfDay(hour) {
        if (hour >= 5 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 22) return 'evening';
        return 'night';
    }

    /**
     * Display greeting from cache based on user settings
     * @param {string} userName - User's name
     * @param {string} mood - Selected mood (grumpy, normal, motivated)
     */
    function displayGreetingFromCache(userName, mood = 'normal') {
        if (!greetingContainer) return;
        
        try {
            // If we don't have a cache, try to load it from storage
            if (!greetingsCache) {
                window.storage.getLocal('greetingsCache').then(result => {
                    if (result.greetingsCache) {
                        greetingsCache = result.greetingsCache;
                        displayGreetingFromCache(userName, mood);
                    } else {
                        displayFallbackGreeting();
                    }
                });
                return;
            }
            
            // Get current time
            const now = new Date();
            const currentHour = now.getHours();
            
            // Find the closest hour in our cached greetings
            const hourKey = `${currentHour.toString().padStart(2, '0')}:00`;
            
            // Find greetings that match our hour and mood
            let matchingGreetings = greetingsCache.data.greetings.filter(g => 
                g.time === hourKey && g.mood === mood
            );
            
            // If no exact match, try to find greetings with the same mood
            if (matchingGreetings.length === 0) {
                matchingGreetings = greetingsCache.data.greetings.filter(g => g.mood === mood);
            }
            
            // If still nothing, use any greetings we have
            if (matchingGreetings.length === 0) {
                matchingGreetings = greetingsCache.data.greetings;
            }
            
            if (matchingGreetings.length > 0) {
                // Select a random greeting from the matches
                const greeting = matchingGreetings[Math.floor(Math.random() * matchingGreetings.length)];
                
                // Select a random template from the greeting
                const template = greeting.template[Math.floor(Math.random() * greeting.template.length)];
                
                // Remove time placeholder with brackets completely - we'll add a live clock element with spacing
                let formattedGreeting = template.replace(/\[\d{2}:\d{2}\]/g, function(match)  {
                    return `<span id="greeting-time" class="greeting-time-display"></span>`;
                });
                
                // Display the greeting with fade-in animation
                greetingContainer.classList.remove('fade-in');
                void greetingContainer.offsetWidth; // Trigger reflow to restart animation
                greetingContainer.innerHTML = formattedGreeting;
                greetingContainer.classList.add('fade-in');
                
                // Set up the live time updater
                setupLiveTimeDisplay();
            } else {
                displayFallbackGreeting();
            }
        } catch (error) {
            console.error('Error displaying greeting from cache:', error);
            displayFallbackGreeting();
        }
    }
    
    /**
     * Set up a live time display that updates every second
     */
    function setupLiveTimeDisplay() {
        const timeElement = document.getElementById('greeting-time');
        if (!timeElement) return;
        
        // Update the time immediately
        updateTimeDisplay();
        
        // Set an interval to update the time every second
        const intervalId = setInterval(updateTimeDisplay, 1000);
        
        // Store the interval ID for cleanup if needed
        if (!window.activeIntervals) window.activeIntervals = {};
        window.activeIntervals.greetingTime = intervalId;
        
        /**
         * Update the time display element with current time
         */
        function updateTimeDisplay() {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            timeElement.textContent = `${hours}:${minutes}`;
        }
    }

    /**
     * Display a fallback greeting when API calls fail
     */
    function displayFallbackGreeting() {
        if (!greetingContainer) return;
        
        // Get user's name if available
        window.storage.get('userName').then(result => {
            const userName = result.userName;
            const now = new Date();
            const hours = now.getHours();
            
            // Create a time-appropriate basic greeting
            let timeGreeting = 'Hello';
            if (hours < 12) {
                timeGreeting = 'Good morning';
            } else if (hours < 18) {
                timeGreeting = 'Good afternoon';
            } else {
                timeGreeting = 'Good evening';
            }
            
            // Add name if available
            const greeting = userName ? `${timeGreeting}, ${userName}!` : `${timeGreeting}!`;
            
            // Show with current date
            const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
            const currentDate = now.toLocaleDateString('en-US', dateOptions);
            
            greetingContainer.textContent = `${greeting} Today is ${currentDate}.`;
        });
    }

    // Initialize on script load
    initialize();

    // Public API
    return {
        updateGreetingDisplay,
        fetchGreetingsFromGemini,
        greetingsCache,
        shouldRefreshCache
    };
})();

// Expose to global scope for other modules
window.aiGreetings = aiGreetings;