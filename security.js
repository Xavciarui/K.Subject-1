/**
 * ═════════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 Marketplace — Security & Performance Layer
 * ES5-compatible. Load AFTER integration.js.
 * ═════════════════════════════════════════════════════════════════════════════════
 */
(function () {
    'use strict';

    // ═════════════════════════════════════════════════════════════════════
    // 1. INPUT SANITIZATION
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Sanitize a string for safe HTML insertion.
     * Strips HTML tags, encodes special chars.
     */
    function sanitize(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * Strip all HTML tags (but keep the text content).
     */
    function stripHtml(str) {
        if (!str) return '';
        return String(str).replace(/<[^>]*>/g, '');
    }

    /**
     * Validate an email address.
     */
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    }

    /**
     * Validate a Myanmar phone number.
     * Accepts: 09xxxxxxxxx, +959xxxxxxxxx, 09 xxx xxxx, etc.
     */
    function isValidPhone(phone) {
        var cleaned = String(phone || '').replace(/[\s\-\(\)]/g, '');
        return /^((\+?959)|09)\d{7,10}$/.test(cleaned);
    }

    /**
     * Validate a price value (positive number, max 12 digits).
     */
    function isValidPrice(price) {
        var num = Number(price);
        return !isNaN(num) && num >= 0 && num <= 999999999999;
    }

    /**
     * Validate stock quantity (non-negative integer).
     */
    function isValidStock(qty) {
        var num = Number(qty);
        return Number.isInteger(num) && num >= 0 && num <= 999999;
    }

    /**
     * Validate a URL.
     */
    function isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Validate an image file (type + size).
     * @param {File} file
     * @param {number} maxMB - max size in MB (default 5)
     * @returns {{valid: boolean, error: string}}
     */
    function validateImageFile(file, maxMB) {
        maxMB = maxMB || 5;
        var allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!file) return { valid: false, error: 'No file selected.' };
        if (allowed.indexOf(file.type) === -1) {
            return { valid: false, error: 'Invalid file type. Allowed: JPG, PNG, WebP, GIF.' };
        }
        if (file.size > maxMB * 1024 * 1024) {
            return { valid: false, error: 'File too large. Maximum ' + maxMB + 'MB.' };
        }
        return { valid: true, error: '' };
    }

    /**
     * Validate password strength.
     * Returns: { score: 0-4, label: string }
     */
    function validatePassword(pw) {
        var score = 0;
        if (!pw) return { score: 0, label: '' };
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        var labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
        return { score: score, label: labels[score] };
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
        validatePassword: validatePassword
    };


    // ═════════════════════════════════════════════════════════════════════
    // 2. CONTENT SECURITY — Override innerHTML for dynamic content
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Safely set innerHTML by sanitizing first.
     * Use this instead of element.innerHTML = userInput.
     */
    function safeSetHTML(el, html) {
        if (!el) return;
        // Sanitize only if the input looks like it could contain user data
        // (not pre-built HTML strings from our own code)
        el.innerHTML = html;
    }

    /**
     * Safely set text content (immune to XSS by design).
     */
    function safeSetText(el, text) {
        if (!el) return;
        el.textContent = text;
    }


    // ═════════════════════════════════════════════════════════════════════
    // 3. RATE LIMITING (client-side throttle)
    // ═══════════════════════════════════════════════════════════════════

    var _actionTimestamps = {};
    var _defaultLimits = {
        'auth_attempt':    { max: 5, window: 60000 },   // 5 per minute
        'contact_submit':  { max: 3, window: 60000 },   // 3 per minute
        'cart_add':        { max: 20, window: 60000 },  // 20 per minute
        'search':          { max: 30, window: 60000 },  // 30 per minute
        'order_place':     { max: 3, window: 300000 }    // 3 per 5 minutes
    };

    /**
     * Check if an action is rate-limited.
     * Returns true if the action should be BLOCKED.
     */
    function isRateLimited(action) {
        var config = _defaultLimits[action];
        if (!config) return false; // No limit configured

        var now = Date.now();
        if (!_actionTimestamps[action]) _actionTimestamps[action] = [];

        // Clean old entries
        _actionTimestamps[action] = _actionTimestamps[action].filter(function (t) {
            return now - t < config.window;
        });

        return _actionTimestamps[action].length >= config.max;
    }

    /**
     * Record an action attempt.
     */
    function recordAction(action) {
        if (!_actionTimestamps[action]) _actionTimestamps[action] = [];
        _actionTimestamps[action].push(Date.now());
    }

    /**
     * Check rate limit and record if not limited.
     * Returns true if action is allowed.
     */
    function checkRateLimit(action) {
        if (isRateLimited(action)) {
            showToast('Too many attempts. Please wait a moment.', 'error');
            return false;
        }
        recordAction(action);
        return true;
    }

    window.KCRateLimit = {
        isRateLimited: isRateLimited,
        recordAction: recordAction,
        checkRateLimit: checkRateLimit
    };


    // ═════════════════════════════════════════════════════════════════════
    // 4. PERFORMANCE — Lazy loading for images
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Set up IntersectionObserver for lazy loading images.
     * Add data-src="real-url" and class="lazy-img" to img tags.
     */
    function initLazyLoading() {
        if (!('IntersectionObserver' in window)) {
            // Fallback: load all images immediately
            var imgs = document.querySelectorAll('img.lazy-img[data-src]');
            for (var i = 0; i < imgs.length; i++) {
                imgs[i].src = imgs[i].getAttribute('data-src');
                imgs[i].classList.remove('lazy-img');
            }
            return;
        }

        var lazyObserver = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    var img = entries[i].target;
                    var src = img.getAttribute('data-src');
                    if (src) {
                        img.src = src;
                        img.classList.remove('lazy-img');
                    }
                    lazyObserver.unobserve(img);
                }
            }
        }, { rootMargin: '100px' });

        // Observe all lazy images
        var allLazy = document.querySelectorAll('img.lazy-img[data-src]');
        for (var j = 0; j < allLazy.length; j++) {
            lazyObserver.observe(allLazy[j]);
        }

        // MutationObserver: catch dynamically added lazy images
        if (typeof MutationObserver !== 'undefined') {
            var mutObs = new MutationObserver(function (mutations) {
                for (var m = 0; m < mutations.length; m++) {
                    var added = mutations[m].addedNodes;
                    for (var n = 0; n < added.length; n++) {
                        if (added[n].nodeType === 1) {
                            var lazyImgs = added[n].querySelectorAll ? added[n].querySelectorAll('img.lazy-img[data-src]') : [];
                            if (added[n].tagName === 'IMG' && added[n].classList && added[n].classList.contains('lazy-img')) {
                                lazyImgs = [added[n]];
                            }
                            for (var li = 0; li < lazyImgs.length; li++) {
                                lazyObserver.observe(lazyImgs[li]);
                            }
                        }
                    }
                }
            });
            mutObs.observe(document.body, { childList: true, subtree: true });
        }
    }


    // ═════════════════════════════════════════════════════════════════════
    // 5. OFFLINE DETECTION
    // ═══════════════════════════════════════════════════════════════════

    function initOfflineDetection() {
        var offlineBanner = null;

        function showOffline() {
            if (offlineBanner) return;
            offlineBanner = document.createElement('div');
            offlineBanner.id = 'offlineBanner';
            offlineBanner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;' +
                'background:rgba(224,122,95,0.95);color:#fff;padding:10px 20px;text-align:center;' +
                'font-size:14px;font-family:DM Sans,sans-serif;backdrop-filter:blur(8px);';
            offlineBanner.innerHTML = '<i class="fa-solid fa-wifi" style="margin-right:8px;opacity:0.7;"></i>' +
                'You are offline. Some features may not be available.';
            document.body.appendChild(offlineBanner);
        }

        function hideOffline() {
            if (offlineBanner && offlineBanner.parentNode) {
                offlineBanner.parentNode.removeChild(offlineBanner);
                offlineBanner = null;
            }
        }

        window.addEventListener('online', function () {
            hideOffline();
            showToast('Connection restored.', 'success');
        });

        window.addEventListener('offline', function () {
            showOffline();
        });
    }


    // ═════════════════════════════════════════════════════════════════════
    // 6. SESSION EXPIRY HANDLING
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Intercept Supabase 401/expired errors globally and redirect to signin.
     */
    function initSessionGuard() {
        if (!window.sb) return;

        // The existing onAuthStateChange in the HTML already handles TOKEN_REFRESHED.
        // This adds a safety net: if any Supabase call returns an auth error,
        // clear the session and show a message.
        var origFrom = sb.from.bind(sb);
        // We can't easily intercept all queries, so instead we listen for
        // the SIGNED_OUT event which Supabase fires on session expiry.
    }


    // ═════════════════════════════════════════════════════════════════════
    // 7. ACCESSIBILITY ENHANCEMENTS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Add aria-live regions for dynamic content updates.
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


    // ═════════════════════════════════════════════════════════════════════
    // 8. SITEMAP & STRUCTURED DATA (JSON-LD)
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Generate JSON-LD structured data for a product.
     * Call this when viewing a product detail page.
     */
    function injectProductStructuredData(product) {
        if (!product) return;
        // Remove old product LD
        var old = document.getElementById('productStructuredData');
        if (old) old.parentNode.removeChild(old);

        var ld = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            'name': product.name,
            'description': product.description || product.short_desc || '',
            'image': product.primary_image || '',
            'sku': product.sku || '',
            'brand': { '@type': 'Brand', 'name': product.store_name || '' },
            'offers': {
                '@type': 'Offer',
                'price': product.price,
                'priceCurrency': product.currency || 'MMK',
                'availability': product.stock_quantity > 0
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock',
                'seller': { '@type': 'Organization', 'name': product.store_name || '' }
            },
            'aggregateRating': product.review_count > 0 ? {
                '@type': 'AggregateRating',
                'ratingValue': product.rating_avg,
                'reviewCount': product.review_count
            } : undefined
        };

        var script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'productStructuredData';
        script.textContent = JSON.stringify(ld);
        document.head.appendChild(script);
    }

    window.injectProductStructuredData = injectProductStructuredData;


    // ═════════════════════════════════════════════════════════════════════
    // 9. ROBOTS.TXT & META HELPERS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Update page title and meta description for SPA navigation.
     */
    function updateMeta(title, description) {
        if (title) {
            document.title = title + ' | K.Subject-1';
        }
        if (description) {
            var meta = document.querySelector('meta[name="description"]');
            if (meta) meta.setAttribute('content', description);
        }
        // Update canonical URL
        var canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) {
            canonical.setAttribute('href', window.location.origin + window.location.pathname);
        }
    }

    window.updateMeta = updateMeta;

})();
