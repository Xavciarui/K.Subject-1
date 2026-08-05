/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 Marketplace — Core Application Logic
 * ES5-compatible JavaScript (var, function, no arrow functions, no const/let)
 * Depends on: Global sb (Supabase client), safeGet(), showToast(), navigateTo(), currentUser
 * 
 * SECURITY AUDIT FIXES APPLIED:
 * - C-01: XSS protection via escapeHtml() utility
 * - C-02: Query injection prevention via sanitizeSearchInput()
 * - C-03: Fixed buildProductGridHtml reference error
 * - C-04: Exposed _cartData via getter function
 * - C-05: Fixed cart operation race conditions with proper promise chaining
 * - H-01 to H-08: High-severity security and stability fixes
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */

(function () {
    'use strict';

    // ─── Internal State ───────────────────────────────────────────────────────
    var _categories = [];
    var _wishlistCache = {};
    var _cartData = null;
    var _featuredProducts = [];
    var _allProductsCache = null;
    var _searchDebounceTimer = null;
    var _notificationCache = [];
    var _unreadNotificationCount = 0;
    // FIXED: H-04: Guard flag for document click listener to prevent duplicate listeners
    var _searchInitDone = false;
    // FIXED: Medium: Loading state lock to prevent double-submission
    var _cartOperationLock = false;

    // ─── Utility Helpers ──────────────────────────────────────────────────────

    // FIXED: C-01: XSS Vulnerability — escapeHtml utility function for safe HTML insertion
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // FIXED: C-02: SQL/Query Injection — sanitizeSearchInput function for safe query construction
    function sanitizeSearchInput(query) {
        if (!query) return '';
        return String(query).trim()
            .replace(/\\/g, '\\\\')
            .replace(/%/g, '\\%')
            .replace(/_/g, '\\_')
            .replace(/,/g, '\\,')
            .replace(/"/g, '\\"')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)');
    }

    /**
     * Format a number as MMK currency with comma separators.
     * e.g. 150000 → "K150,000"
     */
    function formatPrice(amount) {
        if (amount === null || amount === undefined) return 'K0';
        var num = Number(amount);
        if (isNaN(num)) return 'K0';
        var parts = num.toFixed(0).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return 'K' + parts.join('.');
    }

    /**
     * Generate a URL-safe slug from text.
     */
    function slugify(text) {
        if (!text) return '';
        return text.toLowerCase().trim().replace(/[^a-z0-9\u1000-\u109f\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '');
    }

    /**
     * Truncate text to a given length with ellipsis.
     */
    function truncate(text, len) {
        if (!text) return '';
        return text.length > len ? text.substring(0, len) + '...' : text;
    }

    /**
     * Simple debounce helper.
     */
    function debounce(fn, delay) {
        var timer = null;
        return function () {
            var ctx = this;
            var args = arguments;
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(ctx, args);
            }, delay);
        };
    }

    /**
     * Generate a star rating HTML string.
     */
    function starRating(rating, size) {
        size = size || 14;
        var html = '';
        var full = Math.floor(rating);
        var half = (rating - full) >= 0.5 ? 1 : 0;
        var empty = 5 - full - half;
        var i;
        for (i = 0; i < full; i++) {
            html += '<i class="fa-solid fa-star" style="color:#f59e0b;font-size:' + size + 'px"></i>';
        }
        if (half) {
            html += '<i class="fa-solid fa-star-half-stroke" style="color:#f59e0b;font-size:' + size + 'px"></i>';
        }
        for (i = 0; i < empty; i++) {
            html += '<i class="fa-regular fa-star" style="color:#d1d5db;font-size:' + size + 'px"></i>';
        }
        return html;
    }

    /**
     * Relative time string (e.g. "2 hours ago").
     * FIXED: Medium: Added guard against negative diff values
     */
    function timeAgo(dateStr) {
        if (!dateStr) return '';
        var now = new Date();
        var date = new Date(dateStr);
        var diff = Math.floor((now - date) / 1000);
        // FIXED: Medium: Handle potential negative diff (clock skew, future dates)
        if (diff < 0) return 'just now';
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    /**
     * Get a placeholder image URL for products without images.
     */
    function getPlaceholder(categorySlug) {
        var colors = {
            library: 'from-amber-400 to-orange-500',
            tech: 'from-cyan-400 to-blue-500',
            fashion: 'from-pink-400 to-rose-500',
            beauty: 'from-purple-400 to-fuchsia-500',
            outdoor: 'from-emerald-400 to-green-500'
        };
        var icons = {
            library: 'fa-book',
            tech: 'fa-microchip',
            fashion: 'fa-shirt',
            beauty: 'fa-spa',
            outdoor: 'fa-mountain-sun'
        };
        var c = colors[categorySlug] || 'from-gray-400 to-gray-500';
        var ic = icons[categorySlug] || 'fa-box';
        return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f59e0b"/><stop offset="100%" style="stop-color:#ea580c"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)" rx="12"/><text x="200" y="180" text-anchor="middle" font-family="sans-serif" font-size="48" fill="white" opacity="0.9">&#xf4f6;</text><text x="200" y="240" text-anchor="middle" font-family="sans-serif" font-size="16" fill="white" opacity="0.7">No Image</text></svg>');
    }

    // FIXED: Medium: Validate image URL before rendering
    function isValidImageUrl(url) {
        if (!url) return false;
        // Allow data URIs, relative URLs, and common image protocols
        if (url.indexOf('data:image') === 0) return true;
        if (url.indexOf('/') === 0) return true;
        if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) return true;
        // Reject javascript: and other dangerous protocols
        if (url.indexOf('javascript:') === 0) return false;
        if (url.indexOf('data:text') === 0) return false;
        if (url.indexOf('data:html') === 0) return false;
        return true;
    }

    // FIXED: Medium: Validate UUID format for IDs used in onclick handlers
    function isValidUuid(id) {
        if (!id || typeof id !== 'string') return false;
        // Standard UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
    }

    /**
     * Log a visitor page view (non-blocking, fire-and-forget).
     */
    function logVisit(page, productId) {
        try {
            var entry = {
                page: page || window.location.hash,
                product_id: productId || null,
                session_id: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ksession') : null,
                user_agent: navigator.userAgent
            };
            sb.from('visitor_logs').insert(entry).then(function () {}, function () {});
        } catch (e) {
            // silent fail for analytics
        }
    }

    /**
     * Log an activity to activity_logs.
     */
    function logActivity(action, entityType, entityId, meta) {
        if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) return;
        try {
            sb.from('activity_logs').insert({
                user_id: currentUser.id,
                action: action,
                entity_type: entityType || null,
                entity_id: entityId || null,
                metadata: meta || {}
            }).then(function () {}, function () {});
        } catch (e) {
            // silent fail
        }
    }


    // ═════════════════════════════════════════════════════════════════════════════════
    // PRODUCT MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    var ProductManager = {

        /**
         * Load products with optional filters.
         * @param {string} category  - Category slug to filter by.
         * @param {number} page     - Page number (1-based).
         * @param {number} limit    - Items per page.
         * @param {string} sortBy  - 'newest', 'price_asc', 'price_desc', 'popular', 'rating'.
         * @param {string} searchQuery - Text search query.
         * @returns {Promise} Resolves with { data, count }.
         */
        loadProducts: function (category, page, limit, sortBy, searchQuery) {
            page = page || 1;
            limit = limit || 20;
            var from = (page - 1) * limit;
            var to = from + limit - 1;

            var query = sb.from('v_products_with_images').select('*', { count: 'exact' });

            if (category) {
                query = query.eq('category_slug', category);
            }

            // FIXED: C-02: Apply sanitizeSearchInput to prevent query injection
            if (searchQuery && searchQuery.trim()) {
                var sanitizedQuery = sanitizeSearchInput(searchQuery);
                if (sanitizedQuery) {
                    query = query.or('name.ilike.%' + sanitizedQuery + '%,short_desc.ilike.%' + sanitizedQuery + '%,tags.cs.{"' + sanitizedQuery + '"}');
                }
            }

            switch (sortBy) {
                case 'price_asc':
                    query = query.order('price', { ascending: true });
                    break;
                case 'price_desc':
                    query = query.order('price', { ascending: false });
                    break;
                case 'popular':
                    query = query.order('total_sold', { ascending: false, nullsFirst: false });
                    break;
                case 'rating':
                    query = query.order('rating_avg', { ascending: false, nullsFirst: false });
                    break;
                case 'views':
                    query = query.order('view_count', { ascending: false, nullsFirst: false });
                    break;
                case 'newest':
                default:
                    query = query.order('created_at', { ascending: false });
                    break;
            }

            return query.range(from, to);
        },

        /**
         * Render a single product card HTML.
         * @param {Object} product - Product row from v_products_with_images.
         * @returns {string} HTML string.
         * FIXED: C-01: All user data is now escaped via escapeHtml()
         */
        renderProductCard: function (product) {
            if (!product) return '';

            // FIXED: C-01: Validate and use safe image URL
            var rawImg = product.primary_image || getPlaceholder(product.category_slug);
            var img = isValidImageUrl(rawImg) ? rawImg : getPlaceholder(product.category_slug);
            
            // FIXED: C-01: Escape all user-provided strings for XSS prevention
            var name = escapeHtml(product.name) || 'Untitled Product';
            var price = formatPrice(product.price);
            var comparePrice = product.compare_at_price ? formatPrice(product.compare_at_price) : '';
            var storeName = escapeHtml(product.store_name) || 'K.Subject-1';
            var category = escapeHtml(product.category_name) || '';
            var rating = product.rating_avg || 0;
            var reviews = product.review_count || 0;
            var sold = product.total_sold || 0;
            var stock = product.stock_quantity || 0;
            var isWishlisted = _wishlistCache[product.id] || false;
            var hasDiscount = product.compare_at_price && Number(product.compare_at_price) > Number(product.price);
            var discountPct = 0;
            if (hasDiscount) {
                discountPct = Math.round((1 - Number(product.price) / Number(product.compare_at_price)) * 100);
            }

            var outOfStock = stock <= 0;
            var lowStock = stock > 0 && stock <= (product.low_stock_threshold || 5);

            // FIXED: C-01: Escape product ID for attribute (should be UUID but defense in depth)
            var safeProductId = escapeHtml(String(product.id));
            var safeCategorySlug = escapeHtml(product.category_slug || '');

            var card = '<div class="product-card card-shine glow-ring group" data-product-id="' + safeProductId + '" data-category="' + safeCategorySlug + '">';

            // Image wrapper
            card += '<div class="relative overflow-hidden rounded-xl aspect-square bg-gray-100">';
            card += '<img src="' + escapeHtml(img) + '" alt="' + name + '" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" onerror="this.src=\'' + getPlaceholder(product.category_slug) + '\'"/>';

            // Badges
            if (hasDiscount) {
                card += '<span class="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">-' + discountPct + '%</span>';
            }
            if (product.is_featured) {
                card += '<span class="absolute top-3 ' + (hasDiscount ? 'left-16' : 'left-3') + ' bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg"><i class="fa-solid fa-fire mr-1"></i>Hot</span>';
            }
            if (outOfStock) {
                card += '<span class="absolute top-3 right-3 bg-gray-800 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">Out of Stock</span>';
            } else if (lowStock) {
                card += '<span class="absolute top-3 right-3 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">Low Stock</span>';
            }

            // Wishlist button
            card += '<button onclick="WishlistManager.toggleWishlist(\'' + safeProductId + '\'); event.stopPropagation();" class="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-white transition-all duration-200 hover:scale-110 wishlist-btn-' + safeProductId + '">';
            card += '<i class="' + (isWishlisted ? 'fa-solid' : 'fa-regular') + ' fa-heart text-sm ' + (isWishlisted ? 'text-red-500' : 'text-gray-500') + '"></i>';
            card += '</button>';

            card += '</div>'; // end image wrapper

            // Info section
            card += '<div class="mt-3 px-1">';

            // Store name
            card += '<p class="text-xs text-gray-400 font-medium truncate mb-1"><i class="fa-solid fa-store mr-1"></i>' + storeName + '</p>';

            // Product name
            card += '<h3 class="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug mb-1.5 group-hover:text-amber-600 transition-colors cursor-pointer">' + truncate(name, 60) + '</h3>';

            // Rating
            if (rating > 0) {
                card += '<div class="flex items-center gap-1.5 mb-2">';
                card += starRating(rating, 12);
                card += '<span class="text-xs text-gray-400">' + rating.toFixed(1) + (reviews > 0 ? ' (' + reviews + ')' : '') + '</span>';
                card += '</div>';
            } else {
                card += '<div class="mb-2 h-4"></div>';
            }

            // Price
            card += '<div class="flex items-baseline gap-2 flex-wrap">';
            card += '<span class="text-lg font-bold text-gray-900">' + price + '</span>';
            if (hasDiscount) {
                card += '<span class="text-sm text-gray-400 line-through">' + comparePrice + '</span>';
            }
            card += '</div>';

            // Sold count
            if (sold > 0) {
                card += '<p class="text-xs text-gray-400 mt-1.5"><i class="fa-solid fa-bag-shopping mr-1"></i>' + sold + ' sold</p>';
            }

            card += '</div>'; // end info section

            // Add to cart button
            // FIXED: H-05: Check stock validation before showing add to cart button
            if (!outOfStock && typeof currentUser !== 'undefined' && currentUser) {
                card += '<button onclick="CartManager.addToCart(\'' + safeProductId + '\', null, 1); event.stopPropagation();" class="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">';
                card += '<i class="fa-solid fa-cart-plus"></i> Add to Cart';
                card += '</button>';
            } else if (!outOfStock) {
                card += '<button onclick="showToast(\'Please sign in to add items to cart\', \'info\'); event.stopPropagation();" class="w-full mt-3 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold hover:bg-gray-200 transition-all duration-200 flex items-center justify-center gap-2">';
                card += '<i class="fa-solid fa-cart-plus"></i> Add to Cart';
                card += '</button>';
            }

            card += '</div>';
            return card;
        },

        /**
         * Render the main collection view with product grid.
         * @param {string} activeCategory - Currently selected category slug (null = all).
         */

        /**
         * Build product grid HTML string.
         * @param {Array} products - Array of product objects.
         * @param {number} total - Total product count.
         * @returns {string} HTML string for product grid.
         */
        buildProductGridHtml: function (products, total) {
            var html = '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">';
            for (var i = 0; i < products.length; i++) {
                html += ProductManager.renderProductCard(products[i]);
            }
            html += '</div>';
            // Results count
            html += '<p class="text-center text-sm text-muted mt-8">Showing ' + products.length + ' of ' + total + ' products</p>';
            return html;
        },

        renderCollection: function (activeCategory) {
            var container = safeGet('collectionContent');
            if (!container) return;

            container.innerHTML = '<div class="flex items-center justify-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent"></div></div>';

            ProductManager.loadProducts(activeCategory, 1, 24, 'newest', null)
                .then(function (result) {
                    var products = result.data || [];
                    var total = result.count || 0;

                    if (products.length === 0) {
                        var catIcon = (activeCategory === 'tech') ? 'fa-microchip' :
                                     (activeCategory === 'fashion') ? 'fa-shirt' :
                                     (activeCategory === 'beauty') ? 'fa-spa' :
                                     (activeCategory === 'outdoor') ? 'fa-tree' :
                                     (activeCategory === 'library') ? 'fa-book' : 'fa-box-open';
                        var catTitle = (activeCategory === 'tech') ? 'Tech Picks Coming Soon' :
                                       (activeCategory === 'fashion') ? 'Fashion Line in Progress' :
                                       (activeCategory === 'beauty') ? 'Beauty Selection Loading' :
                                       (activeCategory === 'outdoor') ? 'Outdoor Gear Curating' :
                                       (activeCategory === 'library') ? 'Library Being Stocked' : 'Collection Awaiting Products';
                        var catDesc = (activeCategory === 'tech') ? 'We\'re sourcing cutting-edge tech and gadgets that blend innovation with elegant design.' :
                                    (activeCategory === 'fashion') ? 'Our fashion curators are selecting pieces that define contemporary style.' :
                                    (activeCategory === 'beauty') ? 'Premium beauty essentials are being tested and selected for quality.' :
                                    (activeCategory === 'outdoor') ? 'Rugged yet refined outdoor gear is being chosen for your next adventure.' :
                                    (activeCategory === 'library') ? 'We\'re carefully selecting essential reads, guides, and resources. Quality takes time.' :
                                    'The shelves are ready. Our curators are selecting premium pieces across all categories.';
                        var catBtnIcon = (activeCategory === 'library') ? 'fa-arrow-right' : 'fa-plus';
                        var catBtnText = (activeCategory === 'library') ? 'Browse Collection' : 'Submit a Product';
                        var catBtnAction = (activeCategory === 'library') ? 'navigateTo(\'collection\')' : 'navigateTo(\'collaborate\')';

                        // Replace empty state immediately (NO FADE to prevent flash)
                        var existingEmpty = container.querySelector('.empty-state');
                        if (!existingEmpty || !existingEmpty.classList.contains('collection-empty-shown')) {
                            container.innerHTML = '<div class="empty-state collection-empty-shown" style="opacity:1!important;animation:none!important;transition:none!important;">' +
                                '<div class="empty-state-visual" style="opacity:1!important;animation:none!important;transition:none!important;">' +
                                    '<i class="fa-solid ' + catIcon + ' empty-state-icon" aria-hidden="true" style="animation:none!important;"></i>' +
                                '</div>' +
                                '<h3 class="empty-state-title" style="opacity:1!important;animation:none!important;transition:none!important;">' + catTitle + '</h3>' +
                                '<p class="empty-state-desc" style="opacity:1!important;animation:none!important;transition:none!important;">' + catDesc + '</p>' +
                                '<button onclick="' + catBtnAction + '" class="empty-state-action" style="opacity:1!important;pointer-events:auto!important;z-index:100!important;cursor:pointer!important;animation:none!important;transition:none!important;">' +
                                    '<i class="fa-solid ' + catBtnIcon + ' text-xs" aria-hidden="true"></i> ' + catBtnText +
                                '</button>' +
                            '</div>';
                        }
                        // If already showing, do nothing to prevent re-render flash
                        return;
                    }

                    // Products exist - show immediately (NO FADE to prevent flash)
                    var existingEmptyState = container.querySelector('.empty-state');
                    // FIXED: C-03: Changed buildProductGridHtml to ProductManager.buildProductGridHtml
                    var productHtml = ProductManager.buildProductGridHtml(products, total);

                    // Replace immediately without any transition
                    container.innerHTML = productHtml;
                })
                .catch(function (err) {
                    console.error('Collection load error:', err);
                    container.innerHTML = '<div class="text-center py-20"><div class="text-5xl mb-4 text-coral/60"><i class="fa-solid fa-triangle-exclamation"></i></div><h3 class="text-lg font-semibold text-subtle">Having trouble loading</h3><p class="text-muted text-sm mt-1">Please refresh the page or try again in a moment.</p></div>';
                });
        },

        /**
         * Render the Library category view specifically.
         */
        renderLibrary: function () {
            var container = safeGet('libraryContent');
            if (!container) return;

            container.innerHTML = '<div class="flex items-center justify-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent"></div></div>';

            ProductManager.loadProducts('library', 1, 24, 'newest', null)
                .then(function (result) {
                    var products = result.data || [];

                    if (products.length === 0) {
                        // Check for existing empty state - replace immediately (NO FADE to prevent flash)
                        var existingEmpty = container.querySelector('.empty-state');
                        if (!existingEmpty || !existingEmpty.classList.contains('library-empty-shown')) {
                            // Only update if not already showing or different
                            container.innerHTML = '<div class="empty-state library-empty-shown" style="opacity:1!important;pointer-events:auto!important;animation:none!important;transition:none!important;">' +
                                '<div class="empty-state-visual" style="opacity:1!important;pointer-events:none!important;animation:none!important;transition:none!important;">' +
                                    '<i class="fa-solid fa-book empty-state-icon" aria-hidden="true" style="animation:none!important;"></i>' +
                                '</div>' +
                                '<h3 class="empty-state-title" style="opacity:1!important;animation:none!important;transition:none!important;">No items yet</h3>' +
                                '<p class="empty-state-desc" style="opacity:1!important;animation:none!important;transition:none!important;">Library essentials are on the way. We\'re carefully selecting items for quality.</p>' +
                                '<button id="libraryBrowseBtnDynamic" type="button" onclick="navigateTo(\'collection\')" class="empty-state-action" style="opacity:1!important;pointer-events:auto!important;z-index:100!important;cursor:pointer!important;animation:none!important;transition:none!important;">' +
                                    '<i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i> Browse Collection' +
                                '</button>' +
                            '</div>';
                            // Attach backup click handler
                            var dynamicBtn = document.getElementById('libraryBrowseBtnDynamic');
                            if (dynamicBtn) {
                                dynamicBtn.addEventListener('click', function(e) {
                                    e.stopPropagation();
                                    if (typeof navigateTo === 'function') {
                                        navigateTo('collection');
                                    }
                                });
                            }
                        }
                        // If already showing library empty state, do nothing (prevents re-render flash)
                        return;
                            // (handled above - no else block needed)
                    }

                    // Products exist - show them immediately (NO FADE to prevent flash)
                    var existingEmptyState = container.querySelector('.empty-state');
                    var libProductHtml = '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">';
                    for (var j = 0; j < products.length; j++) {
                        libProductHtml += ProductManager.renderProductCard(products[j]);
                    }
                    libProductHtml += '</div>';

                    // Replace immediately without any transition
                    container.innerHTML = libProductHtml;
                })
                .catch(function (err) {
                    console.error('Library load error:', err);
                    container.innerHTML = '<div class="text-center py-20"><p class="text-muted">Having trouble loading library items. Please refresh and try again.</p></div>';
                });
        },

        /**
         * Render featured products section (hero area, etc.).
         */
        renderFeaturedProducts: function () {
            if (_featuredProducts.length === 0) return '';
            var html = '';
            for (var i = 0; i < _featuredProducts.length; i++) {
                html += ProductManager.renderProductCard(_featuredProducts[i]);
            }
            return html;
        },

        /**
         * Load featured products into the internal cache.
         * @returns {Promise}
         */
        loadFeaturedProducts: function () {
            return sb.from('v_products_with_images')
                .select('*')
                .eq('is_featured', true)
                .order('created_at', { ascending: false })
                .limit(10)
                .then(function (result) {
                    _featuredProducts = result.data || [];
                    return _featuredProducts;
                })
                .catch(function (err) {
                    console.error('Featured products load error:', err);
                    _featuredProducts = [];
                    return [];
                });
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // SEARCH MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    var SearchManager = {

        /**
         * Search products by query string.
         * @param {string} query - Search text.
         * @returns {Promise} Resolves with array of products.
         * FIXED: C-02: Applied sanitizeSearchInput to prevent query injection
         */
        searchProducts: function (query) {
            if (!query || !query.trim()) return Promise.resolve([]);
            // FIXED: C-02: Sanitize search input to prevent query injection
            var q = sanitizeSearchInput(query);
            if (!q) return Promise.resolve([]);

            return sb.from('v_products_with_images')
                .select('*')
                .or('name.ilike.%' + q + '%,short_desc.ilike.%' + q + '%,description.ilike.%' + q + '%')
                .limit(20)
                .order('rating_avg', { ascending: false, nullsFirst: false });
        },

        /**
         * Render search results dropdown.
         * @param {Array} results - Array of product objects.
         * @param {HTMLElement} container - The .search-results dropdown element.
         * FIXED: C-01: All user data escaped via escapeHtml()
         */
        renderSearchResults: function (results, container) {
            if (!container) {
                var containers = document.querySelectorAll('.search-results');
                if (containers.length > 0) container = containers[0];
            }
            if (!container) return;

            if (!results || results.length === 0) {
                container.innerHTML = '<div class="p-6 text-center"><div class="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3"><i class="fa-solid fa-magnifying-glass text-accent"></i></div><p class="text-subtle text-sm font-medium">No results found</p><p class="text-muted text-xs mt-1">Try different keywords</p></div>';
                container.style.display = 'block';
                return;
            }

            var html = '';
            for (var i = 0; i < results.length; i++) {
                var p = results[i];
                // FIXED: C-01: Validate and escape image URL
                var rawImg = p.primary_image || getPlaceholder(p.category_slug);
                var img = isValidImageUrl(rawImg) ? rawImg : getPlaceholder(p.category_slug);
                // FIXED: C-01/H-07: Validate ID format before using in onclick
                var safeId = isValidUuid(p.id) ? p.id : '';
                html += '<div class="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors rounded-lg mx-1" onclick="navigateTo(\'product\', \'' + safeId + '\'); SearchManager.hideResults();">';
                html += '<img src="' + escapeHtml(img) + '" alt="" class="w-12 h-12 rounded-lg object-cover flex-shrink-0" onerror="this.style.display=\'none\'"/>';
                html += '<div class="flex-1 min-w-0">';
                // FIXED: C-01: Escape user data
                html += '<p class="text-sm font-medium text-gray-800 truncate">' + escapeHtml(p.name) + '</p>';
                html += '<p class="text-xs text-gray-400">' + escapeHtml(p.category_name || '') + ' · ' + formatPrice(p.price) + '</p>';
                html += '</div>';
                html += '</div>';
            }

            html += '<div class="border-t border-gray-100 px-3 py-2 text-center"><span class="text-xs text-gray-400">' + results.length + ' result' + (results.length !== 1 ? 's' : '') + '</span></div>';

            container.innerHTML = html;
            container.style.display = 'block';
        },

        /**
         * Hide search results dropdown.
         */
        hideResults: function () {
            var containers = document.querySelectorAll('.search-results');
            for (var i = 0; i < containers.length; i++) {
                containers[i].style.display = 'none';
            }
        },

        /**
         * Debounced search handler (300ms delay).
         * @param {string} query - Search text.
         * @param {HTMLElement} container - Optional target dropdown.
         */
        debouncedSearch: debounce(function (query, container) {
            if (!query || !query.trim()) {
                SearchManager.hideResults();
                return;
            }
            SearchManager.searchProducts(query).then(function (results) {
                SearchManager.renderSearchResults(results, container);
                SearchManager.saveSearchHistory(query);
            });
        }, 300),

        /**
         * Save a search query to search_history (logged-in users only).
         * @param {string} query - Search text.
         */
        saveSearchHistory: function (query) {
            if (!query || !query.trim()) return;
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) return;

            // FIXED: C-02: Sanitize before storing
            var q = sanitizeSearchInput(query);
            if (!q) return;
            sb.from('search_history').insert({
                user_id: currentUser.id,
                query: q
            }).then(function () {}, function () {});
        },

        /**
         * Initialize search inputs with event listeners.
         * FIXED: H-04: Added guard flag to prevent duplicate click listeners
         */
        init: function () {
            // FIXED: H-04: Prevent duplicate initialization and multiple listeners
            if (_searchInitDone) return;
            _searchInitDone = true;

            var heroSearch = safeGet('heroSearch');
            var headerSearch = safeGet('headerSearch');

            function attachSearch(inputEl) {
                if (!inputEl) return;
                var resultsEl = inputEl.parentElement.querySelector('.search-results') || inputEl.nextElementSibling;

                inputEl.addEventListener('input', function () {
                    SearchManager.debouncedSearch(this.value, resultsEl);
                });

                inputEl.addEventListener('focus', function () {
                    if (this.value.trim()) {
                        SearchManager.debouncedSearch(this.value, resultsEl);
                    }
                });

                inputEl.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' && this.value.trim()) {
                        e.preventDefault();
                        SearchManager.hideResults();
                        if (typeof navigateTo === 'function') {
                            navigateTo('search', this.value.trim());
                        }
                    }
                    if (e.key === 'Escape') {
                        SearchManager.hideResults();
                    }
                });
            }

            attachSearch(heroSearch);
            attachSearch(headerSearch);

            // Close search results on outside click
            document.addEventListener('click', function (e) {
                if (!e.target.closest('.search-wrapper') && !e.target.closest('.search-results')) {
                    SearchManager.hideResults();
                }
            });
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // CART MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    var CartManager = {

        _couponDiscount: 0,
        _couponCode: '',
        // FIXED: H-06: Coupon persistence note - coupon state is in-memory only
        // and will be lost on page refresh. Consider persisting to localStorage
        // or session storage if persistent coupons are desired.

        /**
         * Load cart items for the current user.
         * @returns {Promise} Resolves with array of cart items.
         * FIXED: H-02: Added error check for sb.rpc response
         */
        loadCart: function () {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
                _cartData = { items: [] };
                return Promise.resolve([]);
            }

            return sb.rpc('get_or_create_cart', { p_user_id: currentUser.id })
                .then(function (res) {
                    // FIXED: H-02: Check for errors in RPC response before accessing res.data
                    if (!res || res.error) {
                        console.error('Cart RPC error:', res ? res.error : 'No response');
                        _cartData = { items: [] };
                        CartManager.renderCart();
                        return Promise.reject(new Error(res ? res.error : 'Cart creation failed'));
                    }
                    var cartId = res.data;
                    return sb.from('v_cart_items')
                        .select('*')
                        .eq('cart_id', cartId)
                        .order('added_at', { ascending: false });
                })
                .then(function (result) {
                    _cartData = { items: result.data || [] };
                    CartManager.renderCart();
                    return _cartData.items;
                })
                .catch(function (err) {
                    console.error('Cart load error:', err);
                    _cartData = { items: [] };
                    CartManager.renderCart();
                    return [];
                });
        },

        /**
         * Add a product to the cart.
         * @param {string} productId - UUID of the product.
         * @param {string|null} variantId - UUID of the variant (optional).
         * @param {number} quantity - Quantity to add.
         * FIXED: H-05: Added stock validation before adding to cart
         * FIXED: C-05: Proper promise chaining instead of fire-and-forget
         */
        addToCart: function (productId, variantId, quantity) {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
                showToast('Please sign in to add items to cart', 'info');
                return Promise.reject(new Error('Not authenticated'));
            }

            // FIXED: Medium: Double-submission lock
            if (_cartOperationLock) {
                showToast('Cart operation in progress, please wait...', 'info');
                return Promise.reject(new Error('Operation in progress'));
            }

            quantity = quantity || 1;

            // FIXED: H-07: Validate product ID format
            if (!isValidUuid(productId)) {
                showToast('Invalid product ID', 'error');
                return Promise.reject(new Error('Invalid product ID'));
            }

            _cartOperationLock = true;

            // Get the product price and stock info
            var pricePromise;
            if (variantId) {
                pricePromise = sb.from('product_variants').select('price, product_id').eq('id', variantId).single();
            } else {
                pricePromise = sb.from('products').select('price, stock_quantity').eq('id', productId).single();
            }

            return pricePromise
                .then(function (result) {
                    // FIXED: H-05: Stock validation before adding to cart
                    if (!variantId && result && result.stock_quantity !== undefined && result.stock_quantity <= 0) {
                        throw new Error('Product is out of stock');
                    }
                    
                    var unitPrice = result.price;
                    // If variant price is null, use parent product price
                    if (unitPrice === null && result.product_id) {
                        return sb.from('products').select('price').eq('id', result.product_id).single()
                            .then(function (parentResult) {
                                return parentResult.price;
                            });
                    }
                    return unitPrice;
                })
                .then(function (unitPrice) {
                    return sb.rpc('get_or_create_cart', { p_user_id: currentUser.id })
                        .then(function (res) {
                            // FIXED: H-02: Check for errors in RPC response
                            if (!res || res.error) {
                                throw new Error(res ? res.error : 'Failed to create/retrieve cart');
                            }
                            var cartId = res.data;
                            var item = {
                                cart_id: cartId,
                                product_id: productId,
                                quantity: quantity,
                                unit_price: unitPrice
                            };
                            if (variantId) {
                                item.variant_id = variantId;
                            }
                            return sb.from('cart_items').upsert(item, { onConflict: 'cart_id,product_id,variant_id' });
                        });
                })
                .then(function () {
                    showToast('Added to cart!', 'success');
                    logActivity('add_to_cart', 'product', productId);
                    // FIXED: C-05: Return the promise chain properly
                    return CartManager.loadCart();
                })
                .catch(function (err) {
                    console.error('Add to cart error:', err);
                    if (err.message === 'Product is out of stock') {
                        showToast('Sorry, this product is out of stock', 'error');
                    } else {
                        showToast('Failed to add to cart', 'error');
                    }
                    throw err;
                })
                .finally(function () {
                    // FIXED: Medium: Release lock after operation completes
                    _cartOperationLock = false;
                });
        },

        /**
         * Remove a cart item.
         * @param {string} cartItemId - UUID of the cart_items row.
         * FIXED: H-07: Validate cart item ID format
         */
        removeFromCart: function (cartItemId) {
            if (!cartItemId) return;
            // FIXED: H-07: Validate ID format
            if (!isValidUuid(cartItemId)) {
                console.error('Invalid cart item ID format');
                return;
            }

            sb.from('cart_items').delete().eq('id', cartItemId)
                .then(function () {
                    showToast('Item removed from cart', 'info');
                    // FIXED: C-05: Return promise chain
                    return CartManager.loadCart();
                })
                .catch(function (err) {
                    console.error('Remove from cart error:', err);
                    showToast('Failed to remove item', 'error');
                });
        },

        /**
         * Update the quantity of a cart item.
         * @param {string} cartItemId - UUID of the cart_items row.
         * @param {number} newQty - New quantity (must be > 0).
         * FIXED: H-07: Validate cart item ID format
         */
        updateCartQuantity: function (cartItemId, newQty) {
            if (!cartItemId || !newQty || newQty < 1) return;
            // FIXED: H-07: Validate ID format
            if (!isValidUuid(cartItemId)) {
                console.error('Invalid cart item ID format');
                return;
            }

            sb.from('cart_items').update({ quantity: newQty }).eq('id', cartItemId)
                .then(function () {
                    // FIXED: C-05: Return promise chain
                    return CartManager.loadCart();
                })
                .catch(function (err) {
                    console.error('Update cart quantity error:', err);
                    showToast('Failed to update quantity', 'error');
                });
        },

        /**
         * Apply a coupon code to the cart.
         * @param {string} code - Coupon code.
         * FIXED: H-08: Added sanity check for discount percentage (>90% rejected)
         */
        applyCoupon: function (code) {
            if (!code || !code.trim()) {
                showToast('Please enter a coupon code', 'info');
                return;
            }
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
                showToast('Please sign in to apply coupons', 'info');
                return;
            }

            // FIXED: Medium: Input length validation
            code = code.trim().toUpperCase().substring(0, 50);

            sb.from('coupons').select('*').eq('code', code).eq('is_active', true).single()
                .then(function (coupon) {
                    if (!coupon) {
                        showToast('Invalid coupon code', 'error');
                        return;
                    }

                    // Check dates
                    var now = new Date();
                    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
                        showToast('Coupon is not yet active', 'error');
                        return;
                    }
                    if (coupon.ends_at && new Date(coupon.ends_at) < now) {
                        showToast('Coupon has expired', 'error');
                        return;
                    }

                    // Check usage limit
                    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
                        showToast('Coupon usage limit reached', 'error');
                        return;
                    }

                    // Check minimum order
                    var subtotal = CartManager.getCartTotal();
                    if (coupon.min_order_amount && subtotal < Number(coupon.min_order_amount)) {
                        showToast('Minimum order amount is ' + formatPrice(coupon.min_order_amount), 'error');
                        return;
                    }

                    // Calculate discount
                    var discount = 0;
                    if (coupon.discount_type === 'percentage') {
                        discount = subtotal * (Number(coupon.discount_value) / 100);
                        if (coupon.max_discount && discount > Number(coupon.max_discount)) {
                            discount = Number(coupon.max_discount);
                        }
                    } else {
                        discount = Number(coupon.discount_value);
                        if (discount > subtotal) discount = subtotal;
                    }

                    // FIXED: H-08: Sanity check - reject if discount exceeds 90% of subtotal
                    if (subtotal > 0 && (discount / subtotal) > 0.90) {
                        console.warn('Coupon discount exceeds 90% threshold, capping at 90%');
                        discount = subtotal * 0.90;
                    }

                    CartManager._couponDiscount = discount;
                    CartManager._couponCode = coupon.code;

                    // Update cart with coupon
                    sb.rpc('get_or_create_cart', { p_user_id: currentUser.id })
                        .then(function (res) {
                            // FIXED: H-02: Check for RPC errors
                            if (!res || res.error) {
                                throw new Error(res ? res.error : 'Cart lookup failed');
                            }
                            return sb.from('carts').update({ coupon_id: coupon.id }).eq('id', res.data);
                        })
                        .then(function () {
                            showToast('Coupon applied! You save ' + formatPrice(discount), 'success');
                            CartManager.renderCart();
                        })
                        .catch(function (err) {
                            console.error('Coupon application error:', err);
                        });
                })
                .catch(function (err) {
                    console.error('Coupon error:', err);
                    showToast('Invalid coupon code', 'error');
                });
        },

        /**
         * Remove the applied coupon from the cart.
         */
        removeCoupon: function () {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) return;

            CartManager._couponDiscount = 0;
            CartManager._couponCode = '';

            sb.rpc('get_or_create_cart', { p_user_id: currentUser.id })
                .then(function (res) {
                    // FIXED: H-02: Check for RPC errors
                    if (!res || res.error) {
                        throw new Error(res ? res.error : 'Cart lookup failed');
                    }
                    return sb.from('carts').update({ coupon_id: null }).eq('id', res.data);
                })
                .then(function () {
                    showToast('Coupon removed', 'info');
                    CartManager.renderCart();
                })
                .catch(function (err) {
                    console.error('Remove coupon error:', err);
                });
        },

        /**
         * Render the cart panel contents.
         * FIXED: C-01: All user data escaped via escapeHtml()
         */
        renderCart: function () {
            var itemsContainer = safeGet('cartItems');
            var countBadge = safeGet('cartCount');
            var totalEl = safeGet('cartTotal');
            var footerEl = safeGet('cartFooter');
            var emptyEl = safeGet('cartEmpty');

            var items = (_cartData && _cartData.items) ? _cartData.items : [];
            var count = 0;
            var subtotal = 0;

            for (var i = 0; i < items.length; i++) {
                count += items[i].quantity || 1;
                subtotal += (Number(items[i].unit_price) || 0) * (items[i].quantity || 1);
            }

            var discount = CartManager._couponDiscount || 0;
            var finalTotal = subtotal - discount;
            if (finalTotal < 0) finalTotal = 0;

            // Update count badge
            if (countBadge) {
                countBadge.textContent = count;
                countBadge.style.display = count > 0 ? 'flex' : 'none';
            }

            // Update total
            if (totalEl) {
                totalEl.textContent = formatPrice(finalTotal);
            }

            if (!itemsContainer) return;

            // Empty state
            if (items.length === 0) {
                itemsContainer.innerHTML = '';
                if (emptyEl) emptyEl.style.display = 'flex';
                if (footerEl) footerEl.style.display = 'none';
                return;
            }

            if (emptyEl) emptyEl.style.display = 'none';
            if (footerEl) footerEl.style.display = 'block';

            var html = '';
            for (var j = 0; j < items.length; j++) {
                var item = items[j];
                // FIXED: C-01: Validate and escape image URL
                var rawImg = item.product_image || getPlaceholder('');
                var img = isValidImageUrl(rawImg) ? rawImg : getPlaceholder('');
                var lineTotal = (Number(item.unit_price) || 0) * (item.quantity || 1);

                // FIXED: H-07: Validate cart item ID before using in onclick
                var safeCartItemId = isValidUuid(item.cart_item_id) ? item.cart_item_id : '';

                html += '<div class="flex gap-3 p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors rounded-lg">';
                html += '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(item.product_name || '') + '" class="w-16 h-16 rounded-lg object-cover flex-shrink-0" onerror="this.src=\'' + getPlaceholder('') + '\'"/>';
                html += '<div class="flex-1 min-w-0">';
                // FIXED: C-01: Escape user data
                html += '<p class="text-sm font-medium text-gray-800 truncate">' + escapeHtml(item.product_name || 'Product') + '</p>';
                if (item.variant_name) {
                    html += '<p class="text-xs text-gray-400 mt-0.5">' + escapeHtml(item.variant_name) + '</p>';
                }
                html += '<p class="text-sm font-bold text-gray-900 mt-1">' + formatPrice(item.unit_price) + '</p>';
                html += '<div class="flex items-center gap-2 mt-2">';
                html += '<button onclick="CartManager.updateCartQuantity(\'' + safeCartItemId + '\', ' + Math.max(1, (item.quantity || 1) - 1) + ')" class="w-7 h-7 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors text-xs font-bold">-</button>';
                html += '<span class="text-sm font-medium w-6 text-center">' + (item.quantity || 1) + '</span>';
                html += '<button onclick="CartManager.updateCartQuantity(\'' + safeCartItemId + '\', ' + ((item.quantity || 1) + 1) + ')" class="w-7 h-7 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors text-xs font-bold">+</button>';
                html += '<span class="ml-auto text-sm font-bold text-gray-900">' + formatPrice(lineTotal) + '</span>';
                html += '</div>';
                html += '</div>';
                html += '<button onclick="CartManager.removeFromCart(\'' + safeCartItemId + '\')" class="self-start p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Remove">';
                html += '<i class="fa-solid fa-trash-can text-xs"></i>';
                html += '</button>';
                html += '</div>';
            }

            // Coupon info
            if (CartManager._couponCode) {
                html += '<div class="p-3 bg-green-50 border border-green-200 rounded-lg mx-3 mt-3">';
                html += '<div class="flex items-center justify-between">';
                html += '<div class="flex items-center gap-2"><i class="fa-solid fa-tag text-green-600 text-sm"></i><span class="text-sm font-medium text-green-800">' + escapeHtml(CartManager._couponCode) + '</span></div>';
                html += '<button onclick="CartManager.removeCoupon()" class="text-xs text-green-600 hover:text-red-500 transition-colors"><i class="fa-solid fa-xmark"></i></button>';
                html += '</div>';
                html += '<p class="text-xs text-green-600 mt-1">You save ' + formatPrice(discount) + '!</p>';
                html += '</div>';
            }

            itemsContainer.innerHTML = html;
        },

        /**
         * Get the current cart item count.
         * @returns {number}
         */
        getCartCount: function () {
            if (!_cartData || !_cartData.items) return 0;
            var count = 0;
            for (var i = 0; i < _cartData.items.length; i++) {
                count += _cartData.items[i].quantity || 1;
            }
            return count;
        },

        /**
         * Get the cart subtotal (before discount).
         * @returns {number}
         */
        getCartTotal: function () {
            if (!_cartData || !_cartData.items) return 0;
            var total = 0;
            for (var i = 0; i < _cartData.items.length; i++) {
                var item = _cartData.items[i];
                total += (Number(item.unit_price) || 0) * (item.quantity || 1);
            }
            return total;
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // WISHLIST MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    var WishlistManager = {

        /**
         * Toggle a product in the wishlist (add if not present, remove if present).
         * @param {string} productId - UUID of the product.
         * FIXED: H-07: Validate product ID format
         */
        toggleWishlist: function (productId) {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
                showToast('Please sign in to add to wishlist', 'info');
                return;
            }

            // FIXED: H-07: Validate product ID format
            if (!isValidUuid(productId)) {
                console.error('Invalid product ID format for wishlist');
                return;
            }

            if (_wishlistCache[productId]) {
                // Remove from wishlist
                sb.from('wishlists').delete().eq('user_id', currentUser.id).eq('product_id', productId)
                    .then(function () {
                        _wishlistCache[productId] = false;
                        WishlistManager._updateWishlistButtons(productId, false);
                        showToast('Removed from wishlist', 'info');
                    })
                    .catch(function (err) {
                        console.error('Wishlist remove error:', err);
                        showToast('Failed to update wishlist', 'error');
                    });
            } else {
                // Add to wishlist
                sb.from('wishlists').insert({
                    user_id: currentUser.id,
                    product_id: productId
                })
                    .then(function () {
                        _wishlistCache[productId] = true;
                        WishlistManager._updateWishlistButtons(productId, true);
                        showToast('Added to wishlist!', 'success');
                        logActivity('add_to_wishlist', 'product', productId);
                    })
                    .catch(function (err) {
                        console.error('Wishlist add error:', err);
                        showToast('Failed to add to wishlist', 'error');
                    });
            }
        },

        /**
         * Check if a product is in the user's wishlist.
         * @param {string} productId - UUID of the product.
         * @returns {boolean}
         */
        isWishlisted: function (productId) {
            return !!_wishlistCache[productId];
        },

        /**
         * Load all wishlisted products for the current user and populate the cache.
         * @returns {Promise}
         */
        loadWishlist: function () {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
                _wishlistCache = {};
                return Promise.resolve([]);
            }

            return sb.from('wishlists')
                .select('product_id')
                .eq('user_id', currentUser.id)
                .then(function (result) {
                    _wishlistCache = {};
                    var items = result.data || [];
                    for (var i = 0; i < items.length; i++) {
                        _wishlistCache[items[i].product_id] = true;
                    }
                    return items;
                })
                .catch(function (err) {
                    console.error('Wishlist load error:', err);
                    _wishlistCache = {};
                    return [];
                });
        },

        /**
         * Update all wishlist button instances for a given product ID.
         * @private
         */
        _updateWishlistButtons: function (productId, isWishlisted) {
            var btns = document.querySelectorAll('.wishlist-btn-' + productId);
            for (var i = 0; i < btns.length; i++) {
                var icon = btns[i].querySelector('i');
                if (icon) {
                    icon.className = (isWishlisted ? 'fa-solid' : 'fa-regular') + ' fa-heart text-sm ' + (isWishlisted ? 'text-red-500' : 'text-gray-500');
                }
            }
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // CATEGORY MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    var CategoryManager = {

        /**
         * Load all active categories.
         * @returns {Promise} Resolves with array of category objects.
         */
        loadCategories: function () {
            return sb.from('categories')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
                .then(function (result) {
                    _categories = result.data || [];
                    return _categories;
                })
                .catch(function (err) {
                    console.error('Categories load error:', err);
                    _categories = [];
                    return [];
                });
        },

        /**
         * Render product counts on category pills/links.
         */
        renderCategoryCounts: function () {
            // Update .cat-pill elements with data-colcat attribute
            var pills = document.querySelectorAll('.cat-pill');
            for (var i = 0; i < pills.length; i++) {
                var slug = pills[i].getAttribute('data-colcat');
                var cat = CategoryManager.getCategoryBySlug(slug);
                if (cat) {
                    var countEl = pills[i].querySelector('.cat-count');
                    if (countEl) {
                        countEl.textContent = cat.product_count || 0;
                    }
                }
            }

            // Update .cat-link elements
            var links = document.querySelectorAll('.cat-link');
            for (var j = 0; j < links.length; j++) {
                var linkSlug = links[j].getAttribute('data-cat') || links[j].getAttribute('data-colcat');
                var linkCat = CategoryManager.getCategoryBySlug(linkSlug);
                if (linkCat) {
                    var linkCountEl = links[j].querySelector('.cat-count');
                    if (linkCountEl) {
                        linkCountEl.textContent = linkCat.product_count || 0;
                    }
                }
            }
        },

        /**
         * Get a category by its slug.
         * @param {string} slug - Category slug.
         * @returns {Object|null} Category object or null.
         */
        getCategoryBySlug: function (slug) {
            if (!slug) return null;
            for (var i = 0; i < _categories.length; i++) {
                if (_categories[i].slug === slug) return _categories[i];
            }
            return null;
        },

        /**
         * Get all loaded categories.
         * @returns {Array}
         */
        getAll: function () {
            return _categories;
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // DASHBOARD MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    var DashboardManager = {

        /**
         * Load and render dashboard overview stats.
         * FIXED: H-01: Added .catch() handlers to all stat queries
         */
        loadDashboardStats: function () {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) return;

            var userId = currentUser.id;
            var role = currentUser.role;

            // Products stat
            var productsQuery = role === 'admin'
                ? sb.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active')
                : sb.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', userId);

            productsQuery.then(function (result) {
                var el = safeGet('dashStatProducts');
                if (el) el.textContent = result.count || 0;
            }).catch(function (err) {
                // FIXED: H-01: Added catch handler
                console.error('Dashboard products stat error:', err);
            });

            // Orders stat
            var ordersQuery = role === 'admin'
                ? sb.from('orders').select('id', { count: 'exact', head: true })
                : sb.from('order_items').select('id', { count: 'exact', head: true }).eq('seller_id', userId);

            ordersQuery.then(function (result) {
                var el = safeGet('dashStatOrders');
                if (el) el.textContent = result.count || 0;
            }).catch(function (err) {
                // FIXED: H-01: Added catch handler
                console.error('Dashboard orders stat error:', err);
            });

            // Revenue stat
            var revenueQuery = role === 'admin'
                ? sb.from('orders').select('total_amount').neq('status', 'cancelled')
                : sb.from('order_items').select('subtotal').eq('seller_id', userId);

            revenueQuery.then(function (result) {
                var total = 0;
                var data = result.data || [];
                for (var i = 0; i < data.length; i++) {
                    var val = role === 'admin' ? Number(data[i].total_amount) : Number(data[i].subtotal);
                    if (!isNaN(val)) total += val;
                }
                var el = safeGet('dashStatRevenue');
                if (el) el.textContent = formatPrice(total);
            }).catch(function (err) {
                // FIXED: H-01: Added catch handler
                console.error('Dashboard revenue stat error:', err);
            });

            // Views stat (for sellers)
            if (role === 'seller') {
                sb.from('products').select('view_count').eq('seller_id', userId)
                    .then(function (result) {
                        var views = 0;
                        var data = result.data || [];
                        for (var i = 0; i < data.length; i++) {
                            views += Number(data[i].view_count) || 0;
                        }
                        var el = safeGet('dashStatViews');
                        if (el) el.textContent = views.toLocaleString();
                    }).catch(function (err) {
                        // FIXED: H-01: Added catch handler
                        console.error('Dashboard seller views stat error:', err);
                    });
            } else if (role === 'admin') {
                sb.from('visitor_logs').select('id', { count: 'exact', head: true })
                    .then(function (result) {
                        var el = safeGet('dashStatViews');
                        if (el) el.textContent = (result.count || 0).toLocaleString();
                    }).catch(function (err) {
                        // FIXED: H-01: Added catch handler
                        console.error('Dashboard admin views stat error:', err);
                    });
            }
        },

        /**
         * Load and render dashboard products list.
         * FIXED: C-01: User data escaped via escapeHtml()
         */
        loadDashboardProducts: function () {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) return;

            var listEl = safeGet('dashProductsList');
            var recentEl = safeGet('dashRecentProducts');

            var query = currentUser.role === 'admin'
                ? sb.from('products').select('*, categories(name, slug), product_images(url, is_primary)').order('created_at', { ascending: false }).limit(50)
                : sb.from('products').select('*, categories(name, slug), product_images(url, is_primary)').eq('seller_id', currentUser.id).order('created_at', { ascending: false }).limit(50);

            query.then(function (result) {
                var products = result.data || [];

                // Render products list in dashboard
                if (listEl) {
                    if (products.length === 0) {
                        listEl.innerHTML = '<div class="text-center py-6 sm:py-10 px-4"><div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3"><i class="fa-solid fa-box-open text-accent text-base sm:text-lg"></i></div><p class="text-subtle text-sm font-medium">No products yet</p><p class="text-muted text-xs mt-1">Add your first product to get started</p></div>';
                    } else {
                        var html = '<div class="space-y-3">';
                        for (var i = 0; i < products.length; i++) {
                            var p = products[i];
                            var primaryImg = '';
                            if (p.product_images && p.product_images.length > 0) {
                                for (var j = 0; j < p.product_images.length; j++) {
                                    if (p.product_images[j].is_primary) {
                                        primaryImg = p.product_images[j].url;
                                        break;
                                    }
                                }
                                if (!primaryImg && p.product_images[0]) primaryImg = p.product_images[0].url;
                            }

                            var statusColors = {
                                draft: 'bg-white/5 text-gray-400 border border-white/10',
                                active: 'bg-green-500/10 text-green-400 border border-green-500/20',
                                archived: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
                                banned: 'bg-red-500/10 text-red-400 border border-red-500/20'
                            };
                            var statusClass = statusColors[p.status] || 'bg-white/5 text-gray-400 border border-white/10';

                            // FIXED: C-01: Validate image URL and escape user data
                            var safePrimaryImg = isValidImageUrl(primaryImg) ? primaryImg : getPlaceholder('');
                            var safeProductId = isValidUuid(p.id) ? p.id : '';

                            html += '<div class="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors bg-white/[0.02]">';
                            html += '<img src="' + escapeHtml(safePrimaryImg) + '" alt="" class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0" onerror="this.style.display=\'none\'"/>';
                            html += '<div class="flex-1 min-w-0">';
                            html += '<p class="text-xs sm:text-sm font-medium text-softWhite truncate">' + escapeHtml(p.name || 'Untitled') + '</p>';
                            html += '<p class="text-[11px] sm:text-xs text-muted mt-0.5">' + escapeHtml(p.categories ? p.categories.name : '') + ' · ' + formatPrice(p.price) + '</p>';
                            html += '</div>';
                            html += '<span class="text-[10px] sm:text-xs font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full ' + statusClass + '">' + escapeHtml(p.status || 'draft') + '</span>';
                            html += '<div class="flex items-center gap-0.5 sm:gap-1">';
                            if (p.status === 'draft') {
                                html += '<button onclick="DashboardManager.updateProductStatus(\'' + safeProductId + '\', \'active\')" class="p-1.5 sm:p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors" title="Publish"><i class="fa-solid fa-check text-[10px] sm:text-xs"></i></button>';
                            } else if (p.status === 'active') {
                                html += '<button onclick="DashboardManager.updateProductStatus(\'' + safeProductId + '\', \'archived\')" class="p-1.5 sm:p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors" title="Archive"><i class="fa-solid fa-archive text-[10px] sm:text-xs"></i></button>';
                            } else {
                                html += '<button onclick="DashboardManager.updateProductStatus(\'' + safeProductId + '\', \'active\')" class="p-1.5 sm:p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors" title="Reactivate"><i class="fa-solid fa-rotate-left text-[10px] sm:text-xs"></i></button>';
                            }
                            html += '<button onclick="DashboardManager.deleteProduct(\'' + safeProductId + '\')" class="p-1.5 sm:p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete"><i class="fa-solid fa-trash text-[10px] sm:text-xs"></i></button>';
                            html += '</div>';
                            html += '</div>';
                        }
                        html += '</div>';
                        listEl.innerHTML = html;
                    }
                }

                // Recent products (first 5)
                if (recentEl) {
                    var recent = products.slice(0, 5);
                    if (recent.length === 0) {
                        recentEl.innerHTML = '<div class="text-center py-3"><p class="text-sm text-muted"><i class="fa-solid fa-box-open text-accent/50 mr-2"></i>No products yet</p></div>';
                    } else {
                        var rhtml = '';
                        for (var k = 0; k < recent.length; k++) {
                            var rp = recent[k];
                            rhtml += '<div class="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">';
                            rhtml += '<div class="w-2 h-2 rounded-full ' + (rp.status === 'active' ? 'bg-green-400' : 'bg-gray-600') + '"></div>';
                            // FIXED: C-01: Escape user data
                            rhtml += '<span class="text-sm text-softWhite truncate flex-1">' + escapeHtml(rp.name) + '</span>';
                            rhtml += '<span class="text-xs text-muted">' + formatPrice(rp.price) + '</span>';
                            rhtml += '</div>';
                        }
                        recentEl.innerHTML = rhtml;
                    }
                }
            }).catch(function (err) {
                console.error('Dashboard products error:', err);
            });
        },

        /**
         * Load and render dashboard orders.
         * FIXED: C-01: User data escaped via escapeHtml()
         */
        loadDashboardOrders: function () {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) return;

            var listEl = safeGet('dashOrdersList');
            var recentEl = safeGet('dashRecentOrders');
            var countsEl = safeGet('dashOrderCounts');

            var userId = currentUser.id;
            var role = currentUser.role;

            var orderPromise;
            if (role === 'seller') {
                orderPromise = sb.from('v_seller_orders').select('*').order('created_at', { ascending: false }).limit(50);
            } else {
                orderPromise = sb.from('v_customer_orders').select('*').order('created_at', { ascending: false }).limit(50);
            }

            orderPromise.then(function (result) {
                var orders = result.data || [];

                // Count statuses
                if (countsEl) {
                    var counts = { pending: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, completed: 0, cancelled: 0 };
                    if (role === 'customer') {
                        for (var c = 0; c < orders.length; c++) {
                            var st = orders[c].status;
                            if (counts[st] !== undefined) counts[st]++;
                        }
                    } else {
                        for (var d = 0; d < orders.length; d++) {
                            var ist = orders[d].item_status || orders[d].order_status;
                            if (counts[ist] !== undefined) counts[ist]++;
                        }
                    }
                    countsEl.innerHTML =
                        '<span class="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full">Pending: ' + counts.pending + '</span> ' +
                        '<span class="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">Active: ' + (counts.confirmed + counts.processing + counts.shipped) + '</span> ' +
                        '<span class="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Done: ' + (counts.delivered + counts.completed) + '</span> ' +
                        '<span class="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">Cancelled: ' + counts.cancelled + '</span>';
                }

                // Render orders list
                if (listEl) {
                    if (orders.length === 0) {
                        listEl.innerHTML = '<div class="text-center py-6 sm:py-10 px-4"><div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3"><i class="fa-solid fa-receipt text-accent text-base sm:text-lg"></i></div><p class="text-subtle text-sm font-medium">No orders yet</p><p class="text-muted text-xs mt-1">Orders will appear here when customers purchase</p></div>';
                    } else {
                        // Mobile-friendly: use card layout instead of table
                        var html = '<div class="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">';
                        html += '<table class="w-full min-w-[500px] sm:min-w-0">';
                        html += '<thead class="hidden sm:table-header-group"><tr class="border-b border-white/10">';
                        html += '<th class="py-2 px-2 sm:px-3 text-left text-[11px] text-muted uppercase tracking-wider">Order</th>';
                        html += '<th class="py-2 px-2 sm:px-3 text-left text-[11px] text-muted uppercase tracking-wider">Product</th>';
                        html += '<th class="py-2 px-2 sm:px-3 text-left text-[11px] text-muted uppercase tracking-wider hidden sm:table-cell">Date</th>';
                        html += '<th class="py-2 px-2 sm:px-3 text-left text-[11px] text-muted uppercase tracking-wider">Total</th>';
                        html += '<th class="py-2 px-2 sm:px-3 text-left text-[11px] text-muted uppercase tracking-wider">Status</th>';
                        if (role === 'seller') {
                            html += '<th class="py-2 px-2 sm:px-3 text-left text-[11px] text-muted uppercase tracking-wider">Action</th>';
                        }
                        html += '</tr></thead><tbody>';
                        
                        for (var i = 0; i < orders.length; i++) {
                            var o = orders[i];
                            var orderNum = o.order_number || 'N/A';
                            var orderStatus = role === 'customer' ? o.status : (o.item_status || o.order_status);
                            var total = role === 'customer' ? o.total_amount : o.subtotal;

                            var statusStyles = {
                                pending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
                                confirmed: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
                                processing: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
                                shipped: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
                                delivered: 'bg-green-500/10 text-green-400 border border-green-500/20',
                                completed: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                                cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
                                refunded: 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                            };
                            var ss = statusStyles[orderStatus] || 'bg-white/5 text-gray-400 border border-white/10';

                            // FIXED: H-07: Validate order item ID
                            var safeItemId = isValidUuid(o.order_item_id) ? o.order_item_id : '';

                            html += '<tr class="border-b border-white/5 hover:bg-white/[0.03] transition-colors">';
                            html += '<td class="py-2 sm:py-3 px-2 sm:px-3 text-xs sm:text-sm font-mono text-muted">' + escapeHtml(orderNum) + '</td>';
                            // FIXED: C-01: Escape user data
                            html += '<td class="py-2 sm:py-3 px-2 sm:px-3 text-xs sm:text-sm text-softWhite max-w-[120px] sm:max-w-none truncate">' + escapeHtml(o.product_name || 'Product') + '</td>';
                            html += '<td class="py-2 sm:py-3 px-2 sm:px-3 text-xs sm:text-sm text-muted hidden sm:table-cell">' + timeAgo(o.created_at) + '</td>';
                            html += '<td class="py-2 sm:py-3 px-2 sm:px-3 text-xs sm:text-sm font-semibold text-softWhite">' + formatPrice(total) + '</td>';
                            html += '<td class="py-2 sm:py-3 px-2 sm:px-3"><span class="text-[10px] sm:text-xs font-medium px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full ' + ss + '">' + escapeHtml(orderStatus || 'pending') + '</span></td>';

                            // Actions for sellers
                            if (role === 'seller') {
                                html += '<td class="py-2 sm:py-3 px-2 sm:px-3">';
                                html += '<select onchange="DashboardManager.updateOrderItemStatus(\'' + safeItemId + '\', this.value, null)" class="text-[10px] sm:text-xs border border-white/10 rounded-md px-1.5 sm:px-2 py-1 sm:py-1.5 bg-white/5 text-gray-300 focus:outline-none focus:ring-1 sm:focus:ring-2 focus:ring-accent/50 w-full sm:w-auto">';
                                var statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
                                for (var s = 0; s < statuses.length; s++) {
                                    html += '<option value="' + statuses[s] + '"' + (orderStatus === statuses[s] ? ' selected' : '') + '>' + statuses[s] + '</option>';
                                }
                                html += '</select>';
                                html += '</td>';
                            } else {
                                html += '<td class="py-2 sm:py-3 px-2 sm:px-3">-</td>';
                            }

                            html += '</tr>';
                        }
                        html += '</tbody></table></div>';
                        listEl.innerHTML = html;
                    }
                }

                // Recent orders (first 5)
                if (recentEl) {
                    var recent = orders.slice(0, 5);
                    if (recent.length === 0) {
                        recentEl.innerHTML = '<div class="text-center py-3"><p class="text-sm text-muted"><i class="fa-solid fa-receipt text-accent/50 mr-2"></i>No orders yet</p></div>';
                    } else {
                        var rhtml = '<tbody>';
                        for (var k = 0; k < recent.length; k++) {
                            var ro = recent[k];
                            var rStatus = role === 'customer' ? ro.status : (ro.item_status || ro.order_status);
                            var rTotal = role === 'customer' ? ro.total_amount : ro.subtotal;
                            rhtml += '<tr class="border-b border-white/5">';
                            rhtml += '<td class="py-1.5 sm:py-2 text-[11px] sm:text-sm font-mono text-muted">' + escapeHtml(ro.order_number || '-') + '</td>';
                            rhtml += '<td class="py-1.5 sm:py-2 text-[11px] sm:text-sm text-softWhite">' + formatPrice(rTotal) + '</td>';
                            rhtml += '<td class="py-1.5 sm:py-2 text-[11px] sm:text-sm text-muted">' + timeAgo(ro.created_at) + '</td>';
                            rhtml += '</tr>';
                        }
                        rhtml += '</tbody>';
                        recentEl.innerHTML = rhtml;
                    }
                }
            }).catch(function (err) {
                console.error('Dashboard orders error:', err);
            });
        },

        /**
         * Load and render the activity feed in the dashboard.
         */
        loadRecentActivity: function () {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) return;

            var feedEl = safeGet('dashActivityFeed');
            if (!feedEl) return;

            sb.from('activity_logs')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(10)
                .then(function (result) {
                    var logs = result.data || [];
                    if (logs.length === 0) {
                        feedEl.innerHTML = '<div class="text-center py-4 sm:py-6 px-4"><div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2"><i class="fa-solid fa-clock-rotate-left text-accent text-xs sm:text-sm"></i></div><p class="text-xs sm:text-sm text-muted">No recent activity</p><p class="text-[11px] sm:text-xs text-muted/60 mt-1">Your actions will appear here</p></div>';
                        return;
                    }

                    var html = '';
                    var icons = {
                        'add_to_cart': 'fa-cart-plus text-green-500',
                        'add_to_wishlist': 'fa-heart text-red-400',
                        'place_order': 'fa-bag-shopping text-blue-500',
                        'view_product': 'fa-eye text-gray-400',
                        'update_product': 'fa-pen text-amber-500',
                        'delete_product': 'fa-trash text-red-400'
                    };

                    for (var i = 0; i < logs.length; i++) {
                        var log = logs[i];
                        var iconClass = icons[log.action] || 'fa-circle text-gray-300';
                        var label = log.action.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });

                        html += '<div class="flex items-center gap-2 sm:gap-3 py-2 sm:py-2.5 border-b border-white/5 last:border-0">';
                        html += '<div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0"><i class="fa-solid ' + iconClass + ' text-[10px] sm:text-xs"></i></div>';
                        html += '<div class="flex-1 min-w-0">';
                        html += '<p class="text-xs sm:text-sm text-softWhite">' + escapeHtml(label) + '</p>';
                        html += '<p class="text-[11px] sm:text-xs text-muted">' + timeAgo(log.created_at) + '</p>';
                        html += '</div>';
                        html += '</div>';
                    }

                    feedEl.innerHTML = html;
                })
                .catch(function (err) {
                    console.error('Activity feed error:', err);
                });
        },

        /**
         * Update a product's status.
         * @param {string} productId - UUID of the product.
         * @param {string} status - New status ('draft', 'active', 'archived', 'banned').
         * FIXED: H-07: Validate product ID format
         */
        updateProductStatus: function (productId, status) {
            if (!productId || !status) return;
            // FIXED: H-07: Validate ID format
            if (!isValidUuid(productId)) {
                console.error('Invalid product ID format');
                return;
            }

            var updateData = { status: status };
            if (status === 'active') {
                updateData.is_active = true;
                updateData.published_at = new Date().toISOString();
            } else if (status === 'archived') {
                updateData.is_active = false;
            } else if (status === 'banned') {
                updateData.is_active = false;
            } else if (status === 'draft') {
                updateData.is_active = false;
                updateData.published_at = null;
            }

            sb.from('products').update(updateData).eq('id', productId)
                .then(function () {
                    showToast('Product status updated to ' + status, 'success');
                    logActivity('update_product', 'product', productId, { status: status });
                    DashboardManager.loadDashboardProducts();
                    DashboardManager.loadDashboardStats();
                })
                .catch(function (err) {
                    console.error('Update product status error:', err);
                    showToast('Failed to update product status', 'error');
                });
        },

        /**
         * Delete a product (only draft/archived products can be deleted by sellers).
         * @param {string} productId - UUID of the product.
         * FIXED: H-07: Validate product ID format
         */
        deleteProduct: function (productId) {
            if (!productId) return;
            // FIXED: H-07: Validate ID format
            if (!isValidUuid(productId)) {
                console.error('Invalid product ID format');
                return;
            }
            if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;

            sb.from('products').delete().eq('id', productId)
                .then(function (result) {
                    if (result.error) {
                        showToast('Cannot delete this product. It may have active orders.', 'error');
                        return;
                    }
                    showToast('Product deleted', 'success');
                    logActivity('delete_product', 'product', productId);
                    DashboardManager.loadDashboardProducts();
                    DashboardManager.loadDashboardStats();
                })
                .catch(function (err) {
                    console.error('Delete product error:', err);
                    showToast('Failed to delete product. It may have active orders.', 'error');
                });
        },

        /**
         * Update an order item's status (for sellers).
         * @param {string} orderItemId - UUID of the order_items row.
         * @param {string} status - New status.
         * @param {string|null} trackingNumber - Optional tracking number.
         * FIXED: H-07: Validate order item ID format
         */
        updateOrderItemStatus: function (orderItemId, status, trackingNumber) {
            if (!orderItemId || !status) return;
            // FIXED: H-07: Validate ID format
            if (!isValidUuid(orderItemId)) {
                console.error('Invalid order item ID format');
                return;
            }

            var updateData = { status: status };
            if (trackingNumber) {
                updateData.tracking_number = trackingNumber;
            }

            sb.from('order_items').update(updateData).eq('id', orderItemId)
                .then(function () {
                    showToast('Order status updated to ' + status, 'success');
                    DashboardManager.loadDashboardOrders();
                })
                .catch(function (err) {
                    console.error('Update order status error:', err);
                    showToast('Failed to update order status', 'error');
                });
        },

        /**
         * Save user settings (profile update for dashboard settings tab).
         * @param {Object} settings - Key-value pairs to update.
         * FIXED: Medium: Input length validation added
         */
        saveSettings: function (settings) {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
                showToast('Please sign in first', 'info');
                return;
            }
            if (!settings || typeof settings !== 'object') return;

            var updateData = {};
            // FIXED: Medium: Add input length validation
            if (settings.first_name !== undefined) updateData.first_name = String(settings.first_name).substring(0, 100);
            if (settings.last_name !== undefined) updateData.last_name = String(settings.last_name).substring(0, 100);
            if (settings.brand_name !== undefined) updateData.brand_name = String(settings.brand_name).substring(0, 200);
            if (settings.phone !== undefined) updateData.phone = String(settings.phone).substring(0, 20);
            if (settings.description !== undefined) updateData.description = String(settings.description).substring(0, 2000);
            if (settings.address_line1 !== undefined) updateData.address_line1 = String(settings.address_line1).substring(0, 255);
            if (settings.city !== undefined) updateData.city = String(settings.city).substring(0, 100);
            if (settings.region !== undefined) updateData.region = String(settings.region).substring(0, 100);
            if (settings.postal_code !== undefined) updateData.postal_code = String(settings.postal_code).substring(0, 20);

            if (Object.keys(updateData).length === 0) {
                showToast('No changes to save', 'info');
                return;
            }

            sb.from('profiles').update(updateData).eq('id', currentUser.id)
                .then(function () {
                    showToast('Settings saved successfully!', 'success');
                    // Update local currentUser if global update function exists
                    if (typeof window.refreshCurrentUser === 'function') {
                        window.refreshCurrentUser();
                    }
                })
                .catch(function (err) {
                    console.error('Save settings error:', err);
                    showToast('Failed to save settings', 'error');
                });
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // NOTIFICATION MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    var NotificationManager = {

        /**
         * Load notifications for the current user.
         * @param {number} limit - Max notifications to load.
         * @returns {Promise} Resolves with array of notifications.
         */
        loadNotifications: function (limit) {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
                _notificationCache = [];
                return Promise.resolve([]);
            }

            limit = limit || 20;

            return sb.from('notifications')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(limit)
                .then(function (result) {
                    _notificationCache = result.data || [];
                    _unreadNotificationCount = 0;
                    for (var i = 0; i < _notificationCache.length; i++) {
                        if (!_notificationCache[i].is_read) _unreadNotificationCount++;
                    }
                    NotificationManager.renderNotificationBadge();
                    return _notificationCache;
                })
                .catch(function (err) {
                    console.error('Notifications load error:', err);
                    _notificationCache = [];
                    return [];
                });
        },

        /**
         * Mark a single notification as read.
         * @param {string} notificationId - UUID of the notification.
         * FIXED: H-07: Validate notification ID format
         */
        markAsRead: function (notificationId) {
            if (!notificationId) return;
            // FIXED: H-07: Validate notification ID format before using in DB operations
            if (!isValidUuid(notificationId)) {
                console.error('Invalid notification ID format');
                return;
            }

            sb.from('notifications').update({ is_read: true }).eq('id', notificationId)
                .then(function () {
                    for (var i = 0; i < _notificationCache.length; i++) {
                        if (_notificationCache[i].id === notificationId) {
                            _notificationCache[i].is_read = true;
                            _unreadNotificationCount = Math.max(0, _unreadNotificationCount - 1);
                            break;
                        }
                    }
                    NotificationManager.renderNotificationBadge();
                })
                .catch(function (err) {
                    console.error('Mark as read error:', err);
                });
        },

        /**
         * Mark all notifications as read for the current user.
         */
        markAllAsRead: function () {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) return;

            sb.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false)
                .then(function (result) {
                    _unreadNotificationCount = 0;
                    for (var i = 0; i < _notificationCache.length; i++) {
                        _notificationCache[i].is_read = true;
                    }
                    NotificationManager.renderNotificationBadge();
                    showToast('All notifications marked as read', 'success');
                })
                .catch(function (err) {
                    console.error('Mark all as read error:', err);
                });
        },

        /**
         * Get the unread notification count.
         * @returns {number}
         */
        getUnreadCount: function () {
            return _unreadNotificationCount;
        },

        /**
         * Render/update the notification badge in the header.
         */
        renderNotificationBadge: function () {
            var badges = document.querySelectorAll('.notification-badge');
            for (var i = 0; i < badges.length; i++) {
                if (_unreadNotificationCount > 0) {
                    badges[i].textContent = _unreadNotificationCount > 99 ? '99+' : _unreadNotificationCount;
                    badges[i].style.display = 'flex';
                } else {
                    badges[i].style.display = 'none';
                }
            }
        },

        /**
         * Render notification list HTML.
         * @returns {string} HTML string for the notification dropdown/panel.
         * FIXED: C-01: User data escaped via escapeHtml()
         * FIXED: H-07: Notification ID validated before use in onclick
         */
        renderNotificationList: function () {
            if (_notificationCache.length === 0) {
                return '<div class="p-6 text-center"><div class="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3"><i class="fa-solid fa-bell-slash text-accent"></i></div><p class="text-subtle text-sm font-medium">No notifications</p><p class="text-muted text-xs mt-1">We\'ll notify you when something arrives</p></div>';
            }

            var typeIcons = {
                'order_placed': 'fa-bag-shopping text-blue-500',
                'order_confirmed': 'fa-circle-check text-green-500',
                'order_shipped': 'fa-truck text-purple-500',
                'order_delivered': 'fa-box-open text-emerald-500',
                'order_cancelled': 'fa-circle-xmark text-red-500',
                'payment_verified': 'fa-credit-card text-green-500',
                'payment_failed': 'fa-credit-card text-red-500',
                'new_review': 'fa-star text-amber-500',
                'new_message': 'fa-envelope text-blue-400',
                'seller_approved': 'fa-store text-green-500',
                'seller_rejected': 'fa-store text-red-500',
                'low_stock': 'fa-triangle-exclamation text-orange-500',
                'refund_approved': 'fa-rotate-left text-green-500',
                'refund_rejected': 'fa-rotate-left text-red-500',
                'system': 'fa-gear text-gray-500',
                'promo': 'fa-tag text-amber-500',
                'new_follower': 'fa-user-plus text-pink-500'
            };

            var html = '';
            for (var i = 0; i < _notificationCache.length; i++) {
                var n = _notificationCache[i];
                var icon = typeIcons[n.type] || 'fa-bell text-gray-400';
                var unread = !n.is_read ? 'bg-amber-50' : '';

                // FIXED: H-07: Validate notification ID before using in onclick
                var safeNotifId = isValidUuid(n.id) ? n.id : '';

                html += '<div class="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer ' + unread + '" onclick="NotificationManager.markAsRead(\'' + safeNotifId + '\')">';
                html += '<div class="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5"><i class="fa-solid ' + icon + ' text-sm"></i></div>';
                html += '<div class="flex-1 min-w-0">';
                // FIXED: C-01: Escape user data
                html += '<p class="text-sm font-medium text-gray-800 ' + (!n.is_read ? '' : 'font-normal text-gray-600') + '">' + escapeHtml(n.title || 'Notification') + '</p>';
                html += '<p class="text-xs text-gray-400 mt-0.5 line-clamp-2">' + escapeHtml(n.message || '') + '</p>';
                html += '<p class="text-xs text-gray-300 mt-1">' + timeAgo(n.created_at) + '</p>';
                html += '</div>';
                if (!n.is_read) {
                    html += '<div class="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></div>';
                }
                html += '</div>';
            }

            return html;
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // CONTACT MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    var ContactManager = {

        /**
         * Submit a contact/support form.
         * Creates a support_ticket and initial ticket_message.
         * @param {Object} data - { subject, category, priority, message }.
         * @returns {Promise}
         * FIXED: Medium: Input length validation
         */
        submitContactForm: function (data) {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
                showToast('Please sign in to contact us', 'info');
                return Promise.reject(new Error('Not authenticated'));
            }

            if (!data || !data.subject || !data.message) {
                showToast('Please fill in all required fields', 'error');
                return Promise.reject(new Error('Missing fields'));
            }

            // FIXED: Medium: Input length validation
            var safeSubject = String(data.subject).substring(0, 200);
            var safeMessage = String(data.message).substring(0, 10000);
            var safeCategory = String(data.category || 'general').substring(0, 50);
            var safePriority = String(data.priority || 'normal').substring(0, 20);

            var ticketData = {
                user_id: currentUser.id,
                subject: safeSubject || 'General Inquiry',
                category: safeCategory,
                priority: safePriority
            };

            return sb.from('support_tickets').insert(ticketData).select('id').single()
                .then(function (result) {
                    var ticketId = result.data ? result.data.id : result.id;
                    return sb.from('ticket_messages').insert({
                        ticket_id: ticketId,
                        sender_id: currentUser.id,
                        content: safeMessage
                    });
                })
                .then(function () {
                    showToast('Your message has been sent! We will get back to you soon.', 'success');
                    logActivity('contact_form_submit', 'support_ticket', null, { subject: safeSubject });
                })
                .catch(function (err) {
                    console.error('Contact form error:', err);
                    showToast('Failed to send message. Please try again.', 'error');
                    throw err;
                });
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // NEWSLETTER MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    var NewsletterManager = {

        /**
         * Subscribe an email to the newsletter.
         * @param {string} email - Email address to subscribe.
         * @returns {Promise}
         * FIXED: Medium: Email length validation
         */
        subscribe: function (email) {
            if (!email || !email.trim()) {
                showToast('Please enter your email address', 'info');
                return Promise.reject(new Error('No email'));
            }

            // FIXED: Medium: Email length validation (RFC 5321 limit is 320 chars)
            var trimmedEmail = email.trim().substring(0, 320);

            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(trimmedEmail)) {
                showToast('Please enter a valid email address', 'error');
                return Promise.reject(new Error('Invalid email'));
            }

            return sb.from('newsletter_subscribers').upsert({
                email: trimmedEmail.toLowerCase(),
                is_active: true,
                subscribed_at: new Date().toISOString(),
                unsubscribed_at: null,
                source: 'footer'
            }, { onConflict: 'email' })
                .then(function () {
                    showToast('Thank you for subscribing!', 'success');
                })
                .catch(function (err) {
                    console.error('Newsletter subscribe error:', err);
                    showToast('Failed to subscribe. Please try again.', 'error');
                    throw err;
                });
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // RECENTLY VIEWED MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    var RecentlyViewedManager = {

        /**
         * Track a product view for the current user.
         * @param {string} productId - UUID of the product.
         * FIXED: H-07: Validate product ID format
         */
        trackView: function (productId) {
            if (!productId) return;
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) return;
            // FIXED: H-07: Validate product ID format
            if (!isValidUuid(productId)) {
                console.error('Invalid product ID format for trackView');
                return;
            }

            sb.from('recently_viewed').upsert({
                user_id: currentUser.id,
                product_id: productId,
                viewed_at: new Date().toISOString()
            }, { onConflict: 'user_id,product_id' })
                .then(function () {
                    // Also increment view count on the product
                    sb.rpc('increment_view_count', { p_product_id: productId }).then(function () {}, function () {});
                })
                .catch(function (err) {
                    console.error('Track view error:', err);
                });

            // Also log visitor view
            logVisit('product', productId);
        },

        /**
         * Load recently viewed products for the current user.
         * @param {number} limit - Max items to return.
         * @returns {Promise} Resolves with array of products.
         */
        loadRecentlyViewed: function (limit) {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
                return Promise.resolve([]);
            }

            limit = limit || 10;

            return sb.from('recently_viewed')
                .select('product_id, viewed_at')
                .eq('user_id', currentUser.id)
                .order('viewed_at', { ascending: false })
                .limit(limit)
                .then(function (result) {
                    var viewed = result.data || [];
                    if (viewed.length === 0) return [];

                    var productIds = [];
                    for (var i = 0; i < viewed.length; i++) {
                        productIds.push(viewed[i].product_id);
                    }

                    return sb.from('v_products_with_images')
                        .select('*')
                        .in('id', productIds)
                        .then(function (prodResult) {
                            return prodResult.data || [];
                        });
                })
                .catch(function (err) {
                    console.error('Recently viewed load error:', err);
                    return [];
                });
        },

        /**
         * Render recently viewed products as HTML cards.
         * @param {number} limit - Max items to render.
         * @returns {string} HTML string.
         */
        renderRecentlyViewed: function (limit) {
            // This is synchronous - use cached data or empty
            // For async, call loadRecentlyViewed() first then render
            return '';
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // IMAGE MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    var ImageManager = {

        /**
         * Upload an image to Supabase Storage.
         * @param {File} file - The file object from an input element.
         * @param {string} bucket - Storage bucket name (e.g. 'product-images', 'avatars').
         * @param {string} path - File path within the bucket (e.g. 'user-id/filename.jpg').
         * @returns {Promise} Resolves with { path, publicUrl }.
         */
        uploadImage: function (file, bucket, path) {
            if (!file || !bucket || !path) {
                return Promise.reject(new Error('Missing upload parameters'));
            }

            // Validate file type
            var allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (allowedTypes.indexOf(file.type) === -1) {
                showToast('Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.', 'error');
                return Promise.reject(new Error('Invalid file type'));
            }

            // Validate file size (5MB max)
            var maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                showToast('File is too large. Maximum size is 5MB.', 'error');
                return Promise.reject(new Error('File too large'));
            }

            return sb.storage.from(bucket).upload(path, file, {
                cacheControl: '3600',
                upsert: false
            })
                .then(function (result) {
                    var publicUrl = ImageManager.getPublicUrl(bucket, result.path);
                    return {
                        path: result.path,
                        publicUrl: publicUrl
                    };
                })
                .catch(function (err) {
                    console.error('Image upload error:', err);
                    showToast('Failed to upload image', 'error');
                    throw err;
                });
        },

        /**
         * Delete an image from Supabase Storage.
         * @param {string} bucket - Storage bucket name.
         * @param {string} path - Full file path within the bucket.
         * @returns {Promise}
         */
        deleteImage: function (bucket, path) {
            if (!bucket || !path) {
                return Promise.reject(new Error('Missing delete parameters'));
            }

            return sb.storage.from(bucket).remove([path])
                .then(function () {
                    // Successfully deleted
                })
                .catch(function (err) {
                    console.error('Image delete error:', err);
                    showToast('Failed to delete image', 'error');
                    throw err;
                });
        },

        /**
         * Get the public URL for a file in Supabase Storage.
         * @param {string} bucket - Storage bucket name.
         * @param {string} path - File path within the bucket.
         * @returns {string} Full public URL.
         */
        getPublicUrl: function (bucket, path) {
            if (!bucket || !path) return '';

            try {
                var result = sb.storage.from(bucket).getPublicUrl(path);
                return result.data ? result.data.publicUrl : result.publicUrl;
            } catch (e) {
                console.error('Get public URL error:', e);
                return '';
            }
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // GLOBAL EXPORTS
    // ═════════════════════════════════════════════════════════════════════════════════

    window.ProductManager = ProductManager;
    window.SearchManager = SearchManager;
    window.CartManager = CartManager;
    window.WishlistManager = WishlistManager;
    window.CategoryManager = CategoryManager;
    window.DashboardManager = DashboardManager;
    window.NotificationManager = NotificationManager;
    window.ContactManager = ContactManager;
    window.NewsletterManager = NewsletterManager;
    window.RecentlyViewedManager = RecentlyViewedManager;
    window.ImageManager = ImageManager;

    // Also expose helpers
    window.formatPrice = formatPrice;
    window.slugify = slugify;
    window.starRating = starRating;
    window.timeAgo = timeAgo;
    window.truncate = truncate;

    // FIXED: C-04: Expose _cartData properly via getter function (not direct access)
    window.getCartData = function () {
        return _cartData;
    };
    
    // FIXED: Expose utility functions for external use if needed
    window.escapeHtml = escapeHtml;
    window.sanitizeSearchInput = sanitizeSearchInput;


    // ═════════════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Initialize the marketplace managers.
     * Call this after auth session is established.
     * FIXED: C-05: Cart operations now return promises for proper chaining
     */
    window.initMarketplace = function () {
        // Load public data (always)
        CategoryManager.loadCategories().then(function () {
            CategoryManager.renderCategoryCounts();
        });

        ProductManager.loadFeaturedProducts();
        SearchManager.init();

        // Load user-specific data (if logged in)
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
            // FIXED: C-05: Now returns promise but we don't need to await here
            // The operations will complete asynchronously
            CartManager.loadCart();
            WishlistManager.loadWishlist();
            NotificationManager.loadNotifications();
        }

        // Log landing page visit
        logVisit('home');
    };

    // Auto-init if DOM is ready and currentUser exists
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(function () {
            if (typeof currentUser !== 'undefined' && currentUser) {
                window.initMarketplace();
            }
        }, 100);
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(function () {
                if (typeof currentUser !== 'undefined' && currentUser) {
                    window.initMarketplace();
                }
            }, 100);
        });
    }


})();
