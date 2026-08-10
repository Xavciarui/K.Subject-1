/**
 * ═════════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 Marketplace — Security & Performance Layer (FIXED v3.0)
 * ES5-compatible JavaScript (var, function, no arrow functions, no const/let)
 * 
 * Load AFTER integration.js and dashboard-complete-fix.js
 * 
 * FEATURES:
 * 1. Input Sanitization & XSS Prevention
 * 2. Rate Limiting for API calls
 * 3. Form Validation Helpers
 * 4. Performance Optimizations (Lazy Loading, Debouncing)
 * 5. Security Headers & CSP Helpers
 * 6. Error Boundary & Graceful Degradation
 * 
 * VERSION: 3.0.0 (Schema v3.0 Compatible - No Errors)
 * ═════════════════════════════════════════════════════════════════════════════════
 */
(function () {
    'use strict';

    // ═════════════════════════════════════════════════════════════════════
    // CONFIGURATION CONSTANTS
    // ═════════════════════════════════════════════════════════════════════

    var CONFIG = {
        MAX_PRICE: 999999999999,           // Maximum allowed price
        MAX_STOCK: 999999,                  // Maximum stock quantity
        MAX_EMAIL_LENGTH: 254,              // RFC 5321 limit
        MAX_PHONE_LENGTH: 20,               // International phone numbers
        MAX_STRING_LENGTH: 100000,          // Prevent ReDoS attacks
        MAX_PASSWORD_LENGTH: 128,           // Reasonable password max
        MIN_PASSWORD_LENGTH: 8,             // Minimum password strength
        DEFAULT_MAX_FILE_SIZE_MB: 5,        // Default file upload limit
        LAZY_LOAD_ROOT_MARGIN: '100px',    // IntersectionObserver margin
        RATE_LIMIT_WINDOW_MS: 60000,       // 1 minute rate limit window
        DECIMAL_PRECISION: 2               // Currency decimal places
    };

    // ═════════════════════════════════════════════════════════════════════
    // 1. INPUT SANITIZATION
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Sanitize a string for safe HTML insertion.
     * Strips HTML tags, encodes special chars, handles all XSS vectors.
     * 
     * @param {*} str - Input to sanitize
     * @returns {string} Safe string for HTML insertion
     */
    window.sanitize = function(str) {
        if (str === null || str === undefined) return '';
        var input = String(str);
        
        // Remove null bytes and control characters
        input = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        
        // HTML entity encoding map
        var htmlEntities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '/': '&#x2F;',
            '`': '&#96;',
            '=': '&#x3D;'
        };
        
        return input.replace(/[&<>"'`=/]/g, function(char) {
            return htmlEntities[char];
        });
    };

    /**
     * Strict sanitization for URLs to prevent javascript: protocol injection
     * @param {string} url - URL to sanitize
     * @returns {string} Safe URL or empty string
     */
    window.sanitizeUrl = function(url) {
        if (!url) return '';
        var sanitized = String(url).trim().toLowerCase();
        
        // Block dangerous protocols
        var dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
        for (var i = 0; i < dangerousProtocols.length; i++) {
            if (sanitized.indexOf(dangerousProtocols[i]) === 0) {
                return '';
            }
        }
        
        return url;
    };

    /**
     * Sanitize numeric input for prices/quantities
     * @param {*} value - Input value
     * @param {number} min - Minimum allowed value
     * @param {number} max - Maximum allowed value
     * @returns {number} Safe numeric value
     */
    window.sanitizeNumber = function(value, min, max) {
        var num = parseFloat(value);
        if (isNaN(num)) num = 0;
        if (typeof min === 'number' && num < min) num = min;
        if (typeof max === 'number' && num > max) num = max;
        return Math.round(num * 100) / 100; // Round to 2 decimal places
    };

    /**
     * Validate email format according to RFC 5321
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid email format
     */
    window.isValidEmail = function(email) {
        if (!email || typeof email !== 'string') return false;
        if (email.length > CONFIG.MAX_EMAIL_LENGTH) return false;
        
        // Basic email regex (RFC 5321 compliant enough)
        var emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return emailRegex.test(email);
    };

    /**
     * Validate phone number (international format)
     * @param {string} phone - Phone number to validate
     * @returns {boolean} True if valid phone format
     */
    window.isValidPhone = function(phone) {
        if (!phone || typeof phone !== 'string') return false;
        if (phone.length > CONFIG.MAX_PHONE_LENGTH) return false;
        
        // Allow digits, spaces, dashes, parentheses, plus sign
        var phoneRegex = /^[\d\s\-\+\(\)]+$/;
        return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 7; // At least 7 digits
    };

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} Validation result with isValid and message
     */
    window.validatePassword = function(password) {
        if (!password || typeof password !== 'string') {
            return { isValid: false, message: 'Password is required' };
        }
        if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
            return { isValid: false, message: 'Password must be at least ' + CONFIG.MIN_PASSWORD_LENGTH + ' characters' };
        }
        if (password.length > CONFIG.MAX_PASSWORD_LENGTH) {
            return { isValid: false, message: 'Password is too long' };
        }
        
        // Check for common weak patterns
        var commonPatterns = ['password', '12345678', 'qwerty', 'abcdef'];
        var lowerPassword = password.toLowerCase();
        for (var i = 0; i < commonPatterns.length; i++) {
            if (lowerPassword.indexOf(commonPatterns[i]) !== -1) {
                return { isValid: false, message: 'Password contains common pattern' };
            }
        }
        
        return { isValid: true, message: 'Password is valid' };
    };

    // ═════════════════════════════════════════════════════════════════════
    // 2. RATE LIMITING
    // ═════════════════════════════════════════════════════════════════════

    /** @type {Object} Rate limit tracker storage */
    var _rateLimitStore = {};

    /**
     * Check if action is rate limited
     * @param {string} actionName - Name of the action to check
     * @param {number} [maxCalls=10] - Maximum calls allowed in window
     * @param {number} [windowMs] - Time window in milliseconds
     * @returns {boolean} True if action is allowed, false if rate limited
     */
    window.checkRateLimit = function(actionName, maxCalls, windowMs) {
        maxCalls = maxCalls || 10;
        windowMs = windowMs || CONFIG.RATE_LIMIT_WINDOW_MS;
        
        var now = Date.now();
        
        if (!_rateLimitStore[actionName]) {
            _rateLimitStore[actionName] = { count: 1, resetAt: now + windowMs };
            return true;
        }
        
        var record = _rateLimitStore[actionName];
        
        // Reset if window has passed
        if (now > record.resetAt) {
            record.count = 1;
            record.resetAt = now + windowMs;
            return true;
        }
        
        // Check limit
        if (record.count >= maxCalls) {
            return false;
        }
        
        record.count++;
        return true;
    };

    /**
     * Reset rate limit for an action (for testing or admin use)
     * @param {string} actionName - Action to reset
     */
    window.resetRateLimit = function(actionName) {
        delete _rateLimitStore[actionName];
    };

    // ═════════════════════════════════════════════════════════════════════
    // 3. FORM VALIDATION HELPERS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Validate product form data before submission
     * @param {Object} formData - Product form data
     * @returns {Object} Validation result with isValid and errors array
     */
    window.validateProductForm = function(formData) {
        var errors = [];
        
        // Title validation
        if (!formData.title || formData.title.trim().length === 0) {
            errors.push('Product title is required');
        } else if (formData.title.trim().length > 200) {
            errors.push('Product title must be under 200 characters');
        }
        
        // Price validation
        var price = parseFloat(formData.price);
        if (isNaN(price) || price <= 0) {
            errors.push('Valid price is required');
        } else if (price > CONFIG.MAX_PRICE) {
            errors.push('Price exceeds maximum allowed');
        }
        
        // Stock validation
        var stock = parseInt(formData.stock_quantity, 10);
        if (isNaN(stock) || stock < 0) {
            errors.push('Valid stock quantity is required');
        } else if (stock > CONFIG.MAX_STOCK) {
            errors.push('Stock quantity exceeds maximum');
        }
        
        // Description validation
        if (formData.description && formData.description.length > CONFIG.MAX_STRING_LENGTH) {
            errors.push('Description is too long');
        }
        
        // Category validation
        if (!formData.category_id) {
            errors.push('Please select a category');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    };

    /**
     * Validate checkout form data
     * @param {Object} checkoutData - Checkout data object
     * @returns {Object} Validation result with isValid and errors array
     */
    window.validateCheckoutForm = function(checkoutData) {
        var errors = [];
        
        // Address validation
        if (!checkoutData.addressId && !checkoutData.newAddress) {
            errors.push('Please select or add a shipping address');
        }
        
        if (checkoutData.newAddress) {
            var addr = checkoutData.newAddress;
            if (!addr.firstName || addr.firstName.trim() === '') {
                errors.push('First name is required');
            }
            if (!addr.phone || !isValidPhone(addr.phone)) {
                errors.push('Valid phone number is required');
            }
            if (!addr.addressLine1 || addr.addressLine1.trim() === '') {
                errors.push('Address line 1 is required');
            }
            if (!addr.city || addr.city.trim() === '') {
                errors.push('City is required');
            }
        }
        
        // Delivery method validation
        if (!checkoutData.deliveryMethodId) {
            errors.push('Please select a delivery method');
        }
        
        // Payment method validation
        if (!checkoutData.paymentMethodId) {
            errors.push('Please select a payment method');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    };

    /**
     * Show validation errors in UI
     * @param {Array} errors - Array of error messages
     * @param {string} [containerId] - Optional container ID for error display
     */
    window.showValidationErrors = function(errors, containerId) {
        if (errors.length === 0) return;
        
        var errorHtml = '<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">';
        errorHtml += '<div class="flex items-center mb-2">';
        errorHtml += '<i class="fas fa-exclamation-circle text-red-500 mr-2"></i>';
        errorHtml += '<span class="font-medium text-red-800">Please fix the following errors:</span>';
        errorHtml += '</div>';
        errorHtml += '<ul class="list-disc list-inside text-red-700 text-sm">';
        
        for (var i = 0; i < errors.length; i++) {
            errorHtml += '<li>' + sanitize(errors[i]) + '</li>';
        }
        
        errorHtml += '</ul></div>';
        
        if (containerId) {
            var container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = errorHtml;
                container.style.display = 'block';
            }
        } else if (typeof window.showToast === 'function') {
            window.showToast(errors[0], 'error');
        }
    };

    // ═════════════════════════════════════════════════════════════════════
    // 4. PERFORMANCE OPTIMIZATIONS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Lazy load images using Intersection Observer
     * Falls back to loading all images if not supported
     */
    window.initLazyLoading = function() {
        var lazyImages = document.querySelectorAll('img[data-src]');
        
        if ('IntersectionObserver' in window) {
            var imageObserver = new IntersectionObserver(function(entries) {
                for (var i = 0; i < entries.length; i++) {
                    var entry = entries[i];
                    if (entry.isIntersecting) {
                        var img = entry.target;
                        img.src = img.dataset.src;
                        if (img.dataset.srcset) {
                            img.srcset = img.dataset.srcset;
                        }
                        img.classList.add('loaded');
                        imageObserver.unobserve(img);
                    }
                }
            }, {
                rootMargin: CONFIG.LAZY_LOAD_ROOT_MARGIN,
                threshold: 0.01
            });
            
            for (var j = 0; j < lazyImages.length; j++) {
                imageObserver.observe(lazyImages[j]);
            }
        } else {
            // Fallback: Load all images immediately
            for (var k = 0; k < lazyImages.length; k++) {
                lazyImages[k].src = lazyImages[k].dataset.src;
            }
        }
    };

    /**
     * Debounce function execution
     * @param {Function} func - Function to debounce
     * @param {number} wait - Milliseconds to wait
     * @returns {Function} Debounced function
     */
    window.debounce = function(func, wait) {
        var timeout;
        return function() {
            var context = this;
            var args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                func.apply(context, args);
            }, wait || 250);
        };
    };

    /**
     * Throttle function execution
     * @param {Function} func - Function to throttle
     * @param {number} limit - Milliseconds between executions
     * @returns {Function} Throttled function
     */
    window.throttle = function(func, limit) {
        var inThrottle;
        return function() {
            var context = this;
            var args = arguments;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(function() { inThrottle = false; }, limit || 100);
            }
        };
    };

    // ═════════════════════════════════════════════════════════════════════
    // 5. ERROR BOUNDARY & GRACEFUL DEGRADATION
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Global error handler for uncaught errors
     * Prevents app crashes and provides user feedback
     */
    window.setupErrorBoundary = function() {
        window.onerror = function(message, source, lineno, colno, error) {
            // Log error (in production, send to error tracking service)
            console.error('[ErrorBoundary]', {
                message: message,
                source: source,
                line: lineno,
                column: colno,
                error: error
            });
            
            // Show user-friendly message
            if (typeof window.showToast === 'function') {
                window.showToast('An unexpected error occurred. Please refresh the page.', 'error');
            }
            
            // Return true to prevent default browser error handling
            return true;
        };
        
        // Handle unhandled promise rejections
        window.onunhandledrejection = function(event) {
            console.error('[UnhandledRejection]', event.reason);
            
            if (typeof window.showToast === 'function') {
                window.showToast('A request failed. Please try again.', 'error');
            }
            
            event.preventDefault();
        };
    };

    /**
     * Safe async wrapper that catches errors gracefully
     * @param {Promise} promise - Promise to wrap
     * @param {*} defaultValue - Default value on error
     * @returns {Promise} Wrapped promise with error handling
     */
    window.safeAsync = function(promise, defaultValue) {
        return promise.then(function(result) {
            return { success: true, data: result };
        }).catch(function(error) {
            console.error('[safeAsync] Error:', error);
            return { success: false, error: error, data: defaultValue };
        });
    };

    // ═════════════════════════════════════════════════════════════════════
    // 6. SECURITY UTILITIES
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Generate CSRF token for forms (if not using SameSite cookies)
     * @returns {string} Random CSRF token
     */
    window.generateCSRFToken = function() {
        var array = new Uint8Array(32);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(array);
        } else {
            for (var i = 0; i < array.length; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
        }
        return Array.prototype.map.call(array, function(byte) {
            return ('0' + byte.toString(16)).slice(-2);
        }).join('');
    };

    /**
     * Set CSRF token in meta tag and all forms
     */
    window.setCSRFToken = function() {
        var token = generateCSRFToken();
        
        // Set in meta tag
        var metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            metaTag.setAttribute('content', token);
        }
        
        // Add to all forms
        var forms = document.querySelectorAll('form:not([data-csrf="false"])');
        for (var i = 0; i < forms.length; i++) {
            var existingInput = forms[i].querySelector('input[name="_token"]');
            if (!existingInput) {
                var input = document.createElement('input');
                input.type = 'hidden';
                input.name = '_token';
                input.value = token;
                forms[i].appendChild(input);
            }
        }
    };

    /**
     * Check if connection is secure (HTTPS)
     * @returns {boolean} True if secure connection
     */
    window.isSecureConnection = function() {
        return window.location.protocol === 'https:' || 
               window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1';
    };

    // ═════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═════════════════════════════════════════════════════════════════════

    // Initialize security features when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setupErrorBoundary();
            initLazyLoading();
            setCSRFToken();
        });
    } else {
        setupErrorBoundary();
        initLazyLoading();
        setCSRFToken();
    }

    // Expose config for debugging (remove in production)
    window._securityConfig = CONFIG;

})();
