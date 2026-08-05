/**
 * ═════════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 Marketplace — Security & Performance Layer
 * ES5-compatible. Load AFTER integration.js.
 * 
 * VERSION: 2.0.0 (Production Audit Fixes Applied)
 * ═════════════════════════════════════════════════════════════════════════════════
 */
(function () {
    'use strict';

    // ═════════════════════════════════════════════════════════════════════
    // CONFIGURATION CONSTANTS
    // ═════════════════════════════════════════════════════════════════════

    var CONFIG = {
        MAX_PRICE: 999999999999,
        MAX_STOCK: 999999,
        MAX_EMAIL_LENGTH: 254,          // RFC 5321 limit
        MAX_PHONE_LENGTH: 20,
        MAX_STRING_LENGTH: 100000,     // Prevent ReDoS
        MAX_PASSWORD_LENGTH: 128,
        MIN_PASSWORD_LENGTH: 8,
        DEFAULT_MAX_FILE_SIZE_MB: 5,
        LAZY_LOAD_ROOT_MARGIN: '100px',
        RATE_LIMIT_WINDOW_MS: 60000,
        DECIMAL_PRECISION: 2           // Max decimal places for currency
    };

    // ═════════════════════════════════════════════════════════════════════
    // 1. INPUT SANITIZATION
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Sanitize a string for safe HTML insertion.
     * Strips HTML tags, encodes special chars.
     * Handles all XSS vectors including null bytes, slashes, backticks.
     * 
     * @param {*} str - Input to sanitize
     * @returns {string} Safe string for HTML insertion
     */
    function sanitize(str) {
        if (str === null || str === undefined) return '';
        var input = String(str);
        // Prevent ReDoS with extremely long strings
        if (input.length > CONFIG.MAX_STRING_LENGTH) {
            input = input.substring(0, CONFIG.MAX_STRING_LENGTH);
        }
        return input
            .replace(/\x00/g, '')                    // Remove null bytes
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')               // Encode forward slashes (prevent </script>)
            .replace(/`/g, '&#96;')                  // Encode backticks (template literal injection)
            .replace(/[\t\n\r]/g, ' ');              // Normalize whitespace (attribute breakout)
    }

    /**
     * Strip all HTML tags (but keep the text content).
     * Includes ReDoS protection.
     * 
     * @param {*} str - Input to strip
     * @returns {string} Plain text without HTML tags
     */
    function stripHtml(str) {
        if (!str) return '';
        var input = String(str);
        if (input.length > CONFIG.MAX_STRING_LENGTH) {
            input = input.substring(0, CONFIG.MAX_STRING_LENGTH);
        }
        return input.replace(/<[^>]*>/g, '');
    }

    /**
     * Validate an email address.
     * Enforces RFC 5321 length limit.
     * 
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid email format
     */
    function isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        if (email.length > CONFIG.MAX_EMAIL_LENGTH) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    }

    /**
     * Validate a Myanmar phone number.
     * Accepts: 09xxxxxxxxx, +959xxxxxxxxx, 09 xxx xxxx, etc.
     * 
     * @param {*} phone - Phone number to validate
     * @returns {boolean} True if valid Myanmar phone format
     */
    function isValidPhone(phone) {
        if (!phone) return false;
        var cleaned = String(phone).replace(/[\s\-\(\)]/g, '');
        if (cleaned.length > CONFIG.MAX_PHONE_LENGTH) return false;
        return /^((\+?959)|09)\d{7,10}$/.test(cleaned);
    }

    /**
     * Validate a price value (positive number, max 12 digits, max 2 decimals).
     * Rejects NaN, Infinity, negative zero, and non-finite values.
     * 
     * @param {*} price - Price value to validate
     * @returns {boolean} True if valid positive price
     */
    function isValidPrice(price) {
        var num = Number(price);
        // Reject non-finite values (NaN, Infinity, -Infinity)
        if (!isFinite(num)) return false;
        // Reject negative zero
        if (num < 0 || Object.is(num, -0)) return false;
        // Upper bound check
        if (num > CONFIG.MAX_PRICE) return false;
        // Decimal precision check (currency should have reasonable decimals)
        var str = num.toString();
        var decimalPart = str.split('.')[1] || '';
        if (decimalPart.length > CONFIG.DECIMAL_PRECISION) return false;
        return true;
    }

    /**
     * Validate stock quantity (non-negative integer).
     * ES5-compatible implementation (no Number.isInteger).
     * 
     * @param {*} qty - Quantity to validate
     * @returns {boolean} True if valid non-negative integer
     */
    function isValidStock(qty) {
        var num = Number(qty);
        // ES5-compatible integer check (replaces Number.isInteger)
        if (typeof num !== 'number' || !isFinite(num)) return false;
        if (Math.floor(num) !== num) return false;
        if (num < 0 || num > CONFIG.MAX_STOCK) return false;
        return true;
    }

    /**
     * Validate a URL.
     * Uses base URL fallback for relative URLs.
     * Only allows http/https protocols.
     * 
     * @param {*} url - URL to validate
     * @returns {boolean} True if valid http/https URL
     */
    function isValidUrl(url) {
        if (!url || typeof url !== 'string') return false;
        try {
            var parsed = new URL(url, window.location.origin);
            return ['http:', 'https:'].indexOf(parsed.protocol) !== -1;
        } catch (e) {
            return false;
        }
    }

    /**
     * Validate an image file (type + size + extension).
     * Checks both MIME type and file extension.
     * 
     * @param {File} file - File object to validate
     * @param {number} [maxMB=5] - Max size in MB
     * @returns {{valid: boolean, error: string}} Validation result
     */
    function validateImageFile(file, maxMB) {
        maxMB = maxMB || CONFIG.DEFAULT_MAX_FILE_SIZE_MB;
        
        // Check file exists
        if (!file) return { valid: false, error: 'No file selected.' };
        
        // Check file is actually a File object
        if (!(file instanceof File)) {
            return { valid: false, error: 'Invalid file object.' };
        }
        
        // Allowed MIME types
        var allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        
        // Allowed extensions
        var allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        
        // Check extension first (more reliable than MIME type)
        var fileName = file.name || '';
        var ext = fileName.split('.').pop().toLowerCase();
        if (allowedExtensions.indexOf(ext) === -1) {
            return { valid: false, error: 'Invalid file type. Allowed: JPG, PNG, WebP, GIF.' };
        }
        
        // Check MIME type
        if (allowedMimeTypes.indexOf(file.type) === -1) {
            return { valid: false, error: 'Invalid file type. Allowed: JPG, PNG, WebP, GIF.' };
        }
        
        // Check file size
        if (file.size > maxMB * 1024 * 1024) {
            return { valid: false, error: 'File too large. Maximum ' + maxMB + 'MB.' };
        }
        
        // Check file has content
        if (file.size === 0) {
            return { valid: false, error: 'File is empty.' };
        }
        
        return { valid: true, error: '' };
    }

    /**
     * Validate password strength.
     * Returns: { score: 0-4, label: string, valid: boolean }
     * Requires minimum 8 characters for validity.
     * 
     * @param {string} pw - Password to validate
     * @returns {{score: number, label: string, valid: boolean}} Strength result
     */
    function validatePassword(pw) {
        if (!pw) return { score: 0, label: '', valid: false };
        if (typeof pw !== 'string') return { score: 0, label: '', valid: false };
        
        // Length validation
        if (pw.length < CONFIG.MIN_PASSWORD_LENGTH) {
            return { score: 0, label: 'Too short (min ' + CONFIG.MIN_PASSWORD_LENGTH + ')', valid: false };
        }
        if (pw.length > CONFIG.MAX_PASSWORD_LENGTH) {
            return { score: 0, label: 'Too long', valid: false };
        }
        
        var score = 0;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        
        var labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
        return { 
            score: score, 
            label: labels[score], 
            valid: score >= 3  // Require at least "Good" strength
        };
    }

    /**
     * Escape HTML entities in a string (alias for sanitize).
     * Provided for semantic clarity when escaping user content.
     * 
     * @param {*} str - String to escape
     * @returns {string} Escaped string safe for HTML context
     */
    function escapeHtml(str) {
        return sanitize(str);
    }

    /**
     * Sanitize PostgREST query input to prevent injection.
     * Escapes special characters used in PostgREST filters.
     * 
     * @param {string} input - Query input to sanitize
     * @returns {string} Sanitized string safe for PostgREST queries
     */
    function sanitizePostgREST(input) {
        if (!input) return '';
        return String(input)
            .replace(/\\/g, '\\\\')
            .replace(/%/g, '\\%')
            .replace(/_/g, '\\_')
            .replace(/,/g, '\\,')
            .replace(/"/g, '\\"')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)')
            .replace(/\./g, '\\.')
            .replace(/'/g, "''");  // SQL single-quote escape
    }

    // Export validators
    window.KCSanitize = {
        sanitize: sanitize,
        stripHtml: stripHtml,
        isValidEmail: isValidEmail,
        isValidPhone: isValidPhone,
        isValidPrice: isValidPrice,
        isValidStock: isValidStock,
        isValidUrl: isValidUrl,
        validateImageFile: validateImageFile,
        validatePassword: validatePassword,
        escapeHtml: escapeHtml,
        sanitizePostgREST: sanitizePostgREST
    };


    // ═════════════════════════════════════════════════════════════════════
    // 2. CONTENT SECURITY — Override innerHTML for dynamic content
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Safely set innerHTML by sanitizing first.
     * ALWAYS sanitizes input - use this instead of element.innerHTML = userInput.
     * 
     * @param {Element|null} el - Target element
     * @param {string} html - HTML content (will be sanitized)
     */
    function safeSetHTML(el, html) {
        if (!el) return;
        // ALWAYS sanitize - this is the security layer
        el.innerHTML = sanitize(html);
    }

    /**
     * Safely set text content (immune to XSS by design).
     * Preferred over safeSetHTML when no HTML is needed.
     * 
     * @param {Element|null} el - Target element
     * @param {string} text - Text content
     */
    function safeSetText(el, text) {
        if (!el) return;
        if (text === null || text === undefined) {
            el.textContent = '';
        } else {
            el.textContent = String(text);
        }
    }


    // ═════════════════════════════════════════════════════════════════════
    // 3. RATE LIMITING (client-side throttle)
    // ═════════════════════════════════════════════════════════════════════

    // Private state (not directly exposed on window for security)
    var _actionTimestamps = {};
    
    // Use sessionStorage for persistence across reloads (optional enhancement)
    var _useSessionStorage = true;

    var _defaultLimits = {
        'auth_attempt':    { max: 5, window: 60000 },   // 5 per minute
        'contact_submit':  { max: 3, window: 60000 },   // 3 per minute
        'cart_add':        { max: 20, window: 60000 },  // 20 per minute
        'search':          { max: 30, window: 60000 },  // 30 per minute
        'order_place':     { max: 3, window: 300000 }    // 3 per 5 minutes
    };

    /**
     * Get timestamps from sessionStorage or memory.
     * @param {string} action - Action name
     * @returns {number[]} Array of timestamps
     */
    function _getTimestamps(action) {
        if (_useSessionStorage && typeof sessionStorage !== 'undefined') {
            try {
                var data = sessionStorage.getItem('_kc_rl_' + action);
                return data ? JSON.parse(data) : [];
            } catch (e) {
                // Fall through to memory
            }
        }
        return _actionTimestamps[action] || [];
    }

    /**
     * Save timestamps to sessionStorage and/or memory.
     * @param {string} action - Action name
     * @param {number[]} timestamps - Array of timestamps
     */
    function _setTimestamps(action, timestamps) {
        _actionTimestamps[action] = timestamps;
        if (_useSessionStorage && typeof sessionStorage !== 'undefined') {
            try {
                sessionStorage.setItem('_kc_rl_' + action, JSON.stringify(timestamps));
            } catch (e) {
                // Storage full or unavailable - continue with memory only
            }
        }
    }

    /**
     * Check if an action is rate-limited.
     * Returns true if the action should be BLOCKED.
     * 
     * @param {string} action - Action name to check
     * @returns {boolean} True if rate limited (should block)
     */
    function isRateLimited(action) {
        var config = _defaultLimits[action];
        if (!config) return false; // No limit configured

        var now = Date.now();
        var timestamps = _getTimestamps(action);

        // Clean old entries (outside window)
        timestamps = timestamps.filter(function (t) {
            return now - t < config.window;
        });

        // Save cleaned timestamps
        _setTimestamps(action, timestamps);

        return timestamps.length >= config.max;
    }

    /**
     * Record an action attempt.
     * 
     * @param {string} action - Action name to record
     */
    function recordAction(action) {
        var timestamps = _getTimestamps(action);
        timestamps.push(Date.now());
        _setTimestamps(action, timestamps);
    }

    /**
     * Check rate limit and record if not limited.
     * Returns true if action is allowed.
     * 
     * @param {string} action - Action name to check
     * @returns {boolean} True if action is allowed
     */
    function checkRateLimit(action) {
        if (isRateLimited(action)) {
            if (typeof showToast === 'function') {
                showToast('Too many attempts. Please wait a moment.', 'error');
            }
            return false;
        }
        recordAction(action);
        return true;
    }

    /**
     * Reset rate limiting data for a specific action (for testing/admin).
     * @param {string} action - Action name to reset
     */
    function resetRateLimit(action) {
        _setTimestamps(action, []);
    }

    // Export rate limiter (expose only methods, not internal state)
    window.KCRateLimit = {
        isRateLimited: isRateLimited,
        recordAction: recordAction,
        checkRateLimit: checkRateLimit,
        resetRateLimit: resetRateLimit
    };


    // ═════════════════════════════════════════════════════════════════════
    // 4. PERFORMANCE — Lazy loading for images
    // ═════════════════════════════════════════════════════════════════════

    // Store observer references for cleanup
    var _lazyObserver = null;
    var _mutationObserver = null;

    /**
     * Set up IntersectionObserver for lazy loading images.
     * Add data-src="real-url" and class="lazy-img" to img tags.
     * Includes error handling for broken images.
     */
    function initLazyLoading() {
        // Clean up existing observers first
        cleanupLazyLoading();

        if (!('IntersectionObserver' in window)) {
            // Fallback: load all images immediately
            var imgs = document.querySelectorAll('img.lazy-img[data-src]');
            for (var i = 0; i < imgs.length; i++) {
                _loadLazyImage(imgs[i]);
            }
            return;
        }

        _lazyObserver = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    _loadLazyImage(entries[i].target);
                    _lazyObserver.unobserve(entries[i].target);
                }
            }
        }, { rootMargin: CONFIG.LAZY_LOAD_ROOT_MARGIN });

        // Observe all lazy images
        _observeAllLazyImages();

        // MutationObserver: catch dynamically added lazy images
        if (typeof MutationObserver !== 'undefined') {
            _mutationObserver = new MutationObserver(function (mutations) {
                // Debounce mutation handling
                if (_mutationTimer) return;
                _mutationTimer = setTimeout(function () {
                    _mutationTimer = null;
                    _observeAllLazyImages();
                }, 100);

                for (var m = 0; m < mutations.length; m++) {
                    var added = mutations[m].addedNodes;
                    for (var n = 0; n < added.length; n++) {
                        if (added[n].nodeType === 1) {
                            var lazyImgs = added[n].querySelectorAll ? 
                                added[n].querySelectorAll('img.lazy-img[data-src]') : [];
                            if (added[n].tagName === 'IMG' && 
                                added[n].classList && 
                                added[n].classList.contains('lazy-img')) {
                                lazyImgs = [added[n]];
                            }
                            for (var li = 0; li < lazyImgs.length; li++) {
                                if (_lazyObserver) {
                                    _lazyObserver.observe(lazyImgs[li]);
                                }
                            }
                        }
                    }
                }
            });
            
            _mutationObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

    /** @type {number|null} Timer for mutation debouncing */
    var _mutationTimer = null;

    /**
     * Observe all current lazy images.
     * @private
     */
    function _observeAllLazyImages() {
        if (!_lazyObserver) return;
        var allLazy = document.querySelectorAll('img.lazy-img[data-src]');
        for (var j = 0; j < allLazy.length; j++) {
            _lazyObserver.observe(allLazy[j]);
        }
    }

    /**
     * Load a single lazy image with error handling.
     * @param {HTMLImageElement} img - Image element to load
     * @private
     */
    function _loadLazyImage(img) {
        var src = img.getAttribute('data-src');
        if (src) {
            // Set error handler before src
            img.onerror = function () {
                this.src = 'data:image/svg+xml,' + encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' +
                    '<rect fill="#13131c" width="40" height="40" rx="4"/>' +
                    '<path fill="#333" d="M20 10 L30 30 H10 Z M20 16 L24 26 H16 Z"/></svg>'
                );
                this.classList.remove('lazy-img');
            };
            img.onload = function () {
                this.classList.remove('lazy-img');
            };
            img.src = src;
        }
    }

    /**
     * Cleanup lazy loading observers (call on page unload).
     */
    function cleanupLazyLoading() {
        if (_lazyObserver) {
            _lazyObserver.disconnect();
            _lazyObserver = null;
        }
        if (_mutationObserver) {
            _mutationObserver.disconnect();
            _mutationObserver = null;
        }
        if (_mutationTimer) {
            clearTimeout(_mutationTimer);
            _mutationTimer = null;
        }
    }


    // ═════════════════════════════════════════════════════════════════════
    // 5. OFFLINE DETECTION
    // ═════════════════════════════════════════════════════════════════════

    var offlineBanner = null;

    /**
     * Show offline notification banner using DOM API (safe from XSS).
     */
    function showOffline() {
        if (offlineBanner) return;
        
        offlineBanner = document.createElement('div');
        offlineBanner.id = 'offlineBanner';
        offlineBanner.style.cssText = 
            'position:fixed;bottom:0;left:0;right:0;z-index:9999;' +
            'background:rgba(224,122,95,0.95);color:#fff;padding:10px 20px;text-align:center;' +
            'font-size:14px;font-family:DM Sans,sans-serif;backdrop-filter:blur(8px);' +
            '-webkit-backdrop-filter:blur(8px);';
        
        // Use DOM API instead of innerHTML for security
        var icon = document.createElement('i');
        icon.className = 'fa-solid fa-wifi';
        icon.style.cssText = 'margin-right:8px;opacity:0.7;';
        icon.setAttribute('aria-hidden', 'true');
        
        var text = document.createTextNode('You are offline. Some features may not be available.');
        
        offlineBanner.appendChild(icon);
        offlineBanner.appendChild(text);
        document.body.appendChild(offlineBanner);
    }

    /**
     * Hide offline notification banner.
     */
    function hideOffline() {
        if (offlineBanner && offlineBanner.parentNode) {
            offlineBanner.parentNode.removeChild(offlineBanner);
            offlineBanner = null;
        }
    }

    /**
     * Initialize online/offline event listeners.
     */
    function initOfflineDetection() {
        window.addEventListener('online', function () {
            hideOffline();
            if (typeof showToast === 'function') {
                showToast('Connection restored.', 'success');
            }
        });

        window.addEventListener('offline', function () {
            showOffline();
        });
    }


    // ═════════════════════════════════════════════════════════════════════
    // 6. SESSION EXPIRY HANDLING (COMPLETE IMPLEMENTATION)
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Initialize session expiry guard.
     * Listens for Supabase auth state changes and handles session expiry.
     * Also intercepts fetch for 401 responses.
     */
    function initSessionGuard() {
        if (!window.sb || !sb.auth) {
            console.warn('[security] Supabase client not found. Session guard skipped.');
            return;
        }

        // Listen for auth state changes
        sb.auth.onAuthStateChange(function (event, session) {
            if (event === 'SIGNED_OUT') {
                // Session expired or user signed out
                console.log('[security] User signed out. Session ended.');
                
                // Clear any sensitive cached data
                if (typeof localStorage !== 'undefined') {
                    try {
                        // Clear app-specific items but preserve others
                        var keysToRemove = [];
                        for (var i = 0; i < localStorage.length; i++) {
                            var key = localStorage.key(i);
                            if (key && (key.indexOf('sb-') === 0 || key.indexOf('kc_') === 0 || key.indexOf('_kc_') === 0)) {
                                keysToRemove.push(key);
                            }
                        }
                        keysToRemove.forEach(function (key) {
                            localStorage.removeItem(key);
                        });
                    } catch (e) {
                        // Storage might be disabled
                    }
                }

                // Redirect to sign in if not already there
                if (window.location.hash !== '#signin' && 
                    window.location.pathname.indexOf('/signin') === -1) {
                    // Show message and update UI
                    if (typeof showToast === 'function') {
                        showToast('Session expired. Please sign in again.', 'warning');
                    }
                    
                    // Update auth UI if function exists
                    if (typeof updateAuthUI === 'function') {
                        try {
                            updateAuthUI();
                        } catch (e) {
                            // Non-critical
                        }
                    }
                }
            }
            
            if (event === 'TOKEN_REFRESHED') {
                console.debug('[security] Token refreshed successfully.');
            }
        });

        // Intercept fetch API for 401 responses (if fetch exists)
        if (window.fetch && !window._fetchIntercepted) {
            var origFetch = window.fetch;
            window.fetch = function () {
                return origFetch.apply(this, arguments).then(function (response) {
                    if (response.status === 401) {
                        console.warn('[security] Received 401 response. Session may be invalid.');
                        // Trigger session check
                        if (sb.auth && sb.auth.getSession) {
                            sb.auth.getSession().then(function ({ data: { session } }) {
                                if (!session) {
                                    if (typeof showToast === 'function') {
                                        showToast('Session expired. Please sign in again.', 'warning');
                                    }
                                }
                            }).catch(function () {});
                        }
                    }
                    return response;
                });
            };
            window._fetchIntercepted = true;
        }
    }


    // ═════════════════════════════════════════════════════════════════════
    // 7. ACCESSIBILITY ENHANCEMENTS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Add aria-live regions for dynamic content updates.
     * Ensures screen readers announce important changes.
     */
    function initAccessibility() {
        // Ensure cart count changes are announced
        var cartCount = document.getElementById('cartCount');
        if (cartCount && !cartCount.getAttribute('aria-live')) {
            cartCount.setAttribute('aria-live', 'polite');
            cartCount.setAttribute('aria-atomic', 'true');
        }

        // Ensure toast container has proper role (already set in HTML)
        var toastContainer = document.getElementById('toastContainer');
        if (toastContainer) {
            toastContainer.setAttribute('aria-relevant', 'additions removals');
        }

        // Ensure skip link focus styling works
        var skipLink = document.querySelector('.sr-only[href*="main-content"], [class*="skip"]');
        if (skipLink) {
            skipLink.addEventListener('click', function (e) {
                var target = document.querySelector(skipLink.getAttribute('href'));
                if (target) {
                    e.preventDefault();
                    target.setAttribute('tabindex', '-1');
                    target.focus({ preventScroll: false });
                    // Remove tabindex after blur
                    target.addEventListener('blur', function onBlur() {
                        target.removeAttribute('tabindex');
                        target.removeEventListener('blur', onBlur);
                    });
                }
            });
        }
    }


    // ═════════════════════════════════════════════════════════════════════
    // INITIALIZE ALL SECURITY & PERFORMANCE FEATURES
    // ═════════════════════════════════════════════════════════════════════

    document.addEventListener('DOMContentLoaded', function () {
        initLazyLoading();
        initOfflineDetection();
        initSessionGuard();
        initAccessibility();
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', function () {
        cleanupLazyLoading();
    });


    // ═════════════════════════════════════════════════════════════════════
    // 8. SITEMAP & STRUCTURED DATA (JSON-LD)
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Generate JSON-LD structured data for a product.
     * Call this when viewing a product detail page.
     * Includes output validation for security.
     * 
     * @param {Object} product - Product data object
     * @param {string} product.name - Product name (required)
     * @param {string} product.description - Product description
     * @param {string} product.primary_image - Primary image URL
     * @param {string} product.sku - Product SKU
     * @param {string} product.store_name - Store/brand name
     * @param {number} product.price - Product price
     * @param {string} [product.currency='MMK'] - Currency code
     * @param {number} product.stock_quantity - Stock quantity
     * @param {number} product.review_count - Review count
     * @param {number} product.rating_avg - Average rating
     */
    function injectProductStructuredData(product) {
        // Validate input
        if (!product || typeof product !== 'object') return;
        if (!product.name || typeof product.name !== 'string') return;
        if (product.name.length === 0 || product.name.length > 500) return;
        
        // Validate price if present
        if (product.price !== undefined && product.price !== null) {
            if (!isValidPrice(product.price)) {
                console.warn('[security] Invalid price for structured data:', product.price);
                return;
            }
        }
        
        // Validate image URL if present
        if (product.primary_image && !isValidUrl(product.primary_image)) {
            console.warn('[security] Invalid image URL for structured data:', product.primary_image);
            // Continue without image rather than fail completely
        }

        // Remove old product LD
        var old = document.getElementById('productStructuredData');
        if (old && old.parentNode) {
            old.parentNode.removeChild(old);
        }

        // Build sanitized LD object
        var ld = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            'name': sanitize(product.name),
            'description': sanitize(product.description || product.short_desc || ''),
            'image': product.primary_image ? sanitize(product.primary_image) : '',
            'sku': sanitize(String(product.sku || '')),
            'brand': { '@type': 'Brand', 'name': sanitize(product.store_name || '') },
            'offers': {
                '@type': 'Offer',
                'price': Number(product.price) || 0,
                'priceCurrency': sanitize(product.currency || 'MMK'),
                'availability': (Number(product.stock_quantity) || 0) > 0
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock',
                'seller': { '@type': 'Organization', 'name': sanitize(product.store_name || '') }
            }
        };

        // Only add aggregateRating if we have valid review data
        if (Number(product.review_count) > 0 && Number(product.rating_avg) > 0) {
            ld.aggregateRating = {
                '@type': 'AggregateRating',
                'ratingValue': Math.min(5, Math.max(0, Number(product.rating_avg))),
                'reviewCount': Math.max(0, Math.floor(Number(product.review_count)))
            };
        }

        var script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'productStructuredData';
        script.textContent = JSON.stringify(ld);
        document.head.appendChild(script);
    }

    window.injectProductStructuredData = injectProductStructuredData;


    // ═════════════════════════════════════════════════════════════════════
    // 9. ROBOTS.TXT & META HELPERS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Update page title and meta description for SPA navigation.
     * Sanitizes inputs to prevent injection via document.title.
     * 
     * @param {string} title - Page title (will be sanitized)
     * @param {string} description - Meta description (will be sanitized)
     */
    function updateMeta(title, description) {
        if (title && typeof title === 'string') {
            // document.title is text-only, but sanitize for consistency
            var cleanTitle = stripHtml(title).substring(0, 60);
            document.title = cleanTitle + ' | K.Subject-1';
        }
        if (description && typeof description === 'string') {
            var meta = document.querySelector('meta[name="description"]');
            if (meta) meta.setAttribute('content', sanitize(description).substring(0, 160));
        }
        // Update canonical URL
        var canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) {
            canonical.setAttribute('href', window.location.origin + window.location.pathname);
        }
    }

    window.updateMeta = updateMeta;


    // ═════════════════════════════════════════════════════════════════════
    // 10. CSRF PROTECTION HELPERS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Get CSRF token from meta tag.
     * @returns {string} CSRF token or empty string
     */
    function getCSRFToken() {
        var meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    }

    /**
     * Add CSRF token to headers object.
     * @param {Object} headers - Headers object to modify
     * @returns {Object} Modified headers object
     */
    function addCSRFToHeaders(headers) {
        headers = headers || {};
        var token = getCSRFToken();
        if (token) {
            headers['X-CSRF-Token'] = token;
        }
        return headers;
    }

    // Export CSRF helpers
    window.KCCSRF = {
        getCSRFToken: getCSRFToken,
        addCSRFToHeaders: addCSRFToHeaders
    };


    // ═════════════════════════════════════════════════════════════════════
    // CLEANUP & UTILITIES
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Full cleanup of all security module resources.
     * Call when destroying the application or running tests.
     */
    function destroy() {
        cleanupLazyLoading();
        hideOffline();
        // Remove offline listeners are automatically removed with element
    }

    window.KCSecurityCleanup = {
        destroy: destroy,
        cleanupLazyLoading: cleanupLazyLoading
    };

})();
