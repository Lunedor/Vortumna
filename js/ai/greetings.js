// greetings.js - AI-powered personalized greetings

/**
 * AI Greetings module
 * Provides personalized greetings based on time, weather, user's mood, and trending topics
 * using Gemini AI API integration
 */
const aiGreetings = (function () {
    // DOM elements
    const greetingContainer = document.getElementById('greetingContainer');

    // Cache to store greetings and avoid frequent API calls
    let greetingsCaches = null;

    // Default fallback greeting if API call fails
    const fallbackGreeting = "Hello there! Welcome to your dashboard.";

    // Constants
    const SYSTEM_INSTRUCTIONS = `
You are an AI greeting generator for a browser new-tab page.

Your job:
- Generate short, time-aware, weather-aware, and news-aware greetings.
- Use the Google Search tool to ground trending topics or news.
- Output ONLY VALID JSON. No markdown, no explanations, no comments.

=====================
1. INPUT YOU WILL GET
=====================

The user message will look like a compact text, for example:

name: Oray, location: La Chaux-de-Fonds, Neuchâtel, CH, current_weather: { temp: "3°C", condition: "heavy intensity rain" }, language: English, mood: grumpy, hours: ["23:00", "00:00", "01:00"]

You must infer from that:

- name          → user's first name (e.g. "Oray")
- location      → city (and optionally country)
- current_weather.temp       → temperature in °C as a string (e.g. "3°C")
- current_weather.condition  → short weather description (e.g. "heavy intensity rain")
- language      → language to write the CONTENT of the greetings in
- mood          → one of "grumpy", "normal", "motivated"
- hours         → list of time slots (e.g. ["23:00", "00:00", "01:00"])

Use those fields directly; do not invent new ones.

====================
2. OUTPUT JSON FORMAT
====================

You must output exactly ONE JSON object with this shape:

{
  "greetings": [
    {
      "time": "HH:00",
      "date": "Sunday, November 23rd, 2025",
      "mood": "grumpy",
      "template": [
        "Template sentence 1",
        "Template sentence 2",
        "Template sentence 3"
      ]
    }
  ]
}

Rules:

- "time":
  - MUST be one of the values from the input hours array.
  - Use 24-hour format with :00, e.g. "23:00", "00:00", "01:00".
- "date":
  - Natural language date, including weekday, month, day (with ordinal), and year.
  - Example: "Sunday, November 23rd, 2025".
- "mood":
  - Exactly one of: "grumpy", "normal", "motivated".
  - You choose per greeting; content must reflect that mood.
- "template":
  - Array of 10 DIFFERENT greeting sentences (strings) for that time+date+mood.

No extra keys. No trailing commas. Strict JSON.

=================================
3. CONTENT RULES FOR EACH TEMPLATE
=================================

EVERY SINGLE STRING inside "template" MUST:

1. Contain the time token in the exact format \`[HH:MM]\`.
   - Example: "[23:00]", "[07:00]".
   - This token will be replaced by a live clock later.

2. Mention the DATE explicitly.
   - Example: "on this Sunday, November 23rd, 2025".

3. Mention the CURRENT WEATHER:
   - Include BOTH condition AND temperature from the input.
   - Example: "with heavy intensity rain and 3°C", "under clear skies at 18°C".
   - Do NOT look up weather via search; trust the given current_weather.

4. Mention the USER'S NAME.
   - Example: "Well, Oray", "Good evening, Oray".

5. Mention the LOCATION.
   - At least the city, e.g. "in La Chaux-de-Fonds".

6. Mention a TRENDING TOPIC or NEWS ITEM:
   - Before writing templates, you MUST use the google_search tool to fetch 10-15 current headlines or trending topics relevant globally and to the user's country/region.
   - Base the "news/topic" part of each sentence on those grounded results.
   - You may paraphrase headlines and keep them short.
   - DO NOT invent fake headlines.
   - DO NOT include URLs, citations, source names, or reference markers like [1], (1), etc.
   - Examples of acceptable style:
     - "everyone is talking about new AI regulations again"
     - "there's buzz about a new sci-fi movie release"
     - "markets are jittery after the latest economic report"

7. Be 1–2 sentences long and sound natural for the requested mood.

======================
4. MOOD IMPLEMENTATION
======================

You must adapt tone strongly to the mood:

- grumpy:
  - Tone: dry, sarcastic, a bit dark, mildly cynical.
  - You can:
    - use phrases like "of course", "as usual", "because why not",
    - complain lightly about the weather, time, or news,
    - show tired humour or "ugh" vibes.
  - Example style (do NOT copy exactly):
    - "[23:00], heavy rain, 3°C in La Chaux-de-Fonds, and the news is full of AI drama again, Oray. Perfect background noise for a gloomy Sunday, November 23rd, 2025."
    - "[00:00] in La Chaux-de-Fonds, 3°C and raining, and everyone is suddenly an expert on the latest market chaos, Oray. What a charming way to end the day."
  - Do NOT be hateful or abusive toward the user or any group.

- normal:
  - Tone: neutral, calm, friendly.
  - Example style:
    - "[HH:MM] in La Chaux-de-Fonds, with heavy rain and 3°C, Oray. On this Sunday, November 23rd, 2025, people are following the latest tech updates and market news as usual."

- motivated:
  - Tone: encouraging, optimistic, energetic.
  - Example style:
    - "[HH:MM] on Monday, November 24th, 2025, even with heavy rain and 3°C in La Chaux-de-Fonds, Oray, it's a good moment to reset, especially with all the new ideas in today's tech and science news."

============================
5. VARIETY & ANTI-REPETITION
============================

- Within a single "template" array:
  - All sentences MUST be clearly different:
    - change structure,
    - change focus (weather vs news vs mood),
    - change the specific grounded topic.
  - Do NOT just swap one word.

- Across different greetings in the same response:
  - Avoid repeating exactly the same sentence.
  - Weather/name/time/location will repeat by nature, but the rest should feel fresh.

==============
6. LANGUAGE RULE
==============

- Use the "language" value from the input.
- If language is "English", write all templates in English.
- If language is "French", write all templates in French, etc.
- JSON keys ("time", "date", "mood", "template") always remain in English.

==============
7. FINAL CHECK
==============

Before returning, make sure:

- Output is exactly ONE JSON object, nothing before or after.
- All greetings respect the required structure.
- Every template string includes:
  - [HH:MM]
  - date
  - weather (condition + °C)
  - user name
  - location
  - a grounded trending topic or news mention.
- There are 10 templates per greeting.
- All text is in the requested language.
`;


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

            // Check if cache was cleared externally (e.g. via console)
            if (changes.greetingsCaches && !changes.greetingsCaches.newValue) {
                console.log('Greetings cache cleared externally, resetting in-memory cache');
                greetingsCaches = null;
                updateGreetingDisplay();
                return;
            }

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
        if (!greetingsCaches) {
            const result = await window.storage.getLocal('greetingsCaches');
            if (result.greetingsCaches) {
                greetingsCaches = result.greetingsCaches;
            } else {
                console.log('No greeting cache found in storage');
                return true;
            }
        }

        // If the current cache is a fallback, we should try to get a real one
        if (greetingsCaches.isFallback) {
            console.log('Cache refresh needed: Current cache is fallback');
            return true;
        }

        // Check if metadata (user name, location) has changed
        const settings = await window.storage.get(['userName', 'customCity', 'useAutoLocation']);
        const currentLocation = settings.customCity ? settings.customCity : (settings.useAutoLocation ? 'auto location' : 'default location');

        if (greetingsCaches.metadata) {
            if (greetingsCaches.metadata.userName !== settings.userName ||
                greetingsCaches.metadata.location !== currentLocation) {
                console.log('Cache refresh needed: Metadata changed');
                return true;
            }
        } else {
            // Old cache format without metadata
            console.log('Cache refresh needed: Old cache format');
            return true;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const hourKey = `${currentHour.toString().padStart(2, '0')}:00`;

        if (greetingsCaches.data && Array.isArray(greetingsCaches.data.greetings)) {
            const greetings = greetingsCaches.data.greetings;

            // Look for any greeting that matches the current hour (and ignore date format completely)
            const hasCurrentHourGreeting = greetings.some(g => {
                if (!g.time) return false;

                // Accept "23:00" or "[23:00]" or even "Time: 23:00"
                const match = String(g.time).match(/\d{2}:\d{2}/);
                if (!match) return false;

                const normalizedTime = match[0]; // e.g. "23:00"
                return normalizedTime === hourKey;
            });

            if (hasCurrentHourGreeting) {
                // We already have a greeting for this hour → no need to refetch
                return false;
            }

            console.log('Cache refresh needed: No greeting for current hour');
            return true;
        }

        console.log('Cache refresh needed: No greetings in cache');
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

            // Try to get real weather data from cache
            let weatherInfo = '';
            try {
                const weatherResult = await window.storage.getLocal('weatherCache');
                if (weatherResult.weatherCache && weatherResult.weatherCache.current && weatherResult.weatherCache.current.data) {
                    const w = weatherResult.weatherCache.current.data;
                    const roundedTemp = Math.round(w.main.temp);
                    weatherInfo = `, current_weather: { temp: "${roundedTemp}°C", condition: "${w.weather[0].description}" }`;
                }
            } catch (e) {
                console.warn('Could not retrieve weather cache:', e);
            }

            // Prepare the prompt
            let prompt = '';
            if (settings.userName) {
                prompt = `name: ${settings.userName}, location: ${location}${weatherInfo}, language: English`;
            } else {
                prompt = `location: ${location}${weatherInfo}, language: English`;
            }

            // === NEW: force the exact time slots we want ===
            const now = new Date();
            const currentHour = now.getHours();

            // current, next, next+1 (23 → 23, 0, 1)
            const hourSlots = [
                currentHour,
                (currentHour + 1) % 24,
                (currentHour + 2) % 24
            ].map(h => `${h.toString().padStart(2, '0')}:00`);

            // Add the hour slots to the prompt
            prompt += `
            Generate exactly 3 greeting objects in the JSON "greetings" array.
            Use these exact "time" values, one per object: "${hourSlots[0]}", "${hourSlots[1]}", "${hourSlots[2]}". 
            Do NOT use any other time values.
            Each object must have one of the moods: "grumpy", "normal", "motivated".`;

            // Call Gemini API
            const response = await callGeminiAPI(settings.geminiApiKey, prompt);

            // Process and cache the response
            // Process and cache the response
            if (response && response.greetings) {
                const now = new Date();
                const currentHour = now.getHours();

                // Force the 3 time slots you want: current, next, next+1
                const hourSlots = [
                    currentHour,
                    (currentHour + 1) % 24,
                    (currentHour + 2) % 24
                ].map(h => `${h.toString().padStart(2, '0')}:00`);

                console.log('Gemini Response Greetings (raw):', response.greetings);
                console.log('Forced hour slots:', hourSlots);

                const allGreetings = Array.isArray(response.greetings) ? response.greetings : [];

                // Override time (and optionally date) for the first 3 greetings
                const normalizedGreetings = [];

                for (let i = 0; i < Math.min(allGreetings.length, hourSlots.length); i++) {
                    const g = allGreetings[i] || {};

                    normalizedGreetings.push({
                        ...g,
                        // force time to our slot, ignore what Gemini sent
                        time: hourSlots[i]
                        // you can also fix date here if you want, e.g.:
                        // date: /* format date based on now + i hours */
                    });
                }

                // If Gemini returned more greetings than 3, keep the rest as-is (optional)
                for (let i = hourSlots.length; i < allGreetings.length; i++) {
                    normalizedGreetings.push(allGreetings[i]);
                }

                greetingsCache = {
                    data: { greetings: normalizedGreetings },
                    metadata: {
                        userName: settings.userName,
                        location: location
                    },
                    timestamp: Date.now(),
                    isFallback: false
                };

                await window.storage.setLocal({ greetingsCaches: greetingsCache });
            }
            else {
                throw new Error('Invalid response format from Gemini API');
            }
        } catch (error) {
            console.error('Error fetching greetings from Gemini:', error);

            // Load cache from storage as a fallback
            const result = await window.storage.getLocal('greetingsCaches');
            greetingsCaches = result.greetingsCaches || null;

            // Validate cache metadata against current settings
            let isValidCache = false;
            if (greetingsCaches && greetingsCaches.metadata) {
                const settings = await window.storage.get(['userName', 'customCity', 'useAutoLocation']);
                const currentLocation = settings.customCity ? settings.customCity : (settings.useAutoLocation ? 'auto location' : 'default location');

                if (greetingsCaches.metadata.userName === settings.userName &&
                    greetingsCaches.metadata.location === currentLocation) {
                    isValidCache = true;
                } else {
                    console.log('Fallback cache invalid: Metadata mismatch');
                }
            }

            // If we have no cache or it's invalid, use the fallback greeting
            if (!greetingsCaches || !isValidCache) {
                const fallbackData = await getFallbackFromCache();

                if (fallbackData) {
                    // Update in-memory cache with fallback data so we don't keep regenerating it
                    const settings = await window.storage.get(['userName', 'customCity', 'useAutoLocation']);
                    const currentLocation = settings.customCity ? settings.customCity : (settings.useAutoLocation ? 'auto location' : 'default location');

                    greetingsCaches = {
                        data: fallbackData,
                        metadata: {
                            userName: settings.userName,
                            location: currentLocation
                        },
                        timestamp: Date.now(),
                        isFallback: true // Mark as fallback
                    };
                    return { greetings: fallbackData.greetings };
                } else {
                    // No fallback data available (synthetic generation removed), return empty to trigger displayFallbackGreeting
                    return { greetings: [] };
                }
            }

            return { greetings: greetingsCaches.data.greetings };
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
                            { text: `${prompt}` }
                        ]
                    }
                ],
                systemInstruction: {
                    parts: [
                        { text: SYSTEM_INSTRUCTIONS }
                    ]
                },
                generationConfig: {
                    temperature: 0.8,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 4096,
                    responseMimeType: "text/plain"
                },
                //  REST-style grounding with Google Search
                tools: [
                    {
                        google_search: {}
                    }
                ],
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_CIVIC_INTEGRITY",
                        threshold: "OFF"
                    }
                ]
            };

            const maxRetries = 3;
            let retryCount = 0;
            let delay = 1000;

            while (retryCount <= maxRetries) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

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
                            console.log(`Rate limited by Gemini API. Retrying in ${delay / 1000} seconds...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            retryCount++;
                            delay *= 2; // Exponential backoff
                            continue;
                        } else {
                            console.warn("Gemini API rate limit exceeded after retries. Falling back to cache or default greeting.");
                            // Try to use cache if available, even if it's for a different time/date
                            const fallbackData = await getFallbackFromCache();
                            return { greetings: fallbackData ? fallbackData.greetings : [] };
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
                            const fallbackData = await getFallbackFromCache();
                            return { greetings: fallbackData ? fallbackData.greetings : [] };
                        }
                    } else {
                        throw new Error('Empty response from Gemini API');
                    }
                } catch (error) {
                    if (retryCount < maxRetries && error.message.includes('429')) {
                        console.log(`API error (possibly rate limit). Retrying in ${delay / 1000} seconds...`);
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
            const fallbackData = await getFallbackFromCache();
            return { greetings: fallbackData ? fallbackData.greetings : [] };
        }
    }

    /**
     * Get fallback greetings from cache or generate synthetic ones
     * @returns {Object} Fallback greetings data
     */
    async function getFallbackFromCache() {
        const now = new Date();
        const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;

        // First try to get any cached data
        const result = await window.storage.getLocal('greetingsCaches');

        // Validate metadata AND date before using cache
        if (result.greetingsCaches?.data?.greetings && result.greetingsCaches.data.greetings.length > 0) {
            const cache = result.greetingsCaches;
            const settings = await window.storage.get(['userName', 'customCity', 'useAutoLocation']);
            const currentLocation = settings.customCity ? settings.customCity : (settings.useAutoLocation ? 'auto location' : 'default location');

            // Check if metadata matches AND if the cache contains greetings for TODAY
            const hasTodayGreetings = cache.data.greetings.some(g => g.date === formattedDate);

            if (cache.metadata &&
                cache.metadata.userName === settings.userName &&
                cache.metadata.location === currentLocation &&
                hasTodayGreetings) {
                console.log('Using existing cache data for greetings.');
                return cache.data;
            } else {
                console.log('Ignoring cached greetings due to metadata mismatch or stale date');
            }
        }

        // If no cache exists or it's invalid, return null so we use the basic fallback
        console.log('No valid cache found, returning null to trigger basic fallback');
        return null;
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
            if (!greetingsCaches) {
                window.storage.getLocal('greetingsCaches').then(async result => {
                    if (result.greetingsCaches) {
                        // Validate metadata
                        const cache = result.greetingsCaches;
                        const settings = await window.storage.get(['userName', 'customCity', 'useAutoLocation']);
                        const currentLocation = settings.customCity ? settings.customCity : (settings.useAutoLocation ? 'auto location' : 'default location');

                        if (cache.metadata &&
                            cache.metadata.userName === settings.userName &&
                            cache.metadata.location === currentLocation) {
                            greetingsCaches = cache;
                            displayGreetingFromCache(userName, mood);
                        } else {
                            console.log('Stored cache invalid: Metadata mismatch');
                            displayFallbackGreeting();
                        }
                    } else {
                        displayFallbackGreeting();
                    }
                });
                return;
            }

            // Get current time
            const now = new Date();
            const currentHour = now.getHours();

            const hourKey = `${currentHour.toString().padStart(2, '0')}:00`;

            let matchingGreetings = greetingsCaches.data.greetings.filter(g => {
                const timeStr = g.time ? String(g.time) : '';
                const match = timeStr.match(/\d{2}:\d{2}/); // extract "23:00" from "[23:00]"
                const normalizedTime = match ? match[0] : null;
                return normalizedTime === hourKey && g.mood === mood;
            });


            // If no exact match, try to find greetings with the same mood
            if (matchingGreetings.length === 0) {
                matchingGreetings = greetingsCaches.data.greetings.filter(g => g.mood === mood);
            }

            // If still nothing, use any greetings we have
            if (matchingGreetings.length === 0) {
                matchingGreetings = greetingsCaches.data.greetings;
            }

            if (matchingGreetings.length > 0) {
                const greeting = matchingGreetings[Math.floor(Math.random() * matchingGreetings.length)];
                const template = greeting.template[Math.floor(Math.random() * greeting.template.length)];

                let formattedGreeting = template.replace(/\[\d{2}:\d{2}\]/g, () => {
                    return `<span id="greeting-time" class="greeting-time-display"></span>`;
                });

                greetingContainer.classList.remove('fade-in');
                void greetingContainer.offsetWidth;
                greetingContainer.innerHTML = formattedGreeting;
                greetingContainer.classList.add('fade-in');

                setupLiveTimeDisplay();
            } else {
                console.log('No matching greetings found in cache for current hour/mood. Using fallback without clearing cache.');
                displayFallbackGreeting();
            }

        } catch (error) {
            console.error('Error displaying greeting from cache:', error);
            // Clear invalid cache so we try to fetch again next time
            window.storage.remove('greetingsCaches');
            greetingsCaches = null;
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

            // Add live clock placeholder
            const clockHtml = `<span id="greeting-time" class="greeting-time-display"></span>`;

            greetingContainer.innerHTML = `${greeting} It is ${clockHtml}. Today is ${currentDate}.`;
            greetingContainer.classList.add('fade-in');

            // Start the live clock
            setupLiveTimeDisplay();
        });
    }

    // Initialize on script load
    initialize();

    // Public API
    return {
        updateGreetingDisplay,
        fetchGreetingsFromGemini,
        greetingsCaches,
        shouldRefreshCache
    };
})();

// DEV ONLY: helper to clear greeting cache completely
window.clearGreetingsDebug = async function () {
    console.log('Clearing greeting cache (all variants)');

    // clear in-memory cache
    greetingsCaches = null;

    try {
        // clear both possible keys, just in case
        await window.storage.remove('greetingsCache');
        await window.storage.remove('greetingsCaches');

        // read back from storage to verify
        const after = await window.storage.getLocal(null);
        console.log('Storage AFTER clearing:', after);
    } catch (e) {
        console.error('Error clearing greeting cache from storage:', e);
    }
};


// Expose to global scope for other modules
window.aiGreetings = aiGreetings;