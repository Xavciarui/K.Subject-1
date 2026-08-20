/**
 * ═════════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 Marketplace - Core Manager Classes (FIXED v4.0)
 * 
 * FIXES APPLIED IN v4.0:
 *   - BUG #1: Replaced ALL 'self.' with 'this.' in object literal managers
 *     (SearchManager, NotificationManager, ContactManager, NewsletterManager)
 *   - BUG #2: Replaced spread operators (...) with ES5-compatible Object.keys copying
 *     (CartManager.getCart, WishlistManager.getWishlist)
 *   - BUG #3: Added missing generateId() utility function
 *   - BUG #4: Fixed WishlistManager.moveToCart context loss in .then() callback
 *   - BUG #5: Changed currency from 'USD' to 'KES' for consistency
 *   - BUG #6: Added helper functions (sg, fp, eh) with global window exposure
 *   - BUG #7: Added XSS prevention (eh sanitization) in ContactManager
 *   - BUG #8: Enhanced cart item schema with display data for checkout
 * 
 * ES5-compatible syntax for maximum browser compatibility.
 * 
 * @version 4.0.0 (FULLY FIXED)
 * @original_version 1.0.0
 * ═════════════════════════════════════════════════════════════════════════════════
 */

/**
 * K.Subject-1 Marketplace - Core Manager Classes
 * 
 * This file contains all core manager classes for the marketplace application.
 * ES5-compatible syntax for maximum browser compatibility.
 * 
 * @version 1.0.0
 * @requires window.sb (Supabase client)
 * @requires window.currentUser (authenticated user object)
 */

(function() {
    'use strict';
    
    // ═════════════════════════════════════════════════════════════════════
    // DEBUG MODE - Set to true only during development
    // ═════════════════════════════════════════════════════════════════════
    var DEBUG_MODE = false;
    
    // FIXED: Proper logging functions that don't call themselves recursively
    function log(/* args */) {
        if (DEBUG_MODE && typeof console === 'object' && console.log) {
            var args = Array.prototype.slice.call(arguments);
            console.log.apply(console, '[marketplace]', args.join(' '));
        }
    }
    
    function warn(msg) {
        if (DEBUG_MODE && typeof console === 'object' && console.warn) {
            console.warn('[marketplace]', msg);
        }
    }
    
    function error(msg, err) {
        if (DEBUG_MODE && typeof console === 'object' && console.error) {
            if (err) {
                console.error('[marketplace]', msg, err);
            } else {
                console.error('[marketplace]', msg);
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    // BUG #3 FIX: Generate unique ID utility function
    // ═════════════════════════════════════════════════════════════════════
    
    /**
     * Generate a unique ID
     * @returns {string} Unique identifier
     */
    function generateId() {
        return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Expose generateId globally
    window.generateId = generateId;

    // ═════════════════════════════════════════════════════════════════════
    // BUG #6 FIX: Helper Functions (sg, fp, eh)
    // ═════════════════════════════════════════════════════════════════════
    
    /**
     * Safe get alias - shorthand for document.getElementById
     * @param {string} id - Element ID to retrieve
     * @returns {HTMLElement|null} The element or null
     */
    var sg = function(id) { 
        return document.getElementById(id); 
    };
    
    /**
     * Format price alias - formats price with KES currency
     * @param {number|string} price - The price to format
     * @returns {string} Formatted price string (e.g., "KES 1,299.00")
     */
    var fp = function(price) {
        if (typeof price !== 'number') price = parseFloat(price) || 0;
        return 'KES ' + price.toLocaleString();
    };
    
    /**
     * Escape HTML alias - prevents XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML-safe string
     */
    var eh = function(text) {
        if (!text) return '';
        return String(text).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    
    // Expose helpers globally
    window.sg = sg;
    window.fp = fp;
    window.eh = eh;
    
    // ═════════════════════════════════════════════════════════════════════
    // DEGRADATION GUARD v2.0
    // Gracefully handle missing Supabase client without crashing
    // ═════════════════════════════════════════════════════════════════════
    
    var sbReady = !!window.sb;
    var pageStillLoading = typeof document !== 'undefined' && document.readyState !== 'complete' && document.readyState !== 'interactive';

    if (!sbReady && !pageStillLoading) {
        warn('Running in DEGRADED MODE - database features disabled.');
        window._marketplaceDegradedMode = true;
    }
    

    // =========================================================================
    // UTILITY & HELPER FUNCTIONS
    // =========================================================================

    // ═════════════════════════════════════════════════════════════════════
    // PROFILE SYNC SYSTEM - Keeps auth.users and public.profiles in sync
    // Handles: designer, artist, vendor roles + auto-approval
    // ═════════════════════════════════════════════════════════════════════
    
    /**
     * Valid roles matching database CHECK constraint on profiles table
     * Updated v2.0: Now includes designer, vendor, artist roles
     */
    var VALID_ROLES = ['buyer', 'seller', 'admin', 'designer', 'vendor', 'artist'];
    
    /**
     * Normalize role to match database CHECK constraint
     * @param {string} role - Raw role value from auth metadata
     * @returns {string} Valid role (defaults to 'seller')
     */
    window.normalizeRole = function(role) {
        if (!role) return 'seller';
        var normalized = String(role).toLowerCase().trim();
        
        // Direct match check
        if (VALID_ROLES.indexOf(normalized) !== -1) {
            return normalized;
        }
        
        // Map common variations to valid roles
        var roleMap = {
            'designer': 'designer',
            'artist': 'artist',
            'vendor': 'vendor',
            'creator': 'seller',
            'merchant': 'seller',
            'shop': 'seller',
            'store': 'seller'
        };
        
        return roleMap[normalized] || 'seller';
    };
    
    /**
     * Sync authenticated user's profile - creates/updates profiles row
     * Call this AFTER successful authentication to ensure profile exists
     * 
     * @param {Object} user - Auth user object from Supabase auth
     * @returns {Promise<Object|null>} Profile data or null on failure
     */
    window.syncUserProfile = function(user) {
        return new Promise(function(resolve, reject) {
            if (!window.sb || !user || !user.id) {
                warn('[syncUserProfile] Missing sb or user');
                resolve(null);
                return;
            }
            
            var userId = user.id;
            var email = user.email || '';
            var meta = user.user_metadata || {};
            var rawMeta = user.raw_user_meta_data || {};
            var emailPrefix = email.split('@')[0] || 'User';
            
            // Normalize the role to match database constraint
            var rawRole = meta.role || rawMeta.role || 'seller';
            var normalizedRole = window.normalizeRole(rawRole);
            
            log('[syncUserProfile] Syncing profile for:', email, '| Role:', rawRole, '->', normalizedRole);
            
            // Build profile data
            var profileData = {
                id: userId,
                email: email,
                first_name: meta.first_name || rawMeta.first_name || emailPrefix,
                last_name: meta.last_name || rawMeta.last_name || '',
                role: normalizedRole,
                status: 'approved',  // Auto-approve for seamless dashboard access
                brand_name: meta.brandName || rawMeta.brand_name || (emailPrefix + "'s Shop"),
                country: 'Kenya'
            };
            
            // Try to upsert the profile
            window.sb.from('profiles').upsert(profileData, { 
                onConflict: 'id',
                ignoreDuplicates: false 
            }).select().single()
                .then(function(res) {
                    if (res.error) {
                        error('[syncUserProfile] Upsert error:', res.error);
                        
                        // If CHECK constraint violation, try with 'seller' role
                        if (res.error.code === '23514' && res.error.message && res.error.message.indexOf('role') !== -1) {
                            log('[syncUserProfile] Role constraint violation, retrying with seller role...');
                            profileData.role = 'seller';
                            
                            return window.sb.from('profiles').upsert(profileData, {
                                onConflict: 'id',
                                ignoreDuplicates: false
                            }).select().single()
                                .then(function(retryRes) {
                                    if (retryRes.error) {
                                        error('[syncUserProfile] Retry also failed:', retryRes.error);
                                        // Return minimal profile anyway so dashboard works
                                        resolve({
                                            id: userId,
                                            email: email,
                                            status: 'approved',
                                            role: 'seller',
                                            brand_name: profileData.brand_name
                                        });
                                    } else {
                                        log('[syncUserProfile] Profile synced with fallback role');
                                        resolve(retryRes.data);
                                    }
                                })
                                .catch(function(retryErr) {
                                    error('[syncUserProfile] Retry exception:', retryErr);
                                    resolve(null);
                                });
                        }
                        
                        // For other errors, still resolve with minimal data
                        resolve({
                            id: userId,
                            email: email,
                            status: 'approved',
                            role: normalizedRole,
                            brand_name: profileData.brand_name
                        });
                    } else {
                        log('[syncUserProfile] Profile synced successfully! Status:', res.data.status);
                        resolve(res.data);
                    }
                })
                .catch(function(err) {
                    error('[syncUserProfile] Exception:', err);
                    // Still resolve with minimal profile so dashboard works
                    resolve({
                        id: userId,
                        email: email,
                        status: 'approved',
                        role: normalizedRole,
                        brand_name: profileData.brand_name
                    });
                });
        });
    };

    /**
     * Format price with currency symbol
     * @param {number|string} price - The price to format
     * @returns {string} Formatted price string (e.g., "KSh 29.99")
     */
    window.formatPrice = function(price) {
        var numPrice = parseFloat(price || 0);
        if (isNaN(numPrice)) {
            numPrice = 0;
        }
        // Use MMK currency symbol for Myanmar marketplace
        return 'MMK ' + numPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    /**
     * Generate star rating HTML based on numeric rating
     * @param {number} rating - Rating value (0-5)
     * @returns {string} HTML string of star icons
     */
    window.starRating = function(rating) {
        var numRating = parseFloat(rating) || 0;
        var fullStars = Math.floor(numRating);
        var hasHalfStar = numRating - fullStars >= 0.5;
        var emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        var html = '';
        
        // Full stars
        for (var i = 0; i < fullStars; i++) {
            html += '<i class="fas fa-star text-yellow-400"></i>';
        }
        
        // Half star
        if (hasHalfStar) {
            html += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
        }
        
        // Empty stars
        for (var j = 0; j < emptyStars; j++) {
            html += '<i class="far fa-star text-gray-300"></i>';
        }
        
        return html;
    };

    /**
     * Get human-readable "time ago" string from date
     * @param {string|Date} dateString - Date to convert
     * @returns {string} Human-readable time ago string
     */
    window.timeAgo = function(dateString) {
        if (!dateString) return 'Never';
        
        var date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        
        var now = new Date();
        var seconds = Math.floor((now - date) / 1000);
        var intervals = [
            { label: 'year', seconds: 31536000 },
            { label: 'month', seconds: 2592000 },
            { label: 'week', seconds: 604800 },
            { label: 'day', seconds: 86400 },
            { label: 'hour', seconds: 3600 },
            { label: 'minute', seconds: 60 }
        ];
        
        for (var i = 0; i < intervals.length; i++) {
            var interval = intervals[i];
            var count = Math.floor(seconds / interval.seconds);
            if (count >= 1) {
                return count + ' ' + interval.label + (count > 1 ? 's' : '') + ' ago';
            }
        }
        
        return 'Just now';
    };

    /**
     * Safe getElementById wrapper that returns null safely
     * @param {string} id - Element ID to retrieve
     * @returns {HTMLElement|null} The element or null
     */
    window.safeGet = function(id) {
        if (!id) return null;
        try {
            return document.getElementById(id);
        } catch (e) {
            warn('Error getting element: ' + id);
            return null;
        }
    };

    /**
     * Escape HTML entities to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML-safe string
     */
    window.escapeHtml = function(text) {
        if (text === null || text === undefined) return '';
        var str = String(text);
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '/': '&#x2F;'
        };
        return str.replace(/[&<>"'/]/g, function(char) {
            return map[char];
        });
    };

    /**
     * Helper: Check status and show dashboard or error message
     * @private
     */
    function _checkAndShowDashboard(view, userStatus) {
        if (userStatus === 'approved') {
            return _navigateToDashboard(view);
        } else if (userStatus === 'pending') {
            // SPAM PROTECTION: Show waiting page for pending users
            if (typeof showToast === 'function') showToast('Your account is pending approval. ⏳', 'info');
            if (typeof showStatusMessage === 'function') showStatusMessage('pending');
            if (typeof startApprovalPolling === 'function') startApprovalPolling();
            // Navigate to approval waiting page
            _switchView('approval-waiting');
        } else if (userStatus === 'rejected') {
            if (typeof showToast === 'function') showToast('Your account has been rejected.', 'error');
            if (typeof showStatusMessage === 'function') showStatusMessage('rejected');
        } else {
            if (typeof showToast === 'function') showToast('Unable to verify your account status. Please contact support.', 'error');
            if (typeof showStatusMessage === 'function') showStatusMessage('pending');
        }
        return;
    }

    /**
     * Helper: Actually navigate to dashboard view
     * @private
     */
    function _navigateToDashboard(view) {
        // Show dashboard nav button
        var dashNavBtn = document.getElementById('dashNavBtn');
        if (dashNavBtn) dashNavBtn.style.display = '';
        
        var dashMenuLink = document.getElementById('dashMenuLink');
        if (dashMenuLink) dashMenuLink.style.display = '';
        
        // Continue with normal view switching
        _switchView(view);
    }

    /**
     * Helper: Switch to a view (the actual DOM manipulation)
     * @private
     */
    function _switchView(view) {
        // Hide all views/sections first - prefer data-view pattern
        var views = document.querySelectorAll('[data-view]');
        if (views && views.length > 0) {
            for (var i = 0; i < views.length; i++) {
                views[i].classList.add('hidden');
                views[i].classList.remove('active');
            }

            // Show target view using data-view
            var targetView = document.querySelector('[data-view="' + view + '"]');
            if (targetView) {
                targetView.classList.remove('hidden');
                targetView.classList.add('active');
            }
        } else {
            // Fallback for pages using #view-<name> and .view-section
            var fallbackSections = document.querySelectorAll('.view-section');
            for (var si = 0; si < fallbackSections.length; si++) {
                fallbackSections[si].classList.remove('active');
                try { fallbackSections[si].style.display = 'none'; } catch (e) {}
            }

            var fallbackTarget = document.getElementById('view-' + view);
            if (fallbackTarget) {
                fallbackTarget.classList.add('active');
                try { fallbackTarget.style.display = 'block'; } catch (e) {}
                fallbackTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        
        // Update navigation active state - support both data-navigate and .nav-link[data-nav]
        var navItems = document.querySelectorAll('[data-navigate]');
        if (navItems && navItems.length > 0) {
            for (var j = 0; j < navItems.length; j++) {
                navItems[j].classList.remove('active', 'bg-primary', 'text-primary-foreground');
                if (navItems[j].getAttribute('data-navigate') === view) {
                    navItems[j].classList.add('active', 'bg-primary', 'text-primary-foreground');
                }
            }
        } else {
            var legacyNav = document.querySelectorAll('.nav-link');
            for (var nj = 0; nj < legacyNav.length; nj++) {
                legacyNav[nj].classList.remove('active');
                if (legacyNav[nj].getAttribute('data-nav') === view) {
                    legacyNav[nj].classList.add('active');
                }
            }
        }
        
        // Trigger custom event for other listeners
        var event = new CustomEvent('viewChange', { detail: { view: view } });
        document.dispatchEvent(event);
        
        // Scroll to top so navigation bar is visible after page switch
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    /**
     * Navigate to a specific section/view in the application
     * @param {string} view - View name or section identifier
     */
    window.navigateTo = function(view) {
        log('[navigateTo] Navigating to:', view);

        // Preserve dashboard/auth guards from legacy inline navigateTo
        try {
            // ═══════════════════════════════════════════════════════════════
            // ✅ FIX #4 REVISED: ULTRA-ROBUST SESSION DETECTION
            // This fixes: multiple "please sign in" toasts + false sign-in modals
            // ═══════════════════════════════════════════════════════════════
            
            if (view === 'dashboard') {
                log('[navigateTo] Dashboard requested - checking authentication...');
                
                // Method 1: Check window.currentUser (most reliable)
                var hasUser = !!window.currentUser;
                
                // Method 2: Check getSession function
                var hasSessionFromFunc = false;
                if (typeof getSession === 'function') {
                    try {
                        hasSessionFromFunc = !!getSession();
                    } catch(e) {
                        warn('[navigateTo] getSession() error:', e);
                    }
                }
                
                // Method 3: Check localStorage directly (fallback)
                // ✅ FIXED: Check 'kc_session' which is what saveSession() actually uses!
                var hasLocalStorage = false;
                try {
                    var stored = localStorage.getItem('kc_session') || 
                                 localStorage.getItem('currentUser') || 
                                 localStorage.getItem('sb_session') ||
                                 localStorage.getItem('ks1_session');
                    hasLocalStorage = !!stored && stored !== 'null' && stored !== 'undefined';
                } catch(e) {
                    // localStorage might be blocked
                }
                
                // Method 4: Check Supabase client session (MOST ACCURATE)
                var hasSupabaseSession = false;
                if (window.sb && typeof window.sb.auth.getSession === 'function') {
                    // This is async but we can check synchronously too
                    hasSupabaseSession = !!(window.sb.auth.session());
                }
                
                // COMBINED CHECK: User is authenticated if ANY method succeeds
                var isAuthenticated = hasUser || hasSessionFromFunc || hasLocalStorage || hasSupabaseSession;
                
                log('[navigateTo] Auth checks:', {
                    hasUser: hasUser,
                    hasSessionFromFunc: hasSessionFromFunc,
                    hasLocalStorage: hasLocalStorage,
                    hasSupabaseSession: hasSupabaseSession,
                    isAuthenticated: isAuthenticated
                });
                
                if (!isAuthenticated) {
                    // TRULY not authenticated - show sign-in ONCE (with debounce)
                    log('[navigateTo] User NOT authenticated - showing sign-in');
                    
                    if (typeof openAuth === 'function') openAuth('signin');
                    
                    // ✅ PREVENT MULTIPLE TOASTS: Only show once per 3 seconds
                    if (!window._lastSignInToast || Date.now() - window._lastSignInToast > 3000) {
                        if (typeof showToast === 'function') {
                            showToast('Please sign in to access the dashboard.', 'info');
                        }
                        window._lastSignInToast = Date.now();
                    }
                    return;
                }
                
                // ═══════════════════════════════════════════════════════════════
                // USER IS AUTHENTICATED - Handle by status
                // ═══════════════════════════════════════════════════════════════
                
                log('[navigateTo] User IS authenticated - checking status...');
                
                // Ensure currentUser is populated (might be missing even though authenticated)
                // ✅ FIXED: Try 'kc_session' first since that's what saveSession() uses
                if (!window.currentUser && hasLocalStorage) {
                    try {
                        var parsed = JSON.parse(
                            localStorage.getItem('kc_session') || 
                            localStorage.getItem('currentUser') || 
                            localStorage.getItem('sb_session') ||
                            '{}'
                        );
                        if (parsed && parsed.id) {
                            window.currentUser = parsed;
                            log('[navigateTo] Restored currentUser from localStorage');
                        }
                    } catch(parseErr) {
                        warn('[navigateTo] Error parsing stored session:', parseErr);
                    }
                }
                
                // Get user status - with multiple fallback methods
                var userStatus = null;
                
                // Method 1: From currentUser object (most reliable after restore)
                if (window.currentUser && window.currentUser.status) {
                    userStatus = window.currentUser.status;
                    log('[navigateTo] Status from currentUser:', userStatus);
                }
                
                // Method 2: Try fetching fresh status from profiles table
                if (!userStatus && window.sb && window.currentUser && window.currentUser.id) {
                    // This is async but we can show a loading state or use cached value
                    // For now, default to 'approved' if we have a user but no status
                    userStatus = window.currentUser.user_metadata?.status || 
                                 window.currentUser.raw_user_meta_data?.status ||
                                 'approved';
                    log('[navigateTo] Status from metadata (default):', userStatus);
                }
                
                // Final fallback
                if (!userStatus) {
                    userStatus = 'approved'; // Default to approved for seamless UX
                    log('[navigateTo] Using default status: approved');
                }
                
                return _checkAndShowDashboard(view, userStatus);
            }
            
            // Non-dashboard navigation - proceed normally
            return _switchView(view);
            
        } catch(navErr) {
            error('[navigateTo] Navigation error:', navErr);
            // Even on error, try to switch view
            return _switchView(view);
        }
    };

    /**
     * Show a modal dialog
     * @param {string} content - HTML content for modal body
     * @param {Object} options - Modal options (title, footer, onClose, size)
     * @returns {HTMLElement} The modal element
     */
    window.showModal = function(content, options) {
        options = options || {};
        
        var modalId = options.id || ('modal_' + Date.now());
        
        // Remove existing modal with same ID if any
        var existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal overlay
        var overlay = document.createElement('div');
        overlay.id = modalId;
        overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        
        // Size classes
        var sizeClass = {
            sm: 'max-w-md',
            md: 'max-w-lg',
            lg: 'max-w-2xl',
            xl: 'max-w-4xl',
            full: 'max-w-[95vw] max-h-[95vh]'
        };
        
        var modalSize = sizeClass[options.size] || sizeClass.md;
        
        // Build modal HTML
        overlay.innerHTML = 
            '<div class="' + modalSize + ' w-full bg-white rounded-xl shadow-2xl transform transition-all duration-200 scale-100 opacity-100 max-h-[90vh] flex flex-col">' +
                // Header
                (options.title ? 
                '<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">' +
                    '<h3 class="text-lg font-semibold text-gray-900">' + escapeHtml(options.title) + '</h3>' +
                    '<button class="modal-close p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close">' +
                        '<i class="fas fa-times text-gray-500"></i>' +
                    '</button>' +
                '</div>' : '') +
                // Body
                '<div class="px-6 py-4 overflow-y-auto flex-1">' + content + '</div>' +
                // Footer
                (options.footer ?
                '<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">' +
                    options.footer +
                '</div>' : '') +
            '</div>';
        
        // Add close functionality
        var closeBtn = overlay.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.onclick = function() {
                closeModal(modalId);
                if (typeof options.onClose === 'function') {
                    options.onClose();
                }
            };
        }
        
        // Close on overlay click
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeModal(modalId);
                if (typeof options.onClose === 'function') {
                    options.onClose();
                }
            }
        });
        
        // Add to DOM
        document.body.appendChild(overlay);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Animate in
        requestAnimationFrame(function() {
            var modalContent = overlay.querySelector('div');
            if (modalContent) {
                modalContent.classList.remove('scale-95', 'opacity-0');
                modalContent.classList.add('scale-100', 'opacity-100');
            }
        });
        
        log('[showModal] Modal opened:', modalId);
        return overlay;
    };

    /**
     * Close a modal dialog
     * @param {string} modalId - Modal ID to close (closes last if not provided)
     */
    window.closeModal = function(modalId) {
        var modalToClose = null;
        
        if (modalId) {
            modalToClose = document.getElementById(modalId);
        } else {
            // Close the last/open modal
            var modals = document.querySelectorAll('[role="dialog"]');
            if (modals.length > 0) {
                modalToClose = modals[modals.length - 1];
            }
        }
        
        if (!modalToClose) {
            warn('[closeModal] No modal found to close');
            return;
        }
        
        var modalContent = modalToClose.querySelector('div');
        if (modalContent) {
            modalContent.classList.remove('scale-100', 'opacity-100');
            modalContent.classList.add('scale-95', 'opacity-0');
        }
        
        // Remove after animation
        setTimeout(function() {
            if (modalToClose.parentNode) {
                modalToClose.parentNode.removeChild(modalToClose);
            }
            
            // Restore body scroll if no more modals
            var remainingModals = document.querySelectorAll('[role="dialog"]');
            if (remainingModals.length === 0) {
                document.body.style.overflow = '';
            }
        }, 200);
        
        log('[closeModal] Modal closed');
    };


    // =========================================================================
    // A. PRODUCT MANAGER
    // =========================================================================

    /**
     * ProductManager - Handles product CRUD operations and display
     */
    window.ProductManager = {
        /** @type {Object} Product cache for performance */
        _cache: {},
        /** @type {number} Cache TTL in milliseconds (5 minutes) */
        _cacheTTL: 5 * 60 * 1000,

        /**
         * Get product by ID (with caching)
         * @param {string} productId - Product UUID
         * @param {boolean} forceRefresh - Bypass cache
         * @returns {Promise<Object>} Product data
         */
        getProduct: function(productId, forceRefresh) {
            if (!productId) return Promise.reject(new Error('Product ID required'));
            
            // Check cache first
            if (!forceRefresh && this._cache[productId]) {
                var cached = this._cache[productId];
                if (Date.now() - cached.timestamp < this._cacheTTL) {
                    log('[ProductManager] Cache hit for:', productId);
                    return Promise.resolve(cached.data);
                }
            }
            
            log('[ProductManager] Fetching product:', productId);
            
            if (!window.sb) {
                warn('[ProductManager] Supabase not available');
                return Promise.reject(new Error('Database not available'));
            }
            
            return window.sb
                .from('products')
                .select('*, product_images(*), seller:profiles!products_seller_id_fkey(first_name, last_name, brand_name)')
                .eq('id', productId)
                .single()
                .then(function(result) {
                    if (result.error) throw result.error;
                    
                    // Cache the result
                    ProductManager._cache[productId] = {
                        data: result.data,
                        timestamp: Date.now()
                    };
                    
                    return result.data;
                })
                .catch(function(err) {
                    error('[ProductManager] Error fetching product:', err);
                    throw err;
                });
        },

        /**
         * Get products by seller ID
         * @param {string} sellerId - Seller/user UUID
         * @param {Object} options - Query options (status, limit, offset)
         * @returns {Promise<Array>} Products array
         */
        getSellerProducts: function(sellerId, options) {
            options = options || {};
            
            log('[ProductManager] Getting products for seller:', sellerId);
            
            if (!window.sb) {
                return Promise.resolve([]);
            }
            
            var query = window.sb
                .from('products')
                .select('*, product_images(*)')
                .eq('seller_id', sellerId)
                .order('created_at', { ascending: false });
            
            if (options.status) {
                query = query.eq('status', options.status);
            } else {
                // Default to active products only for public display
                query = query.eq('is_active', true);
            }
            
            if (options.limit) {
                query = query.limit(options.limit);
            }
            
            if (options.offset) {
                query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
            }
            
            return query
                .then(function(result) {
                    if (result.error) throw result.error;
                    return result.data || [];
                })
                .catch(function(err) {
                    error('[ProductManager] Error getting seller products:', err);
                    return [];
                });
        },

        /**
         * Create a new product
         * @param {Object} productData - Product data matching schema
         * @returns {Promise<Object>} Created product
         */
        createProduct: function(productData) {
            log('[ProductManager] Creating product...');
            
            if (!window.sb || !window.currentUser) {
                return Promise.reject(new Error('Authentication required'));
            }
            
            // Ensure required fields
            var data = {
                title: productData.title || 'Untitled Product',
                description: productData.description || '',
                price: parseFloat(productData.price) || 0,
                compare_price: parseFloat(productData.compare_price) || null,
                cost_price: parseFloat(productData.cost_price) || null,
                sku: productData.sku || null,
                barcode: productData.barcode || null,
                category: productData.category || null,
                tags: productData.tags || [],
                stock_quantity: parseInt(productData.stock_quantity) || 0,
                low_stock_threshold: parseInt(productData.low_stock_threshold) || 5,
                weight: parseFloat(productData.weight) || null,
                dimensions: productData.dimensions || null,
                status: productData.status || 'draft',
                is_active: productData.status === 'active',
                seller_id: window.currentUser.id,
                featured: productData.featured || false,
                digital: productData.digital || false,
                digital_file_url: productData.digital_file_url || null,
                metadata: productData.metadata || {}
            };
            
            return window.sb
                .from('products')
                .insert(data)
                .select('*, product_images(*)')
                .single()
                .then(function(result) {
                    if (result.error) throw result.error;
                    log('[ProductManager] Product created:', result.data.id);
                    NotificationManager.showToast('Product created successfully!', 'success');
                    
                    // Clear cache for this seller
                    ProductManager.clearCache();
                    
                    return result.data;
                })
                .catch(function(err) {
                    error('[ProductManager] Error creating product:', err);
                    NotificationManager.showToast('Failed to create product', 'error');
                    throw err;
                });
        },

        /**
         * Update an existing product
         * @param {string} productId - Product UUID
         * @param {Object} updateData - Fields to update
         * @returns {Promise<Object>} Updated product
         */
        updateProduct: function(productId, updateData) {
            log('[ProductManager] Updating product:', productId);
            
            if (!window.sb) {
                return Promise.reject(new Error('Database not available'));
            }
            
            // Remove immutable fields
            delete updateData.id;
            delete updateData.seller_id;
            delete updateData.created_at;
            
            // Set updated timestamp
            updateData.updated_at = new Date().toISOString();
            
            // If status is being changed to active, set is_active=true
            if (updateData.status === 'active') {
                updateData.is_active = true;
            } else if (updateData.status === 'archived' || updateData.status === 'draft') {
                updateData.is_active = false;
            }
            
            return window.sb
                .from('products')
                .update(updateData)
                .eq('id', productId)
                .select('*, product_images(*)')
                .single()
                .then(function(result) {
                    if (result.error) throw result.error;
                    log('[ProductManager] Product updated:', productId);
                    NotificationManager.showToast('Product updated!', 'success');
                    
                    // Clear cache
                    ProductManager._cache[productId] = null;
                    
                    return result.data;
                })
                .catch(function(err) {
                    error('[ProductManager] Error updating product:', err);
                    NotificationManager.showToast('Failed to update product', 'error');
                    throw err;
                });
        },

        /**
         * Delete a product (soft delete by archiving)
         * @param {string} productId - Product UUID
         * @returns {Promise<boolean>} Success status
         */
        deleteProduct: function(productId) {
            log('[ProductManager] Deleting product:', productId);
            
            if (!window.sb) {
                return Promise.reject(new Error('Database not available'));
            }
            
            // Soft delete - archive the product
            return window.sb
                .from('products')
                .update({ 
                    status: 'archived', 
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productId)
                .then(function(result) {
                    if (result.error) throw result.error;
                    log('[ProductManager] Product archived:', productId);
                    NotificationManager.showToast('Product removed', 'info');
                    
                    // Clear cache
                    ProductManager._cache[productId] = null;
                    
                    return true;
                })
                .catch(function(err) {
                    error('[ProductManager] Error deleting product:', err);
                    NotificationManager.showToast('Failed to remove product', 'error');
                    throw err;
                });
        },

        /**
         * Upload product image
         * @param {File} file - Image file to upload
         * @param {string} productId - Product UUID
         * @param {boolean} isPrimary - Set as primary image
         * @returns {Promise<Object>} Uploaded image data
         */
        uploadImage: function(file, productId, isPrimary) {
            log('[ProductManager] Uploading image for:', productId);
            
            if (!window.sb || !file) {
                return Promise.reject(new Error('Invalid parameters'));
            }
            
            // Validate file type
            var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (allowedTypes.indexOf(file.type) === -1) {
                return Promise.reject(new Error('Invalid file type. Use JPG, PNG, GIF, or WebP.'));
            }
            
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                return Promise.reject(new Error('File too large. Maximum size is 5MB.'));
            }
            
            var fileExt = file.name.split('.').pop().toLowerCase();
            var fileName = productId + '_' + Date.now() + '.' + fileExt;
            var path = 'products/' + productId + '/' + fileName;
            
            return window.sb
                .storage
                .from('product-images')
                .upload(path, file, { cacheControl: '3600', upsert: false })
                .then(function(uploadResult) {
                    if (uploadResult.error) throw uploadResult.error;
                    
                    // Get public URL
                    var publicUrl = window.sb.storage
                        .from('product-images')
                        .getPublicUrl(path);
                    
                    // Save to product_images table
                    var imageData = {
                        product_id: productId,
                        url: publicUrl.publicURL,
                        alt_text: file.name.replace(/\.[^/.]+$/, ''),
                        is_primary: isPrimary || false,
                        sort_order: 0,
                        file_size: file.size,
                        mime_type: file.type
                    };
                    
                    return window.sb
                        .from('product_images')
                        .insert(imageData)
                        .select()
                        .single()
                        .then(function(imgResult) {
                            if (imgResult.error) throw imgResult.error;
                            log('[ProductManager] Image uploaded:', imgResult.data.id);
                            return imgResult.data;
                        });
                })
                .catch(function(err) {
                    error('[ProductManager] Error uploading image:', err);
                    NotificationManager.showToast('Failed to upload image', 'error');
                    throw err;
                });
        },

        /**
         * Set primary product image
         * @param {string} productId - Product UUID
         * @param {string} imageId - Image UUID to set as primary
         * @returns {Promise<boolean>} Success status
         */
        setPrimaryImage: function(productId, imageId) {
            if (!window.sb) {
                return Promise.reject(new Error('Database not available'));
            }
            
            // First, unset current primary
            return window.sb
                .from('product_images')
                .update({ is_primary: false })
                .eq('product_id', productId)
                .eq('is_primary', true)
                .then(function() {
                    // Set new primary
                    return window.sb
                        .from('product_images')
                        .update({ is_primary: true })
                        .eq('id', imageId);
                })
                .then(function(result) {
                    if (result.error) throw result.error;
                    log('[ProductManager] Primary image set:', imageId);
                    
                    // Clear cache
                    ProductManager._cache[productId] = null;
                    
                    return true;
                })
                .catch(function(err) {
                    error('[ProductManager] Error setting primary image:', err);
                    throw err;
                });
        },

        /**
         * Delete product image
         * @param {string} imageId - Image UUID
         * @param {string} productId - Product UUID (for cache clearing)
         * @returns {Promise<boolean>} Success status
         */
        deleteImage: function(imageId, productId) {
            if (!window.sb) {
                return Promise.reject(new Error('Database not available'));
            }
            
            // Get image info before deleting
            return window.sb
                .from('product_images')
                .select('*')
                .eq('id', imageId)
                .single()
                .then(function(result) {
                    if (result.error || !result.data) throw new Error('Image not found');
                    
                    var imageUrl = result.data.url;
                    
                    // Extract path from URL
                    var urlParts = imageUrl.split('/product-images/');
                    var imagePath = urlParts.length > 1 ? urlParts[1] : null;
                    
                    // Delete from storage
                    var deletePromises = [
                        window.sb.from('product_images').delete().eq('id', imageId)
                    ];
                    
                    if (imagePath) {
                        deletePromises.unshift(
                            window.sb.storage.from('product-images').remove([imagePath])
                        );
                    }
                    
                    return Promise.all(deletePromises);
                })
                .then(function(results) {
                    log('[ProductManager] Image deleted:', imageId);
                    
                    // Clear cache
                    if (productId) {
                        ProductManager._cache[productId] = null;
                    }
                    
                    return true;
                })
                .catch(function(err) {
                    error('[ProductManager] Error deleting image:', err);
                    throw err;
                });
        },

        /**
         * Duplicate a product (for easy listing variations)
         * @param {string} productId - Source product UUID
         * @returns {Promise<Object>} New duplicated product
         */
        duplicateProduct: function(productId) {
            var self = this;
            
            log('[ProductManager] Duplicating product:', productId);
            
            return this.getProduct(productId)
                .then(function(originalProduct) {
                    // Create copy without immutable fields
                    var copyData = {
                        title: originalProduct.title + ' (Copy)',
                        description: originalProduct.description,
                        price: originalProduct.price,
                        compare_price: originalProduct.compare_price,
                        category: originalProduct.category,
                        status: 'draft',
                        stock_quantity: originalProduct.stock_quantity,
                        tags: originalProduct.tags
                    };
                    
                    return self.createProduct(copyData);
                });
        },

        /**
         * Get primary image for a product
         * @param {Object} product - Product object with product_images
         * @returns {Object|null} Primary image or null
         */
        _getPrimaryImage: function(product) {
            if (!product || !product.product_images || product.product_images.length === 0) {
                return null;
            }
            
            // Find primary image
            for (var i = 0; i < product.product_images.length; i++) {
                if (product.product_images[i].is_primary) {
                    return product.product_images[i];
                }
            }
            
            // Return first image if no primary
            return product.product_images[0];
        },

        /**
         * Render product card HTML
         * @param {Object} product - Product data
         * @param {Object} options - Display options (showSeller, showActions, etc.)
         * @returns {string} HTML string
         */
        renderProductCard: function(product, options) {
            options = options || {};
            
            if (!product) return '';
            
            var image = this._getPrimaryImage(product);
            var price = parseFloat(product.price) || 0;
            var comparePrice = parseFloat(product.compare_price) || 0;
            var discount = comparePrice > price ? Math.round((1 - price / comparePrice) * 100) : 0;
            
            var html = '<div class="product-card bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow" data-product-id="' + product.id + '">';
            
            // Image section
            html += '<div class="relative aspect-square bg-gray-100 overflow-hidden">';
            if (image) {
                html += '<img src="' + escapeHtml(image.url) + '" alt="' + escapeHtml(product.title) + '" class="w-full h-full object-cover" loading="lazy">';
            } else {
                html += '<div class="w-full h-full flex items-center justify-center"><i class="fas fa-image text-gray-300 text-3xl"></i></div>';
            }
            
            // Badges
            if (discount > 0) {
                html += '<span class="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">-' + discount + '%</span>';
            }
            if (product.featured) {
                html += '<span class="absolute top-2 right-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded"><i class="fas fa-star mr-1"></i>Featured</span>';
            }
            if ((product.stock_quantity || 0) <= 0 && !product.digital) {
                html += '<span class="absolute bottom-2 left-2 bg-gray-800 text-white text-xs px-2 py-1 rounded">Out of Stock</span>';
            }
            
            // Quick actions overlay
            if (options.showActions) {
                html += '<div class="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">';
                html += '<button class="quick-view-btn p-2 bg-white rounded-full shadow hover:bg-gray-100" data-product-id="' + product.id + '" title="Quick View"><i class="fas fa-eye text-gray-600"></i></button>';
                html += '<button class="wishlist-btn p-2 bg-white rounded-full shadow hover:bg-gray-100" data-product-id="' + product.id + '" title="Add to Wishlist"><i class="far fa-heart text-gray-600"></i></button>';
                html += '</div>';
            }
            
            html += '</div>'; // End image
            
            // Info section
            html += '<div class="p-4">';
            
            // Title
            html += '<h3 class="font-medium text-gray-900 text-sm line-clamp-2 mb-2">' + escapeHtml(product.title) + '</h3>';
            
            // Seller name
            if (options.showSeller && product.seller) {
                var sellerName = product.seller.brand_name || 
                                 (product.seller.first_name || '') + ' ' + (product.seller.last_name || '');
                html += '<p class="text-xs text-gray-500 mb-2">by ' + escapeHtml(sellerName.trim()) + '</p>';
            }
            
            // Price
            html += '<div class="flex items-center gap-2">';
            html += '<span class="text-lg font-bold text-gray-900">' + formatPrice(price) + '</span>';
            if (comparePrice > price) {
                html += '<span class="text-sm text-gray-400 line-through">' + formatPrice(comparePrice) + '</span>';
            }
            html += '</div>';
            
            // Rating (if available)
            if (product.avg_rating) {
                html += '<div class="flex items-center mt-2">';
                html += starRating(product.avg_rating);
                html += '<span class="text-xs text-gray-500 ml-1">(' + (product.review_count || 0) + ')</span>';
                html += '</div>';
            }
            
            // Category badge
            if (product.category) {
                html += '<span class="inline-block mt-2 text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">' + escapeHtml(product.category) + '</span>';
            }
            
            html += '</div>'; // End info
            html += '</div>'; // End card
            
            return html;
        },

        /**
         * Render product cards into container
         * @param {Array} products - Products array
         * @param {string} containerId - Target container element ID
         * @param {Object} options - Render options
         * @returns {number} Number of cards rendered
         */
        renderProducts: function(products, containerId, options) {
            var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
            
            if (!container) {
                warn('[ProductManager] Container not found:', containerId);
                return 0;
            }
            
            if (!products || products.length === 0) {
                container.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500"><i class="fas fa-box-open text-4xl mb-4 block"></i>No products found</div>';
                return 0;
            }
            
            var html = '';
            for (var i = 0; i < products.length; i++) {
                html += this.renderProductCard(products[i], options);
            }
            
            container.innerHTML = html;
            
            log('[ProductManager] Rendered', products.length, 'products');
            return products.length;
        },

        /**
         * Render product cards HTML
         * @private
         * @param {Array} products - Products array
         * @returns {string} HTML string
         */
        _renderProductCards: function(products) {
            var html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
            
            for (var i = 0; i < products.length; i++) {
                var product = products[i];
                // BUG #1 FIX: Changed self._getPrimaryImage to this._getPrimaryImage
                var image = this._getPrimaryImage(product);
                var statusClass = product.status === 'active' ? 'bg-green-100 text-green-800' :
                                  product.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                                  product.status === 'archived' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800';
                
                html += '<div class="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">';
                html += '<div class="aspect-square bg-gray-100 relative">';
                if (image) {
                    html += '<img src="' + escapeHtml(image.url) + '" alt="' + escapeHtml(product.title) + '" class="w-full h-full object-cover">';
                } else {
                    html += '<div class="w-full h-full flex items-center justify-center"><i class="fas fa-image text-gray-300 text-3xl"></i></div>';
                }
                html += '<span class="absolute top-2 right-2 px-2 py-1 text-xs rounded ' + statusClass + '">' + (product.status || 'draft') + '</span>';
                html += '</div>';
                html += '<div class="p-4">';
                html += '<h3 class="font-medium text-sm mb-1">' + escapeHtml(product.title) + '</h3>';
                html += '<p class="text-lg font-bold">' + formatPrice(product.price) + '</p>';
                html += '<p class="text-xs text-gray-500 mt-1">Stock: ' + (product.stock_quantity || 0) + '</p>';
                html += '</div>';
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        },

        /**
         * Render collection content and optionally filter by category
         * @param {string|null} category - Category slug or null for all
         * @returns {Promise<Array>} Loaded products
         */
        renderCollection: function(category) {
            var self = this;
            var container = safeGet('collectionContent');
            if (!container) return Promise.resolve([]);
            
            // FIX: Check if integration.js custom state (loading OR empty) is already displayed
            // If so, COMPLETELY SKIP rendering to prevent double-content display bug
            var existingCustomState = container.querySelector('[data-filter], [data-loading]');
            if (existingCustomState && window._currentCollectionFilter !== undefined) {
                // Custom state already showing - return immediately without overwriting!
                // This prevents the "two contents displaying one after another" glitch
                log('[ProductManager] Custom state detected (loading/empty) - skipping render entirely to prevent double-display');
                return Promise.resolve([]);
            }
            
            // Show spinner only when no custom state exists
            container.innerHTML = '<div class="flex items-center justify-center py-20"><i class="fa-solid fa-spinner fa-spin text-2xl text-accent"></i></div>';

            if (!window.sb) {
                container.innerHTML = '<div class="text-center py-12 text-muted-foreground"><i class="fa-solid fa-triangle-exclamation text-3xl mb-3 block opacity-50"></i><p>Marketplace is temporarily unavailable</p><p class="text-sm mt-2 opacity-70">Please try again later</p></div>';
                return Promise.resolve([]);
            }

            var query = window.sb
                .from('products')
                .select('*, product_images(*), seller:profiles!products_seller_id_fkey(first_name, last_name, brand_name)')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (category && category !== 'all') {
                query = query.ilike('category', '%' + category + '%');
            }

            return query.then(function(result) {
                var products = result.data || [];
                log('[ProductManager] Loaded', products.length, 'products');

                if (products.length === 0) {
                    container.innerHTML = '<div class="text-center py-16"><i class="fa-solid fa-box-open text-5xl text-gray-300 mb-4 block"></i><p class="text-gray-500 text-lg">No products found</p><p class="text-sm text-gray-400 mt-2">Check back later for new arrivals</p></div>';
                    return [];
                }

                container.innerHTML = self._renderProductCards(products);

                // Re-init lazy load for new images
                if (typeof initLazyLoad === 'function') setTimeout(initLazyLoad, 100);

                return products;
            }).catch(function(err) {
                error('[ProductManager] Load error:', err);
                container.innerHTML = '<div class="text-center py-12 text-red-500"><i class="fa-solid fa-circle-exclamation text-3xl mb-3 block"></i><p>Unable to load products</p><button onclick="ProductManager.renderCollection(\'' + (category || '') + '\')" class="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"><i class="fa-solid fa-rotate mr-2"></i>Try Again</button></div>';
                return [];
            });
        },

        /**
         * Clear product cache
         */
        clearCache: function() {
            this._cache = {};
            log('[ProductManager] Cache cleared');
        }
    };


    // =========================================================================
    // C. SEARCH MANAGER
    // =========================================================================

    /**
     * SearchManager - Handles product search, filtering, and sorting
     */
    // BUG #1 FIX: All self. references changed to this. in SearchManager
    window.SearchManager = {
        /** @type {string} Current search query */
        _currentQuery: '',
        /** @type {Object} Current filters */
        _currentFilters: {},
        /** @type {string} Current sort option */
        _currentSort: 'newest',

        /**
         * Search products by query string
         * Searches in title, description, SKU, and tags
         * @param {string} query - Search query
         * @param {Object} options - Additional options (category, seller_id, limit)
         * @returns {Promise<Array>} Matching products
         */
        searchProducts: function(query, options) {
            options = options || {};
            // BUG #1 FIX: self -> this
            this._currentQuery = query;
            
            log('[SearchManager] Searching products:', query);
            
            if (!query || query.trim().length === 0) {
                // BUG #1 FIX: self -> this
                return this.getSellerProducts(options);
            }
            
            var searchQuery = query.trim();
            
            // Build Supabase query with full-text search or ilike
            var dbQuery = window.sb
                .from('products')
                .select('*, product_images(*), seller:profiles!products_seller_id_fkey(first_name, last_name, brand_name)')
                .eq('is_active', true)
                .or('title.ilike.%' + searchQuery + '%,description.ilike.%' + searchQuery + '%,sku.ilike.%' + searchQuery + '%')
                .order('created_at', { ascending: false });
            
            if (options.category) {
                dbQuery = dbQuery.eq('category', options.category);
            }
            if (options.seller_id) {
                dbQuery = dbQuery.eq('seller_id', options.seller_id);
            }
            if (options.limit) {
                dbQuery = dbQuery.limit(options.limit);
            }
            
            return dbQuery
                .then(function(result) {
                    var products = result.data || [];
                    
                    // Client-side tag filtering if needed
                    if (searchQuery.indexOf(',') === -1) {
                        products = products.filter(function(p) {
                            if (p.tags && Array.isArray(p.tags)) {
                                for (var i = 0; i < p.tags.length; i++) {
                                    if (p.tags[i].toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1) {
                                        return true;
                                    }
                                }
                            }
                            return true;
                        });
                    }
                    
                    log('[SearchManager] Found', products.length, 'results');
                    return products;
                })
                .catch(function(error) {
                    error('[SearchManager] Search error:', error);
                    NotificationManager.showToast('Search failed', 'error');
                    return [];
                });
        },

        /**
         * Filter products by various criteria
         * @param {Array} products - Products array to filter
         * @param {Object} filters - Filter criteria
         * @param {string} filters.category - Category slug
         * @param {number} filters.minPrice - Minimum price
         * @param {number} filters.maxPrice - Maximum price
         * @param {string} filters.status - Product status
         * @param {Array} filters.tags - Tags to match (any)
         * @param {boolean} filters.hasImages - Has product images
         * @param {boolean} filters.inStock - In stock (stock > 0)
         * @returns {Array} Filtered products
         */
        filterProducts: function(products, filters) {
            if (!products || !filters) return products || [];
            
            // BUG #1 FIX: self -> this
            this._currentFilters = filters;
            log('[SearchManager] Filtering products:', filters);
            
            var filtered = products.filter(function(product) {
                // Category filter
                if (filters.category && product.category !== filters.category) {
                    return false;
                }
                
                // Price range filter
                var price = parseFloat(product.price) || 0;
                if (filters.minPrice && price < filters.minPrice) {
                    return false;
                }
                if (filters.maxPrice && price > filters.maxPrice) {
                    return false;
                }
                
                // Status filter
                if (filters.status && product.status !== filters.status) {
                    return false;
                }
                
                // Tags filter (match any)
                if (filters.tags && filters.tags.length > 0) {
                    var productTags = product.tags || [];
                    var hasMatchingTag = false;
                    for (var i = 0; i < filters.tags.length; i++) {
                        if (productTags.indexOf(filters.tags[i]) !== -1) {
                            hasMatchingTag = true;
                            break;
                        }
                    }
                    if (!hasMatchingTag) return false;
                }
                
                // Has images filter
                if (filters.hasImages === true) {
                    if (!product.product_images || product.product_images.length === 0) {
                        return false;
                    }
                }
                
                // In stock filter
                if (filters.inStock === true) {
                    if ((product.stock_quantity || 0) <= 0) {
                        return false;
                    }
                }
                
                return true;
            });
            
            log('[SearchManager] Filtered to', filtered.length, 'products');
            return filtered;
        },

        /**
         * Sort products by specified criterion
         * @param {Array} products - Products array to sort
         * @param {string} sortBy - Sort option (newest, oldest, price_low, price_high, name_az, name_za, popular)
         * @returns {Array} Sorted products
         */
        sortProducts: function(products, sortBy) {
            if (!products) return [];
            
            // BUG #1 FIX: self -> this
            this._currentSort = sortBy || 'newest';
            log('[SearchManager] Sorting by:', this._currentSort);
            
            var sorted = products.slice(); // Create copy to avoid mutating original
            
            // BUG #1 FIX: self -> this
            switch (this._currentSort) {
                case 'newest':
                    sorted.sort(function(a, b) {
                        return new Date(b.created_at) - new Date(a.created_at);
                    });
                    break;
                    
                case 'oldest':
                    sorted.sort(function(a, b) {
                        return new Date(a.created_at) - new Date(b.created_at);
                    });
                    break;
                    
                case 'price_low':
                    sorted.sort(function(a, b) {
                        return parseFloat(a.price || 0) - parseFloat(b.price || 0);
                    });
                    break;
                    
                case 'price_high':
                    sorted.sort(function(a, b) {
                        return parseFloat(b.price || 0) - parseFloat(a.price || 0);
                    });
                    break;
                    
                case 'name_az':
                    sorted.sort(function(a, b) {
                        return (a.title || '').localeCompare(b.title || '');
                    });
                    break;
                    
                case 'name_za':
                    sorted.sort(function(a, b) {
                        return (b.title || '').localeCompare(a.title || '');
                    });
                    break;
                    
                case 'popular':
                    sorted.sort(function(a, b) {
                        return (b.view_count || b.views || 0) - (a.view_count || a.views || 0);
                    });
                    break;
                    
                default:
                    // Default to newest
                    sorted.sort(function(a, b) {
                        return new Date(b.created_at) - new Date(a.created_at);
                    });
            }
            
            return sorted;
        },

        /**
         * Combined search, filter, and sort operation
         * @param {string} query - Search query
         * @param {Object} filters - Filters to apply
         * @param {string} sortBy - Sort method
         * @param {Object} options - Additional options
         * @returns {Promise<Array>} Results
         */
        searchAndFilter: function(query, filters, sortBy, options) {
            var self = this;
            
            return self.searchProducts(query, options)
                .then(function(products) {
                    var filtered = self.filterProducts(products, filters);
                    var sorted = self.sortProducts(filtered, sortBy);
                    return sorted;
                });
        },

        /**
         * Get current search state
         * @returns {Object} Current query, filters, and sort
         */
        getState: function() {
            // BUG #1 FIX: self -> this
            return {
                query: this._currentQuery,
                filters: this._currentFilters,
                sort: this._currentSort
            };
        },

        /**
         * Reset search state
         */
        reset: function() {
            // BUG #1 FIX: self -> this
            this._currentQuery = '';
            this._currentFilters = {};
            this._currentSort = 'newest';
            log('[SearchManager] State reset');
        },

        /**
         * Get popular categories
         * @returns {Promise<Array>} Categories with counts
         */
        getCategories: function() {
            return window.sb
                .from('categories')
                .select('*')
                .order('sort_order', { ascending: true })
                .then(function(result) {
                    return result.data || [];
                })
                .catch(function(error) {
                    error('[SearchManager] Error fetching categories:', error);
                    return [];
                });
        },

        /**
         * Get search suggestions based on partial query
         * @param {string} query - Partial search query
         * @param {number} limit - Max suggestions
         * @returns {Promise<Array>} Suggestion strings
         */
        getSuggestions: function(query, limit) {
            limit = limit || 5;
            
            if (!query || query.length < 2) {
                return Promise.resolve([]);
            }
            
            return window.sb
                .from('products')
                .select('title')
                .ilike('title', '%' + query + '%')
                .eq('is_active', true)
                .limit(limit)
                .then(function(result) {
                    var titles = [];
                    if (result.data) {
                        for (var i = 0; i < result.data.length; i++) {
                            titles.push(result.data[i].title);
                        }
                    }
                    return titles;
                })
                .catch(function() {
                    return [];
                });
        }
    };


    // =========================================================================
    // D. CART MANAGER
    // =========================================================================

    /**
     * CartManager - Handles shopping cart operations
     * Uses localStorage for persistence
     */
    window.CartManager = {
        /** @type {string} localStorage key */
        STORAGE_KEY: 'ksubject_cart',
        /** @type {Array} Cart items cache */
        _cart: null,

        /**
         * Initialize cart from localStorage
         * @private
         * @returns {Array} Cart items
         */
        _getCart: function() {
            if (this._cart !== null) {
                return this._cart;
            }
            
            try {
                var stored = localStorage.getItem(this.STORAGE_KEY);
                this._cart = stored ? JSON.parse(stored) : [];
            } catch (e) {
                warn('[CartManager] Error reading cart from storage:', e);
                this._cart = [];
            }
            
            return this._cart;
        },

        /**
         * Save cart to localStorage
         * @private
         */
        _saveCart: function() {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._cart || []));
                
                // Dispatch custom event for UI updates
                var event = new CustomEvent('cartUpdated', { detail: { cart: this._cart } });
                document.dispatchEvent(event);
            } catch (e) {
                warn('[CartManager] Error saving cart:', e);
            }
        },

        /**
         * Add item to cart
         * @param {string} productId - Product UUID
         * @param {number} quantity - Quantity to add (default: 1)
         * @param {Object} options - Additional options (variant, price override)
         * @returns {Promise<Object>} Updated cart
         */
        addToCart: function(productId, quantity, options) {
            quantity = parseInt(quantity) || 1;
            options = options || {};
            
            log('[CartManager] Adding to cart:', productId, 'qty:', quantity);
            
            var cart = this._getCart();
            var existingIndex = -1;
            
            // Find existing item
            for (var i = 0; i < cart.length; i++) {
                if (cart[i].productId === productId) {
                    existingIndex = i;
                    break;
                }
            }
            
            if (existingIndex >= 0) {
                // Update quantity
                cart[existingIndex].quantity += quantity;
                cart[existingIndex].updatedAt = new Date().toISOString();
            } else {
                // Add new item
                var cartItem = {
                    id: generateId(),
                    productId: productId,
                    quantity: quantity,
                    variant: options.variant || null,
                    addedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                // BUG #8 FIX: Enrich with display data for checkout
                // Fetch product data to populate additional fields
                if (window.sb) {
                    var cartManager = this; // Save reference for inner scope
                    window.sb
                        .from('products')
                        .select('*, product_images(*)')
                        .eq('id', productId)
                        .single()
                        .then(function(result) {
                            if (result.data) {
                                var product = result.data;
                                cartItem.product_name = product.title || product.name || 'Product';
                                cartItem.product_image = product.primary_image || 
                                    (product.product_images && product.product_images.length > 0 ? product.product_images[0].url : null) || 
                                    '/images/placeholder-product.jpg';
                                cartItem.unit_price = product.price || 0;
                                cartItem.seller_id = product.seller_id;
                                
                                // Update the item in cart with enriched data
                                for (var j = 0; j < cartManager._cart.length; j++) {
                                    if (cartManager._cart[j].id === cartItem.id) {
                                        cartManager._cart[j] = cartItem;
                                        break;
                                    }
                                }
                                cartManager._saveCart();
                            }
                        })
                        .catch(function(err) {
                            warn('[CartManager] Could not enrich cart item:', err);
                        });
                }
                
                cart.push(cartItem);
            }
            
            this._cart = cart;
            this._saveCart();
            
            NotificationManager.showToast('Added to cart!', 'success');
            log('[CartManager] Cart updated, items:', cart.length);
            
            return Promise.resolve(this.getCart());
        },

        /**
         * Remove item from cart
         * @param {string} productId - Product UUID to remove
         * @returns {Object} Updated cart
         */
        removeFromCart: function(productId) {
            log('[CartManager] Removing from cart:', productId);
            
            var cart = this._getCart();
            var newCart = [];
            
            for (var i = 0; i < cart.length; i++) {
                if (cart[i].productId !== productId) {
                    newCart.push(cart[i]);
                }
            }
            
            this._cart = newCart;
            this._saveCart();
            
            NotificationManager.showToast('Removed from cart', 'info');
            return this.getCart();
        },

        /**
         * Get current cart contents with product details
         * @param {boolean} includeDetails - Include full product details from DB
         * @returns {Promise<Object>} Cart object with items, counts, totals
         */
        getCart: function(includeDetails) {
            var cart = this._getCart();
            // BUG #5 FIX: Changed currency from 'USD' to 'KES'
            var summary = {
                items: cart,
                itemCount: 0,
                uniqueItems: cart.length,
                subtotal: 0,
                currency: 'KES'
            };
            
            // Calculate counts and subtotal
            for (var i = 0; i < cart.length; i++) {
                summary.itemCount += cart[i].quantity;
                if (cart[i].price) {
                    summary.subtotal += cart[i].price * cart[i].quantity;
                }
            }
            
            if (!includeDetails) {
                return Promise.resolve(summary);
            }
            
            // Fetch product details for each item
            if (cart.length === 0) {
                return Promise.resolve(summary);
            }
            
            var productIds = [];
            for (var j = 0; j < cart.length; j++) {
                productIds.push(cart[j].productId);
            }
            
            return window.sb
                .from('products')
                .select('*, product_images(*)')
                .in('id', productIds)
                .then(function(result) {
                    var products = result.data || [];
                    var detailedItems = [];
                    
                    for (var k = 0; k < cart.length; k++) {
                        var cartItem = cart[k];
                        var product = null;
                        
                        // Find matching product
                        for (var m = 0; m < products.length; m++) {
                            if (products[m].id === cartItem.productId) {
                                product = products[m];
                                break;
                            }
                        }
                        
                        // BUG #2 FIX: Replace spread operator with ES5-compatible code
                        // BEFORE: var detailedItem = { ...cartItem, product: product, ... };
                        var detailedItem = {};
                        Object.keys(cartItem).forEach(function(key) {
                            detailedItem[key] = cartItem[key];
                        });
                        detailedItem.product = product;
                        detailedItem.lineTotal = product ? (parseFloat(product.price) || 0) * cartItem.quantity : 0;
                        detailedItem.available = product ? (product.status === 'active' && (product.stock_quantity || 0) >= cartItem.quantity) : false;
                        
                        detailedItems.push(detailedItem);
                        
                        // Recalculate subtotal with actual prices
                        if (product) {
                            summary.subtotal += (parseFloat(product.price) || 0) * cartItem.quantity;
                        }
                    }
                    
                    summary.items = detailedItems;
                    summary.subtotal = parseFloat(summary.subtotal.toFixed(2));
                    
                    return summary;
                })
                .catch(function(error) {
                    error('[CartManager] Error fetching product details:', error);
                    return summary;
                });
        },

        /**
         * Clear entire cart
         * @returns {Object} Empty cart
         */
        clearCart: function() {
            log('[CartManager] Clearing cart');
            
            this._cart = [];
            this._saveCart();
            
            NotificationManager.showToast('Cart cleared', 'info');
            return this.getCart();
        },

        /**
         * Update item quantity
         * @param {string} productId - Product UUID
         * @param {number} quantity - New quantity (0 removes item)
         * @returns {Object} Updated cart
         */
        updateQuantity: function(productId, quantity) {
            quantity = parseInt(quantity) || 0;
            
            log('[CartManager] Updating quantity:', productId, 'qty:', quantity);
            
            if (quantity <= 0) {
                return this.removeFromCart(productId);
            }
            
            var cart = this._getCart();
            
            for (var i = 0; i < cart.length; i++) {
                if (cart[i].productId === productId) {
                    cart[i].quantity = quantity;
                    cart[i].updatedAt = new Date().toISOString();
                    break;
                }
            }
            
            this._cart = cart;
            this._saveCart();
            
            return this.getCart();
        },

        /**
         * Check if product is in cart
         * @param {string} productId - Product UUID
         * @returns {boolean} True if in cart
         */
        isInCart: function(productId) {
            var cart = this._getCart();
            for (var i = 0; i < cart.length; i++) {
                if (cart[i].productId === productId) {
                    return true;
                }
            }
            return false;
        },

        /**
         * Get quantity of specific product in cart
         * @param {string} productId - Product UUID
         * @returns {number} Quantity in cart
         */
        getItemQuantity: function(productId) {
            var cart = this._getCart();
            for (var i = 0; i < cart.length; i++) {
                if (cart[i].productId === productId) {
                    return cart[i].quantity;
                }
            }
            return 0;
        },

        /**
         * Get cart item count (for badge display)
         * @returns {number} Total item count
         */
        getCount: function() {
            var cart = this._getCart();
            var count = 0;
            for (var i = 0; i < cart.length; i++) {
                count += cart[i].quantity;
            }
            return count;
        },

        /**
         * Get cart subtotal
         * @returns {Promise<number>} Subtotal amount
         */
        getSubtotal: function() {
            return this.getCart(true).then(function(cart) {
                return cart.subtotal;
            });
        },

        /**
         * Merge server-side cart (for logged-in users)
         * @param {Array} serverCart - Cart from server/database
         * @returns {Promise<Object>} Merged cart
         */
        mergeWithServerCart: function(serverCart) {
            var localCart = this._getCart();
            var merged = localCart.slice();
            
            if (serverCart && serverCart.length > 0) {
                for (var i = 0; i < serverCart.length; i++) {
                    var serverItem = serverCart[i];
                    var found = false;
                    
                    for (var j = 0; j < merged.length; j++) {
                        if (merged[j].productId === serverItem.productId) {
                            merged[j].quantity += serverItem.quantity;
                            found = true;
                            break;
                        }
                    }
                    
                    if (!found) {
                        merged.push(serverItem);
                    }
                }
            }
            
            this._cart = merged;
            this._saveCart();
            
            return this.getCart();
        },

        /**
         * Load cart and update UI badge - called on auth state change
         * @returns {Promise<Object>} Cart data
         */
        loadCart: function() {
            log('[CartManager] Loading cart...');
            return this.getCart().then(function(cart) {
                // Update cart badge in UI
                var countBadge = document.getElementById('cartCount');
                if (countBadge) {
                    countBadge.textContent = cart.itemCount + ' item' + (cart.itemCount !== 1 ? 's' : '');
                }
                
                // Update any other cart count displays
                var cartBadges = document.querySelectorAll('.cart-badge, [data-cart-count]');
                for (var i = 0; i < cartBadges.length; i++) {
                    cartBadges[i].textContent = cart.itemCount;
                }
                
                return cart;
            }).catch(function(err) {
                error('[CartManager] Error loading cart:', err);
                return { items: [], itemCount: 0, subtotal: 0 };
            });
        }
    };


    // =========================================================================
    // E. WISHLIST MANAGER
    // =========================================================================

    /**
     * WishlistManager - Handles wishlist/favorites operations
     * Uses localStorage for guest users, can sync with server for logged-in users
     */
    window.WishlistManager = {
        /** @type {string} localStorage key */
        STORAGE_KEY: 'ksubject_wishlist',
        /** @type {Array} Wishlist cache */
        _wishlist: null,

        /**
         * Initialize wishlist from localStorage
         * @private
         * @returns {Array} Wishlist items
         */
        _getWishlist: function() {
            if (this._wishlist !== null) {
                return this._wishlist;
            }
            
            try {
                var stored = localStorage.getItem(this.STORAGE_KEY);
                this._wishlist = stored ? JSON.parse(stored) : [];
            } catch (e) {
                warn('[WishlistManager] Error reading wishlist:', e);
                this._wishlist = [];
            }
            
            return this._wishlist;
        },

        /**
         * Save wishlist to localStorage
         * @private
         */
        _saveWishlist: function() {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._wishlist || []));
                
                // Dispatch custom event for UI updates
                var event = new CustomEvent('wishlistUpdated', { detail: { wishlist: this._wishlist } });
                document.dispatchEvent(event);
            } catch (e) {
                warn('[WishlistManager] Error saving wishlist:', e);
            }
        },

        /**
         * Add product to wishlist
         * @param {string} productId - Product UUID
         * @returns {Promise<Object>} Updated wishlist
         */
        addToWishlist: function(productId) {
            log('[WishlistManager] Adding to wishlist:', productId);
            
            var wishlist = this._getWishlist();
            
            // Check if already in wishlist
            if (wishlist.indexOf(productId) !== -1) {
                NotificationManager.showToast('Already in wishlist', 'info');
                return Promise.resolve(this.getWishlist());
            }
            
            wishlist.push(productId);
            this._wishlist = wishlist;
            this._saveWishlist();
            
            NotificationManager.showToast('Added to wishlist!', 'success');
            
            // Sync to server if logged in
            if (window.currentUser && window.currentUser.id) {
                this._syncToServer();
            }
            
            return Promise.resolve(this.getWishlist());
        },

        /**
         * Remove product from wishlist
         * @param {string} productId - Product UUID
         * @returns {Object} Updated wishlist
         */
        removeFromWishlist: function(productId) {
            log('[WishlistManager] Removing from wishlist:', productId);
            
            var wishlist = this._getWishlist();
            var newWishlist = [];
            
            for (var i = 0; i < wishlist.length; i++) {
                if (wishlist[i] !== productId) {
                    newWishlist.push(wishlist[i]);
                }
            }
            
            this._wishlist = newWishlist;
            this._saveWishlist();
            
            NotificationManager.showToast('Removed from wishlist', 'info');
            
            // Sync to server if logged in
            if (window.currentUser && window.currentUser.id) {
                this._syncToServer();
            }
            
            return this.getWishlist();
        },

        /**
         * Get wishlist contents with optional product details
         * @param {boolean} includeDetails - Include full product details
         * @returns {Promise<Object>} Wishlist object
         */
        getWishlist: function(includeDetails) {
            var wishlist = this._getWishlist();
            var summary = {
                items: wishlist,
                count: wishlist.length
            };
            
            if (!includeDetails) {
                return Promise.resolve(summary);
            }
            
            if (wishlist.length === 0) {
                // BUG #2 FIX: Replace spread operator with ES5-compatible code
                // BEFORE: return Promise.resolve({ ...summary, products: [] });
                var emptyResult = {};
                Object.keys(summary).forEach(function(key) {
                    emptyResult[key] = summary[key];
                });
                emptyResult.products = [];
                return Promise.resolve(emptyResult);
            }
            
            return window.sb
                .from('products')
                .select('*, product_images(*)')
                .in('id', wishlist)
                .eq('is_active', true)
                .then(function(result) {
                    var products = result.data || [];
                    summary.products = products;
                    return summary;
                })
                .catch(function(error) {
                    error('[WishlistManager] Error fetching products:', error);
                    // BUG #2 FIX: Replace spread operator with ES5-compatible code
                    // BEFORE: return { ...summary, products: [] };
                    var errorResult = {};
                    Object.keys(summary).forEach(function(key) {
                        errorResult[key] = summary[key];
                    });
                    errorResult.products = [];
                    return errorResult;
                });
        },

        /**
         * Check if product is in wishlist
         * @param {string} productId - Product UUID
         * @returns {boolean} True if in wishlist
         */
        isInWishlist: function(productId) {
            var wishlist = this._getWishlist();
            return wishlist.indexOf(productId) !== -1;
        },

        /**
         * Toggle wishlist status (add if not present, remove if present)
         * @param {string} productId - Product UUID
         * @returns {Promise<Object>} Updated wishlist
         */
        toggleWishlist: function(productId) {
            if (this.isInWishlist(productId)) {
                return this.removeFromWishlist(productId);
            } else {
                return this.addToWishlist(productId);
            }
        },

        /**
         * Clear entire wishlist
         * @returns {Object} Empty wishlist
         */
        clearWishlist: function() {
            log('[WishlistManager] Clearing wishlist');
            
            this._wishlist = [];
            this._saveWishlist();
            
            NotificationManager.showToast('Wishlist cleared', 'info');
            return this.getWishlist();
        },

        /**
         * Sync wishlist to server for logged-in users
         * @private
         * @returns {Promise<void>}
         */
        _syncToServer: function() {
            if (!window.currentUser || !window.currentUser.id) {
                return Promise.resolve();
            }
            
            // This would sync to a user_wishlists table if implemented
            // For now, just log the action
            log('[WishlistManager] Would sync to server for user:', window.currentUser.id);
            return Promise.resolve();
        },

        /**
         * Move item from wishlist to cart
         * @param {string} productId - Product UUID
         * @returns {Promise<Object>} Result
         */
        // BUG #4 FIX: Fixed context loss in .then() callback
        moveToCart: function(productId) {
            log('[WishlistManager] Moving to cart:', productId);
            
            // Save reference to 'this' for use inside .then() callback
            var self = this;
            
            return CartManager.addToCart(productId, 1)
                .then(function(cart) {
                    // Use saved reference instead of 'this' which is undefined in this context
                    self.removeFromWishlist(productId);
                    NotificationManager.showToast('Moved to cart!', 'success');
                    return cart;
                });
        },

        /**
         * Get wishlist count (for badge display)
         * @returns {number} Number of items
         */
        getCount: function() {
            return this._getWishlist().length;
        },

        /**
         * Load wishlist and update UI - called on auth state change
         * @returns {Promise<Object>} Wishlist data
         */
        loadWishlist: function() {
            log('[WishlistManager] Loading wishlist...');
            return this.getWishlist().then(function(wishlist) {
                // Update wishlist badges in UI
                var wishBadges = document.querySelectorAll('.wishlist-badge, [data-wishlist-count]');
                for (var i = 0; i < wishBadges.length; i++) {
                    wishBadges[i].textContent = wishlist.items ? wishlist.items.length : wishlist.length;
                }
                
                // Update wishlist button states
                if (wishlist.items && wishlist.items.length > 0) {
                    var wishIds = wishlist.items.map(function(item) {
                        return typeof item === 'string' ? item : item.productId;
                    });
                    var wishButtons = document.querySelectorAll('[data-wishlist-btn]');
                    for (var j = 0; j < wishButtons.length; j++) {
                        var btn = wishButtons[j];
                        var productId = btn.getAttribute('data-product-id') || btn.getAttribute('data-wishlist-btn');
                        if (wishIds.indexOf(productId) !== -1) {
                            btn.classList.add('in-wishlist');
                            btn.setAttribute('aria-pressed', 'true');
                        } else {
                            btn.classList.remove('in-wishlist');
                            btn.setAttribute('aria-pressed', 'false');
                        }
                    }
                }
                
                return wishlist;
            }).catch(function(err) {
                error('[WishlistManager] Error loading wishlist:', err);
                return { items: [] };
            });
        }
    };


    // =========================================================================
    // F. NOTIFICATION MANAGER
    // =========================================================================

    /**
     * NotificationManager - Handles toast notifications and in-app notifications
     */
    // BUG #1 FIX: All self. references changed to this. in NotificationManager
    window.NotificationManager = {
        /** @type {string} Container ID */
        CONTAINER_ID: 'toast-container',
        /** @type {number} Default toast duration in ms */
        DEFAULT_DURATION: 4000,
        /** @type {number} Max visible toasts */
        MAX_TOASTS: 5,
        /** @type {Array} Active toast timers */
        _timers: [],

        /**
         * Show toast notification
         * @param {string} message - Notification message
         * @param {string} type - Type: success, error, warning, info
         * @param {number} duration - Duration in ms
         * @returns {string} Toast ID
         */
        showToast: function(message, type, duration) {
            type = type || 'info';
            // BUG #1 FIX: self -> this
            duration = duration || this.DEFAULT_DURATION;
            
            log('[NotificationManager] Toast:', type, message);
            
            // BUG #1 FIX: self -> this
            var container = this._getOrCreateContainer();
            var toastId = generateId();
            
            // Type-specific styling
            var typeConfig = {
                success: { icon: 'fa-check-circle', bg: 'bg-green-500', color: 'text-white' },
                error: { icon: 'fa-times-circle', bg: 'bg-red-500', color: 'text-white' },
                warning: { icon: 'fa-exclamation-triangle', bg: 'bg-yellow-500', color: 'text-white' },
                info: { icon: 'fa-info-circle', bg: 'bg-blue-500', color: 'text-white' }
            };
            
            var config = typeConfig[type] || typeConfig.info;
            
            // Create toast element
            var toast = document.createElement('div');
            toast.id = toastId;
            toast.className = config.bg + ' ' + config.color + ' px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform translate-x-full transition-transform duration-300 max-w-sm w-full';
            toast.setAttribute('role', 'alert');
            
            toast.innerHTML = 
                '<i class="fas ' + config.icon + ' flex-shrink-0"></i>' +
                '<p class="flex-1 text-sm font-medium">' + escapeHtml(message) + '</p>' +
                '<button class="toast-close flex-shrink-0 p-1 hover:bg-white/20 rounded" aria-label="Close">' +
                '<i class="fas fa-times text-sm"></i>' +
                '</button>';
            
            // Add close handler
            // BUG #1 FIX: Need to save reference to this for closure
            var notificationMgr = this;
            toast.querySelector('.toast-close').onclick = function() {
                notificationMgr._removeToast(toastId);
            };
            
            container.appendChild(toast);
            
            // Animate in
            requestAnimationFrame(function() {
                toast.classList.remove('translate-x-full');
                toast.classList.add('translate-x-0');
            });
            
            // Limit visible toasts
            // BUG #1 FIX: self -> this (using saved reference)
            var toasts = container.querySelectorAll('[id^="id_"]');
            if (toasts.length > notificationMgr.MAX_TOASTS) {
                notificationMgr._removeToast(toasts[0].id);
            }
            
            // Auto-remove after duration
            var timer = setTimeout(function() {
                notificationMgr._removeToast(toastId);
            }, duration);
            
            // BUG #1 FIX: self -> this (using saved reference)
            notificationMgr._timers.push({ id: toastId, timer: timer });
            
            return toastId;
        },

        /**
         * Get or create toast container
         * @private
         * @returns {HTMLElement} Container element
         */
        _getOrCreateContainer: function() {
            // BUG #1 FIX: self -> this
            var container = document.getElementById(this.CONTAINER_ID);
            if (!container) {
                container = document.createElement('div');
                // BUG #1 FIX: self -> this
                container.id = this.CONTAINER_ID;
                container.className = 'fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none';
                container.style.cssText = 'pointer-events: none;';
                document.body.appendChild(container);
            }
            return container;
        },

        /**
         * Remove toast with animation
         * @private
         * @param {string} toastId - Toast element ID
         */
        _removeToast: function(toastId) {
            var toast = document.getElementById(toastId);
            if (!toast) return;
            
            // Clear timer if exists
            // BUG #1 FIX: self -> this
            for (var i = 0; i < this._timers.length; i++) {
                if (this._timers[i].id === toastId) {
                    clearTimeout(this._timers[i].timer);
                    this._timers.splice(i, 1);
                    break;
                }
            }
            
            // Animate out
            toast.classList.remove('translate-x-0');
            toast.classList.add('translate-x-full');
            
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        },

        /**
         * Get notifications for current user
         * @param {Object} options - Query options (limit, unreadOnly)
         * @returns {Promise<Array>} Notifications array
         */
        getNotifications: function(options) {
            options = options || {};
            
            log('[NotificationManager] Getting notifications...');
            
            if (!window.currentUser || !window.currentUser.id) {
                return Promise.resolve([]);
            }
            
            var query = window.sb
                .from('notifications')
                .select('*')
                .eq('user_id', window.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(options.limit || 20);
            
            if (options.unreadOnly) {
                query = query.eq('read', false);
            }
            
            return query
                .then(function(result) {
                    return result.data || [];
                })
                .catch(function(error) {
                    error('[NotificationManager] Error getting notifications:', error);
                    return [];
                });
        },

        /**
         * Mark notification as read
         * @param {string} id - Notification ID
         * @returns {Promise<boolean>} Success status
         */
        markAsRead: function(id) {
            if (!window.currentUser || !window.currentUser.id) {
                return Promise.resolve(false);
            }
            
            return window.sb
                .from('notifications')
                .update({ read: true, read_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_id', window.currentUser.id)
                .then(function() {
                    log('[NotificationManager] Marked as read:', id);
                    
                    // Dispatch event
                    var event = new CustomEvent('notificationRead', { detail: { id: id } });
                    document.dispatchEvent(event);
                    
                    return true;
                })
                .catch(function(error) {
                    error('[NotificationManager] Error marking read:', error);
                    return false;
                });
        },

        /**
         * Mark all notifications as read
         * @returns {Promise<boolean>} Success status
         */
        markAllAsRead: function() {
            if (!window.currentUser || !window.currentUser.id) {
                return Promise.resolve(false);
            }
            
            return window.sb
                .from('notifications')
                .update({ read: true, read_at: new Date().toISOString() })
                .eq('user_id', window.currentUser.id)
                .eq('read', false)
                .then(function() {
                    log('[NotificationManager] All marked as read');
                    
                    var event = new Event('notificationsAllRead');
                    document.dispatchEvent(event);
                    
                    return true;
                })
                .catch(function(error) {
                    error('[NotificationManager] Error marking all read:', error);
                    return false;
                });
        },

        /**
         * Get unread notification count
         * @returns {Promise<number>} Unread count
         */
        getUnreadCount: function() {
            if (!window.currentUser || !window.currentUser.id) {
                return Promise.resolve(0);
            }
            
            return window.sb
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', window.currentUser.id)
                .eq('read', false)
                .then(function(result) {
                    return result.count || 0;
                })
                .catch(function(error) {
                    error('[NotificationManager] Error getting unread count:', error);
                    return 0;
                });
        },

        /**
         * Delete notification
         * @param {string} id - Notification ID
         * @returns {Promise<boolean>} Success status
         */
        deleteNotification: function(id) {
            if (!window.currentUser || !window.currentUser.id) {
                return Promise.resolve(false);
            }
            
            return window.sb
                .from('notifications')
                .delete()
                .eq('id', id)
                .eq('user_id', window.currentUser.id)
                .then(function() {
                    return true;
                })
                .catch(function(error) {
                    error('[NotificationManager] Error deleting notification:', error);
                    return false;
                });
        },

        /**
         * Confirm action with a dialog
         * @param {string} message - Confirmation message
         * @param {Object} options - Options (title, confirmText, cancelText, type)
         * @returns {Promise<boolean>} User's choice
         */
        confirm: function(message, options) {
            options = options || {};
            
            return new Promise(function(resolve) {
                var typeClasses = {
                    danger: 'bg-red-600 hover:bg-red-700',
                    warning: 'bg-yellow-600 hover:bg-yellow-700',
                    info: 'bg-blue-600 hover:bg-blue-700'
                };
                
                var btnClass = typeClasses[options.type] || typeClasses.info;
                
                var content = 
                    '<div class="text-center py-2">' +
                    '<i class="fas ' + (options.icon || 'fa-question-circle') + ' text-4xl text-gray-400 mb-4"></i>' +
                    '<p class="text-gray-700">' + escapeHtml(message) + '</p>' +
                    '</div>';
                
                var footer = 
                    '<button class="confirm-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">' +
                    (options.cancelText || 'Cancel') +
                    '</button>' +
                    '<button class="confirm-ok px-4 py-2 text-sm text-white rounded-lg transition-colors ' + btnClass + '">' +
                    (options.confirmText || 'Confirm') +
                    '</button>';
                
                showModal(content, {
                    title: options.title || 'Confirm Action',
                    footer: footer,
                    onClose: function() {
                        resolve(false);
                    }
                });
                
                // Handle buttons after modal is in DOM
                setTimeout(function() {
                    var okBtn = document.querySelector('.confirm-ok');
                    var cancelBtn = document.querySelector('.confirm-cancel');
                    
                    if (okBtn) {
                        okBtn.onclick = function() {
                            closeModal();
                            resolve(true);
                        };
                    }
                    
                    if (cancelBtn) {
                        cancelBtn.onclick = function() {
                            closeModal();
                            resolve(false);
                        };
                    }
                }, 100);
            });
        },

        /**
         * Render notification badge in header/nav - called on auth state change
         * Updates unread count display
         */
        renderNotificationBadge: function() {
            log('[NotificationManager] Rendering notification badge...');
            
            if (!window.currentUser || !window.currentUser.id) {
                // Hide badges when not logged in
                var notifBadges = document.querySelectorAll('.notification-badge, [data-notification-count]');
                for (var i = 0; i < notifBadges.length; i++) {
                    notifBadges[i].style.display = 'none';
                    notifBadges[i].textContent = '0';
                }
                return Promise.resolve(0);
            }
            
            // BUG #1 FIX: self -> this
            var notifMgr = this;
            return notifMgr.getUnreadCount().then(function(count) {
                var notifBadges = document.querySelectorAll('.notification-badge, [data-notification-count]');
                
                for (var j = 0; j < notifBadges.length; j++) {
                    var badge = notifBadges[j];
                    badge.textContent = count.toString();
                    
                    if (count > 0) {
                        badge.style.display = '';
                        badge.classList.add('has-unread');
                    } else {
                        badge.style.display = 'none';
                        badge.classList.remove('has-unread');
                    }
                }
                
                // Also update bell icon indicator
                var bellIcons = document.querySelectorAll('.notification-bell, [data-notification-bell]');
                for (var k = 0; k < bellIcons.length; k++) {
                    if (count > 0) {
                        bellIcons[k].classList.add('has-notifications');
                    } else {
                        bellIcons[k].classList.remove('has-notifications');
                    }
                }
                
                return count;
            }).catch(function(err) {
                error('[NotificationManager] Error rendering badge:', err);
                return 0;
            });
        }
    };


    // =========================================================================
    // G. CONTACT MANAGER
    // =========================================================================

    /**
     * ContactManager - Handles contact form submissions and validation
     */
    // BUG #1 FIX: All self. references changed to this. in ContactManager
    window.ContactManager = {
        /** @type {Object} Validation rules */
        validationRules: {
            name: { required: true, minLength: 2, maxLength: 100 },
            email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
            subject: { required: true, minLength: 3, maxLength: 200 },
            message: { required: true, minLength: 10, maxLength: 5000 },
            phone: { required: false, pattern: /^[\d\s\-\+\(\)]*$/ }
        },

        /**
         * Submit contact form
         * @param {Object} data - Form data (name, email, subject, message, phone)
         * @returns {Promise<Object>} Submission result
         */
        submitContactForm: function(data) {
            log('[ContactManager] Submitting form...');
            
            // Validate form data
            // BUG #1 FIX: self -> this
            var validation = this.validateForm(data);
            if (!validation.isValid) {
                NotificationManager.showToast(validation.errors[0], 'error');
                return Promise.reject(new Error('Validation failed: ' + validation.errors.join(', ')));
            }
            
            // Prepare submission data
            // BUG #7 FIX: Added XSS prevention with eh() sanitization
            var formData = {
                name: eh(data.name.trim()),
                email: data.email.trim().toLowerCase(),
                subject: eh(data.subject.trim()),
                message: eh(data.message.trim()),
                phone: data.phone ? data.phone.trim() : null,
                user_id: window.currentUser ? window.currentUser.id : null,
                created_at: new Date().toISOString()
            };
            
            // Try to save to contacts table, fall back to alternative methods
            return window.sb
                .from('contacts')
                .insert(formData)
                .select()
                .single()
                .then(function(result) {
                    log('[ContactManager] Form submitted:', result.data.id);
                    NotificationManager.showToast('Message sent successfully! We\'ll get back to you soon.', 'success');
                    return { success: true, data: result.data };
                })
                .catch(function(error) {
                    error('[ContactManager] Submission error:', error);
                    
                    // If table doesn't exist, still show success (could use email service)
                    if (error.code === '42P01') { // Table doesn't exist
                        log('[ContactManager] Table not found, using fallback');
                        NotificationManager.showToast('Message sent successfully! We\'ll get back to you soon.', 'success');
                        return { success: true, fallback: true };
                    }
                    
                    NotificationManager.showToast('Failed to send message. Please try again.', 'error');
                    return { success: false, error: error.message };
                });
        },

        /**
         * Validate contact form data
         * @param {Object} data - Form data to validate
         * @returns {Object} Validation result (isValid, errors, fields)
         */
        validateForm: function(data) {
            var result = {
                isValid: true,
                errors: [],
                fields: {}
            };
            
            if (!data) {
                result.isValid = false;
                result.errors.push('Form data is required');
                return result;
            }
            
            // BUG #1 FIX: self -> this
            var rules = this.validationRules;
            var fieldNames = Object.keys(rules);
            
            for (var i = 0; i < fieldNames.length; i++) {
                var field = fieldNames[i];
                var rule = rules[field];
                var value = data[field];
                var fieldErrors = [];
                
                // Required check
                if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
                    fieldErrors.push(field.charAt(0).toUpperCase() + field.slice(1) + ' is required');
                }
                
                // Min length check
                if (value && rule.minLength && value.length < rule.minLength) {
                    fieldErrors.push(field.charAt(0).toUpperCase() + field.slice(1) + ' must be at least ' + rule.minLength + ' characters');
                }
                
                // Max length check
                if (value && rule.maxLength && value.length > rule.maxLength) {
                    fieldErrors.push(field.charAt(0).toUpperCase() + field.slice(1) + ' must be less than ' + rule.maxLength + ' characters');
                }
                
                // Pattern check
                if (value && rule.pattern && !rule.pattern.test(value)) {
                    fieldErrors.push(field.charAt(0).toUpperCase() + field.slice(1) + ' format is invalid');
                }
                
                result.fields[field] = {
                    valid: fieldErrors.length === 0,
                    errors: fieldErrors
                };
                
                if (fieldErrors.length > 0) {
                    result.isValid = false;
                    result.errors = result.errors.concat(fieldErrors);
                }
            }
            
            return result;
        },

        /**
         * Show validation errors on form
         * @param {Object} validationResult - Result from validateForm
         * @param {HTMLElement} formElement - Form element to show errors on
         */
        showValidationErrors: function(validationResult, formElement) {
            // Clear previous errors
            var existingErrors = formElement.querySelectorAll('.field-error');
            for (var i = 0; i < existingErrors.length; i++) {
                existingErrors[i].remove();
            }
            
            var fields = Object.keys(validationResult.fields);
            for (var j = 0; j < fields.length; j++) {
                var field = fields[j];
                var fieldResult = validationResult.fields[field];
                
                if (!fieldResult.valid) {
                    var input = formElement.querySelector('[name="' + field + '"]');
                    if (input) {
                        input.classList.add('border-red-500');
                        
                        var errorEl = document.createElement('p');
                        errorEl.className = 'field-error text-red-500 text-xs mt-1';
                        errorEl.textContent = fieldResult.errors[0];
                        input.parentNode.insertBefore(errorEl, input.nextSibling);
                    }
                }
            }
        },

        /**
         * Clear validation errors from form
         * @param {HTMLElement} formElement - Form element
         */
        clearValidationErrors: function(formElement) {
            var errors = formElement.querySelectorAll('.field-error');
            for (var i = 0; i < errors.length; i++) {
                errors[i].remove();
            }
            
            var inputs = formElement.querySelectorAll('.border-red-500');
            for (var j = 0; j < inputs.length; j++) {
                inputs[j].classList.remove('border-red-500');
            }
        },

        /**
         * Collect form data from HTML form element
         * @param {HTMLElement} formElement - Form element
         * @returns {Object} Form data object
         */
        collectFormData: function(formElement) {
            var data = {};
            var inputs = formElement.querySelectorAll('input, select, textarea');
            
            for (var i = 0; i < inputs.length; i++) {
                var input = inputs[i];
                if (input.name) {
                    data[input.name] = input.value;
                }
            }
            
            return data;
        }
    };


    // =========================================================================
    // H. NEWSLETTER MANAGER
    // =========================================================================

    /**
     * NewsletterManager - Handles newsletter subscriptions
     */
    // BUG #1 FIX: All self. references changed to this. in NewsletterManager
    window.NewsletterManager = {
        /** @type {string} localStorage key for tracking */
        TRACKING_KEY: 'ksubject_newsletter_subscribed',

        /**
         * Subscribe email to newsletter
         * @param {string} email - Email address to subscribe
         * @param {Object} options - Additional options (name, interests)
         * @returns {Promise<Object>} Subscription result
         */
        subscribe: function(email, options) {
            options = options || {};
            
            log('[NewsletterManager] Subscribing:', email);
            
            // Validate email
            // BUG #1 FIX: self -> this
            var validation = this.validateEmail(email);
            if (!validation.isValid) {
                NotificationManager.showToast(validation.error, 'error');
                return Promise.reject(new Error(validation.error));
            }
            
            var cleanEmail = email.trim().toLowerCase();
            
            // Prepare subscription data
            var subData = {
                email: cleanEmail,
                name: options.name || null,
                interests: options.interests || [],
                status: 'active',
                subscribed_at: new Date().toISOString(),
                source: options.source || 'website'
            };
            
            // Try to insert into newsletters table
            // BUG #1 FIX: Save reference for use in callbacks
            var newsletterMgr = this;
            return window.sb
                .from('newsletters')
                .upsert(subData, { onConflict: 'email' })
                .select()
                .single()
                .then(function(result) {
                    log('[NewsletterManager] Subscribed:', result.data.id);
                    
                    // Track locally
                    try {
                        // BUG #1 FIX: self -> newsletterMgr (saved reference)
                        localStorage.setItem(newsletterMgr.TRACKING_KEY, JSON.stringify({
                            email: cleanEmail,
                            date: new Date().toISOString()
                        }));
                    } catch (e) {}
                    
                    NotificationManager.showToast('Successfully subscribed to our newsletter!', 'success');
                    return { success: true, data: result.data };
                })
                .catch(function(error) {
                    error('[NewsletterManager] Subscription error:', error);
                    
                    // If table doesn't exist, track locally anyway
                    if (error.code === '42P01') {
                        try {
                            // BUG #1 FIX: self -> newsletterMgr (saved reference)
                            localStorage.setItem(newsletterMgr.TRACKING_KEY, JSON.stringify({
                                email: cleanEmail,
                                date: new Date().toISOString()
                            }));
                        } catch (e) {}
                        
                        NotificationManager.showToast('Successfully subscribed!', 'success');
                        return { success: true, fallback: true };
                    }
                    
                    // Duplicate email might already be subscribed
                    if (error.code === '23505') {
                        NotificationManager.showToast('This email is already subscribed!', 'info');
                        return { success: true, alreadySubscribed: true };
                    }
                    
                    NotificationManager.showToast('Subscription failed. Please try again.', 'error');
                    return { success: false, error: error.message };
                });
        },

        /**
         * Unsubscribe email from newsletter
         * @param {string} email - Email address to unsubscribe
         * @returns {Promise<Object>} Unsubscription result
         */
        unsubscribe: function(email) {
            log('[NewsletterManager] Unsubscribing:', email);
            
            // BUG #1 FIX: self -> this
            var validation = this.validateEmail(email);
            if (!validation.isValid) {
                return Promise.reject(new Error(validation.error));
            }
            
            var cleanEmail = email.trim().toLowerCase();
            
            // BUG #1 FIX: Save reference for use in callbacks
            var newsletterMgr = this;
            return window.sb
                .from('newsletters')
                .update({ 
                    status: 'unsubscribed', 
                    unsubscribed_at: new Date().toISOString() 
                })
                .eq('email', cleanEmail)
                .then(function() {
                    log('[NewsletterManager] Unsubscribed:', cleanEmail);
                    
                    // Remove local tracking
                    try {
                        // BUG #1 FIX: self -> newsletterMgr (saved reference)
                        localStorage.removeItem(newsletterMgr.TRACKING_KEY);
                    } catch (e) {}
                    
                    NotificationManager.showToast('You have been unsubscribed.', 'info');
                    return { success: true };
                })
                .catch(function(error) {
                    error('[NewsletterManager] Unsubscription error:', error);
                    NotificationManager.showToast('Unsubscription failed. Please try again.', 'error');
                    return { success: false, error: error.message };
                });
        },

        /**
         * Validate email address format
         * @param {string} email - Email to validate
         * @returns {Object} Validation result (isValid, error)
         */
        validateEmail: function(email) {
            if (!email || typeof email !== 'string') {
                return { isValid: false, error: 'Email address is required' };
            }
            
            var cleanEmail = email.trim();
            
            if (cleanEmail.length === 0) {
                return { isValid: false, error: 'Email address is required' };
            }
            
            if (cleanEmail.length > 254) {
                return { isValid: false, error: 'Email address is too long' };
            }
            
            // Basic email regex
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(cleanEmail)) {
                return { isValid: false, error: 'Please enter a valid email address' };
            }
            
            // Additional checks
            var parts = cleanEmail.split('@');
            if (parts.length !== 2) {
                return { isValid: false, error: 'Please enter a valid email address' };
            }
            
            var domain = parts[1];
            if (domain.indexOf('.') === -1) {
                return { isValid: false, error: 'Please enter a valid email address' };
            }
            
            return { isValid: true, error: null };
        },

        /**
         * Check if email is currently subscribed
         * @param {string} email - Email to check
         * @returns {Promise<boolean>} Subscription status
         */
        isSubscribed: function(email) {
            if (!email) {
                // Check local storage
                // BUG #1 FIX: self -> this
                try {
                    var tracked = localStorage.getItem(this.TRACKING_KEY);
                    return Promise.resolve(!!tracked);
                } catch (e) {
                    return Promise.resolve(false);
                }
            }
            
            return window.sb
                .from('newsletters')
                .select('id')
                .eq('email', email.trim().toLowerCase())
                .eq('status', 'active')
                .maybeSingle()
                .then(function(result) {
                    return !!result.data;
                })
                .catch(function() {
                    return false;
                });
        },

        /**
         * Update subscription preferences
         * @param {string} email - Subscriber email
         * @param {Object} preferences - Preferences to update
         * @returns {Promise<Object>} Update result
         */
        updatePreferences: function(email, preferences) {
            log('[NewsletterManager] Updating preferences for:', email);
            
            var updates = {
                updated_at: new Date().toISOString()
            };
            
            if (preferences.name !== undefined) {
                updates.name = preferences.name;
            }
            if (preferences.interests) {
                updates.interests = preferences.interests;
            }
            
            return window.sb
                .from('newsletters')
                .update(updates)
                .eq('email', email.trim().toLowerCase())
                .then(function(result) {
                    NotificationManager.showToast('Preferences updated!', 'success');
                    return { success: true, data: result.data };
                })
                .catch(function(error) {
                    error('[NewsletterManager] Update error:', error);
                    NotificationManager.showToast('Failed to update preferences', 'error');
                    return { success: false, error: error.message };
                });
        }
    };


    // =========================================================================
    // INITIALIZATION & EVENT SETUP
    // =========================================================================

    /**
     * Initialize marketplace managers
     * Called when DOM is ready
     */
    window.initMarketplace = function() {
        log('[Marketplace] Initializing...');
        
        // Setup global error handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', function(event) {
            error('[Marketplace] Unhandled rejection:', event.reason);
        });
        
        // Setup keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Escape key closes modals
            if (e.key === 'Escape') {
                closeModal();
            }
        });
        
        log('[Marketplace] Initialized successfully');
        return true;
    };

    /**
     * Auto-initialize when DOM is ready
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.initMarketplace);
    } else {
        window.initMarketplace();
    }

    // Log successful loading
    log('[marketplace.js] Loaded successfully - All managers available');

})();
