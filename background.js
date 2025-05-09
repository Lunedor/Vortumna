// background.js (Service Worker)

// Listen for messages from content scripts (like imageGallery.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchImage') {
    console.log('Received fetch request for image:', request.imageUrl);
    
    // For all images, we'll try the methods in sequence until one works
    imageToBase64WithFallbacks(request.imageUrl)
      .then(imageData => {
        console.log('Successfully converted image to base64');
        sendResponse({ success: true, imageData });
      })
      .catch(error => {
        console.error('All image fetch methods failed:', error);
        sendResponse({ 
          success: false, 
          error: "Could not automatically save this image",
          requireManualSave: true
        });
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

// Method 1: Direct fetch approach
async function fetchImageAsBase64(imageUrl) {
  const response = await fetch(imageUrl);
  
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }
  
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Method 2: Image element with crossOrigin approach
function imageToBase64(url) {
  return new Promise((resolve, reject) => {
    // Create a unique URL by adding a cache-busting parameter
    const cacheBustUrl = `${url}${url.includes('?') ? '&' : '?'}cacheBust=${Date.now()}`;
    
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = cacheBustUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Convert canvas to Base64
        const base64 = canvas.toDataURL('image/jpeg');
        resolve(base64);
      } catch (e) {
        reject(`Canvas error: ${e.message}`);
      }
    };

    img.onerror = () => {
      reject(`Failed to load image`);
    };
    
    // Add a timeout to prevent hanging
    setTimeout(() => {
      reject('Image load timed out');
    }, 10000);
  });
}

// Method 3: Proxy service approach
async function fetchWithProxy(imageUrl) {
  // Use a CORS proxy service
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`;
  
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Proxy fetch failed: ${response.status} ${response.statusText}`);
  }
  
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Try all methods in sequence until one works
async function imageToBase64WithFallbacks(imageUrl) {
  // Try methods in sequence, each catching and moving to the next
  try {
    // Method 1: Direct fetch
    console.log('Trying direct fetch...');
    return await fetchImageAsBase64(imageUrl);
  } catch (directFetchError) {
    console.log('Direct fetch failed, trying crossOrigin method...', directFetchError);
    
    try {
      // Method 2: Image with crossOrigin
      return await imageToBase64(imageUrl);
    } catch (crossOriginError) {
      console.log('CrossOrigin method failed, trying proxy...', crossOriginError);
      
      // Method 3: Proxy service (last resort)
      return await fetchWithProxy(imageUrl);
    }
  }
}

