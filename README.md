[![If you are a good person...](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/lunedor)
# Vortumna - Your Personalized New Tab Experience

Vortumna is a browser extension designed to transform your new tab page into a dynamic, beautiful, and intelligent dashboard. It offers a wide array of customizable backgrounds, integrated AI chatbots, personalized greetings, and much more to make every new tab inspiring and productive.

## ✨ Features

Vortumna is packed with features to enhance your browsing experience:

### 🖼️ Dynamic Backgrounds
Choose from a variety of sources to set stunning backgrounds:

*   **Local Images:**
    *   Upload a single image.
    *   Create a gallery of your favorite images (stored locally in IndexedDB).
    *   Schedule background changes: Manual, Hourly, Daily, or Every New Session.
*   **Google Earth View:** Display breathtaking satellite imagery from Google Earth.
*   **Unsplash:** Access a vast library of high-quality photos.
    *   Select images by category.
    *   Requires an Unsplash API key.
*   **Imgur:** Fetch images from Imgur URLs.
    *   Supports direct image links, albums, tags, and gallery pages.
    *   Uses a default client ID; advanced users can potentially configure their own.
*   **Pixabay:** Discover free stock photos.
    *   Filter by category.
    *   Select image quality.
    *   Requires a Pixabay API key.
*   **Reddit:** Get images from your favorite image-based subreddits via RSS.
    *   Select from a curated list of subreddits.
*   **Background Caching:**
    *   Images from all sources are cached (using IndexedDB with Blobs) to improve loading speed and reduce API calls.
    *   Cache expiration is handled based on the selected schedule.

### 💬 AI Chatbots
Integrate powerful AI directly into your new tab:

*   **Gemini AI Chat:**
    *   Chat with Google's Gemini models.
    *   Model selection from available Gemini models.
    *   Upload images and documents for context.
    *   **Image Generation:** Generate images using compatible Gemini models (e.g., `gemini-2.0-flash-exp-image-generation`).
    *   **Search Mode:** Perform web searches enhanced by Gemini.
    *   Conversation history.
    *   Requires a Gemini API key.
    *   Keyboard Shortcut: `Alt+A` (configurable or platform dependent).
*   **OpenRouter Chat:**
    *   Access a variety of models through OpenRouter (DeepSeek, Llama, Qwen, etc.).
    *   Model selection.
    *   Upload images and documents (image support depends on the selected model and OpenRouter API capabilities).
    *   **Search Mode:** Perform web searches enhanced by the selected model.
    *   Conversation history.
    *   Requires an OpenRouter API key.
    *   Keyboard Shortcut: `Alt+O` (configurable or platform dependent).
*   **Common AI Chat Features:**
    *   Clean conversation history.
    *   Copy messages.
    *   Markdown rendering for AI responses.
    *   File previews for uploads.
    *   Typing indicators.

### 👋 AI-Powered Personalized Greetings
*   Get unique greetings powered by Gemini AI.
*   Greetings are personalized based on:
    *   Time of day and date.
    *   (Intended) Current weather conditions and forecast (requires weather integration to be fully functional).
    *   User's configured mood (grumpy, normal, motivated).
    *   Trending topics and news (via Gemini's search tool).
    *   User's name (if provided).
    *   Location (if provided or auto-detected).
*   Greetings are cached to minimize API calls.
*   Requires a Gemini API key.

### 🏞️ Image Gallery
*   Save your favorite background images from any source (Local, Earth View, Unsplash, etc.) to a personal gallery.
*   View, manage, and delete saved images.
*   Set any gallery image as your current background with a click (or Ctrl+Click).
*   Images are stored efficiently as Blobs in IndexedDB.

### ⚙️ Customization & Settings
*   **API Key Management:** Securely save and manage API keys for Unsplash, Pixabay, Gemini, and OpenRouter.
*   **Feature Toggles:** Show or hide AI chat modules and greetings.
*   **Background Source Selection:** Easily switch between different background providers.
*   **Subreddit/Category Selection:** Customize content for Reddit, Unsplash, and Pixabay.
*   **Image Display Mode:** Choose how background images fit your screen (e.g., cover, contain).
*   **City Autocomplete:** For weather settings, easily find cities using OpenWeather API.

### 🛠️ General UI & UX
*   **File Drag & Drop:** Easily add files to AI chats.
*   **Responsive Design:** Adapts to different screen sizes.
*   **User Feedback:** Clear notifications for actions like saving API keys, file uploads, etc.
*   **Keyboard Shortcuts:** Quick access to AI chat features.

## 🚀 Getting Started

### Installation
1.  Clone this repository or download the source code.
2.  Open your Chromium-based browser (e.g., Google Chrome, Microsoft Edge).
3.  Go to `chrome://extensions` or `edge://extensions`.
4.  Enable "Developer mode".
5.  Click "Load unpacked" and select the directory where you cloned/downloaded Vortumna.

### Configuration
Many features in Vortumna require API keys to function. You can configure these in the extension's settings panel:

1.  **Open a new tab** to load Vortumna.
2.  **Click the settings icon** (usually a gear ⚙️) to open the settings panel.
3.  **API Keys:**
    *   **Gemini API Key:** Required for Gemini Chat and AI Greetings. Obtain from Google AI Studio.
    *   **OpenRouter API Key:** Required for OpenRouter Chat. Obtain from OpenRouter.ai.
    *   **Unsplash API Key:** Required for Unsplash backgrounds. Create an app on the Unsplash Developer Portal.
    *   **Pixabay API Key:** Required for Pixabay backgrounds. Obtain from Pixabay API Documentation.
    *   **(OpenWeather API Key):** While not directly for a background, the city autocomplete feature in settings uses OpenWeather. Obtain from OpenWeatherMap.
4.  **Backgrounds:** Select your preferred background source and customize its options (e.g., subreddit for Reddit, category for Unsplash/Pixabay).
5.  **AI Features:** Toggle visibility for Gemini Chat, OpenRouter Chat, and AI Greetings. Configure your name and mood for greetings.

## 💻 Technology Stack

*   **Frontend:** HTML, CSS, JavaScript (ES6+)
*   **Browser APIs:**
    *   `chrome.storage` (or `browser.storage` for cross-browser compatibility)
    *   `chrome.alarms` (for scheduled background changes)
    *   IndexedDB (for Image Gallery and Background Caching)
    *   `FileReader` API (for file uploads)
    *   `URL.createObjectURL` (for displaying Blobs)
    *   Fetch API (for network requests)
    *   Canvas API (for saving DOM images to gallery)
*   **External APIs:**
    *   Gemini API
    *   OpenRouter API
    *   Unsplash API
    *   Pixabay API
    *   Imgur API
    *   Reddit RSS Feeds
    *   Google Earth View (via gstatic JSON, potentially unofficial)
    *   OpenWeatherMap Geocoding API (for city autocomplete in settings)
*   **Libraries:**
    *   `marked.js` (for rendering Markdown in AI chat responses)

## 📂 File Structure (Key `js` directories)

*   `js/ai/`: Contains logic for AI integrations (Gemini, OpenRouter, Greetings, shared AI components).
*   `js/background/`: Manages different background sources (EarthView, Imgur, Local Images, Pixabay, Reddit, Unsplash) and caching (`backgroundCache.js`).
*   `js/settings/`: Handles the settings panel UI and logic.
*   `js/ui/`: General UI components and interactions.
*   `js/utils/`: Utility functions.

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features, improvements, or bug fixes, please feel free to:
1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/YourAmazingFeature`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some amazing feature'`).
5.  Push to the branch (`git push origin feature/YourAmazingFeature`).
6.  Open a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Enjoy your enhanced new tab experience with Vortumna!
