/**
 * ═════════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 Marketplace — Security, Performance & Accessibility Layer
 * ES5-compatible (var, function, no arrow functions, no const/let)
 * 
 * FEATURES:
 * - Input Sanitization (sanitize, sanitizeUrl, sanitizeNumber)
 * - Validation (isValidEmail, isValidPhone, validatePassword)
 * - Rate Limiting (checkRateLimit, resetRateLimit)
 * - Form Validation (validateProductForm, validateCheckoutForm, showValidationErrors)
 * - Performance (initLazyLoading, debounce, throttle)
 * - Error Boundary (setupErrorBoundary, safeAsync)
 * - Security Utilities (generateCSRFToken, setCSRFToken, isSecureConnection)
 * 
 * Load AFTER marketplace.js and integration.js
 * ═════════════════════════════════════════════════════════════════════════════════
 */
(function() {
    'use strict';
    
    // ─── DEBUG MODE ─────────────────────────────────────────────────────
    var DEBUG_MODE = false;
    
    function log(/* args */) {
        if (DEBUG_MODE && typeof console === 'object' && console.log) {
            var args = Array.prototype.slice.call(arguments);
            console.log.apply(console, '[security] ' + args.join(' '));
        }
    }
    
    function warn(msg) {
        if (DEBUG_MODE) console.warn('[security]', msg);
    }
    
    function error(msg, err) {
        if (DEBUG_MODE && err) {
            console.error('[security]', msg, err);
        } else if (DEBUG_MODE) {
            console.error('[security]', msg);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 1: INPUT SANITIZATION
    // ══════════════════════════════════════════════════════════════════════
    
    /**
     * Sanitize string input - remove potentially dangerous characters
     * @param {string} input - Raw input string
     * @param {Object} options - Sanitization options
     * @returns {string} Sanitized string
     */
    window.sanitize = function(input, options) {
        if (input === null || input === undefined) return '';
        var str = String(input);
        
        var opts = options || {};
        
        // Remove null bytes
        str = str.replace(/\0/g, '');
        
        // Remove control characters (except newlines and tabs if allowed)
        if (!opts.allowNewlines) {
            str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        } else {
            str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '\n');
        }
        
        // Normalize whitespace
        if (opts.normalizeWhitespace) {
            str = str.replace(/\s+/g, ' ').trim();
        }
        
        // Strip HTML tags if requested
        if (opts.stripHtml !== false) {
            str = str.replace(/<[^>]*>/g, '');
        }
        
        // Escape HTML entities if requested
        if (opts.escapeHtml) {
            var escapeMap = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '/': '&#x2F;',
                '`': '&#x60;',
                '=': '&#x3D;'
            };
            str = str.replace(/[&<>"'`=/]/g, function(char) { return escapeMap[char]; });
        }
        
        // Limit length
        if (opts.maxLength && str.length > opts.maxLength) {
            str = str.substring(0, opts.maxLength);
        }
        
        return str;
    };
    
    /**
     * Sanitize URL to prevent XSS via javascript: protocol
     * @param {string} url - URL to sanitize
     * @returns {string} Safe URL or empty string if dangerous
     */
    window.sanitizeUrl = function(url) {
        if (!url) return '';
        
        var str = String(url).trim();
        
        // Block dangerous protocols
        var dangerousPatterns = [
            /^\s*javascript:/i,
            /^\s*vbscript:/i,
            /^\s*data:\s*text\/html/i,
            /^\s*data:\s*image\/svg/i
        ];
        
        for (var i = 0; i < dangerousPatterns.length; i++) {
            if (dangerousPatterns[i].test(str)) {
                warn('Blocked dangerous URL pattern');
                return '';
            }
        }
        
        // Allow relative URLs, http, https, mailto, tel
        var safePattern = /^(https?:\/\/|mailto:|tel:|#|\/|\.\.?[\/\\])/i;
        if (!safePattern.test(str) && !str.startsWith('/') && !str.startsWith('#')) {
            // If it doesn't look like a URL, still allow but sanitize
            str = window.sanitize(str, { maxLength: 2000 });
        }
        
        return str;
    };
    
    /**
     * Sanitize numeric input
     * @param {*} input - Input to sanitize
     * @param {Object} options - Options (min, max, defaultVal, integersOnly)
     * @returns {number} Sanitized number
     */
    window.sanitizeNumber = function(input, options) {
        var opts = options || {};
        var num = parseFloat(input);
        
        if (isNaN(num)) return opts.defaultVal || 0;
        
        if (opts.integersOnly) {
            num = Math.floor(num);
        }
        
        if (typeof opts.min === 'number' && num < opts.min) {
            num = opts.min;
        }
        
        if (typeof opts.max === 'number' && num > opts.max) {
            num = opts.max;
        }
        
        return num;
    };

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 2: VALIDATION FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════
    
    /**
     * Validate email address format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    window.isValidEmail = function(email) {
        if (!email || typeof email !== 'string') return false;
        
        // RFC 5322 simplified regex
        var emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?))*$/;
        
        return emailRegex.test(email.trim()) && email.length <= 254;
    };
    
    /**
     * Validate phone number format (international support)
     * @param {string} phone - Phone number to validate
     * @returns {boolean} True if valid
     */
    window.isValidPhone = function(phone) {
        if (!phone || typeof phone !== 'string') return false;
        
        // Remove common separators
        var cleaned = phone.replace(/[\s\-\(\)\+\.]/g, '');
        
        // Accept 7-15 digits, optionally starting with +
        var phoneRegex = /^\+?[1-9]\d{6,14}$/;
        
        return phoneRegex.test(cleaned);
    };
    
    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @param {Object} requirements - Password requirements
     * @returns {Object} Result with isValid and errors array
     */
    window.validatePassword = function(password, requirements) {
        var reqs = requirements || {};
        var minLength = reqs.minLength || 8;
        var requireUppercase = reqs.requireUppercase !== false;
        var requireLowercase = reqs.requireLowercase !== false;
        var requireNumbers = reqs.requireNumbers !== false;
        var requireSpecial = reqs.requireSpecial || false;
        
        var errors = [];
        
        if (!password || password.length < minLength) {
            errors.push('Password must be at least ' + minLength + ' characters long');
        }
        
        if (requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        
        if (requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        
        if (requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        
        if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            strength: calculatePasswordStrength(password)
        };
    };
    
    /**
     * Calculate password strength score (0-100)
     * @param {string} password - Password to analyze
     * @returns {number} Strength score
     */
    function calculatePasswordStrength(password) {
        if (!password) return 0;
        
        var score = 0;
        
        // Length scoring
        if (password.length >= 8) score += 20;
        if (password.length >= 12) score += 20;
        if (password.length >= 16) score += 10;
        
        // Character variety
        if (/[a-z]/.test(password)) score += 10;
        if (/[A-Z]/.test(password)) score += 10;
        if (/\d/.test(password)) score += 10;
        if (/[^a-zA-Z\d]/.test(password)) score += 20;
        
        // Bonus for mixed patterns
        if (/(.)\1{2,}/.test(password)) score -= 15; // Penalize repetition
        
        return Math.max(0, Math.min(100, score));
    }

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 3: RATE LIMITING
    // ══════════════════════════════════════════════════════════════════════
    
    var rateLimitStore = {};
    
    /**
     * Check if action is rate limited
     * @param {string} action - Action identifier
     * @param {Object} options - Limit options (maxAttempts, windowMs)
     * @returns {Object} {allowed: boolean, remaining: number, resetTime: number}
     */
    window.checkRateLimit = function(action, options) {
        var opts = options || {};
        var maxAttempts = opts.maxAttempts || 5;
        var windowMs = opts.windowMs || 60000; // 1 minute default
        
        var now = Date.now();
        var record = rateLimitStore[action];
        
        if (!record || now > record.resetTime) {
            // New window or expired
            rateLimitStore[action] = {
                attempts: 1,
                resetTime: now + windowMs
            };
            return {
                allowed: true,
                remaining: maxAttempts - 1,
                resetTime: now + windowMs
            };
        }
        
        if (record.attempts >= maxAttempts) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: record.resetTime
            };
        }
        
        record.attempts++;
        return {
            allowed: true,
            remaining: maxAttempts - record.attempts,
            resetTime: record.resetTime
        };
    };
    
    /**
     * Reset rate limit for an action
     * @param {string} action - Action identifier
     */
    window.resetRateLimit = function(action) {
        delete rateLimitStore[action];
        log('Rate limit reset for:', action);
    };

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 4: FORM VALIDATION
    // ══════════════════════════════════════════════════════════════════════
    
    /**
     * Validate product form data
     * @param {FormData|Object} formData - Form data to validate
     * @returns {Object} {isValid: boolean, errors: Object}
     */
    window.validateProductForm = function(formData) {
        var errors = {};
        var data = formData;
        
        // Handle FormData objects
        if (typeof FormData !== 'undefined' && data instanceof FormData) {
            data = {};
            formData.forEach(function(value, key) {
                data[key] = value;
            });
        }
        
        // Title validation
        if (!data.title || data.title.trim().length < 3) {
            errors.title = 'Product title must be at least 3 characters';
        } else if (data.title.trim().length > 200) {
            errors.title = 'Product title must be under 200 characters';
        }
        
        // Description validation
        if (!data.description || data.description.trim().length < 10) {
            errors.description = 'Description must be at least 10 characters';
        }
        
        // Price validation
        if (data.price === undefined || data.price === '') {
            errors.price = 'Price is required';
        } else {
            var price = parseFloat(data.price);
            if (isNaN(price) || price < 0) {
                errors.price = 'Please enter a valid price';
            } else if (price > 999999.99) {
                errors.price = 'Price seems too high';
            }
        }
        
        // Category validation
        if (!data.category && !data.category_id) {
            errors.category = 'Please select a category';
        }
        
        // Images validation (if provided)
        if (data.images && Array.isArray(data.images) && data.images.length === 0) {
            errors.images = 'Please add at least one image';
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors: errors
        };
    };
    
    /**
     * Validate checkout form data
     * @param {FormData|Object} formData - Form data to validate
     * @returns {Object} {isValid: boolean, errors: Object}
     */
    window.validateCheckoutForm = function(formData) {
        var errors = {};
        var data = formData;
        
        // Handle FormData objects
        if (typeof FormData !== 'undefined' && data instanceof FormData) {
            data = {};
            formData.forEach(function(value, key) {
                data[key] = value;
            });
        }
        
        // Full name validation
        if (!data.fullName || data.fullName.trim().length < 2) {
            errors.fullName = 'Please enter your full name';
        }
        
        // Email validation
        if (!data.email || !window.isValidEmail(data.email)) {
            errors.email = 'Please enter a valid email address';
        }
        
        // Phone validation (optional but must be valid if provided)
        if (data.phone && !window.isValidPhone(data.phone)) {
            errors.phone = 'Please enter a valid phone number';
        }
        
        // Address validation
        if (!data.address || data.address.trim().length < 5) {
            errors.address = 'Please enter your full address';
        }
        
        // City validation
        if (!data.city || data.city.trim().length < 2) {
            errors.city = 'Please enter your city';
        }
        
        // Postal/ZIP code validation
        if (!data.postalCode || data.postalCode.trim().length < 3) {
            errors.postalCode = 'Please enter your postal code';
        }
        
        // Payment method validation
        if (!data.paymentMethod) {
            errors.paymentMethod = 'Please select a payment method';
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors: errors
        };
    };
    
    /**
     * Display validation errors on form
     * @param {Object} errors - Errors object from form validation
     * @param {string} formId - Form element ID
     */
    window.showValidationErrors = function(errors, formId) {
        // Clear previous errors
        var existingErrors = document.querySelectorAll('.validation-error');
        existingErrors.forEach(function(el) { el.remove(); });
        
        var form = formId ? document.getElementById(formId) : document;
        if (!form) return;
        
        Object.keys(errors).forEach(function(field) {
            var fieldEl = form.querySelector('[name="' + field + '"]');
            
            if (fieldEl) {
                // Add error class
                fieldEl.classList.add('error', 'border-red-500');
                
                // Create error message element
                var errorEl = document.createElement('div');
                errorEl.className = 'validation-error text-red-500 text-sm mt-1';
                errorEl.textContent = errors[field];
                
                // Insert after field
                fieldEl.parentNode.insertBefore(errorEl, fieldEl.nextSibling);
            }
        });
        
        // Scroll to first error
        var firstError = form.querySelector('.validation-error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        log('Validation errors displayed:', Object.keys(errors).length);
    };

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 5: PERFORMANCE UTILITIES
    // ══════════════════════════════════════════════════════════════════════
    
    /**
     * Initialize lazy loading for images
     * @param {Object} options - Configuration options
     */
    window.initLazyLoading = function(options) {
        var opts = options || {};
        var rootMargin = opts.rootMargin || '50px';
        var threshold = opts.threshold || 0.1;
        
        if ('IntersectionObserver' in window) {
            var lazyImages = document.querySelectorAll('img[data-src]');
            
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        var img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        img.classList.add('loaded');
                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: rootMargin,
                threshold: threshold
            });
            
            lazyImages.forEach(function(img) {
                observer.observe(img);
            });
            
            log('Lazy loading initialized for', lazyImages.length, 'images');
        } else {
            // Fallback: load all images immediately
            var images = document.querySelectorAll('img[data-src]');
            images.forEach(function(img) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }
    };
    
    /**
     * Debounce function - delay execution until after wait ms of inactivity
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
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
            }, wait);
        };
    };
    
    /**
     * Throttle function - limit execution to once per wait ms
     * @param {Function} func - Function to throttle
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Throttled function
     */
    window.throttle = function(func, wait) {
        var prev = 0;
        return function() {
            var context = this;
            var args = arguments;
            var now = Date.now();
            if (now - prev >= wait) {
                prev = now;
                func.apply(context, args);
            }
        };
    };

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 6: ERROR BOUNDARY
    // ══════════════════════════════════════════════════════════════════════
    
    /**
     * Setup global error boundary
     * @param {Object} options - Configuration options
     */
    window.setupErrorBoundary = function(options) {
        var opts = options || {};
        
        // Global error handler
        window.onerror = function(message, source, lineno, colno, error) {
            error('Global error:', message, 'at', source, ':', lineno);
            
            if (opts.onError) {
                opts.onError({ message: message, source: source, line: lineno, col: colno, error: error });
            }
            
            // Show user-friendly message
            if (window.showToast) {
                window.showToast('An unexpected error occurred. Please try again.', 'error');
            }
            
            // Prevent default browser error logging in production
            if (!DEBUG_MODE) {
                return true;
            }
        };
        
        // Unhandled promise rejection handler
        window.onunhandledrejection = function(event) {
            error('Unhandled promise rejection:', event.reason);
            
            if (opts.onRejection) {
                opts.onRejection(event.reason);
            }
            
            event.preventDefault();
        };
        
        log('Error boundary setup complete');
    };
    
    /**
     * Safely execute async function with error handling
     * @param {Function} asyncFn - Async function to execute
     * @param {Object} options - Options (fallbackValue, onError, showUserMessage)
     * @returns {Promise} Promise that resolves safely
     */
    window.safeAsync = function(asyncFn, options) {
        var opts = options || {};
        
        try {
            var result = asyncFn();
            
            if (result && typeof result.then === 'function') {
                return result.catch(function(err) {
                    error('safeAsync caught:', err);
                    
                    if (opts.onError) {
                        opts.onError(err);
                    }
                    
                    if (opts.showUserMessage && window.showToast) {
                        window.showToast('Operation failed. Please try again.', 'error');
                    }
                    
                    return opts.fallbackValue || null;
                });
            }
            
            return result;
        } catch (err) {
            error('safeAsync caught sync:', err);
            
            if (opts.onError) {
                opts.onError(err);
            }
            
            return opts.fallbackValue || null;
        }
    };

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 7: SECURITY UTILITIES
    // ══════════════════════════════════════════════════════════════════════
    
    /**
     * Generate CSRF token
     * @returns {string} Random token string
     */
    window.generateCSRFToken = function() {
        var array = new Uint8Array(32);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(array);
        } else {
            // Fallback for older browsers
            for (var i = 0; i < 32; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
        }
        
        // Convert to hex string
        var hex = [];
        for (var i = 0; i < array.length; i++) {
            hex.push(array[i].toString(16).padStart(2, '0'));
        }
        
        return hex.join('');
    };
    
    /**
     * Set CSRF token in meta tag and headers
     * @param {string} token - Token to set
     */
    window.setCSRFToken = function(token) {
        // Set in meta tag
        var metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            metaTag.setAttribute('content', token);
        }
        
        // Store for use in fetch/AJAX requests
        window._csrfToken = token;
        
        log('CSRF token set');
    };
    
    /**
     * Check if connection is secure (HTTPS or localhost)
     * @returns {boolean} True if secure connection
     */
    window.isSecureConnection = function() {
        if (window.location.protocol === 'https:') {
            return true;
        }
        
        // Allow localhost for development
        var hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
            return true;
        }
        
        return false;
    };
    
    /**
     * Content Security Policy helper
     * @param {Object} policy - CSP directives
     */
    window.setContentSecurityPolicy = function(policy) {
        var directives = [];
        
        if (policy.defaultSrc) directives.push("default-src " + policy.defaultSrc);
        if (policy.scriptSrc) directives.push("script-src " + policy.scriptSrc);
        if (policy.styleSrc) directives.push("style-src " + policy.styleSrc);
        if (policy.imgSrc) directives.push("img-src " + policy.imgSrc);
        if (policy.connectSrc) directives.push("connect-src " + policy.connectSrc);
        if (policy.fontSrc) directives.push("font-src " + policy.fontSrc);
        if (policy.objectSrc) directives.push("object-src 'none'");
        if (policy.baseUri) directives.push("base-uri " + policy.baseUri);
        if (policy.formAction) directives.push("form-action " + policy.formAction);
        
        var cspString = directives.join('; ');
        
        var meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = cspString;
        document.head.appendChild(meta);
        
        log('CSP set:', cspString);
    };

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 8: INITIALIZATION
    // ══════════════════════════════════════════════════════════════════════
    
    /**
     * Initialize all security features
     * @param {Object} options - Initialization options
     */
    window.initSecurityLayer = function(options) {
        var opts = options || {};
        
        log('Initializing security layer...');
        
        // Generate and set initial CSRF token
        var token = window.generateCSRFToken();
        window.setCSRFToken(token);
        
        // Setup error boundary if requested
        if (opts.errorBoundary !== false) {
            window.setupErrorBoundary({
                onError: opts.onError,
                onRejection: opts.onRejection
            });
        }
        
        // Initialize lazy loading if requested
        if (opts.lazyLoad !== false) {
            window.initLazyLoading(opts.lazyLoadOptions);
        }
        
        // Warn if not secure connection
        if (!window.isSecureConnection()) {
            warn('Connection is not secure (not HTTPS)');
        }
        
        log('Security layer initialized successfully');
        
        return {
            csrfToken: token,
            isSecure: window.isSecureConnection()
        };
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            window.initSecurityLayer();
        });
    } else {
        window.initSecurityLayer();
    }
    
})();
