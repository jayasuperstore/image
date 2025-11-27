// Configuration
const CONFIG = {
    // API URL
    API_BASE_URL: 'http://192.168.1.177/jayawebapi/api/pricechecker',
    
    SLIDESHOW_INTERVAL: 5000,  // 5 seconds
    AUTO_RESET_DELAY: 30000,   // 30 seconds
    
    // GitHub paths - all in one repository
    GITHUB_BASE: 'https://raw.githubusercontent.com/jayasuperstore/image/main/',
    PRODUCT_IMAGE_BASE: 'https://raw.githubusercontent.com/jayasuperstore/image/main/products/',
    DEFAULT_IMAGE: 'https://raw.githubusercontent.com/jayasuperstore/image/main/products/none.png',
    
    // Auto-update configuration - using same repository
    AUTO_UPDATE: {
        ENABLED: true,
        CHECK_INTERVAL: 300000, // Check every 5 minutes (300000ms)
        FILES: {
            HTML: 'https://raw.githubusercontent.com/jayasuperstore/image/main/pricechecker/index.html',
            JS: 'https://raw.githubusercontent.com/jayasuperstore/image/main/pricechecker/pricechecker.js',
            CSS: 'https://raw.githubusercontent.com/jayasuperstore/image/main/pricechecker/pricechecker.css'
        },
        VERSION_URL: 'https://raw.githubusercontent.com/jayasuperstore/image/main/pricechecker/version.json'
    }
};

// State Management
const state = {
    currentSlide: 0,
    slideInterval: null,
    resetTimeout: null,
    barcodeBuffer: '',
    barcodeTimeout: null,
    updateCheckInterval: null,
    currentVersion: '1.6.0', // Increment this with each update
    lastUpdateCheck: null
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    console.log(`Price Checker v${state.currentVersion} - Auto Update System Enabled`);
    
    // Initialize auto-update system
    if (CONFIG.AUTO_UPDATE.ENABLED) {
        await initializeAutoUpdate();
    }
    
    await buildSlideshow(); // Build slideshow dynamically with auto-detection
    initializeBarcodeScanner();
    setupEventListeners();
    setupManualInput();
    
    // Auto-request fullscreen on page load
    setTimeout(() => {
        requestFullscreen();
    }, 500); // Small delay to ensure page is fully loaded
});

// ============================================
// AUTO-UPDATE SYSTEM
// ============================================

async function initializeAutoUpdate() {
    console.log('Initializing auto-update system...');
    
    // Check for updates immediately on startup
    await checkForUpdates();
    
    // Set up periodic update checks
    if (CONFIG.AUTO_UPDATE.CHECK_INTERVAL > 0) {
        state.updateCheckInterval = setInterval(async () => {
            await checkForUpdates();
        }, CONFIG.AUTO_UPDATE.CHECK_INTERVAL);
        
        console.log(`Auto-update check scheduled every ${CONFIG.AUTO_UPDATE.CHECK_INTERVAL / 1000} seconds`);
    }
}

async function checkForUpdates() {
    try {
        console.log('Checking for updates from GitHub...');
        state.lastUpdateCheck = new Date();
        
        // First, check version file if available
        const hasNewVersion = await checkVersion();
        
        if (hasNewVersion) {
            console.log('New version detected, updating files...');
            await updateFiles();
        } else {
            // Fallback: Check file modifications by comparing content hashes
            const needsUpdate = await checkFileChanges();
            if (needsUpdate) {
                console.log('File changes detected, updating...');
                await updateFiles();
            } else {
                console.log('All files are up to date');
            }
        }
        
        // Update the UI to show last check time
        updateLastCheckTime();
        
    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}

async function checkVersion() {
    try {
        const response = await fetch(CONFIG.AUTO_UPDATE.VERSION_URL + '?t=' + Date.now(), {
            cache: 'no-cache'
        });
        
        if (response.ok) {
            const versionData = await response.json();
            console.log('Remote version:', versionData.version, 'Current version:', state.currentVersion);
            
            // Compare versions
            if (versionData.version && versionData.version !== state.currentVersion) {
                return true; // New version available
            }
        }
    } catch (error) {
        console.log('Version file not found or error reading it, falling back to content check');
    }
    
    return false;
}

async function checkFileChanges() {
    try {
        // Get current page's script content
        const currentScript = document.querySelector('script[src*="pricechecker.js"]');
        if (!currentScript) return false;
        
        // Fetch the latest JS file from GitHub
        const response = await fetch(CONFIG.AUTO_UPDATE.FILES.JS + '?t=' + Date.now(), {
            cache: 'no-cache'
        });
        
        if (response.ok) {
            const remoteContent = await response.text();
            
            // Simple check: compare file sizes (quick check)
            // For production, you might want to implement proper hash comparison
            const currentSize = currentScript.innerHTML ? currentScript.innerHTML.length : 0;
            const remoteSize = remoteContent.length;
            
            if (Math.abs(currentSize - remoteSize) > 100) { // Significant size difference
                return true;
            }
            
            // Check for version string in the content
            const versionMatch = remoteContent.match(/currentVersion:\s*['"]([^'"]+)['"]/);
            if (versionMatch && versionMatch[1] !== state.currentVersion) {
                return true;
            }
        }
    } catch (error) {
        console.error('Error checking file changes:', error);
    }
    
    return false;
}

async function updateFiles() {
    try {
        console.log('Starting file update process...');
        
        // Show update notification
        showUpdateNotification('Updating application...');
        
        // Update JavaScript
        await updateJavaScript();
        
        // Update CSS
        await updateCSS();
        
        // Update HTML (this will reload the page)
        await updateHTML();
        
    } catch (error) {
        console.error('Error updating files:', error);
        showUpdateNotification('Update failed. Please refresh manually.', 'error');
    }
}

async function updateJavaScript() {
    try {
        const response = await fetch(CONFIG.AUTO_UPDATE.FILES.JS + '?t=' + Date.now(), {
            cache: 'no-cache'
        });
        
        if (response.ok) {
            const newScript = await response.text();
            
            // Store in localStorage for persistence
            localStorage.setItem('pricechecker_js_content', newScript);
            localStorage.setItem('pricechecker_js_updated', new Date().toISOString());
            
            console.log('JavaScript updated in localStorage');
            
            // Create a new script element with the updated code
            const scriptElement = document.createElement('script');
            scriptElement.textContent = newScript;
            
            // Remove old script and add new one
            const oldScript = document.querySelector('script[src*="pricechecker.js"]');
            if (oldScript) {
                oldScript.remove();
            }
            
            document.body.appendChild(scriptElement);
            console.log('JavaScript hot-reloaded');
        }
    } catch (error) {
        console.error('Error updating JavaScript:', error);
        throw error;
    }
}

async function updateCSS() {
    try {
        const response = await fetch(CONFIG.AUTO_UPDATE.FILES.CSS + '?t=' + Date.now(), {
            cache: 'no-cache'
        });
        
        if (response.ok) {
            const newCSS = await response.text();
            
            // Store in localStorage
            localStorage.setItem('pricechecker_css_content', newCSS);
            localStorage.setItem('pricechecker_css_updated', new Date().toISOString());
            
            // Hot-reload CSS
            let styleElement = document.getElementById('dynamic-styles');
            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = 'dynamic-styles';
                document.head.appendChild(styleElement);
            }
            
            styleElement.textContent = newCSS;
            console.log('CSS hot-reloaded');
        }
    } catch (error) {
        console.error('Error updating CSS:', error);
        // CSS update failure is not critical, continue
    }
}

async function updateHTML() {
    try {
        const response = await fetch(CONFIG.AUTO_UPDATE.FILES.HTML + '?t=' + Date.now(), {
            cache: 'no-cache'
        });
        
        if (response.ok) {
            const newHTML = await response.text();
            
            // Store in localStorage
            localStorage.setItem('pricechecker_html_content', newHTML);
            localStorage.setItem('pricechecker_html_updated', new Date().toISOString());
            
            console.log('HTML updated in localStorage');
            
            // Schedule page reload after a short delay
            showUpdateNotification('Update complete! Reloading...', 'success');
            
            setTimeout(() => {
                // Clear cache and reload
                if ('caches' in window) {
                    caches.keys().then(names => {
                        names.forEach(name => caches.delete(name));
                    });
                }
                
                // Force reload with cache bypass
                window.location.reload(true);
            }, 2000);
        }
    } catch (error) {
        console.error('Error updating HTML:', error);
        throw error;
    }
}

function showUpdateNotification(message, type = 'info') {
    // Remove existing notification if any
    const existingNotification = document.getElementById('update-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'update-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 15px 30px;
        background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        animation: slideDown 0.3s ease;
    `;
    
    notification.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : type === 'success' ? 'fa-check-circle' : 'fa-sync fa-spin'}" style="margin-right: 10px;"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    // Auto-remove after 5 seconds (except for reload notifications)
    if (type !== 'success') {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
}

function updateLastCheckTime() {
    // Create or update a small indicator showing last update check
    let indicator = document.getElementById('update-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'update-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            font-size: 10px;
            color: #999;
            z-index: 100;
            font-family: monospace;
        `;
        document.body.appendChild(indicator);
    }
    
    const time = state.lastUpdateCheck ? state.lastUpdateCheck.toLocaleTimeString() : 'Never';
    indicator.textContent = `Last update check: ${time}`;
}

// Load cached content on page startup (for offline capability)
function loadCachedContent() {
    // Check if we have cached content in localStorage
    const cachedJS = localStorage.getItem('pricechecker_js_content');
    const cachedCSS = localStorage.getItem('pricechecker_css_content');
    
    if (cachedCSS) {
        // Apply cached CSS immediately
        const styleElement = document.createElement('style');
        styleElement.id = 'cached-styles';
        styleElement.textContent = cachedCSS;
        document.head.appendChild(styleElement);
        console.log('Loaded cached CSS');
    }
    
    // Note: Cached JS is already running if this code is executing
    // This function is mainly for applying cached CSS
}

// Call this at the very start
loadCachedContent();

// ============================================
// ORIGINAL PRICE CHECKER FUNCTIONALITY
// ============================================

// Auto-detect available slides and build slideshow
async function buildSlideshow() {
    const baseImageUrl = 'https://raw.githubusercontent.com/jayasuperstore/image/main/';
    const slideshowContainer = document.getElementById('slideshowContainer');
    const maxSlides = 20; // Maximum slides to check
    const availableSlides = [];
    
    console.log('Detecting available slides...');
    
    // Check slides sequentially
    for (let i = 1; i <= maxSlides; i++) {
        const imageUrl = `${baseImageUrl}slide${i}.jpg`;
        const exists = await checkImageExists(imageUrl);
        
        if (exists) {
            availableSlides.push(imageUrl);
            console.log(`Found: slide${i}.jpg`);
        } else {
            // Stop checking after first missing slide
            console.log(`Slide${i}.jpg not found, stopping detection`);
            break;
        }
    }
    
    // If no slides found, default to slide1
    if (availableSlides.length === 0) {
        console.log('No slides detected, using default slide1.jpg');
        availableSlides.push(`${baseImageUrl}slide1.jpg`);
    }
    
    console.log(`Total slides detected: ${availableSlides.length}`);
    
    // Clear existing slides
    slideshowContainer.innerHTML = '';
    
    // Create slides
    availableSlides.forEach((imageUrl, index) => {
        const slideDiv = document.createElement('div');
        slideDiv.className = `slide fade ${index === 0 ? 'active' : ''}`;
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = `Promotion ${index + 1}`;
        // Add inline styles for proper image display
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            object-position: center;
            background: #f5f5f5;
        `;
        
        slideDiv.appendChild(img);
        slideshowContainer.appendChild(slideDiv);
    });
    
    // Create indicators container
    const indicatorsDiv = document.createElement('div');
    indicatorsDiv.className = 'slide-indicators';
    
    // Create dots
    for (let i = 0; i < availableSlides.length; i++) {
        const dot = document.createElement('span');
        dot.className = `dot ${i === 0 ? 'active' : ''}`;
        dot.onclick = () => goToSlide(i);
        indicatorsDiv.appendChild(dot);
    }
    
    slideshowContainer.appendChild(indicatorsDiv);
    
    // Start slideshow if more than one slide
    if (availableSlides.length > 1) {
        startSlideshow();
    }
}

// Check if an image exists at the given URL
async function checkImageExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Slideshow Functions
function startSlideshow() {
    if (state.slideInterval) {
        clearInterval(state.slideInterval);
    }
    
    const slides = document.getElementsByClassName('slide');
    if (slides.length <= 1) return; // Don't start slideshow if only one slide
    
    showSlide(0);
    state.slideInterval = setInterval(() => {
        nextSlide();
    }, CONFIG.SLIDESHOW_INTERVAL);
}

function stopSlideshow() {
    if (state.slideInterval) {
        clearInterval(state.slideInterval);
        state.slideInterval = null;
    }
}

function showSlide(index) {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    
    if (slides.length === 0) return;
    
    if (index >= slides.length) {
        state.currentSlide = 0;
    } else if (index < 0) {
        state.currentSlide = slides.length - 1;
    } else {
        state.currentSlide = index;
    }
    
    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === state.currentSlide);
    });
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === state.currentSlide);
    });
}

function nextSlide() {
    showSlide(state.currentSlide + 1);
}

function goToSlide(index) {
    showSlide(index);
    // Restart slideshow timer
    startSlideshow();
}

// Barcode Scanner Setup
function initializeBarcodeScanner() {
    const barcodeInput = document.getElementById('barcodeInput');
    
    // Keep input focused for barcode scanner
    barcodeInput.focus();
    
    setInterval(() => {
        if (document.activeElement !== barcodeInput && 
            document.activeElement.id !== 'manualInput') {
            barcodeInput.focus();
        }
    }, 100);
    
    // Listen for document keypress events (barcode scanner input)
    document.addEventListener('keydown', handleBarcodeInput);
}

function handleBarcodeInput(event) {
    // CRITICAL: Ignore if user is typing in manual input
    const activeElement = document.activeElement;
    if (activeElement && activeElement.id === 'manualInput') {
        return; // Don't capture keystrokes when manual input is focused
    }
    
    // Clear previous timeout
    if (state.barcodeTimeout) {
        clearTimeout(state.barcodeTimeout);
    }
    
    // Handle Enter key - barcode complete
    if (event.key === 'Enter') {
        if (state.barcodeBuffer.trim()) {
            searchProduct(state.barcodeBuffer.trim());
            state.barcodeBuffer = '';
        }
        return;
    }
    
    // Ignore special keys (except alphanumeric and common barcode characters)
    if (event.key.length > 1 && event.key !== 'Shift') {
        return;
    }
    
    // Add character to buffer (ignore Shift)
    if (event.key !== 'Shift') {
        state.barcodeBuffer += event.key;
    }
    
    // Reset buffer after 100ms of inactivity (barcode scanners are fast)
    state.barcodeTimeout = setTimeout(() => {
        state.barcodeBuffer = '';
    }, 100);
}

// Manual Input Setup
function setupManualInput() {
    const manualInput = document.getElementById('manualInput');
    
    if (manualInput) {
        // Handle Enter key in manual input
        manualInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchManual();
            }
        });
        
        // When manual input is focused, pause barcode scanning
        manualInput.addEventListener('focus', () => {
            console.log('Manual input focused - pausing barcode scanner');
            document.removeEventListener('keydown', handleBarcodeInput);
        });
        
        // When manual input loses focus, resume barcode scanning
        manualInput.addEventListener('blur', () => {
            console.log('Manual input blurred - resuming barcode scanner');
            document.addEventListener('keydown', handleBarcodeInput);
            
            // Refocus hidden input for barcode scanner
            setTimeout(() => {
                document.getElementById('barcodeInput').focus();
            }, 100);
        });
    }
}

function searchManual() {
    const manualInput = document.getElementById('manualInput');
    const searchValue = manualInput.value.trim();
    
    if (searchValue) {
        console.log('Manual search:', searchValue);
        searchProduct(searchValue);
        manualInput.value = ''; // Clear input after search
        manualInput.blur(); // Remove focus
        
        // Hide header after search
        const header = document.getElementById('header');
        if (header) {
            header.style.display = 'none';
        }
        const toggleBtn = document.getElementById('toggleHeaderBtn');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class="fas fa-search"></i> Search';
            toggleBtn.style.background = '#2563eb';
        }
    } else {
        alert('Please enter an item code, barcode, or subcode');
    }
}

// Product Search Function
async function searchProduct(searchValue) {
    if (!searchValue) return;
    
    // Sanitize search value
    searchValue = searchValue.trim();
    
    // Hide header when searching
    const header = document.getElementById('header');
    if (header) {
        header.style.display = 'none';
    }
    
    showLoading();
    hideError();
    stopSlideshow();
    
    try {
        console.log(`Fetching product: ${searchValue}`);
        
        // Use the correct API endpoint format from original code
        const response = await fetch(`${CONFIG.API_BASE_URL}/${encodeURIComponent(searchValue)}`);
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Product not found');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const rawData = await response.json();
        const data = normalizeKeys(rawData);
        console.log('Product data:', data);
        
        if (data) {
            displayProduct(data);
            scheduleAutoReset();
        } else {
            showError('Product not found');
        }
    } catch (error) {
        console.error('Error fetching product:', error);
        showError(error.message || 'Failed to load product information. Please try again.');
    } finally {
        hideLoading();
    }
}

// Display Product Function
function displayProduct(product) {
    hideLoading();
    
    // Hide slideshow, show price display
    document.getElementById('slideshowContainer').style.display = 'none';
    document.getElementById('priceDisplay').style.display = 'block';
    
    // Basic Information
    document.getElementById('itemCode').textContent = product.ItemCode || '-';
    document.getElementById('barcodeDisplay').textContent = product.Barcode || product.ItemCode || '-';
    document.getElementById('productName').textContent = product.ItemDescription || 'Unknown Product';
    document.getElementById('articleCode').textContent = product.ItemBrand || '-';
    
    // Location Display with Fallback indicator
    const locationText = product.Location || '-';
    const locationDisplay = document.getElementById('locationDisplay');
    if (product.IsFallbackFromHQ) {
        locationDisplay.textContent = `${locationText} (From HQ Stock)`;
        locationDisplay.style.color = '#ff9800'; // Orange color for fallback
    } else {
        locationDisplay.textContent = locationText;
        locationDisplay.style.color = ''; // Reset to default
    }
    
    // Product Image - ONLY GitHub
    const imageElement = document.getElementById('productImage');
    if (product.ItemImage) {
        // If API provides base64 image, use it
        imageElement.src = `data:image/jpeg;base64,${product.ItemImage}`;
        imageElement.onerror = () => {
            imageElement.src = CONFIG.DEFAULT_IMAGE;
        };
    } else {
        // Try GitHub image by item code
        imageElement.src = `${CONFIG.PRODUCT_IMAGE_BASE}${product.ItemCode}.png`;
        imageElement.onerror = () => {
            // Fallback to default GitHub image only
            imageElement.src = CONFIG.DEFAULT_IMAGE;
        };
    }
    
    // Stock Information
    displayStock(product.BalQty, product.UOM);
    
    // Price Information
    displayPricing(product);
    
    // Reset to slideshow after delay
    resetToSlideshow();
}

// Display Stock
function displayStock(balQty, uom) {
    const stockBadge = document.getElementById('stockBadge');
    const stockQty = document.getElementById('stockQty');
    const stockUOM = document.getElementById('stockUOM');
    
    const qty = parseFloat(balQty) || 0;
    
    stockQty.textContent = qty.toFixed(0);
    stockUOM.textContent = uom || 'Unit';
    
    // Update badge color based on stock level
    stockBadge.classList.remove('low-stock', 'out-of-stock');
    if (qty === 0) {
        stockBadge.classList.add('out-of-stock');
    } else if (qty <= 10) {
        stockBadge.classList.add('low-stock');
    }
}

// Display Pricing - FIXED to show promo even when price equals normal but has minQty
function displayPricing(product) {
    console.log('=== displayPricing called ===');
    
    const normalPrice = parseFloat(product.NormalPrice) || 0;
    const promoPrice = parseFloat(product.PromoPrice) || 0;
    const memberPrice = parseFloat(product.MemberPrice1) || 0;
    const isPromoValid = product.IsPromoValid === true || product.IsPromoValid === 'T';
    const minQty = parseFloat(product.Promotion?.MinQty);
    const maxQty = parseFloat(product.Promotion?.MaxQty);
    
    console.log('Price values:', { normalPrice, promoPrice, isPromoValid, minQty, maxQty });
    
    // Normal Price Box
    const normalPriceBox = document.getElementById('normalPriceBox');
    const normalPriceValue = document.getElementById('normalPrice');
    const normalUOM = document.getElementById('normalUOM');
    
    normalPriceValue.textContent = formatPrice(normalPrice);
    normalUOM.textContent = product.UOM || 'Unit';
    
    // Normal price always shown without strike-through
    normalPriceBox.querySelector('.price-value').classList.remove('crossed');
    
    // Promo Price Box
    const promoPriceBox = document.getElementById('promoPriceBox');
    const hasPromo = isPromoValid && promoPrice > 0 && promoPrice < normalPrice;
    
    console.log('hasPromo calculation:', hasPromo);
    
    if (hasPromo) {
        console.log('✅ SHOWING PROMO BOX');
        promoPriceBox.style.display = 'block';
        document.getElementById('promoPrice').textContent = formatPrice(promoPrice);
        document.getElementById('promoUOM').textContent = product.UOM || 'Unit';
        
        // Calculate savings
        const savings = normalPrice - promoPrice;
        document.getElementById('savingsAmount').textContent = formatPrice(savings);
        
        // Show quantity requirement ONLY if MinQty is greater than 1
        const promoQtyBox = document.getElementById('promoQuantity');
        const promoQtyText = document.getElementById('promoQtyText');
        
        if (minQty && !isNaN(minQty) && minQty > 1) {
            console.log('✅ SHOWING QUANTITY BOX (MinQty > 1)');
            
            let qtyText = `Min. Buy: ${minQty}`;
            if (maxQty && maxQty > 0 && maxQty !== minQty) {
                qtyText += ` (Max: ${maxQty})`;
            }
            qtyText += ` ${product.UOM || 'unit'}(s)`;
            
            promoQtyText.textContent = qtyText;
            promoQtyBox.style.display = 'block';
        } else {
            promoQtyBox.style.display = 'none';
        }
        
        // Display promo validity
        displayPromoValidity(product);
    } else {
        console.log('❌ NOT SHOWING PROMO BOX');
        promoPriceBox.style.display = 'none';
        const promoQtyBox = document.getElementById('promoQuantity');
        if (promoQtyBox) {
            promoQtyBox.style.display = 'none';
        }
    }
    
    // Member Price Box (only if no promo or member price is better)
    const memberPriceBox = document.getElementById('memberPriceBox');
    if (memberPrice > 0 && (!isPromoValid || !promoPrice || memberPrice < promoPrice)) {
        memberPriceBox.style.display = 'block';
        
        // Set member unit price
        document.getElementById('memberPrice').textContent = formatPrice(memberPrice);
        document.getElementById('memberUOM').textContent = product.UOM || 'Unit';
        
        // Only show total price section if MinQty > 1
        const memberTotalPriceSection = memberPriceBox.querySelector('.price-value:nth-of-type(2)');
        
        if (minQty && !isNaN(minQty) && minQty > 1) {
            const memberTotalQty = minQty;
            const memberTotalPrice = memberPrice * memberTotalQty;
            
            document.getElementById('memberTotalQty').textContent = memberTotalQty;
            document.getElementById('memberTotalPrice').textContent = formatPrice(memberTotalPrice);
            document.getElementById('memberTotalUOM').textContent = product.UOM || 'Unit';
            
            if (memberTotalPriceSection) {
                memberTotalPriceSection.style.display = 'flex';
            }
            
            const memberTotalSavings = (normalPrice * memberTotalQty) - memberTotalPrice;
            const memberSavingsElement = document.getElementById('memberSavingsAmount');
            if (memberSavingsElement) {
                memberSavingsElement.textContent = formatPrice(memberTotalSavings);
            }
            
            const memberQtyBox = document.getElementById('memberQuantity');
            const memberQtyText = document.getElementById('memberQtyText');
            
            if (memberQtyBox && memberQtyText) {
                let qtyText = `Min. Buy: ${minQty}`;
                if (maxQty && maxQty > 0 && maxQty !== minQty) {
                    qtyText += ` (Max: ${maxQty})`;
                }
                qtyText += ` ${product.UOM || 'unit'}(s)`;
                
                memberQtyText.textContent = qtyText;
                memberQtyBox.style.display = 'block';
            }
        } else {
            if (memberTotalPriceSection) {
                memberTotalPriceSection.style.display = 'none';
            }
            
            const memberSavingsSimple = normalPrice - memberPrice;
            const memberSavingsElement = document.getElementById('memberSavingsAmount');
            if (memberSavingsElement) {
                memberSavingsElement.textContent = formatPrice(memberSavingsSimple);
            }
            
            const memberQtyBox = document.getElementById('memberQuantity');
            if (memberQtyBox) {
                memberQtyBox.style.display = 'none';
            }
        }
    } else {
        memberPriceBox.style.display = 'none';
    }
    
    console.log('=== displayPricing complete ===');
}

// Display Promo Validity
function displayPromoValidity(product) {
    const promoValidity = document.getElementById('promoValidity');
    
    if (product.Promotion) {
        promoValidity.style.display = 'flex';
        
        const fromDate = product.Promotion.FromDate ? formatDate(product.Promotion.FromDate) : '-';
        const toDate = product.Promotion.ToDate ? formatDate(product.Promotion.ToDate) : '-';
        
        document.getElementById('validFrom').textContent = fromDate;
        document.getElementById('validUntil').textContent = toDate;
    } else {
        promoValidity.style.display = 'none';
    }
}

// Utility Functions
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function formatPrice(price) {
    const num = parseFloat(price) || 0;
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatNumber(num) {
    return parseFloat(num).toLocaleString('en-MY', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (error) {
        return '-';
    }
}

function normalizeKeys(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => normalizeKeys(item));
    }
    
    // Handle objects - normalize keys recursively
    const normalized = {};
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            // Capitalize first letter of key
            const newKey = key.charAt(0).toUpperCase() + key.slice(1);
            
            // Recursively normalize nested objects!
            const value = obj[key];
            if (value !== null && typeof value === 'object') {
                normalized[newKey] = normalizeKeys(value);
            } else {
                normalized[newKey] = value;
            }
        }
    }
    
    return normalized;
}

function scheduleAutoReset() {
    // Clear existing timeout
    if (state.resetTimeout) {
        clearTimeout(state.resetTimeout);
    }
    
    // Schedule new reset
    state.resetTimeout = setTimeout(() => {
        resetDisplay();
    }, CONFIG.AUTO_RESET_DELAY);
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorContent = errorMessage.querySelector('p');
    
    if (errorContent) {
        errorContent.textContent = message || 'An error occurred';
    }
    
    errorMessage.style.display = 'flex';
    document.getElementById('slideshowContainer').style.display = 'none';
    document.getElementById('priceDisplay').style.display = 'none';
    
    resetToSlideshow();
}

function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

function resetDisplay() {
    hideError();
    hideLoading();
    document.getElementById('priceDisplay').style.display = 'none';
    document.getElementById('slideshowContainer').style.display = 'block';
    startSlideshow();
}

function resetToSlideshow() {
    if (state.resetTimeout) {
        clearTimeout(state.resetTimeout);
    }
    
    state.resetTimeout = setTimeout(() => {
        resetDisplay();
    }, CONFIG.AUTO_RESET_DELAY);
}

// Event Listeners Setup
function setupEventListeners() {
    // Click anywhere to reset
    document.addEventListener('click', function(e) {
        // Don't reset if clicking on input fields or buttons
        if (e.target.tagName === 'INPUT' || 
            e.target.tagName === 'BUTTON' ||
            e.target.closest('button')) {
            return;
        }
        
        // If price display is showing, reset to slideshow
        if (document.getElementById('priceDisplay').style.display === 'block') {
            resetDisplay();
        }
    });
    
    // Escape key to reset
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            resetDisplay();
            exitFullscreen();
        }
    });
}

// Toggle Header Function
function toggleHeader() {
    const header = document.getElementById('header');
    const toggleBtn = document.getElementById('toggleHeaderBtn');
    
    if (header.style.display === 'none') {
        header.style.display = 'block';
        toggleBtn.innerHTML = '<i class="fas fa-times"></i> Close';
        // Focus on manual input when header is shown
        setTimeout(() => {
            document.getElementById('manualInput').focus();
        }, 100);
    } else {
        header.style.display = 'none';
        toggleBtn.innerHTML = '<i class="fas fa-search"></i> Search';
    }
}

// Fullscreen Functions
function requestFullscreen() {
    const elem = document.documentElement;
    
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
            console.log('Fullscreen request failed:', err);
        });
    } else if (elem.webkitRequestFullscreen) { // Safari
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { // IE/Edge
        elem.msRequestFullscreen();
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
            console.log('Exit fullscreen failed:', err);
        });
    } else if (document.webkitExitFullscreen) { // Safari
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { // IE/Edge
        document.msExitFullscreen();
    }
}

// Check if in fullscreen
function isFullscreen() {
    return !!(document.fullscreenElement || 
              document.webkitFullscreenElement || 
              document.msFullscreenElement);
}

// Listen for fullscreen changes
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('msfullscreenchange', handleFullscreenChange);

function handleFullscreenChange() {
    if (isFullscreen()) {
        console.log('Entered fullscreen mode');
        document.body.classList.add('fullscreen');
    } else {
        console.log('Exited fullscreen mode');
        document.body.classList.remove('fullscreen');
    }
}

// Expose functions to global scope for HTML onclick handlers
window.searchManual = searchManual;
window.resetDisplay = resetDisplay;
window.toggleHeader = toggleHeader;
window.goToSlide = goToSlide;

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    if (state.slideInterval) {
        clearInterval(state.slideInterval);
    }
    if (state.resetTimeout) {
        clearTimeout(state.resetTimeout);
    }
    if (state.barcodeTimeout) {
        clearTimeout(state.barcodeTimeout);
    }
    if (state.updateCheckInterval) {
        clearInterval(state.updateCheckInterval);
    }
});

console.log('Price Checker initialized successfully');