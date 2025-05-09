// Add CSS for separate clock and weather visibility
const styleElement = document.createElement('style');
styleElement.textContent = `
.weather-container.clock-only .weather-wrapper,
.weather-container.clock-only .weather-divider,
.weather-container.clock-only .forecast-container,
.weather-container.clock-only .weather-toggle-arrow {
    display: none !important;
}

.weather-container.weather-only .weather-datetime {
    display: none !important;
}
`;
document.head.appendChild(styleElement);

let weatherCache = {
    current: {
        data: null,
        timestamp: 0
    },
    forecast: {
        data: null,
        timestamp: 0
    }
};

// Cache duration constants (in milliseconds)
const CACHE_DURATION = {
    CURRENT: 3600000,    // 1 hour for current weather
    FORECAST: 7200000,   // 2 hours for forecast data
    LOCATION: 3600000    // 1 hour for location data
};

// Check if we have a valid OpenWeather API key
async function hasValidWeatherApiKey() {
    if (window.storage) {
        const result = await window.storage.get('openweather-api-key');
        const apiKey = result['openweather-api-key'];
        return apiKey && apiKey.trim().length > 0;
    }
    return false;
}

// Get the OpenWeather API key from storage
async function getWeatherApiKey() {
    if (window.storage) {
        const result = await window.storage.get('openweather-api-key');
        return result['openweather-api-key'];
    }
    return null;
}

// Add function to check and update weather checkbox based on API key
async function updateWeatherCheckboxState() {
    const hasKey = await hasValidWeatherApiKey();
    const showWeatherCheckbox = document.getElementById('show-weather');
    
    if (showWeatherCheckbox) {
        showWeatherCheckbox.disabled = !hasKey;
    }
}

// Load cache from storage on startup
async function loadWeatherCache() {
    if (window.storage) {
        const result = await window.storage.getLocal('weatherCache');
        if (result.weatherCache) {
            weatherCache = result.weatherCache;
        }
    }
}

// Save cache to storage
async function saveWeatherCache() {
    if (window.storage) {
        await window.storage.setLocal({ weatherCache });
    }
}

// Display basic weather widget with just time/date when no API key is present
function displayBasicWeatherWidget(city = null) {
    // Get current date and time
    const now = new Date();
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    const currentDate = now.toLocaleDateString('en-US', dateOptions);
    const currentTime = now.toLocaleTimeString('en-GB', timeOptions);
    
    const cityName = city || 'Your Location';
    
    const weatherContainer = document.getElementById('weatherStatus');
    weatherContainer.innerHTML = `
        <div class="weather-basic">
            <div class="weather-datetime">
                <div class="weather-time">${currentTime}</div>
                <div class="weather-date">${currentDate}</div>
                <div class="weather-city">${cityName}</div>
            </div>
        </div>
    `;
    
    // Update time every minute
    setInterval(() => {
        const timeElement = weatherContainer.querySelector('.weather-time');
        if (timeElement) {
            const newTime = new Date().toLocaleTimeString('en-GB', timeOptions);
            timeElement.textContent = newTime;
        }
    }, 60000);
    
    // Add click event to open settings when API key link is clicked
    const addApiLink = weatherContainer.querySelector('.add-api-link');
    if (addApiLink) {
        addApiLink.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('settingsBtn').click();
            // Scroll to weather settings in dropdown
            setTimeout(() => {
                const weatherSection = document.querySelector('#settingsDropdown .settings-section:nth-child(1)');
                if (weatherSection) {
                    weatherSection.scrollIntoView({ behavior: 'smooth' });
                }
            }, 300);
        });
    }
}

// Modified to check for custom city first
async function getLocationAndWeather() {
    try {
        // First check if we have a valid API key
        const hasKey = await hasValidWeatherApiKey();
        if (!hasKey) {
            const settings = await window.storage.get(['customCity']);
            displayBasicWeatherWidget(settings.customCity);
            return;
        }

        const settings = await window.storage.get(['customCity', 'useAutoLocation']);
        const customCity = settings.customCity;
        const useAutoLocation = settings.useAutoLocation;
        
        if (useAutoLocation) {
            // Clear weather cache for auto-detection
            weatherCache = {
                current: { data: null, timestamp: 0 },
                forecast: { data: null, timestamp: 0 }
            };
            await saveWeatherCache();
            
            if (navigator.geolocation) {
                // Show loading state
                document.getElementById('weatherStatus').innerHTML = 'Getting your location...';
                
                navigator.geolocation.getCurrentPosition(
                    position => {
                        fetchWeather(position.coords.latitude, position.coords.longitude);
                    }, 
                    error => {
                        console.error('Geolocation error:', error);
                        let errorMessage = 'Unable to get location. ';
                        switch(error.code) {
                            case error.PERMISSION_DENIED:
                                errorMessage += 'Please allow location access or set a custom location.';
                                break;
                            case error.POSITION_UNAVAILABLE:
                                errorMessage += 'Location information is unavailable. Try setting a custom location.';
                                break;
                            case error.TIMEOUT:
                                errorMessage += 'Location request timed out. Try setting a custom location.';
                                break;
                            default:
                                errorMessage += 'Try setting a custom location.';
                        }
                        // Display basic widget with error info
                        displayBasicWeatherWidget();
                        console.log(errorMessage);
                    },
                    { 
                        enableHighAccuracy: true,  
                        timeout: 20000,            // 20 seconds timeout
                        maximumAge: CACHE_DURATION.LOCATION
                    }
                );
            } else {
                displayBasicWeatherWidget();
                console.log('Geolocation is not supported by this browser. Try setting a custom location.');
            }
        } else if (customCity) {
            await loadWeatherCache(); // Only load cache for custom city
            fetchWeatherByCity(customCity);
        } else {
            displayBasicWeatherWidget();
        }
    } catch (error) {
        console.error('Error in getLocationAndWeather:', error);
        displayBasicWeatherWidget();
    }
}

async function fetchWeather(lat, lon) {
    try {
        const hasKey = await hasValidWeatherApiKey();
        if (!hasKey) {
            displayBasicWeatherWidget();
            return;
        }
        
        const now = Date.now();
        // Check if we have valid cached data (less than 1 hour old)
        if (weatherCache.current.data && now - weatherCache.current.timestamp < CACHE_DURATION.CURRENT) {
            updateWeatherDisplay(weatherCache.current.data);
            return;
        }

        const apiKey = await getWeatherApiKey();
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=tr`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }
        
        const data = await response.json();
        weatherCache.current.data = data;
        weatherCache.current.timestamp = now;
        await saveWeatherCache();
        updateWeatherDisplay(data);
    } catch (error) {
        console.error('Failed to fetch weather data:', error);
        displayBasicWeatherWidget();
    }
}

async function fetchWeatherByCity(city) {
    try {
        const hasKey = await hasValidWeatherApiKey();
        if (!hasKey) {
            displayBasicWeatherWidget(city);
            return;
        }
        
        const now = Date.now();
        // Clear the forecast cache when city changes
        if (!weatherCache.current.data || weatherCache.current.data.name.toLowerCase() !== city.toLowerCase()) {
            weatherCache.forecast.data = null;
            weatherCache.forecast.timestamp = 0;
        }

        if (weatherCache.current.data && 
            weatherCache.current.data.name.toLowerCase() === city.toLowerCase() && 
            now - weatherCache.current.timestamp < CACHE_DURATION.CURRENT) {
            updateWeatherDisplay(weatherCache.current.data);
            return;
        }

        const apiKey = await getWeatherApiKey();
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('City not found');
        }
        
        const data = await response.json();
        weatherCache.current.data = data;
        weatherCache.current.timestamp = now;
        await saveWeatherCache();
        updateWeatherDisplay(data);
        
        // Also fetch the forecast for the new city
        await fetchForecast(data.coord.lat, data.coord.lon);
    } catch (error) {
        console.error('Failed to fetch weather data:', error);
        displayBasicWeatherWidget(city);
    }
}

async function fetchForecast(lat, lon) {
    try {
        const hasKey = await hasValidWeatherApiKey();
        if (!hasKey) return {};
        
        const now = Date.now();
        if (weatherCache.forecast.data && now - weatherCache.forecast.timestamp < CACHE_DURATION.FORECAST) { // Cache for forecast
            return weatherCache.forecast.data;
        }

        const apiKey = await getWeatherApiKey();
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Forecast API error: ${response.status}`);
        }
        
        const data = await response.json();
        const dailyForecasts = {};
        
        // Process the 3-hour interval forecasts into daily forecasts
        data.list.forEach(item => {
            const date = new Date(item.dt * 1000);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const hour = date.getHours();
            
            // Initialize the day's data structure if not exists
            if (!dailyForecasts[dayName]) {
                dailyForecasts[dayName] = {
                    temps: [],
                    icons: {},
                    descriptions: {},
                    midDayFound: false
                };
            }
            
            // Add this data point
            dailyForecasts[dayName].temps.push(item.main.temp);
            
            // Count occurrences of each icon and description
            if (!dailyForecasts[dayName].icons[item.weather[0].icon]) {
                dailyForecasts[dayName].icons[item.weather[0].icon] = 0;
            }
            dailyForecasts[dayName].icons[item.weather[0].icon]++;
            
            if (!dailyForecasts[dayName].descriptions[item.weather[0].description]) {
                dailyForecasts[dayName].descriptions[item.weather[0].description] = 0;
            }
            dailyForecasts[dayName].descriptions[item.weather[0].description]++;
            
            // If this is a mid-day reading (12-14), save it as our preferred time
            if (hour >= 12 && hour <= 14 && !dailyForecasts[dayName].midDayFound) {
                dailyForecasts[dayName].midDayTemp = item.main.temp;
                dailyForecasts[dayName].midDayIcon = item.weather[0].icon;
                dailyForecasts[dayName].midDayDescription = item.weather[0].description;
                dailyForecasts[dayName].midDayFound = true;
            }
        });
        
        // Process the collected data for each day
        const processedForecasts = {};
        Object.entries(dailyForecasts).forEach(([day, data]) => {
            // If mid-day data was found, use it, otherwise use most frequent conditions
            let temp, icon, description;
            
            if (data.midDayFound) {
                temp = data.midDayTemp;
                icon = data.midDayIcon;
                description = data.midDayDescription;
            } else {
                // Calculate average temperature
                temp = data.temps.reduce((sum, temp) => sum + temp, 0) / data.temps.length;
                
                // Find most frequent icon and description
                icon = Object.entries(data.icons).sort((a, b) => b[1] - a[1])[0][0];
                description = Object.entries(data.descriptions).sort((a, b) => b[1] - a[1])[0][0];
            }
            
            processedForecasts[day] = {
                temp: temp,
                icon: icon,
                description: description
            };
        });
        
        weatherCache.forecast.data = processedForecasts;
        weatherCache.forecast.timestamp = now;
        await saveWeatherCache();
        return processedForecasts;
    } catch (error) {
        console.error('Failed to fetch forecast data:', error);
        return {};
    }
}

async function updateWeatherDisplay(data) {
    const weatherContainer = document.getElementById('weatherStatus');
    const temp = data.main.temp.toFixed(0);
    const feelsLike = data.main.feels_like.toFixed(0);
    const iconUrl = `https://cdn.jsdelivr.net/gh/steepleian/MeteoconsYR@6073ee11ecba5177e7c435444b124b35cfff871d/${data.weather[0].icon}.svg`;
    const string = data.weather[0].description;
    const condition = string.charAt(0).toUpperCase() + string.slice(1);
    const cityName = data.name;
    
    // Get current date and time
    const now = new Date();
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    const currentDate = now.toLocaleDateString('en-US', dateOptions);
    const currentTime = now.toLocaleTimeString('en-GB', timeOptions);
    
    // Check if forecast was expanded
    let isForecastExpanded = false;
    
    if (window.storage) {
        const result = await window.storage.get('weatherForecastExpanded');
        isForecastExpanded = result.weatherForecastExpanded === true;
    }
    
    weatherContainer.innerHTML = `
        <div class="weather-datetime">
            <div class="weather-time">${currentTime}</div>
            <div class="weather-date">${currentDate}</div>
            <div class="weather-city">${cityName}</div>
        </div>
        <div class="weather-divider"></div>
        <div class="weather-wrapper">
            <div class="weather-icon"><img src="${iconUrl}" alt="Weather icon" /></div>
            <div class="vertical-divider"></div>
            <div class="weather-info">
                <div class="weather-temp">${temp}°C</div>
                <div class="weather-condition">${condition}</div>
                <div class="weather-feels-like">Feels like: ${feelsLike}°C</div>
            </div>
        </div>
        <div class="weather-toggle-arrow ${isForecastExpanded ? 'expanded' : ''}" role="button" tabindex="0" title="Toggle forecast"></div>
        <div class="forecast-container ${isForecastExpanded ? '' : 'hidden'}"></div>
    `;

    // Store coordinates for forecast
    weatherContainer.dataset.lat = data.coord.lat;
    weatherContainer.dataset.lon = data.coord.lon;

    // Add click event for forecast toggle arrow only
    const toggleArrow = weatherContainer.querySelector('.weather-toggle-arrow');
    toggleArrow.addEventListener('click', async function(e) {
        e.stopPropagation(); // Prevent event from bubbling to container
        const forecastContainer = weatherContainer.querySelector('.forecast-container');
        const isExpanding = forecastContainer.classList.contains('hidden');
        
        if (isExpanding) {
            const lat = weatherContainer.dataset.lat;
            const lon = weatherContainer.dataset.lon;
            const forecast = await fetchForecast(lat, lon);
            let forecastHTML = '<div class="forecast-grid">';
            Object.entries(forecast).slice(0, 5).forEach(([date, data]) => {
                forecastHTML += `
                    <div class="forecast-day">
                        <div class="forecast-date">${date}</div>
                        <img src="https://cdn.jsdelivr.net/gh/steepleian/MeteoconsYR@6073ee11ecba5177e7c435444b124b35cfff871d/${data.icon.replace('n', 'd')}.svg" alt="Weather icon" />
                        <div class="forecast-temp">${Math.round(data.temp)}°C</div>
                    </div>
                `;
            });
            forecastHTML += '</div>';
            forecastContainer.innerHTML = forecastHTML;
            forecastContainer.classList.remove('hidden');
            this.classList.add('expanded');
            if (window.storage) {
                await window.storage.set({ weatherForecastExpanded: true });
            }
        } else {
            forecastContainer.classList.add('hidden');
            this.classList.remove('expanded');
            if (window.storage) {
                await window.storage.set({ weatherForecastExpanded: false });
            }
        }
    });

    // Add keyboard support for accessibility
    toggleArrow.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
        }
    });

    // If forecast was expanded, load it immediately
    if (isForecastExpanded) {
        const lat = weatherContainer.dataset.lat;
        const lon = weatherContainer.dataset.lon;
        const forecast = await fetchForecast(lat, lon);
        const forecastContainer = weatherContainer.querySelector('.forecast-container');
        let forecastHTML = '<div class="forecast-grid">';
        Object.entries(forecast).slice(0, 5).forEach(([date, data]) => {
            forecastHTML += `
                <div class="forecast-day">
                    <div class="forecast-date">${date}</div>
                    <img src="https://cdn.jsdelivr.net/gh/steepleian/MeteoconsYR@6073ee11ecba5177e7c435444b124b35cfff871d/${data.icon.replace('n', 'd')}.svg" alt="Weather icon" />
                    <div class="forecast-temp">${Math.round(data.temp)}°C</div>
                </div>
            `;
        });
        forecastHTML += '</div>';
        forecastContainer.innerHTML = forecastHTML;
    }

    // Update time every minute
    setInterval(() => {
        const timeElement = weatherContainer.querySelector('.weather-time');
        if (timeElement) {
            const newTime = new Date().toLocaleTimeString('en-GB', timeOptions);
            timeElement.textContent = newTime;
        }
    }, 60000);
}

// Initialize weather when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check and update weather checkbox state
    updateWeatherCheckboxState();
    
    // Ensure storage module is loaded before initializing weather
    if (window.storage) {
        getLocationAndWeather();
    } else {
        // If storage is not available yet, wait a bit and try again
        const storageCheckInterval = setInterval(() => {
            if (window.storage) {
                clearInterval(storageCheckInterval);
                getLocationAndWeather();
            }
        }, 100);
        
        // Failsafe: after 3 seconds, try anyway
        setTimeout(() => {
            if (!window.storage) {
                console.warn('Storage not available, but proceeding with weather initialization');
                getLocationAndWeather();
            }
        }, 3000);
    }
});

// Export the fetchForecast function to make it available to other modules
window.fetchForecast = fetchForecast;
