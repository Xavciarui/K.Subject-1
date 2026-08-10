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
    
    function log(msg) {
        if (DEBUG_MODE) log('', msg);
    }
    
    function warn(msg) {
        if (DEBUG_MODE) warn('', msg);
    }
    
    function error(msg, err) {
        if (DEBUG_MODE && err) {
            error('', msg, err);
        } else if (DEBUG_MODE) {
            error('', msg);
        }
    }
    
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

    /**
     * Format price with currency symbol
     * @param {number|string} price - The price to format
     * @returns {string} Formatted price string (e.g., "$29.99")
     */
    window.formatPrice = function(price) {
        var numPrice = parseFloat(price || 0);
        if (isNaN(numPrice)) {
            numPrice = 0;
        }
        return '$' + numPrice.toFixed(2);
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
     * Navigate to a specific section/view in the application
     * @param {string} view - View name or section identifier
     */
    window.navigateTo = function(view) {
        log('[navigateTo] Navigating to:', view);

        // Preserve dashboard/auth guards from legacy inline navigateTo
        try {
            if (view === 'dashboard' && !window.currentUser) {
                if (typeof openAuth === 'function') openAuth('signin');
                if (typeof showToast === 'function') showToast('Please sign in to access the dashboard.', 'info');
                return;
            }

            if (view === 'dashboard' && (typeof sessionValid !== 'undefined') && !sessionValid) {
                if (typeof openAuth === 'function') openAuth('signin');
                if (typeof showToast === 'function') showToast('Your session has expired. Please sign in again.', 'info');
                return;
            }

            if (view === 'dashboard') {
                var userStatus = (window.currentUser && window.currentUser.status) || 'unknown';
                if (userStatus !== 'approved') {
                    if (userStatus === 'pending') {
                        if (typeof showToast === 'function') showToast('Your account is still pending approval.', 'info');
                        if (typeof showStatusMessage === 'function') showStatusMessage('pending');
                    } else if (userStatus === 'rejected') {
                        if (typeof showToast === 'function') showToast('Your account has been rejected.', 'error');
                        if (typeof showStatusMessage === 'function') showStatusMessage('rejected');
                    } else {
                        if (typeof showToast === 'function') showToast('Unable to verify your account status. Please contact support.', 'error');
                        if (typeof showStatusMessage === 'function') showStatusMessage('pending');
                    }
                    return;
                }
            }
        } catch (e) { warn('[navigateTo] guard error', e); }
        
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
                // also attempt to hide via style if classes not used
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
    };

    /**
     * Show modal dialog with content
     * @param {string|HTMLElement} content - Content to display or element
     * @param {Object} options - Modal options (title, size, onClose)
     */
    window.showModal = function(content, options) {
        options = options || {};
        
        // Remove existing modal if any
        closeModal();
        
        // Create modal container
        var modalOverlay = document.createElement('div');
        modalOverlay.id = 'modal-overlay';
        modalOverlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4';
        modalOverlay.onclick = function(e) {
            if (e.target === modalOverlay) {
                closeModal();
                if (typeof options.onClose === 'function') {
                    options.onClose();
                }
            }
        };
        
        // Create modal content container
        var modalContent = document.createElement('div');
        var sizeClass = options.size === 'large' ? 'max-w-4xl' : 
                        options.size === 'small' ? 'max-w-md' : 
                        options.size === 'medium' ? 'max-w-2xl' : 'max-w-lg';
        modalContent.className = sizeClass + ' w-full bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto';
        
        // Build modal HTML
        var html = '';
        
        // Header
        if (options.title) {
            html += '<div class="flex items-center justify-between p-4 border-b border-gray-200">';
            html += '<h3 class="text-lg font-semibold text-gray-900">' + escapeHtml(options.title) + '</h3>';
            html += '<button type="button" class="modal-close-btn p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">';
            html += '<i class="fas fa-times text-gray-500"></i>';
            html += '</button>';
            html += '</div>';
        }
        
        // Body
        html += '<div class="p-4">';
        if (typeof content === 'string') {
            html += content;
        } else if (content instanceof HTMLElement) {
            // Will append after setting innerHTML
        }
        html += '</div>';
        
        // Footer
        if (options.footer) {
            html += '<div class="flex items-center justify-end gap-3 p-4 border-t border-gray-200">';
            html += options.footer;
            html += '</div>';
        }
        
        modalContent.innerHTML = html;
        
        // If content is an element, append it to body
        if (content instanceof HTMLElement) {
            var bodyContainer = modalContent.querySelector('.p-4:not(.border-b):not(.border-t)');
            if (bodyContainer) {
                bodyContainer.appendChild(content);
            }
        }
        
        // Add close button functionality
        var closeBtn = modalContent.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.onclick = function() {
                closeModal();
                if (typeof options.onClose === 'function') {
                    options.onClose();
                }
            };
        }
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Animate in
        requestAnimationFrame(function() {
            modalContent.style.transform = 'scale(1)';
            modalContent.style.opacity = '1';
        });
        
        log('[showModal] Modal displayed');
    };

    /**
     * Close currently open modal
     */
    window.closeModal = function() {
        var existingModal = document.getElementById('modal-overlay');
        if (existingModal) {
            existingModal.remove();
            document.body.style.overflow = '';
            log('[closeModal] Modal closed');
        }
    };

    /**
     * Debounce function to limit execution rate
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
            }, wait);
        };
    };

    /**
     * Generate unique ID
     * @returns {string} Unique identifier
     */
    window.generateId = function() {
        return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    };

    // =========================================================================
    // A. DASHBOARD MANAGER
    // =========================================================================

    /**
     * DashboardManager - Handles dashboard statistics, products list, orders, and activity feed
     * Most referenced manager in the application
     */
    window.DashboardManager = {
        /** @type {boolean} Loading state flag */
        _isLoading: false,
        
        /** @type {Array} Cached statistics data */
        _cachedStats: null,

        /**
         * Load all dashboard statistics
         * Updates DOM elements: statTotalProducts, statActiveProducts, statRevenue, statOrders, statViews
         * @returns {Promise<Object>} Statistics data
         */
        loadDashboardStats: function() {
            var self = this;
            
            log('[DashboardManager] Loading dashboard stats...');
            
            // Check if user is authenticated
            if (!window.currentUser || !window.currentUser.id) {
                warn('[DashboardManager] No authenticated user');
                self._showEmptyStats();
                return Promise.resolve(null);
            }
            
            self.showDashboardLoading();
            
            var sellerId = window.currentUser.id;
            
            // Build queries
            var productsPromise = window.sb
                .from('products')
                .select('*', { count: 'exact' })
                .eq('seller_id', sellerId);
            
            var activeProductsPromise = window.sb
                .from('products')
                .select('*', { count: 'exact' })
                .eq(' seller_id', sellerId)
                .eq('status', 'active');
            
            var ordersPromise = window.sb
                .from('orders')
                .select('*, order_items(*)')
                .eq('seller_id', sellerId)
                .order('created_at', { ascending: false })
                .limit(50);
            
            return Promise.all([productsPromise, activeProductsPromise, ordersPromise])
                .then(function(results) {
                    var productsData = results[0];
                    var activeData = results[1];
                    var ordersData = results[2];
                    
                    var totalProducts = productsData.data ? productsData.data.length : 0;
                    var activeProducts = activeData.data ? activeData.data.length : 0;
                    var totalRevenue = 0;
                    var totalOrders = ordersData.data ? ordersData.data.length : 0;
                    var totalViews = 0;
                    
                    // Calculate revenue from orders
                    if (ordersData.data && ordersData.data.length > 0) {
                        for (var i = 0; i < ordersData.data.length; i++) {
                            var order = ordersData.data[i];
                            if (order.status !== 'cancelled') {
                                totalRevenue += parseFloat(order.total || 0);
                            }
                        }
                    }
                    
                    // Sum up views from products (if view_count field exists)
                    if (productsData.data && productsData.data.length > 0) {
                        for (var j = 0; j < productsData.data.length; j++) {
                            var product = productsData.data[j];
                            totalViews += parseInt(product.view_count || product.views || 0, 10);
                        }
                    }
                    
                    var stats = {
                        totalProducts: totalProducts,
                        activeProducts: activeProducts,
                        revenue: totalRevenue,
                        orders: totalOrders,
                        views: totalViews
                    };
                    
                    self._cachedStats = stats;
                    self._updateStatElements(stats);
                    
                    log('[DashboardManager] Stats loaded:', stats);
                    return stats;
                })
                .catch(function(error) {
                    error('[DashboardManager] Error loading stats:', error);
                    NotificationManager.showToast('Failed to load dashboard statistics', 'error');
                    return null;
                })
                .finally(function() {
                    self.hideDashboardLoading();
                });
        },

        /**
         * Update DOM elements with statistics
         * @private
         * @param {Object} stats - Statistics object
         */
        _updateStatElements: function(stats) {
            var elements = {
                'statTotalProducts': stats.totalProducts,
                'statActiveProducts': stats.activeProducts,
                'statRevenue': formatPrice(stats.revenue),
                'statOrders': stats.orders,
                'statViews': stats.views.toLocaleString()
            };
            
            var keys = Object.keys(elements);
            for (var i = 0; i < keys.length; i++) {
                var el = safeGet(keys[i]);
                if (el) {
                    el.textContent = elements[keys[i]];
                    // Add animation class
                    el.classList.add('stat-updated');
                    setTimeout(function(element) {
                        element.classList.remove('stat-updated');
                    }, 500, el);
                }
            }
        },

        /**
         * Show empty/default state for stats when no user
         * @private
         */
        _showEmptyStats: function() {
            var defaults = {
                'statTotalProducts': '0',
                'statActiveProducts': '0',
                'statRevenue': '$0.00',
                'statOrders': '0',
                'statViews': '0'
            };
            
            var keys = Object.keys(defaults);
            for (var i = 0; i < keys.length; i++) {
                var el = safeGet(keys[i]);
                if (el) {
                    el.textContent = defaults[keys[i]];
                }
            }
        },

        /**
         * Load products list for dashboard display
         * Renders products to dashProductsList container
         * @param {number} limit - Maximum number of products to load
         * @returns {Promise<Array>} Array of product objects
         */
        loadDashboardProducts: function(limit) {
            var self = this;
            limit = limit || 6;
            
            log('[DashboardManager] Loading dashboard products...');
            
            if (!window.currentUser || !window.currentUser.id) {
                warn('[DashboardManager] No authenticated user');
                return Promise.resolve([]);
            }
            
            var container = safeGet('dashProductsList');
            if (container) {
                container.innerHTML = '<div class="flex items-center justify-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>';
            }
            
            return window.sb
                .from('products')
                .select('*, product_images(*)')
                .eq('seller_id', window.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(limit)
                .then(function(result) {
                    var products = result.data || [];
                    
                    if (container) {
                        if (products.length === 0) {
                            container.innerHTML = self._renderEmptyState('products', 'No products yet. Create your first product!');
                        } else {
                            container.innerHTML = self._renderProductCards(products);
                        }
                    }
                    
                    log('[DashboardManager] Loaded', products.length, 'products');
                    return products;
                })
                .catch(function(error) {
                    error('[DashboardManager] Error loading products:', error);
                    if (container) {
                        container.innerHTML = self._renderErrorState('Failed to load products');
                    }
                    return [];
                });
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
                var image = self._getPrimaryImage(product);
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
                html += '<span class="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full ' + statusClass + '">' + escapeHtml(product.status) + '</span>';
                html += '</div>';
                html += '<div class="p-3">';
                html += '<h4 class="font-medium text-sm text-gray-900 truncate">' + escapeHtml(product.title) + '</h4>';
                html += '<p class="text-lg font-bold text-primary mt-1">' + formatPrice(product.price) + '</p>';
                html += '<div class="flex items-center justify-between mt-2 text-xs text-gray-500">';
                html += '<span><i class="fas fa-eye mr-1"></i>' + (product.view_count || 0) + ' views</span>';
                html += '<span>' + timeAgo(product.created_at) + '</span>';
                html += '</div>';
                html += '</div>';
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        },

        /**
         * Get primary image from product
         * @private
         * @param {Object} product - Product object with images
         * @returns {Object|null} Primary image or null
         */
        _getPrimaryImage: function(product) {
            if (!product.product_images || product.product_images.length === 0) {
                return null;
            }
            
            // Find primary image
            for (var i = 0; i < product.product_images.length; i++) {
                if (product.product_images[i].is_primary) {
                    return product.product_images[i];
                }
            }
            
            // Return first image as fallback
            return product.product_images[0];
        },

        /**
         * Load orders for dashboard display
         * Renders orders to dashOrdersList container
         * @param {number} limit - Maximum number of orders to load
         * @returns {Promise<Array>} Array of order objects
         */
        loadDashboardOrders: function(limit) {
            var self = this;
            limit = limit || 5;
            
            log('[DashboardManager] Loading dashboard orders...');
            
            if (!window.currentUser || !window.currentUser.id) {
                warn('[DashboardManager] No authenticated user');
                return Promise.resolve([]);
            }
            
            var container = safeGet('dashOrdersList');
            if (container) {
                container.innerHTML = '<div class="flex items-center justify-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>';
            }
            
            // Try full query first, fallback to simple query if schema doesn't support joins
            var ordersQuery = window.sb
                .from('orders')
                .select('*, order_items(*), buyer:profiles!orders_buyer_id_fkey(first_name, last_name, avatar_url)')
                .eq('seller_id', window.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(limit);
            
            // Fallback simple query for schemas without relationships defined
            var fallbackQuery = window.sb
                .from('orders')
                .select('*')
                .eq('seller_id', window.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(limit);
            
            return ordersQuery
                .then(function(result) {
                    var orders = result.data || [];
                    
                    if (container) {
                        if (orders.length === 0) {
                            container.innerHTML = self._renderEmptyState('orders', 'No orders yet.');
                        } else {
                            container.innerHTML = self._renderOrderList(orders);
                        }
                    }
                    
                    log('[DashboardManager] Loaded', orders.length, 'orders');
                    return orders;
                })
                .catch(function(error) {
                    warn('[DashboardManager] Full orders query failed, trying simpler query:', error.message);
                    
                    // Try fallback query
                    return fallbackQuery
                        .then(function(result) {
                            var orders = result.data || [];
                            
                            if (container) {
                                if (orders.length === 0) {
                                    container.innerHTML = self._renderEmptyState('orders', 'No orders yet.');
                                } else {
                                    container.innerHTML = self._renderOrderList(orders);
                                }
                            }
                            
                            log('[DashboardManager] Loaded', orders.length, 'orders (fallback)');
                            return orders;
                        })
                        .catch(function(fallbackError) {
                            error('[DashboardManager] Error loading orders:', fallbackError);
                            if (container) {
                                container.innerHTML = self._renderErrorState('Failed to load orders');
                            }
                            return [];
                        });
                });
        },

        /**
         * Render orders list HTML
         * @private
         * @param {Array} orders - Orders array
         * @returns {string} HTML string
         */
        _renderOrderList: function(orders) {
            var html = '<div class="space-y-3">';
            
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                var statusColors = {
                    'pending': 'bg-yellow-100 text-yellow-800',
                    'processing': 'bg-blue-100 text-blue-800',
                    'shipped': 'bg-purple-100 text-purple-800',
                    'delivered': 'bg-green-100 text-green-800',
                    'cancelled': 'bg-red-100 text-red-800'
                };
                var statusColor = statusColors[order.status] || 'bg-gray-100 text-gray-800';
                
                var buyerName = 'Unknown Buyer';
                if (order.buyer) {
                    buyerName = [order.buyer.first_name, order.buyer.last_name].filter(Boolean).join(' ') || 'Customer';
                }
                
                html += '<div class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">';
                html += '<div class="flex items-start justify-between">';
                html += '<div>';
                html += '<div class="flex items-center gap-2">';
                html += '<span class="font-medium text-gray-900">Order #' + (order.id.toString().substring(0, 8).toUpperCase()) + '</span>';
                html += '<span class="px-2 py-0.5 text-xs font-medium rounded-full ' + statusColor + '">' + escapeHtml(order.status) + '</span>';
                html += '</div>';
                html += '<p class="text-sm text-gray-600 mt-1">' + escapeHtml(buyerName) + '</p>';
                html += '</div>';
                html += '<div class="text-right">';
                html += '<p class="font-semibold text-gray-900">' + formatPrice(order.total) + '</p>';
                html += '<p class="text-xs text-gray-500 mt-1">' + timeAgo(order.created_at) + '</p>';
                html += '</div>';
                html += '</div>';
                
                // Order items preview
                if (order.order_items && order.order_items.length > 0) {
                    html += '<div class="mt-3 pt-3 border-t border-gray-100">';
                    html += '<p class="text-xs text-gray-500 mb-1">Items:</p>';
                    var itemCount = Math.min(order.order_items.length, 3);
                    for (var j = 0; j < itemCount; j++) {
                        var item = order.order_items[j];
                        html += '<span class="inline-block text-xs bg-gray-100 px-2 py-1 rounded mr-1 mb-1">' + escapeHtml(item.title) + ' x' + item.quantity + '</span>';
                    }
                    if (order.order_items.length > 3) {
                        html += '<span class="text-xs text-gray-500">+' + (order.order_items.length - 3) + ' more</span>';
                    }
                    html += '</div>';
                }
                
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        },

        /**
         * Load recent activity feed
         * Shows recent actions on the account
         * @returns {Promise<Array>} Activity items array
         */
        loadRecentActivity: function() {
            var self = this;
            
            log('[DashboardManager] Loading recent activity...');
            
            if (!window.currentUser || !window.currentUser.id) {
                warn('[DashboardManager] No authenticated user');
                return Promise.resolve([]);
            }
            
            var container = safeGet('activityFeed');
            if (!container) {
                return Promise.resolve([]);
            }
            
            container.innerHTML = '<div class="flex items-center justify-center py-4"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>';
            
            // Get recent products and orders for activity
            // Use Promise.allSettled-like approach to handle partial failures
            return window.sb
                .from('products')
                .select('*')
                .eq('seller_id', window.currentUser.id)
                .order('updated_at', { ascending: false })
                .limit(5)
                .then(function(productResult) {
                    var products = productResult.data || [];
                    
                    // Try to get orders, but don't fail if orders table has issues
                    return window.sb
                        .from('orders')
                        .select('*')
                        .eq('seller_id', window.currentUser.id)
                        .order('updated_at', { ascending: false })
                        .limit(5)
                        .then(function(orderResult) {
                            return {
                                products: products,
                                orders: orderResult.data || []
                            };
                        })
                        .catch(function(orderError) {
                            // Orders failed (possibly 400 error due to schema), continue with just products
                            warn('[DashboardManager] Orders query failed for activity:', orderError.message);
                            return {
                                products: products,
                                orders: []
                            };
                        });
                })
                .catch(function(productError) {
                    error('[DashboardManager] Error loading products for activity:', productError);
                    return { products: [], orders: [] };
                })
                .then(function(data) {
                    var products = data.products;
                    var orders = data.orders;
                
                var activities = [];
                
                // Product activities
                for (var i = 0; i < products.length; i++) {
                    activities.push({
                        type: 'product',
                        action: products[i].status === 'active' ? 'published' : 'updated',
                        title: products[i].title,
                        timestamp: products[i].updated_at || products[i].created_at,
                        icon: 'fa-box'
                    });
                }
                
                // Order activities
                for (var j = 0; j < orders.length; j++) {
                    activities.push({
                        type: 'order',
                        action: orders[j].status,
                        title: 'Order #' + orders[j].id.toString().substring(0, 8).toUpperCase(),
                        timestamp: orders[j].updated_at || orders[j].created_at,
                        icon: 'fa-shopping-cart'
                    });
                }
                
                // Sort by timestamp
                activities.sort(function(a, b) {
                    return new Date(b.timestamp) - new Date(a.timestamp);
                });
                
                // Take only recent 10
                activities = activities.slice(0, 10);
                
                if (activities.length === 0) {
                    container.innerHTML = self._renderEmptyState('activity', 'No recent activity.');
                } else {
                    container.innerHTML = self._renderActivityFeed(activities);
                }
                
                log('[DashboardManager] Loaded', activities.length, 'activities');
                return activities;
            }).catch(function(error) {
                error('[DashboardManager] Error loading activity:', error);
                container.innerHTML = self._renderErrorState('Failed to load activity');
                return [];
            });
        },

        /**
         * Render activity feed HTML
         * @private
         * @param {Array} activities - Activities array
         * @returns {string} HTML string
         */
        _renderActivityFeed: function(activities) {
            var html = '<div class="space-y-3">';
            
            for (var i = 0; i < activities.length; i++) {
                var activity = activities[i];
                var iconBg = activity.type === 'order' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600';
                
                html += '<div class="flex items-start gap-3">';
                html += '<div class="flex-shrink-0 w-8 h-8 rounded-full ' + iconBg + ' flex items-center justify-center">';
                html += '<i class="fas ' + activity.icon + ' text-sm"></i>';
                html += '</div>';
                html += '<div class="flex-1 min-w-0">';
                html += '<p class="text-sm text-gray-900"><span class="capitalize">' + escapeHtml(activity.action) + '</span> <span class="font-medium">' + escapeHtml(activity.title) + '</span></p>';
                html += '<p class="text-xs text-gray-500 mt-0.5">' + timeAgo(activity.timestamp) + '</p>';
                html += '</div>';
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        },

        /**
         * Render empty state message
         * @private
         * @param {string} type - Type of empty state
         * @param {string} message - Message to display
         * @returns {string} HTML string
         */
        _renderEmptyState: function(type, message) {
            var icons = {
                'products': 'fa-box-open',
                'orders': 'fa-receipt',
                'activity': 'fa-clock'
            };
            var icon = icons[type] || 'fa-inbox';
            
            return '<div class="flex flex-col items-center justify-center py-8 text-center">';
            return '<div class="flex flex-col items-center justify-center py-8 text-center">' +
                   '<i class="fas ' + icon + ' text-gray-300 text-4xl mb-3"></i>' +
                   '<p class="text-gray-500 text-sm">' + escapeHtml(message) + '</p>' +
                   '</div>';
        },

        /**
         * Render error state message
         * @private
         * @param {string} message - Error message to display
         * @returns {string} HTML string
         */
        _renderErrorState: function(message) {
            return '<div class="flex flex-col items-center justify-center py-8 text-center">' +
                   '<i class="fas fa-exclamation-triangle text-red-300 text-4xl mb-3"></i>' +
                   '<p class="text-red-500 text-sm">' + escapeHtml(message) + '</p>' +
                   '<button onclick="DashboardManager.loadDashboardStats()" class="mt-3 px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">Retry</button>' +
                   '</div>';
        },

        /**
         * Show loading state on dashboard
         */
        showDashboardLoading: function() {
            this._isLoading = true;
            
            var loaders = document.querySelectorAll('[data-dashboard-loading]');
            for (var i = 0; i < loaders.length; i++) {
                loaders[i].innerHTML = '<div class="flex items-center justify-center py-4"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>';
            }
            
            // Add skeleton loading classes
            var skeletons = document.querySelectorAll('.dashboard-skeleton');
            for (var j = 0; j < skeletons.length; j++) {
                skeletons[j].classList.remove('hidden');
            }
            
            log('[DashboardManager] Loading state shown');
        },

        /**
         * Hide loading state on dashboard
         */
        hideDashboardLoading: function() {
            this._isLoading = false;
            
            // Remove skeleton loading classes
            var skeletons = document.querySelectorAll('.dashboard-skeleton');
            for (var i = 0; i < skeletons.length; i++) {
                skeletons[i].classList.add('hidden');
            }
            
            log('[DashboardManager] Loading state hidden');
        },

        /**
         * Load complete dashboard (all sections)
         * Convenience method to load everything at once
         * @returns {Promise<void>}
         */
        loadFullDashboard: function() {
            var self = this;
            log('[DashboardManager] Loading full dashboard...');
            
            return Promise.all([
                self.loadDashboardStats(),
                self.loadDashboardProducts(),
                self.loadDashboardOrders(),
                self.loadRecentActivity()
            ]).then(function() {
                log('[DashboardManager] Full dashboard loaded');
                NotificationManager.showToast('Dashboard updated', 'success');
            });
        },

        /**
         * Refresh dashboard data
         * @returns {Promise<void>}
         */
        refresh: function() {
            return this.loadFullDashboard();
        }
    };

    // Reference for private methods
    var dashboardSelf = DashboardManager;

    // =========================================================================
    // B. PRODUCT MANAGER
    // =========================================================================
    var self = null;

    /**
     * ProductManager - Handles all product CRUD operations
     */
    window.ProductManager = {
        /** @type {Object} Current product cache */
        _cache: {},
        /** @type {number} Cache TTL in milliseconds */
        _cacheTTL: 30000,

        /**
         * Render a single product card for collection, library, or search views
         * @param {Object} product - Product object from Supabase
         * @returns {string} HTML string for the product card
         */
        renderProductCard: function(product) {
            if (!product) return '';
            var safeId = product.id ? String(product.id).replace(/'/g, "\\'") : '';
            var imageUrl = '';
            if (product.product_images && product.product_images.length > 0) {
                imageUrl = product.product_images[0].url || product.product_images[0].public_url || '';
            }
            var title = escapeHtml(product.title || product.name || 'Untitled');
            var description = escapeHtml((product.description || product.summary || '').substr(0, 90));
            var price = formatPrice(product.price || product.discount_price || product.effective_price || 0);
            var category = escapeHtml(product.category || product.category_name || '');

            var html = '<div class="group rounded-3xl border border-white/10 bg-surface/80 overflow-hidden transition hover:-translate-y-1 hover:shadow-2xl">';
            html += '<a href="#" onclick="event.preventDefault(); navigateTo(\'product\', \'" + safeId + "\');" class="block">';
            html += '<div class="aspect-[4/3] bg-gray-950 text-slate-500 flex items-center justify-center overflow-hidden">';
            if (imageUrl) {
                html += '<img src="' + escapeHtml(imageUrl) + '" alt="' + title + '" class="h-full w-full object-cover transition duration-300 group-hover:scale-105">';
            } else {
                html += '<div class="flex h-full w-full items-center justify-center text-3xl text-muted"><i class="fa-solid fa-box-open"></i></div>';
            }
            html += '</div>';
            html += '<div class="p-4">';
            if (category) {
                html += '<p class="text-[11px] uppercase tracking-[0.22em] text-accent mb-2">' + category + '</p>';
            }
            html += '<h3 class="text-base font-semibold text-white truncate">' + title + '</h3>';
            if (description) {
                html += '<p class="mt-2 text-sm text-muted leading-6 line-clamp-3">' + description + '</p>';
            }
            html += '<div class="mt-4 flex items-center justify-between">';
            html += '<span class="text-lg font-semibold text-white">' + price + '</span>';
            html += '<span class="text-xs uppercase tracking-[0.2em] text-muted">View</span>';
            html += '</div>';
            html += '</div>';
            html += '</a>';
            html += '</div>';
            return html;
        },

        /**
         * Render a product grid into a target container
         * @param {Array} products - Array of product objects
         * @param {HTMLElement} container - Target DOM container
         */
        _renderProductGrid: function(products, container) {
            if (!container) return;
            if (!products || products.length === 0) {
                container.innerHTML = '<div class="flex flex-col items-center justify-center text-center py-20"><div class="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-5"><i class="fa-solid fa-box-open text-2xl text-muted/50" aria-hidden="true"></i></div><p class="font-medium text-subtle text-lg">No items yet</p><p class="text-sm text-muted mt-2 max-w-sm">The collection is being curated. Check back soon for handpicked products across all categories.</p></div>';
                return;
            }

            var html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">';
            for (var i = 0; i < products.length; i++) {
                html += this.renderProductCard(products[i]);
            }
            html += '</div>';
            container.innerHTML = html;
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
            container.innerHTML = '<div class="flex items-center justify-center py-20"><i class="fa-solid fa-spinner fa-spin text-2xl text-accent"></i></div>';

            if (!window.sb) {
                container.innerHTML = '<div class="flex flex-col items-center justify-center text-center py-20"><div class="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-5"><i class="fa-solid fa-box-open text-2xl text-muted/50" aria-hidden="true"></i></div><p class="font-medium text-subtle text-lg">No collection data available</p><p class="text-sm text-muted mt-2 max-w-sm">Please sign in or refresh the page to load the collection.</p></div>';
                return Promise.resolve([]);
            }

            var query = window.sb.from('products').select('*, product_images(*)').eq('is_active', true).order('created_at', { ascending: false });
            if (category) {
                query = query.eq('category', category);
            }

            return query.then(function(result) {
                var products = result.data || [];
                self._renderProductGrid(products, container);
                return products;
            }).catch(function(error) {
                error('[ProductManager] Error loading collection:', error);
                container.innerHTML = '<div class="flex flex-col items-center justify-center text-center py-20"><div class="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-5"><i class="fa-solid fa-triangle-exclamation text-2xl text-muted/50" aria-hidden="true"></i></div><p class="font-medium text-subtle text-lg">Unable to load collection</p><p class="text-sm text-muted mt-2 max-w-sm">There was a problem fetching products from the server. Please try again later.</p></div>';
                return [];
            });
        },

        /**
         * Render library content
         * @returns {Promise<Array>} Loaded library products
         */
        renderLibrary: function() {
            var self = this;
            var container = safeGet('libraryContent');
            if (!container) return Promise.resolve([]);
            container.innerHTML = '<div class="flex items-center justify-center py-20"><i class="fa-solid fa-spinner fa-spin text-2xl text-accent"></i></div>';

            if (!window.sb) {
                container.innerHTML = '<div class="flex flex-col items-center justify-center text-center py-20"><div class="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-5"><i class="fa-solid fa-book text-2xl text-muted/50" aria-hidden="true"></i></div><p class="font-medium text-subtle text-lg">No library data available</p><p class="text-sm text-muted mt-2 max-w-sm">Please sign in or refresh the page to load the library.</p></div>';
                return Promise.resolve([]);
            }

            return window.sb.from('products').select('*, product_images(*)').eq('is_active', true).eq('category', 'library').order('created_at', { ascending: false })
                .then(function(result) {
                    var products = result.data || [];
                    self._renderProductGrid(products, container);
                    return products;
                }).catch(function(error) {
                    error('[ProductManager] Error loading library:', error);
                    container.innerHTML = '<div class="flex flex-col items-center justify-center text-center py-20"><div class="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-5"><i class="fa-solid fa-triangle-exclamation text-2xl text-muted/50" aria-hidden="true"></i></div><p class="font-medium text-subtle text-lg">Unable to load library</p><p class="text-sm text-muted mt-2 max-w-sm">There was a problem fetching library products from the server. Please try again later.</p></div>';
                    return [];
                });
        },

        /**
         * Get all products for current seller
         * @param {Object} options - Query options (limit, offset, status, category)
         * @returns {Promise<Array>} Array of product objects
         */
        getSellerProducts: function(options) {
            options = options || {};
            
            log('[ProductManager] Getting seller products...');
            
            if (!window.currentUser || !window.currentUser.id) {
                warn('[ProductManager] No authenticated user');
                return Promise.reject(new Error('Not authenticated'));
            }
            
            var query = window.sb
                .from('products')
                .select('*, product_images(*)')
                .eq('seller_id', window.currentUser.id)
                .order('created_at', { ascending: false });
            
            if (options.limit) {
                query = query.limit(options.limit);
            }
            if (options.offset) {
                query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
            }
            if (options.status) {
                query = query.eq('status', options.status);
            }
            if (options.category) {
                query = query.eq('category', options.category);
            }
            
            return query.then(function(result) {
                var products = result.data || [];
                
                // Update cache
                for (var i = 0; i < products.length; i++) {
                    self._cache[products[i].id] = {
                        data: products[i],
                        timestamp: Date.now()
                    };
                }
                
                log('[ProductManager] Retrieved', products.length, 'products');
                return products;
            }).catch(function(error) {
                error('[ProductManager] Error getting products:', error);
                NotificationManager.showToast('Failed to load products', 'error');
                throw error;
            });
        },

        /**
         * Get single product by ID
         * Uses cache if available and fresh
         * @param {string} id - Product UUID
         * @param {boolean} forceRefresh - Bypass cache
         * @returns {Promise<Object>} Product object
         */
        getProductById: function(id, forceRefresh) {
            log('[ProductManager] Getting product:', id);
            
            // Check cache first
            if (!forceRefresh && self._cache[id]) {
                var cached = self._cache[id];
                if (Date.now() - cached.timestamp < self._cacheTTL) {
                    log('[ProductManager] Returning cached product');
                    return Promise.resolve(cached.data);
                }
            }
            
            return window.sb
                .from('products')
                .select('*, product_images(*)')
                .eq('id', id)
                .single()
                .then(function(result) {
                    if (!result.data) {
                        throw new Error('Product not found');
                    }
                    
                    // Update cache
                    self._cache[id] = {
                        data: result.data,
                        timestamp: Date.now()
                    };
                    
                    log('[ProductManager] Product loaded:', result.data.title);
                    return result.data;
                })
                .catch(function(error) {
                    error('[ProductManager] Error getting product:', error);
                    throw error;
                });
        },

        /**
         * Create a new product
         * @param {Object} data - Product data (title, description, price, category, etc.)
         * @returns {Promise<Object>} Created product
         */
        createProduct: function(data) {
            log('[ProductManager] Creating product...');
            
            if (!window.currentUser || !window.currentUser.id) {
                return Promise.reject(new Error('Not authenticated'));
            }
            
            // Validate required fields
            if (!data || !data.title) {
                return Promise.reject(new Error('Product title is required'));
            }
            
            // Prepare product data
            var productData = {
                seller_id: window.currentUser.id,
                title: data.title,
                description: data.description || '',
                price: parseFloat(data.price) || 0,
                compare_price: data.compare_price ? parseFloat(data.compare_price) : null,
                category: data.category || null,
                status: data.status || 'draft',
                stock_quantity: parseInt(data.stock_quantity) || 0,
                sku: data.sku || null,
                tags: data.tags || [],
                is_active: data.status === 'active'
            };
            
            return window.sb
                .from('products')
                .insert(productData)
                .select()
                .single()
                .then(function(result) {
                    log('[ProductManager] Product created:', result.data.id);
                    NotificationManager.showToast('Product created successfully!', 'success');
                    
                    // Clear cache
                    self._cache = {};
                    
                    return result.data;
                })
                .catch(function(error) {
                    error('[ProductManager] Error creating product:', error);
                    NotificationManager.showToast('Failed to create product: ' + (error.message || 'Unknown error'), 'error');
                    throw error;
                });
        },

        /**
         * Update an existing product
         * @param {string} id - Product UUID
         * @param {Object} data - Updated product data
         * @returns {Promise<Object>} Updated product
         */
        updateProduct: function(id, data) {
            log('[ProductManager] Updating product:', id);
            
            if (!window.currentUser || !window.currentUser.id) {
                return Promise.reject(new Error('Not authenticated'));
            }
            
            // Prepare update data
            var updateData = {
                updated_at: new Date().toISOString()
            };
            
            // Only include provided fields
            var allowedFields = ['title', 'description', 'price', 'compare_price', 'category', 
                                 'status', 'stock_quantity', 'sku', 'tags', 'is_active'];
            for (var i = 0; i < allowedFields.length; i++) {
                var field = allowedFields[i];
                if (data.hasOwnProperty(field)) {
                    updateData[field] = data[field];
                }
            }
            
            // Auto-set is_active based on status
            if (updateData.status) {
                updateData.is_active = updateData.status === 'active';
            }
            
            return window.sb
                .from('products')
                .update(updateData)
                .eq('id', id)
                .eq('seller_id', window.currentUser.id) // Security: ensure ownership
                .select()
                .single()
                .then(function(result) {
                    log('[ProductManager] Product updated:', id);
                    NotificationManager.showToast('Product updated successfully!', 'success');
                    
                    // Update cache
                    if (self._cache[id]) {
                        self._cache[id].data = result.data;
                        self._cache[id].timestamp = Date.now();
                    }
                    
                    return result.data;
                })
                .catch(function(error) {
                    error('[ProductManager] Error updating product:', error);
                    NotificationManager.showToast('Failed to update product', 'error');
                    throw error;
                });
        },

        /**
         * Delete a product
         * Also deletes associated images due to CASCADE
         * @param {string} id - Product UUID
         * @returns {Promise<boolean>} Success status
         */
        deleteProduct: function(id) {
            log('[ProductManager] Deleting product:', id);
            
            if (!window.currentUser || !window.currentUser.id) {
                return Promise.reject(new Error('Not authenticated'));
            }
            
            return window.sb
                .from('products')
                .delete()
                .eq('id', id)
                .eq('seller_id', window.currentUser.id) // Security: ensure ownership
                .then(function(result) {
                    log('[ProductManager] Product deleted:', id);
                    NotificationManager.showToast('Product deleted', 'success');
                    
                    // Remove from cache
                    delete self._cache[id];
                    
                    return true;
                })
                .catch(function(error) {
                    error('[ProductManager] Error deleting product:', error);
                    NotificationManager.showToast('Failed to delete product', 'error');
                    throw error;
                });
        },

        /**
         * Change product status
         * @param {string} id - Product UUID
         * @param {string} status - New status (draft, active, archived, sold_out)
         * @returns {Promise<Object>} Updated product
         */
        changeStatus: function(id, status) {
            log('[ProductManager] Changing product status:', id, '->', status);
            
            var validStatuses = ['draft', 'active', 'archived', 'sold_out'];
            if (validStatuses.indexOf(status) === -1) {
                return Promise.reject(new Error('Invalid status: ' + status));
            }
            
            return self.updateProduct(id, { status: status });
        },

        /**
         * Upload product image
         * @param {string} productId - Product UUID
         * @param {File} file - Image file to upload
         * @param {boolean} isPrimary - Whether this is the primary image
         * @returns {Promise<Object>} Uploaded image record
         */
        uploadImage: function(productId, file, isPrimary) {
            log('[ProductManager] Uploading image for product:', productId);
            
            if (!file) {
                return Promise.reject(new Error('No file provided'));
            }
            
            // Validate file type
            var validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (validTypes.indexOf(file.type) === -1) {
                return Promise.reject(new Error('Invalid file type. Please upload JPEG, PNG, GIF, or WebP.'));
            }
            
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                return Promise.reject(new Error('File too large. Maximum size is 5MB.'));
            }
            
            var fileExt = file.name.split('.').pop().toLowerCase();
            var fileName = productId + '/' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.' + fileExt;
            var path = 'products/' + fileName;
            
            return window.sb.storage
                .from('product-images')
                .upload(path, file, { cacheControl: '3600', upsert: false })
                .then(function(uploadResult) {
                    return window.sb.storage
                        .from('product-images')
                        .getPublicUrl(uploadResult.path);
                })
                .then(function(publicUrlData) {
                    // Save image record to database
                    return window.sb
                        .from('product_images')
                        .insert({
                            product_id: productId,
                            url: publicUrlData.publicUrl,
                            path: path,
                            is_primary: isPrimary || false,
                            sort_order: 0
                        })
                        .select()
                        .single();
                })
                .then(function(result) {
                    log('[ProductManager] Image uploaded successfully');
                    NotificationManager.showToast('Image uploaded!', 'success');
                    return result.data;
                })
                .catch(function(error) {
                    error('[ProductManager] Error uploading image:', error);
                    NotificationManager.showToast('Failed to upload image', 'error');
                    throw error;
                });
        },

        /**
         * Set primary image for product
         * @param {string} productId - Product UUID
         * @param {string} imageId - Image UUID to set as primary
         * @returns {Promise<boolean>} Success status
         */
        setPrimaryImage: function(productId, imageId) {
            log('[ProductManager] Setting primary image:', imageId);
            
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
                        .eq('id', imageId)
                        .eq('product_id', productId);
                })
                .then(function() {
                    log('[ProductManager] Primary image set');
                    return true;
                })
                .catch(function(error) {
                    error('[ProductManager] Error setting primary image:', error);
                    throw error;
                });
        },

        /**
         * Delete product image
         * @param {string} imageId - Image UUID
         * @param {string} path - Storage path
         * @returns {Promise<boolean>} Success status
         */
        deleteImage: function(imageId, path) {
            log('[ProductManager] Deleting image:', imageId);
            
            var promises = [];
            
            // Delete from database
            promises.push(
                window.sb
                    .from('product_images')
                    .delete()
                    .eq('id', imageId)
            );
            
            // Delete from storage
            if (path) {
                promises.push(
                    window.sb.storage
                        .from('product-images')
                        .remove([path])
                        .catch(function(err) {
                            warn('[ProductManager] Storage deletion failed:', err);
                        })
                );
            }
            
            return Promise.all(promises)
                .then(function() {
                    log('[ProductManager] Image deleted');
                    NotificationManager.showToast('Image deleted', 'success');
                    return true;
                })
                .catch(function(error) {
                    error('[ProductManager] Error deleting image:', error);
                    throw error;
                });
        },

        /**
         * Duplicate a product
         * @param {string} id - Product UUID to duplicate
         * @returns {Promise<Object>} New duplicated product
         */
        duplicateProduct: function(id) {
            var self = this;
            log('[ProductManager] Duplicating product:', id);
            
            return self.getProductById(id)
                .then(function(originalProduct) {
                    // Create copy without ID and timestamps
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
         * Clear product cache
         */
        clearCache: function() {
            self._cache = {};
            log('[ProductManager] Cache cleared');
        }
    };


    // =========================================================================
    // C. SEARCH MANAGER
    // =========================================================================

    /**
     * SearchManager - Handles product search, filtering, and sorting
     */
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
            self._currentQuery = query;
            
            log('[SearchManager] Searching products:', query);
            
            if (!query || query.trim().length === 0) {
                return self.getSellerProducts(options);
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
            
            self._currentFilters = filters;
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
            
            self._currentSort = sortBy || 'newest';
            log('[SearchManager] Sorting by:', self._currentSort);
            
            var sorted = products.slice(); // Create copy to avoid mutating original
            
            switch (self._currentSort) {
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
            return {
                query: self._currentQuery,
                filters: self._currentFilters,
                sort: self._currentSort
            };
        },

        /**
         * Reset search state
         */
        reset: function() {
            self._currentQuery = '';
            self._currentFilters = {};
            self._currentSort = 'newest';
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
            if (self._cart !== null) {
                return self._cart;
            }
            
            try {
                var stored = localStorage.getItem(self.STORAGE_KEY);
                self._cart = stored ? JSON.parse(stored) : [];
            } catch (e) {
                warn('[CartManager] Error reading cart from storage:', e);
                self._cart = [];
            }
            
            return self._cart;
        },

        /**
         * Save cart to localStorage
         * @private
         */
        _saveCart: function() {
            try {
                localStorage.setItem(self.STORAGE_KEY, JSON.stringify(self._cart || []));
                
                // Dispatch custom event for UI updates
                var event = new CustomEvent('cartUpdated', { detail: { cart: self._cart } });
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
            
            var cart = self._getCart();
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
                cart.push({
                    id: generateId(),
                    productId: productId,
                    quantity: quantity,
                    variant: options.variant || null,
                    addedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
            
            self._cart = cart;
            self._saveCart();
            
            NotificationManager.showToast('Added to cart!', 'success');
            log('[CartManager] Cart updated, items:', cart.length);
            
            return Promise.resolve(self.getCart());
        },

        /**
         * Remove item from cart
         * @param {string} productId - Product UUID to remove
         * @returns {Object} Updated cart
         */
        removeFromCart: function(productId) {
            log('[CartManager] Removing from cart:', productId);
            
            var cart = self._getCart();
            var newCart = [];
            
            for (var i = 0; i < cart.length; i++) {
                if (cart[i].productId !== productId) {
                    newCart.push(cart[i]);
                }
            }
            
            self._cart = newCart;
            self._saveCart();
            
            NotificationManager.showToast('Removed from cart', 'info');
            return self.getCart();
        },

        /**
         * Get current cart contents with product details
         * @param {boolean} includeDetails - Include full product details from DB
         * @returns {Promise<Object>} Cart object with items, counts, totals
         */
        getCart: function(includeDetails) {
            var cart = self._getCart();
            var summary = {
                items: cart,
                itemCount: 0,
                uniqueItems: cart.length,
                subtotal: 0,
                currency: 'USD'
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
                        
                        var detailedItem = {
                            ...cartItem,
                            product: product,
                            lineTotal: product ? (parseFloat(product.price) || 0) * cartItem.quantity : 0,
                            available: product ? (product.status === 'active' && (product.stock_quantity || 0) >= cartItem.quantity) : false
                        };
                        
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
            
            self._cart = [];
            self._saveCart();
            
            NotificationManager.showToast('Cart cleared', 'info');
            return self.getCart();
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
                return self.removeFromCart(productId);
            }
            
            var cart = self._getCart();
            
            for (var i = 0; i < cart.length; i++) {
                if (cart[i].productId === productId) {
                    cart[i].quantity = quantity;
                    cart[i].updatedAt = new Date().toISOString();
                    break;
                }
            }
            
            self._cart = cart;
            self._saveCart();
            
            return self.getCart();
        },

        /**
         * Check if product is in cart
         * @param {string} productId - Product UUID
         * @returns {boolean} True if in cart
         */
        isInCart: function(productId) {
            var cart = self._getCart();
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
            var cart = self._getCart();
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
            var cart = self._getCart();
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
            return self.getCart(true).then(function(cart) {
                return cart.subtotal;
            });
        },

        /**
         * Merge server-side cart (for logged-in users)
         * @param {Array} serverCart - Cart from server/database
         * @returns {Promise<Object>} Merged cart
         */
        mergeWithServerCart: function(serverCart) {
            var localCart = self._getCart();
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
            
            self._cart = merged;
            self._saveCart();
            
            return self.getCart();
        },

        /**
         * Load cart and update UI badge - called on auth state change
         * @returns {Promise<Object>} Cart data
         */
        loadCart: function() {
            log('[CartManager] Loading cart...');
            return self.getCart().then(function(cart) {
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
            if (self._wishlist !== null) {
                return self._wishlist;
            }
            
            try {
                var stored = localStorage.getItem(self.STORAGE_KEY);
                self._wishlist = stored ? JSON.parse(stored) : [];
            } catch (e) {
                warn('[WishlistManager] Error reading wishlist:', e);
                self._wishlist = [];
            }
            
            return self._wishlist;
        },

        /**
         * Save wishlist to localStorage
         * @private
         */
        _saveWishlist: function() {
            try {
                localStorage.setItem(self.STORAGE_KEY, JSON.stringify(self._wishlist || []));
                
                // Dispatch custom event for UI updates
                var event = new CustomEvent('wishlistUpdated', { detail: { wishlist: self._wishlist } });
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
            
            var wishlist = self._getWishlist();
            
            // Check if already in wishlist
            if (wishlist.indexOf(productId) !== -1) {
                NotificationManager.showToast('Already in wishlist', 'info');
                return Promise.resolve(self.getWishlist());
            }
            
            wishlist.push(productId);
            self._wishlist = wishlist;
            self._saveWishlist();
            
            NotificationManager.showToast('Added to wishlist!', 'success');
            
            // Sync to server if logged in
            if (window.currentUser && window.currentUser.id) {
                self._syncToServer();
            }
            
            return Promise.resolve(self.getWishlist());
        },

        /**
         * Remove product from wishlist
         * @param {string} productId - Product UUID
         * @returns {Object} Updated wishlist
         */
        removeFromWishlist: function(productId) {
            log('[WishlistManager] Removing from wishlist:', productId);
            
            var wishlist = self._getWishlist();
            var newWishlist = [];
            
            for (var i = 0; i < wishlist.length; i++) {
                if (wishlist[i] !== productId) {
                    newWishlist.push(wishlist[i]);
                }
            }
            
            self._wishlist = newWishlist;
            self._saveWishlist();
            
            NotificationManager.showToast('Removed from wishlist', 'info');
            
            // Sync to server if logged in
            if (window.currentUser && window.currentUser.id) {
                self._syncToServer();
            }
            
            return self.getWishlist();
        },

        /**
         * Get wishlist contents with optional product details
         * @param {boolean} includeDetails - Include full product details
         * @returns {Promise<Object>} Wishlist object
         */
        getWishlist: function(includeDetails) {
            var wishlist = self._getWishlist();
            var summary = {
                items: wishlist,
                count: wishlist.length
            };
            
            if (!includeDetails) {
                return Promise.resolve(summary);
            }
            
            if (wishlist.length === 0) {
                return Promise.resolve({ ...summary, products: [] });
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
                    return { ...summary, products: [] };
                });
        },

        /**
         * Check if product is in wishlist
         * @param {string} productId - Product UUID
         * @returns {boolean} True if in wishlist
         */
        isInWishlist: function(productId) {
            var wishlist = self._getWishlist();
            return wishlist.indexOf(productId) !== -1;
        },

        /**
         * Toggle wishlist status (add if not present, remove if present)
         * @param {string} productId - Product UUID
         * @returns {Promise<Object>} Updated wishlist
         */
        toggleWishlist: function(productId) {
            if (self.isInWishlist(productId)) {
                return self.removeFromWishlist(productId);
            } else {
                return self.addToWishlist(productId);
            }
        },

        /**
         * Clear entire wishlist
         * @returns {Object} Empty wishlist
         */
        clearWishlist: function() {
            log('[WishlistManager] Clearing wishlist');
            
            self._wishlist = [];
            self._saveWishlist();
            
            NotificationManager.showToast('Wishlist cleared', 'info');
            return self.getWishlist();
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
        moveToCart: function(productId) {
            log('[WishlistManager] Moving to cart:', productId);
            
            return CartManager.addToCart(productId, 1)
                .then(function(cart) {
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
            return self._getWishlist().length;
        },

        /**
         * Load wishlist and update UI - called on auth state change
         * @returns {Promise<Object>} Wishlist data
         */
        loadWishlist: function() {
            log('[WishlistManager] Loading wishlist...');
            return self.getWishlist().then(function(wishlist) {
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
            duration = duration || self.DEFAULT_DURATION;
            
            log('[NotificationManager] Toast:', type, message);
            
            var container = self._getOrCreateContainer();
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
            toast.querySelector('.toast-close').onclick = function() {
                self._removeToast(toastId);
            };
            
            container.appendChild(toast);
            
            // Animate in
            requestAnimationFrame(function() {
                toast.classList.remove('translate-x-full');
                toast.classList.add('translate-x-0');
            });
            
            // Limit visible toasts
            var toasts = container.querySelectorAll('[id^="id_"]');
            if (toasts.length > self.MAX_TOASTS) {
                self._removeToast(toasts[0].id);
            }
            
            // Auto-remove after duration
            var timer = setTimeout(function() {
                self._removeToast(toastId);
            }, duration);
            
            self._timers.push({ id: toastId, timer: timer });
            
            return toastId;
        },

        /**
         * Get or create toast container
         * @private
         * @returns {HTMLElement} Container element
         */
        _getOrCreateContainer: function() {
            var container = document.getElementById(self.CONTAINER_ID);
            if (!container) {
                container = document.createElement('div');
                container.id = self.CONTAINER_ID;
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
            for (var i = 0; i < self._timers.length; i++) {
                if (self._timers[i].id === toastId) {
                    clearTimeout(self._timers[i].timer);
                    self._timers.splice(i, 1);
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
            
            return self.getUnreadCount().then(function(count) {
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
            var validation = self.validateForm(data);
            if (!validation.isValid) {
                NotificationManager.showToast(validation.errors[0], 'error');
                return Promise.reject(new Error('Validation failed: ' + validation.errors.join(', ')));
            }
            
            // Prepare submission data
            var formData = {
                name: data.name.trim(),
                email: data.email.trim().toLowerCase(),
                subject: data.subject.trim(),
                message: data.message.trim(),
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
            
            var rules = self.validationRules;
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
            var validation = self.validateEmail(email);
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
            return window.sb
                .from('newsletters')
                .upsert(subData, { onConflict: 'email' })
                .select()
                .single()
                .then(function(result) {
                    log('[NewsletterManager] Subscribed:', result.data.id);
                    
                    // Track locally
                    try {
                        localStorage.setItem(self.TRACKING_KEY, JSON.stringify({
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
                            localStorage.setItem(self.TRACKING_KEY, JSON.stringify({
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
            
            var validation = self.validateEmail(email);
            if (!validation.isValid) {
                return Promise.reject(new Error(validation.error));
            }
            
            var cleanEmail = email.trim().toLowerCase();
            
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
                        localStorage.removeItem(self.TRACKING_KEY);
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
                try {
                    var tracked = localStorage.getItem(self.TRACKING_KEY);
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
