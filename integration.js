/**
 * ═════════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 Marketplace — Integration Layer
 * ES5-compatible (var, function, no arrow functions, no const/let)
 * Patches HTML functions to use marketplace.js managers, adds checkout & product detail.
 * Load AFTER marketplace.js and the main HTML <script> block.
 * ═════════════════════════════════════════════════════════════════════════════════
 */
(function () {
    'use strict';

    // ─── Guard: managers must exist ─────────────────────────────────────────
    if (!window.ProductManager || !window.SearchManager || !window.CartManager ||
        !window.WishlistManager || !window.NotificationManager || !window.ContactManager ||
        !window.NewsletterManager || !window.DashboardManager) {
        console.warn('[integration] Marketplace managers not found. Integration layer skipped.');
        return;
    }

    var fp = window.formatPrice || function (v) { return 'K' + (v || 0).toLocaleString(); };
    var sr = window.starRating  || function (r) { return ''; };
    var ta = window.timeAgo    || function (d) { return d || ''; };
    var sg = window.safeGet || function (id) { return document.getElementById(id); };

    // ─── Internal checkout state ────────────────────────────────────────────
    var _checkoutDeliveryMethods = [];
    var _checkoutPaymentMethods  = [];
    var _checkoutAddresses       = [];
    var _checkoutDeliveryId      = null;
    var _checkoutPaymentId       = null;
    var _checkoutAddressId       = null;
    var _checkoutDeliveryCost    = 0;
    var _checkoutPaymentProof    = null; // File object
    var _checkoutTransactionRef  = '';
    var _checkoutNotes           = '';

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. PATCH: handleSearch → SearchManager.searchProducts
    // ═══════════════════════════════════════════════════════════════════════════
    var _origHandleSearch = window.handleSearch || function () {};
    window.handleSearch = function (val) {
        var query = (val || '').trim();
        if (!query) {
            var containers = document.querySelectorAll('.search-results');
            for (var i = 0; i < containers.length; i++) {
                containers[i].classList.remove('open');
                containers[i].innerHTML = '';
            }
            return;
        }
        SearchManager.searchProducts(query).then(function (results) {
            var el = document.querySelector('.search-results') ||
                     document.querySelector('#heroSearch') &&
                     document.querySelector('#heroSearch').parentElement &&
                     document.querySelector('#heroSearch').parentElement.querySelector('.search-results');
            // Fallback: update all .search-results
            if (!el) {
                var all = document.querySelectorAll('.search-results');
                for (var j = 0; j < all.length; j++) {
                    SearchManager.renderSearchResults(results, all[j]);
                }
            } else {
                SearchManager.renderSearchResults(results, el);
            }
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. PATCH: filterCollection → ProductManager.renderCollection
    // ═══════════════════════════════════════════════════════════════════════════
    var _origFilterCollection = window.filterCollection || function () {};
    window.filterCollection = function (cat) {
        // Update pill active states (preserve original UI behaviour)
        var pills = document.querySelectorAll('.cat-pill');
        for (var i = 0; i < pills.length; i++) {
            pills[i].classList.remove('active');
        }
        var activePill = document.querySelector('.cat-pill[data-colcat="' + cat + '"]');
        if (activePill) activePill.classList.add('active');

        // Delegate to manager
        ProductManager.renderCollection(cat === 'all' ? null : cat);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. PATCH: filterCollectionWithSearch → SearchManager
    // ═══════════════════════════════════════════════════════════════════════════
    var _origFilterCollectionWithSearch = window.filterCollectionWithSearch || function () {};
    window.filterCollectionWithSearch = function () {
        var input = sg('collectionSearch');
        if (!input) return;
        var q = (input.value || '').trim();
        if (!q) {
            // No search query — reload collection with active category
            var activePill = document.querySelector('.cat-pill.active');
            var cat = activePill ? activePill.getAttribute('data-colcat') : null;
            ProductManager.renderCollection(cat === 'all' ? null : cat);
        } else {
            // Search within collection
            SearchManager.searchProducts(q).then(function (results) {
                var container = sg('collectionContent');
                if (!container) return;
                if (!results || results.length === 0) {
                    container.innerHTML =
                        '<div class="text-center py-20">' +
                        '<div class="text-6xl mb-4 opacity-30"><i class="fa-solid fa-magnifying-glass"></i></div>' +
                        '<h3 class="text-xl font-semibold text-gray-500 mb-2">No results for "' + q.replace(/"/g, '&quot;') + '"</h3>' +
                        '<p class="text-gray-400">Try a different search term.</p></div>';
                    return;
                }
                var html = '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">';
                for (var i = 0; i < results.length; i++) {
                    html += ProductManager.renderProductCard(results[i]);
                }
                html += '</div>';
                html += '<p class="text-center text-sm text-gray-400 mt-8">' + results.length + ' result' + (results.length !== 1 ? 's' : '') + ' for "' + q.replace(/"/g, '&quot;') + '"</p>';
                container.innerHTML = html;
            });
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. PATCH: handleSubscribe → NewsletterManager.subscribe
    // ═══════════════════════════════════════════════════════════════════════════
    var _origHandleSubscribe = window.handleSubscribe || function () {};
    window.handleSubscribe = function () {
        var input = sg('emailInput');
        if (!input) return;
        var email = (input.value || '').trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            if (typeof showToast === 'function') showToast('Please enter a valid email address.', 'error');
            return;
        }
        NewsletterManager.subscribe(email).then(function () {
            input.value = '';
        }).catch(function () {
            // Error already handled by NewsletterManager
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. PATCH: handleContactSubmit → ContactManager.submitContactForm
    // ═══════════════════════════════════════════════════════════════════════════
    var _origHandleContactSubmit = window.handleContactSubmit || function () {};
    window.handleContactSubmit = function (e) {
        e.preventDefault();
        var nameEl    = document.getElementById('contactName');
        var emailEl   = document.getElementById('contactEmail');
        var subjectEl = document.getElementById('contactSubject');
        var msgEl     = document.getElementById('contactMessage');

        var name    = nameEl    ? (nameEl.value || '').trim()    : '';
        var email   = emailEl   ? (emailEl.value || '').trim()   : '';
        var subject = subjectEl ? (subjectEl.value || '')        : '';
        var message = msgEl     ? (msgEl.value || '').trim()     : '';

        if (!name || !email || !subject || !message) {
            if (typeof showToast === 'function') showToast('Please fill in all fields.', 'error');
            return;
        }

        ContactManager.submitContactForm({
            subject: subject,
            category: 'general',
            priority: 'normal',
            message: message
        }).then(function () {
            if (e.target && e.target.reset) e.target.reset();
        }).catch(function () {
            // Error already handled by ContactManager
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. PATCH: navigateTo — load data per view
    // ═══════════════════════════════════════════════════════════════════════════
    var _origNavigateTo = window.navigateTo || function () {};
    window.navigateTo = function (view, param) {
        // Run original guards + view switching first
        _origNavigateTo(view, param);

        // After navigation, load view-specific data
        if (view === 'collection') {
            var activePill = document.querySelector('.cat-pill.active');
            var cat = activePill ? activePill.getAttribute('data-colcat') : null;
            ProductManager.renderCollection(cat === 'all' ? null : cat);
        }
        else if (view === 'library') {
            ProductManager.renderLibrary();
        }
        else if (view === 'dashboard') {
            if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
                DashboardManager.loadDashboardStats();
                DashboardManager.loadDashboardProducts();
                DashboardManager.loadDashboardOrders();
                DashboardManager.loadRecentActivity();
            }
        }
        else if (view === 'checkout') {
            CheckoutManager.loadCheckout();
        }
        else if (view === 'product') {
            if (param) ProductDetailManager.showProduct(param);
        }
        else if (view === 'search') {
            // param is the search query
            if (param) {
                SearchManager.searchProducts(param).then(function (results) {
                    SearchManager.renderSearchResults(results, document.querySelector('.search-results'));
                    // Also navigate to collection view with results
                    var container = sg('collectionContent');
                    if (container) {
                        if (!results || results.length === 0) {
                            container.innerHTML =
                                '<div class="text-center py-20">' +
                                '<div class="text-6xl mb-4 opacity-30"><i class="fa-solid fa-magnifying-glass"></i></div>' +
                                '<h3 class="text-xl font-semibold text-gray-500 mb-2">No results for "' + param.replace(/"/g, '&quot;') + '"</h3>' +
                                '<p class="text-gray-400">Try different keywords.</p></div>';
                        } else {
                            var html = '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">';
                            for (var i = 0; i < results.length; i++) {
                                html += ProductManager.renderProductCard(results[i]);
                            }
                            html += '</div>';
                            html += '<p class="text-center text-sm text-gray-400 mt-8">' + results.length + ' result' + (results.length !== 1 ? 's' : '') + '</p>';
                            container.innerHTML = html;
                        }
                    }
                });
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. EXTEND: updateAuthUI → also load cart, wishlist, notification badge
    // ═══════════════════════════════════════════════════════════════════════════
    var _origUpdateAuthUI = window.updateAuthUI || function () {};
    window.updateAuthUI = function () {
        // Run original
        _origUpdateAuthUI();
        // Load user-specific data
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
            CartManager.loadCart();
            WishlistManager.loadWishlist();
            NotificationManager.renderNotificationBadge();
        } else {
            // Clear badges
            var countBadge = sg('cartCount');
            if (countBadge) { countBadge.textContent = '0 items'; }
            var notifBadges = document.querySelectorAll('.notification-badge');
            for (var i = 0; i < notifBadges.length; i++) {
                notifBadges[i].style.display = 'none';
            }
        }
    };


    // ═══════════════════════════════════════════════════════════════════════════
    // 8. EXTEND: DOMContentLoaded → call initMarketplace() after session restore
    // ═══════════════════════════════════════════════════════════════════════════
    // We hook into the existing DOMContentLoaded by wrapping the original handler.
    // The HTML file uses an async DOMContentLoaded; we add a post-session hook.
    var _origDomReady = document.addEventListener;
    var _domReadyFired = false;

    // Post-session-initialization callback
    window._integrationOnSessionReady = function () {
        if (typeof window.initMarketplace === 'function') {
            window.initMarketplace();
        }
        // Patch the "Proceed to checkout" button in the cart panel
        var cartFooter = sg('cartFooter');
        if (cartFooter) {
            var btn = cartFooter.querySelector('button');
            if (btn && btn.textContent.indexOf('Proceed to checkout') !== -1) {
                btn.setAttribute('onclick', 'toggleCart(); navigateTo(\'checkout\');');
            }
        }
    };

    // We use a MutationObserver + setTimeout approach to detect when the HTML's
    // DOMContentLoaded has finished its async session restore, then fire our init.
    // A simpler approach: override onAuthStateChange to also fire our init.
    if (sb && sb.auth) {
        var _origOnAuth = sb.auth.onAuthStateChange.bind(sb.auth);
        sb.auth.onAuthStateChange = function (callback) {
            _origOnAuth(function (event, session) {
                callback(event, session);
                // After the first auth state event, fire marketplace init
                if (!_domReadyFired) {
                    _domReadyFired = true;
                    setTimeout(function () {
                        window._integrationOnSessionReady();
                    }, 200);
                }
            });
        };
    }

    // Fallback: if DOM already loaded, fire after a delay
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(function () {
            if (!_domReadyFired) {
                _domReadyFired = true;
                window._integrationOnSessionReady();
            }
        }, 1500);
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(function () {
                if (!_domReadyFired) {
                    _domReadyFired = true;
                    window._integrationOnSessionReady();
                }
            }, 1500);
        }
        );
    }


    // ═══════════════════════════════════════════════════════════════════════════
    // 9. PRODUCT DETAIL VIEW (modal / section)
    // ═══════════════════════════════════════════════════════════════════════════

    var ProductDetailManager = {

        _currentProduct: null,
        _selectedVariant: null,
        _selectedQuantity: 1,
        _allImages: [],
        _activeImageIndex: 0,

        showProduct: function (productId) {
            if (!productId) return;
            var container = sg('productDetailContent');
            if (!container) {
                // Dynamically create the product detail view if it doesn't exist
                ProductDetailManager._createView();
                container = sg('productDetailContent');
            }
            if (!container) return;

            container.innerHTML = '<div class="flex items-center justify-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-4 border-accent border-t-transparent"></div></div>';

            // Navigate to product view
            document.querySelectorAll('.view-section').forEach(function (s) { s.classList.remove('active'); });
            var productView = document.getElementById('view-product');
            if (productView) productView.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Load product data
            sb.from('v_products_with_images').select('*').eq('id', productId).single()
                .then(function (product) {
                    if (!product) {
                        container.innerHTML = '<div class="text-center py-20"><div class="text-6xl mb-4 opacity-30"><i class="fa-solid fa-box-open"></i></div><h3 class="text-xl font-semibold text-subtle">Product not found</h3></div>';
                        return;
                    }
                    ProductDetailManager._currentProduct = product;
                    ProductDetailManager._allImages = product.all_images || [];
                    ProductDetailManager._activeImageIndex = 0;
                    ProductDetailManager._selectedQuantity = 1;
                    ProductDetailManager._selectedVariant = null;

                    // Track view
                    if (typeof RecentlyViewedManager !== 'undefined') {
                        RecentlyViewedManager.trackView(productId);
                    }

                    // Load variants and reviews in parallel
                    return Promise.all([
                        sb.from('product_variants').select('*').eq('product_id', productId).eq('is_active', true).order('sort_order', { ascending: true }),
                        sb.from('reviews').select('*, profiles(first_name, last_name)').eq('product_id', productId).eq('is_approved', true).order('created_at', { ascending: false }).limit(20)
                    ]).then(function (results) {
                        var variants = results[0].data || [];
                        var reviews  = results[1].data || [];
                        ProductDetailManager._render(product, variants, reviews);
                    });
                })
                .catch(function (err) {
                    console.error('Product detail load error:', err);
                    container.innerHTML = '<div class="text-center py-20"><div class="text-5xl mb-4 text-red-400"><i class="fa-solid fa-triangle-exclamation"></i></div><h3 class="text-lg font-semibold text-subtle">Failed to load product</h3></div>';
                });
        },

        _createView: function () {
            // Check if view-product already exists
            if (document.getElementById('view-product')) return;

            var mainWrapper = document.querySelector('.relative.z-10 > main') ||
                              document.querySelector('.relative.z-10');
            if (!mainWrapper) return;

            var div = document.createElement('div');
            div.id = 'view-product';
            div.className = 'view-section';
            div.setAttribute('aria-labelledby', 'productDetailHeading');
            div.innerHTML =
                '<div class="py-8">' +
                '  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">' +
                '    <button onclick="navigateTo(\'collection\')" class="flex items-center gap-2 text-sm text-subtle hover:text-accent transition mb-6"><i class="fa-solid fa-arrow-left text-xs"></i> Back to Collection</button>' +
                '    <div id="productDetailContent"></div>' +
                '  </div>' +
                '</div>';
            mainWrapper.appendChild(div);
        },

        _render: function (product, variants, reviews) {
            var container = sg('productDetailContent');
            if (!container) return;

            var p = product;
            var images = ProductDetailManager._allImages;
            if (images.length === 0) images = [p.primary_image || ''];
            var activeImg = images[ProductDetailManager._activeImageIndex] || images[0] || '';

            var isWishlisted = typeof WishlistManager !== 'undefined' && WishlistManager.isWishlisted(p.id);
            var hasDiscount = p.compare_at_price && Number(p.compare_at_price) > Number(p.price);
            var discountPct = 0;
            if (hasDiscount) discountPct = Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100);
            var stock = p.stock_quantity || 0;
            var outOfStock = stock <= 0;

            var html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">';

            // ── Image Gallery ──
            html += '<div>';
            html += '<div class="relative rounded-2xl overflow-hidden bg-surface aspect-square mb-3">';
            html += '<img id="pdMainImage" src="' + activeImg + '" alt="' + (p.name || '').replace(/"/g, '&quot;') + '" class="w-full h-full object-cover"/>';
            if (hasDiscount) {
                html += '<span class="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">-' + discountPct + '%</span>';
            }
            html += '</div>';
            if (images.length > 1) {
                html += '<div class="flex gap-2 overflow-x-auto pb-1">';
                for (var i = 0; i < images.length; i++) {
                    var thumbActive = i === ProductDetailManager._activeImageIndex;
                    html += '<button onclick="ProductDetailManager.setActiveImage(' + i + ')" class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ' + (thumbActive ? 'border-accent' : 'border-white/10') + '">';
                    html += '<img src="' + (images[i] || '') + '" class="w-full h-full object-cover"/>';
                    html += '</button>';
                }
                html += '</div>';
            }
            html += '</div>';

            // ── Product Info ──
            html += '<div class="flex flex-col">';
            html += '<p class="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-2">' + (p.category_name || '') + '</p>';
            html += '<h1 id="productDetailHeading" class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-softWhite">' + (p.name || 'Untitled') + '</h1>';
            if (p.store_name) {
                html += '<p class="text-sm text-muted mt-1"><i class="fa-solid fa-store mr-1.5"></i>' + p.store_name + '</p>';
            }

            // Rating
            if (p.rating_avg > 0) {
                html += '<div class="flex items-center gap-2 mt-3">';
                html += sr(p.rating_avg, 16);
                html += '<span class="text-sm text-subtle">' + p.rating_avg.toFixed(1) + '</span>';
                if (p.review_count > 0) html += '<span class="text-xs text-muted">(' + p.review_count + ' reviews)</span>';
                if (p.total_sold > 0) html += '<span class="text-xs text-muted ml-2"><i class="fa-solid fa-bag-shopping mr-1"></i>' + p.total_sold + ' sold</span>';
                html += '</div>';
            }

            // Price
            html += '<div class="flex items-baseline gap-3 mt-5">';
            html += '<span class="text-3xl font-bold text-softWhite">' + fp(p.price) + '</span>';
            if (hasDiscount) {
                html += '<span class="text-lg text-muted line-through">' + fp(p.compare_at_price) + '</span>';
            }
            html += '</div>';

            // Description
            if (p.short_desc) {
                html += '<p class="text-sm text-subtle mt-4 leading-relaxed">' + p.short_desc + '</p>';
            }

            // Variants
            if (variants && variants.length > 0) {
                html += '<div class="mt-6">';
                html += '<p class="text-sm font-semibold text-softWhite mb-3">Options</p>';
                html += '<div class="flex flex-wrap gap-2" id="pdVariantList">';
                for (var v = 0; v < variants.length; v++) {
                    var variant = variants[v];
                    var vPrice = variant.price ? fp(variant.price) : fp(p.price);
                    var vStock = variant.stock_quantity || 0;
                    var vDisabled = vStock <= 0 ? 'opacity-40 cursor-not-allowed' : '';
                    html += '<button data-variant-id="' + variant.id + '" data-variant-stock="' + vStock + '" onclick="ProductDetailManager.selectVariant(\'' + variant.id + '\')" class="pd-variant-btn rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-subtle transition hover:border-accent/30 ' + vDisabled + '">';
                    html += variant.variant_name;
                    html += '<span class="block text-xs text-muted mt-0.5">' + vPrice + (vStock <= 0 ? ' · Sold out' : '') + '</span>';
                    html += '</button>';
                }
                html += '</div>';
                html += '</div>';
            }

            // Quantity
            html += '<div class="mt-6">';
            html += '<p class="text-sm font-semibold text-softWhite mb-3">Quantity</p>';
            html += '<div class="flex items-center gap-3">';
            html += '<button onclick="ProductDetailManager.changeQty(-1)" class="w-10 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] text-subtle flex items-center justify-center hover:border-accent/30 transition text-lg">-</button>';
            html += '<span id="pdQuantity" class="text-lg font-semibold text-softWhite w-8 text-center">' + ProductDetailManager._selectedQuantity + '</span>';
            html += '<button onclick="ProductDetailManager.changeQty(1)" class="w-10 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] text-subtle flex items-center justify-center hover:border-accent/30 transition text-lg">+</button>';
            if (stock > 0) {
                html += '<span class="text-xs text-muted ml-2">' + stock + ' available</span>';
            }
            html += '</div></div>';

            // Action buttons
            html += '<div class="flex gap-3 mt-8">';
            if (!outOfStock) {
                html += '<button id="pdAddToCartBtn" onclick="ProductDetailManager.addToCart()" class="flex-1 rounded-2xl bg-accent py-3.5 font-semibold text-bg hover:bg-accentDim transition flex items-center justify-center gap-2"><i class="fa-solid fa-cart-plus"></i> Add to Cart</button>';
            } else {
                html += '<button class="flex-1 rounded-2xl bg-white/[0.05] py-3.5 font-semibold text-muted cursor-not-allowed flex items-center justify-center gap-2"><i class="fa-solid fa-ban"></i> Out of Stock</button>';
            }
            html += '<button id="pdWishlistBtn" onclick="ProductDetailManager.toggleWishlist()" class="w-14 h-14 rounded-2xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center hover:border-red-400/40 transition">';
            html += '<i class="' + (isWishlisted ? 'fa-solid text-red-500' : 'fa-regular text-subtle') + ' fa-heart text-lg"></i>';
            html += '</button>';
            html += '</div>';

            // Stock status
            if (outOfStock) {
                html += '<p class="text-sm text-red-400 mt-4"><i class="fa-solid fa-circle-exclamation mr-1.5"></i>This product is currently out of stock.</p>';
            } else if (stock <= 5) {
                html += '<p class="text-sm text-orange-400 mt-4"><i class="fa-solid fa-fire mr-1.5"></i>Only ' + stock + ' left in stock!</p>';
            }

            html += '</div>'; // end info column
            html += '</div>'; // end grid

            // ── Description Tab ──
            if (p.description) {
                html += '<div class="mt-12 border-t border-white/[0.06] pt-8">';
                html += '<h2 class="font-display text-xl font-bold text-softWhite mb-4">Description</h2>';
                html += '<div class="text-sm text-subtle leading-relaxed whitespace-pre-line">' + (p.description || '') + '</div>';
                html += '</div>';
            }

            // ── Specs ──
            if (p.specs && typeof p.specs === 'object' && Object.keys(p.specs).length > 0) {
                html += '<div class="mt-8 border-t border-white/[0.06] pt-8">';
                html += '<h2 class="font-display text-xl font-bold text-softWhite mb-4">Specifications</h2>';
                html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
                var keys = Object.keys(p.specs);
                for (var k = 0; k < keys.length; k++) {
                    html += '<div class="flex justify-between py-2.5 border-b border-white/[0.04]">';
                    html += '<span class="text-sm text-muted">' + keys[k] + '</span>';
                    html += '<span class="text-sm text-subtle font-medium">' + p.specs[keys[k]] + '</span>';
                    html += '</div>';
                }
                html += '</div></div>';
            }

            // ── Reviews Section ──
            html += ReviewManager.renderReviewsSection(reviews, p.id);

            container.innerHTML = html;

            // Attach click handler to product cards for navigation
            ProductDetailManager._attachCardClicks();
        },

        setActiveImage: function (index) {
            ProductDetailManager._activeImageIndex = index;
            var img = sg('pdMainImage');
            if (img && ProductDetailManager._allImages[index]) {
                img.src = ProductDetailManager._allImages[index];
            }
            // Update thumbnail borders
            var thumbs = document.querySelectorAll('#view-product .flex.gap-2 button');
            for (var i = 0; i < thumbs.length; i++) {
                if (i === index) {
                    thumbs[i].classList.add('border-accent');
                    thumbs[i].classList.remove('border-white/10');
                } else {
                    thumbs[i].classList.remove('border-accent');
                    thumbs[i].classList.add('border-white/10');
                }
            }
        },

        selectVariant: function (variantId) {
            var btns = document.querySelectorAll('.pd-variant-btn');
            for (var i = 0; i < btns.length; i++) {
                if (btns[i].getAttribute('data-variant-id') === variantId) {
                    btns[i].classList.add('border-accent', 'bg-accent/10');
                    btns[i].classList.remove('border-white/[0.08]');
                    ProductDetailManager._selectedVariant = variantId;
                } else {
                    btns[i].classList.remove('border-accent', 'bg-accent/10');
                    btns[i].classList.add('border-white/[0.08]');
                }
            }
        },

        changeQty: function (delta) {
            var p = ProductDetailManager._currentProduct;
            var maxStock = p ? (p.stock_quantity || 99) : 99;
            ProductDetailManager._selectedQuantity = Math.max(1, Math.min(maxStock, ProductDetailManager._selectedQuantity + delta));
            var qtyEl = sg('pdQuantity');
            if (qtyEl) qtyEl.textContent = ProductDetailManager._selectedQuantity;
        },

        addToCart: function () {
            var p = ProductDetailManager._currentProduct;
            if (!p) return;
            CartManager.addToCart(p.id, ProductDetailManager._selectedVariant, ProductDetailManager._selectedQuantity);
        },

        toggleWishlist: function () {
            var p = ProductDetailManager._currentProduct;
            if (!p) return;
            WishlistManager.toggleWishlist(p.id);
            // Update button
            var btn = sg('pdWishlistBtn');
            if (btn) {
                var isNow = WishlistManager.isWishlisted(p.id);
                btn.innerHTML = '<i class="' + (isNow ? 'fa-solid text-red-500' : 'fa-regular text-subtle') + ' fa-heart text-lg"></i>';
            }
        },

        _attachCardClicks: function () {
            // Make product cards in the page clickable to open detail view
            var cards = document.querySelectorAll('.product-card');
            for (var i = 0; i < cards.length; i++) {
                (function (card) {
                    if (card._pdClickListener) return;
                    card._pdClickListener = true;
                    card.style.cursor = 'pointer';
                    card.addEventListener('click', function (e) {
                        // Don't trigger if clicking action buttons inside the card
                        if (e.target.closest('button')) return;
                        var pid = card.getAttribute('data-product-id');
                        if (pid) navigateTo('product', pid);
                    });
                })(cards[i]);
            }
        }
    };

    window.ProductDetailManager = ProductDetailManager;


    // ═══════════════════════════════════════════════════════════════════════════
    // 10. REVIEW MANAGER (reviews display + submit)
    // ═══════════════════════════════════════════════════════════════════════════

    var ReviewManager = {

        renderReviewsSection: function (reviews, productId) {
            var avgRating = 0;
            var reviewCount = reviews ? reviews.length : 0;
            if (reviewCount > 0) {
                var total = 0;
                for (var i = 0; i < reviews.length; i++) total += reviews[i].rating;
                avgRating = total / reviewCount;
            }

            var html = '<div class="mt-12 border-t border-white/[0.06] pt-8">';
            html += '<div class="flex items-center justify-between mb-6">';
            html += '<h2 class="font-display text-xl font-bold text-softWhite">Reviews</h2>';
            html += '<span class="text-sm text-muted">' + reviewCount + ' review' + (reviewCount !== 1 ? 's' : '') + '</span>';
            html += '</div>';

            // Rating summary
            if (reviewCount > 0) {
                html += '<div class="flex items-center gap-6 mb-8 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">';
                html += '<div class="text-center">';
                html += '<div class="text-4xl font-bold text-softWhite">' + avgRating.toFixed(1) + '</div>';
                html += '<div class="mt-1">' + sr(avgRating, 14) + '</div>';
                html += '<p class="text-xs text-muted mt-1">' + reviewCount + ' reviews</p>';
                html += '</div>';

                // Rating distribution bars
                html += '<div class="flex-1 space-y-1.5">';
                for (var s = 5; s >= 1; s--) {
                    var count = 0;
                    for (var j = 0; j < reviews.length; j++) { if (reviews[j].rating === s) count++; }
                    var pct = reviewCount > 0 ? Math.round(count / reviewCount * 100) : 0;
                    html += '<div class="flex items-center gap-2">';
                    html += '<span class="text-xs text-muted w-3">' + s + '</span>';
                    html += '<div class="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden"><div class="h-full rounded-full bg-accent" style="width:' + pct + '%"></div></div>';
                    html += '<span class="text-xs text-muted w-6 text-right">' + count + '</span>';
                    html += '</div>';
                }
                html += '</div></div>';
            }

            // Individual reviews
            if (reviewCount === 0) {
                html += '<div class="text-center py-10"><div class="text-4xl mb-3 opacity-20"><i class="fa-regular fa-comment-dots"></i></div><p class="text-subtle">No reviews yet. Be the first to review!</p></div>';
            } else {
                html += '<div class="space-y-4 max-h-96 overflow-y-auto chat-scroll">';
                for (var r = 0; r < reviews.length; r++) {
                    var rev = reviews[r];
                    var authorName = 'Customer';
                    if (rev.profiles) {
                        authorName = (rev.profiles.first_name || '') + ' ' + (rev.profiles.last_name || '');
                        authorName = authorName.trim() || 'Customer';
                    }
                    html += '<div class="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">';
                    html += '<div class="flex items-center justify-between mb-2">';
                    html += '<div class="flex items-center gap-2">';
                    html += '<div class="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent">' + authorName.charAt(0).toUpperCase() + '</div>';
                    html += '<div><p class="text-sm font-medium text-softWhite">' + authorName + '</p>';
                    if (rev.is_verified) html += '<p class="text-[10px] text-sage"><i class="fa-solid fa-circle-check mr-0.5"></i>Verified Purchase</p>';
                    html += '</div></div>';
                    html += '<div class="flex items-center gap-1">' + sr(rev.rating, 11) + '</div>';
                    html += '</div>';
                    if (rev.title) html += '<p class="text-sm font-medium text-subtle mt-2">' + rev.title + '</p>';
                    if (rev.content) html += '<p class="text-sm text-subtle/80 mt-1 leading-relaxed">' + rev.content + '</p>';
                    html += '<p class="text-xs text-muted mt-2">' + ta(rev.created_at) + '</p>';
                    html += '</div>';
                }
                html += '</div>';
            }

            html += '</div>';
            return html;
        }
    };

    window.ReviewManager = ReviewManager;


    // ═══════════════════════════════════════════════════════════════════════════
    // 11. CHECKOUT VIEW
    // ═══════════════════════════════════════════════════════════════════════════

    var CheckoutManager = {

        loadCheckout: function () {
            var container = sg('checkoutContent');
            if (!container) {
                CheckoutManager._createView();
                container = sg('checkoutContent');
            }
            if (!container) return;

            // Must be authenticated
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
                if (typeof showToast === 'function') showToast('Please sign in to proceed to checkout.', 'info');
                if (typeof openAuth === 'function') openAuth('signin');
                return;
            }

            container.innerHTML = '<div class="flex items-center justify-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-4 border-accent border-t-transparent"></div></div>';

            // Check cart has items
            if (!window._cartData || !window._cartData.items || window._cartData.items.length === 0) {
                container.innerHTML =
                    '<div class="text-center py-20">' +
                    '<div class="text-6xl mb-4 opacity-30"><i class="fa-solid fa-cart-shopping"></i></div>' +
                    '<h3 class="text-xl font-semibold text-subtle mb-2">Your cart is empty</h3>' +
                    '<p class="text-sm text-muted mb-6">Add some products before checking out.</p>' +
                    '<button onclick="navigateTo(\'collection\')" class="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-bg hover:bg-accentDim transition">Browse Collection</button>' +
                    '</div>';
                return;
            }

            // Load delivery methods, payment methods, and addresses in parallel
            Promise.all([
                sb.from('delivery_methods').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
                sb.from('payment_methods').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
                sb.from('addresses').select('*').eq('user_id', currentUser.id).order('is_default', { descending: true })
            ]).then(function (results) {
                _checkoutDeliveryMethods = results[0].data || [];
                _checkoutPaymentMethods  = results[1].data || [];
                _checkoutAddresses       = results[2].data || [];
                _checkoutDeliveryId = _checkoutDeliveryMethods.length > 0 ? _checkoutDeliveryMethods[0].id : null;
                _checkoutPaymentId  = _checkoutPaymentMethods.length > 0 ? _checkoutPaymentMethods[0].id : null;
                _checkoutAddressId  = _checkoutAddresses.length > 0 && _checkoutAddresses[0].is_default ? _checkoutAddresses[0].id : (_checkoutAddresses.length > 0 ? _checkoutAddresses[0].id : null);

                if (_checkoutDeliveryId) _checkoutDeliveryCost = Number(_checkoutDeliveryMethods[0].base_price) || 0;

                CheckoutManager._render();
            }).catch(function (err) {
                console.error('Checkout load error:', err);
                container.innerHTML = '<div class="text-center py-20"><div class="text-5xl mb-4 text-red-400"><i class="fa-solid fa-triangle-exclamation"></i></div><h3 class="text-lg font-semibold text-subtle">Failed to load checkout data</h3></div>';
            });
        },

        _createView: function () {
            if (document.getElementById('view-checkout')) return;
            var mainWrapper = document.querySelector('.relative.z-10 > main') ||
                              document.querySelector('.relative.z-10');
            if (!mainWrapper) return;
            var div = document.createElement('div');
            div.id = 'view-checkout';
            div.className = 'view-section';
            div.setAttribute('aria-labelledby', 'checkoutHeading');
            div.innerHTML =
                '<div class="py-8">' +
                '  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">' +
                '    <button onclick="navigateTo(\'collection\')" class="flex items-center gap-2 text-sm text-subtle hover:text-accent transition mb-6"><i class="fa-solid fa-arrow-left text-xs"></i> Back to Collection</button>' +
                '    <h1 id="checkoutHeading" class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-softWhite mb-8">Checkout</h1>' +
                '    <div id="checkoutContent"></div>' +
                '  </div>' +
                '</div>';
            mainWrapper.appendChild(div);
        },

        _render: function () {
            var container = sg('checkoutContent');
            if (!container) return;

            var items = window._cartData ? window._cartData.items : [];
            var subtotal = 0;
            for (var i = 0; i < items.length; i++) {
                subtotal += (Number(items[i].unit_price) || 0) * (items[i].quantity || 1);
            }
            var discount = CartManager._couponDiscount || 0;
            var total = subtotal - discount + _checkoutDeliveryCost;
            if (total < 0) total = 0;

            var html = '<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">';

            // ── Left column: forms ──
            html += '<div class="lg:col-span-2 space-y-8">';

            // 1. Delivery Method
            html += '<div class="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">';
            html += '<h3 class="font-semibold text-softWhite mb-4 flex items-center gap-2"><i class="fa-solid fa-truck text-accent text-sm"></i> Delivery Method</h3>';
            html += '<div class="space-y-3" id="checkoutDeliveryList">';
            for (var d = 0; d < _checkoutDeliveryMethods.length; d++) {
                var dm = _checkoutDeliveryMethods[d];
                var dActive = dm.id === _checkoutDeliveryId;
                html += '<label class="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ' + (dActive ? 'border-accent/40 bg-accent/[0.04]' : 'border-white/[0.06] hover:border-white/[0.12]') + '">';
                html += '<input type="radio" name="checkoutDelivery" value="' + dm.id + '" ' + (dActive ? 'checked' : '') + ' onchange="CheckoutManager.selectDelivery(\'' + dm.id + '\')" class="mt-1 accent-amber-500">';
                html += '<div class="flex-1">';
                html += '<p class="text-sm font-medium text-softWhite">' + dm.name + '</p>';
                if (dm.description) html += '<p class="text-xs text-muted mt-0.5">' + dm.description + '</p>';
                html += '<p class="text-xs text-accent mt-1 font-medium">' + fp(dm.base_price) + (dm.estimated_days ? ' · ' + dm.estimated_days + ' business days' : '') + '</p>';
                html += '</div></label>';
            }
            html += '</div></div>';

            // 2. Shipping Address
            html += '<div class="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">';
            html += '<h3 class="font-semibold text-softWhite mb-4 flex items-center gap-2"><i class="fa-solid fa-location-dot text-accent text-sm"></i> Shipping Address</h3>';

            if (_checkoutAddresses.length > 0) {
                html += '<div class="space-y-2 mb-4" id="checkoutAddressList">';
                for (var a = 0; a < _checkoutAddresses.length; a++) {
                    var addr = _checkoutAddresses[a];
                    var aActive = addr.id === _checkoutAddressId;
                    html += '<label class="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ' + (aActive ? 'border-accent/40 bg-accent/[0.04]' : 'border-white/[0.06] hover:border-white/[0.12]') + '">';
                    html += '<input type="radio" name="checkoutAddress" value="' + addr.id + '" ' + (aActive ? 'checked' : '') + ' onchange="CheckoutManager.selectAddress(\'' + addr.id + '\')" class="mt-1 accent-amber-500">';
                    html += '<div class="flex-1">';
                    html += '<p class="text-sm font-medium text-softWhite">' + addr.first_name + ' ' + addr.last_name + (addr.label ? ' <span class="text-xs text-muted font-normal">(' + addr.label + ')</span>' : '') + '</p>';
                    html += '<p class="text-xs text-muted mt-0.5">' + addr.address_line1 + (addr.address_line2 ? ', ' + addr.address_line2 : '') + ', ' + addr.city + ', ' + addr.region + ' ' + (addr.postal_code || '') + '</p>';
                    html += '<p class="text-xs text-muted">' + addr.phone + '</p>';
                    html += '</div></label>';
                }
                html += '</div>';
                html += '<button onclick="CheckoutManager.showNewAddressForm()" class="text-sm text-accent hover:text-accentDim transition">+ Add new address</button>';
            }

            // New address form (hidden by default)
            html += '<div id="newAddressForm" style="display:none;" class="mt-4 space-y-3">';
            html += '<div class="grid grid-cols-2 gap-3">';
            html += '<input id="ckAddrFirst" type="text" placeholder="First name" class="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-softWhite placeholder-muted outline-none focus:border-accent/30 transition">';
            html += '<input id="ckAddrLast" type="text" placeholder="Last name" class="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-softWhite placeholder-muted outline-none focus:border-accent/30 transition">';
            html += '</div>';
            html += '<input id="ckAddrPhone" type="tel" placeholder="Phone number" class="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-softWhite placeholder-muted outline-none focus:border-accent/30 transition">';
            html += '<input id="ckAddrLine1" type="text" placeholder="Address line 1" class="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-softWhite placeholder-muted outline-none focus:border-accent/30 transition">';
            html += '<input id="ckAddrLine2" type="text" placeholder="Address line 2 (optional)" class="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-softWhite placeholder-muted outline-none focus:border-accent/30 transition">';
            html += '<div class="grid grid-cols-3 gap-3">';
            html += '<input id="ckAddrCity" type="text" placeholder="City" class="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-softWhite placeholder-muted outline-none focus:border-accent/30 transition">';
            html += '<input id="ckAddrRegion" type="text" placeholder="Region" class="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-softWhite placeholder-muted outline-none focus:border-accent/30 transition">';
            html += '<input id="ckAddrPostal" type="text" placeholder="Postal code" class="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-softWhite placeholder-muted outline-none focus:border-accent/30 transition">';
            html += '</div>';
            html += '<button onclick="CheckoutManager.saveNewAddress()" class="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-bg hover:bg-accentDim transition">Save Address</button>';
            html += '</div>';

            html += '</div>';

            // 3. Payment Method
            html += '<div class="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">';
            html += '<h3 class="font-semibold text-softWhite mb-4 flex items-center gap-2"><i class="fa-solid fa-credit-card text-accent text-sm"></i> Payment Method</h3>';
            html += '<div class="space-y-3" id="checkoutPaymentList">';
            for (var p = 0; p < _checkoutPaymentMethods.length; p++) {
                var pm = _checkoutPaymentMethods[p];
                var pActive = pm.id === _checkoutPaymentId;
                html += '<label class="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ' + (pActive ? 'border-accent/40 bg-accent/[0.04]' : 'border-white/[0.06] hover:border-white/[0.12]') + '">';
                html += '<input type="radio" name="checkoutPayment" value="' + pm.id + '" ' + (pActive ? 'checked' : '') + ' onchange="CheckoutManager.selectPayment(\'' + pm.id + '\')" class="mt-1 accent-amber-500">';
                html += '<div class="flex-1">';
                html += '<p class="text-sm font-medium text-softWhite">' + pm.name + '</p>';
                if (pm.description) html += '<p class="text-xs text-muted mt-0.5">' + pm.description + '</p>';
                html += '</div></label>';
            }
            html += '</div>';

            // Payment proof upload (for manual payments)
            html += '<div id="paymentProofSection" class="mt-4">';
            html += '<label class="block text-sm text-subtle mb-2">Payment Proof (screenshot)</label>';
            html += '<input type="file" id="ckPaymentProof" accept="image/*" onchange="CheckoutManager.handleProofUpload(this)" class="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-accent/20 file:text-accent hover:file:bg-accent/30 file:cursor-pointer">';
            html += '<p id="ckProofName" class="text-xs text-muted mt-1"></p>';
            html += '<div class="mt-3">';
            html += '<label class="block text-sm text-subtle mb-1">Transaction Reference (optional)</label>';
            html += '<input id="ckTxRef" type="text" placeholder="e.g. TXN-123456" class="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-softWhite placeholder-muted outline-none focus:border-accent/30 transition">';
            html += '</div>';
            html += '</div>';

            html += '</div>';

            // 4. Order Notes
            html += '<div class="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">';
            html += '<h3 class="font-semibold text-softWhite mb-3 flex items-center gap-2"><i class="fa-solid fa-note-sticky text-accent text-sm"></i> Order Notes (optional)</h3>';
            html += '<textarea id="ckNotes" rows="3" placeholder="Any special instructions for the seller..." class="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-softWhite placeholder-muted outline-none focus:border-accent/30 transition resize-vertical"></textarea>';
            html += '</div>';

            html += '</div>'; // end left column

            // ── Right column: order summary ──
            html += '<div class="lg:col-span-1">';
            html += '<div class="sticky top-24 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">';
            html += '<h3 class="font-semibold text-softWhite flex items-center gap-2"><i class="fa-solid fa-receipt text-accent text-sm"></i> Order Summary</h3>';

            // Cart items
            html += '<div class="space-y-3 max-h-64 overflow-y-auto chat-scroll">';
            for (var ci = 0; ci < items.length; ci++) {
                var item = items[ci];
                var lineTotal = (Number(item.unit_price) || 0) * (item.quantity || 1);
                html += '<div class="flex gap-3">';
                html += '<img src="' + (item.product_image || '') + '" alt="" class="w-12 h-12 rounded-lg object-cover flex-shrink-0" onerror="this.style.display=\'none\'"/>';
                html += '<div class="flex-1 min-w-0">';
                html += '<p class="text-sm text-softWhite truncate">' + (item.product_name || 'Product') + '</p>';
                if (item.variant_name) html += '<p class="text-xs text-muted">' + item.variant_name + '</p>';
                html += '<p class="text-xs text-muted">Qty: ' + (item.quantity || 1) + '</p>';
                html += '</div>';
                html += '<span class="text-sm font-medium text-softWhite">' + fp(lineTotal) + '</span>';
                html += '</div>';
            }
            html += '</div>';

            // Totals
            html += '<div class="border-t border-white/[0.06] pt-4 space-y-2">';
            html += '<div class="flex justify-between text-sm"><span class="text-muted">Subtotal</span><span class="text-subtle">' + fp(subtotal) + '</span></div>';
            if (discount > 0) {
                html += '<div class="flex justify-between text-sm"><span class="text-sage">Discount</span><span class="text-sage">-' + fp(discount) + '</span></div>';
            }
            html += '<div class="flex justify-between text-sm"><span class="text-muted">Delivery</span><span class="text-subtle" id="ckDeliveryCostDisplay">' + fp(_checkoutDeliveryCost) + '</span></div>';
            html += '<div class="flex justify-between text-lg font-bold pt-2 border-t border-white/[0.06]"><span class="text-softWhite">Total</span><span class="text-softWhite" id="ckTotalDisplay">' + fp(total) + '</span></div>';
            html += '</div>';

            // Place order button
            html += '<button id="ckPlaceOrderBtn" onclick="CheckoutManager.placeOrder()" class="w-full mt-4 rounded-2xl bg-accent py-3.5 font-semibold text-bg hover:bg-accentDim transition flex items-center justify-center gap-2">';
            html += '<i class="fa-solid fa-lock text-sm"></i> Place Order · ' + fp(total);
            html += '</button>';

            html += '<p class="text-[10px] text-muted text-center mt-3">By placing this order you agree to our Terms of Service and Returns Policy.</p>';
            html += '</div></div>'; // end right column

            html += '</div>'; // end grid

            container.innerHTML = html;
        },

        selectDelivery: function (deliveryId) {
            _checkoutDeliveryId = deliveryId;
            for (var i = 0; i < _checkoutDeliveryMethods.length; i++) {
                if (_checkoutDeliveryMethods[i].id === deliveryId) {
                    _checkoutDeliveryCost = Number(_checkoutDeliveryMethods[i].base_price) || 0;
                    break;
                }
            }
            CheckoutManager._updateTotals();
            // Re-render to update selection visual
            CheckoutManager._render();
        },

        selectPayment: function (paymentId) {
            _checkoutPaymentId = paymentId;
            CheckoutManager._render();
        },

        selectAddress: function (addressId) {
            _checkoutAddressId = addressId;
            CheckoutManager._render();
        },

        showNewAddressForm: function () {
            var form = sg('newAddressForm');
            if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
        },

        saveNewAddress: function () {
            var first  = (sg('ckAddrFirst')  || {}).value || '';
            var last   = (sg('ckAddrLast')   || {}).value || '';
            var phone  = (sg('ckAddrPhone')  || {}).value || '';
            var line1  = (sg('ckAddrLine1')  || {}).value || '';
            var line2  = (sg('ckAddrLine2')  || {}).value || '';
            var city   = (sg('ckAddrCity')   || {}).value || '';
            var region = (sg('ckAddrRegion') || {}).value || '';
            var postal = (sg('ckAddrPostal') || {}).value || '';

            if (!first.trim() || !last.trim() || !phone.trim() || !line1.trim() || !city.trim() || !region.trim()) {
                showToast('Please fill in all required address fields.', 'error');
                return;
            }

            var addrData = {
                user_id: currentUser.id,
                first_name: first.trim(),
                last_name: last.trim(),
                phone: phone.trim(),
                address_line1: line1.trim(),
                address_line2: line2.trim() || null,
                city: city.trim(),
                region: region.trim(),
                postal_code: postal.trim() || null,
                country: 'Myanmar',
                is_default: _checkoutAddresses.length === 0
            };

            sb.from('addresses').insert(addrData).select('id').single()
                .then(function (result) {
                    var newId = result.data ? result.data.id : result.id;
                    _checkoutAddressId = newId;
                    _checkoutAddresses.push(addrData);
                    if (typeof showToast === 'function') showToast('Address saved!', 'success');
                    CheckoutManager._render();
                })
                .catch(function (err) {
                    console.error('Save address error:', err);
                    showToast('Failed to save address.', 'error');
                });
        },

        handleProofUpload: function (input) {
            if (input.files && input.files[0]) {
                _checkoutPaymentProof = input.files[0];
                var nameEl = sg('ckProofName');
                if (nameEl) nameEl.textContent = input.files[0].name;
            }
        },

        _updateTotals: function () {
            var items = window._cartData ? window._cartData.items : [];
            var subtotal = 0;
            for (var i = 0; i < items.length; i++) {
                subtotal += (Number(items[i].unit_price) || 0) * (items[i].quantity || 1);
            }
            var discount = CartManager._couponDiscount || 0;
            var total = subtotal - discount + _checkoutDeliveryCost;
            if (total < 0) total = 0;

            var dcEl = sg('ckDeliveryCostDisplay');
            var ttEl = sg('ckTotalDisplay');
            if (dcEl) dcEl.textContent = fp(_checkoutDeliveryCost);
            if (ttEl) ttEl.textContent = fp(total);

            var btn = sg('ckPlaceOrderBtn');
            if (btn) btn.innerHTML = '<i class="fa-solid fa-lock text-sm"></i> Place Order · ' + fp(total);
        },

        placeOrder: function () {
            if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
                showToast('Please sign in.', 'info');
                return;
            }

            if (!_checkoutDeliveryId) {
                showToast('Please select a delivery method.', 'error');
                return;
            }
            if (!_checkoutPaymentId) {
                showToast('Please select a payment method.', 'error');
                return;
            }

            // Get address data
            var selectedAddress = null;
            if (_checkoutAddressId) {
                for (var a = 0; a < _checkoutAddresses.length; a++) {
                    if (_checkoutAddresses[a].id === _checkoutAddressId) {
                        selectedAddress = _checkoutAddresses[a];
                        break;
                    }
                }
            }

            if (!selectedAddress) {
                showToast('Please add a shipping address.', 'error');
                return;
            }

            var notesEl = sg('ckNotes');
            _checkoutNotes = notesEl ? (notesEl.value || '').trim() : '';
            var txRefEl = sg('ckTxRef');
            _checkoutTransactionRef = txRefEl ? (txRefEl.value || '').trim() : '';

            // Disable button
            var btn = sg('ckPlaceOrderBtn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<div class="animate-spin rounded-full h-5 w-5 border-2 border-bg border-t-transparent"></div> Placing order...';
            }

            var items = window._cartData ? window._cartData.items : [];
            if (items.length === 0) {
                showToast('Your cart is empty.', 'error');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock text-sm"></i> Place Order'; }
                return;
            }

            var subtotal = 0;
            for (var i = 0; i < items.length; i++) {
                subtotal += (Number(items[i].unit_price) || 0) * (items[i].quantity || 1);
            }
            var discount = CartManager._couponDiscount || 0;
            var total = subtotal - discount + _checkoutDeliveryCost;
            if (total < 0) total = 0;

            // Get delivery method name
            var deliveryName = '';
            for (var d = 0; d < _checkoutDeliveryMethods.length; d++) {
                if (_checkoutDeliveryMethods[d].id === _checkoutDeliveryId) {
                    deliveryName = _checkoutDeliveryMethods[d].name;
                    break;
                }
            }

            // Build order
            var orderData = {
                customer_id: currentUser.id,
                shipping_address_id: selectedAddress.id,
                shipping_name: selectedAddress.first_name + ' ' + selectedAddress.last_name,
                shipping_phone: selectedAddress.phone,
                shipping_address: selectedAddress.address_line1 + (selectedAddress.address_line2 ? ', ' + selectedAddress.address_line2 : ''),
                shipping_city: selectedAddress.city,
                shipping_region: selectedAddress.region,
                shipping_postal: selectedAddress.postal_code || null,
                shipping_country: selectedAddress.country || 'Myanmar',
                delivery_method_id: _checkoutDeliveryId,
                delivery_name: deliveryName,
                subtotal: subtotal,
                delivery_cost: _checkoutDeliveryCost,
                discount_amount: discount,
                total_amount: total,
                currency: 'MMK',
                notes: _checkoutNotes || null,
                status: 'pending'
            };

            if (CartManager._couponCode) {
                orderData.coupon_code = CartManager._couponCode;
            }

            // Upload payment proof first if provided
            var proofPromise = Promise.resolve(null);
            if (_checkoutPaymentProof && typeof ImageManager !== 'undefined') {
                var proofPath = 'payments/' + currentUser.id + '/' + Date.now() + '_' + _checkoutPaymentProof.name;
                proofPromise = ImageManager.uploadImage(_checkoutPaymentProof, 'payment-proofs', proofPath)
                    .then(function (result) { return result.publicUrl; })
                    .catch(function () { return null; }); // Continue even if upload fails
            }

            proofPromise.then(function (proofUrl) {
                return sb.from('orders').insert(orderData).select('id, order_number').single()
                    .then(function (orderResult) {
                        var orderId = orderResult.data ? orderResult.data.id : orderResult.id;
                        var orderNumber = orderResult.data ? orderResult.data.order_number : orderResult.order_number;

                        // Create order items
                        var itemPromises = [];
                        for (var j = 0; j < items.length; j++) {
                            var ci = items[j];
                            var itemSubtotal = (Number(ci.unit_price) || 0) * (ci.quantity || 1);
                            itemPromises.push(
                                sb.from('order_items').insert({
                                    order_id: orderId,
                                    product_id: ci.product_id,
                                    variant_id: ci.variant_id || null,
                                    seller_id: ci.seller_id || currentUser.id,
                                    store_id: ci.store_id || null,
                                    product_name: ci.product_name || 'Product',
                                    product_image: ci.product_image || null,
                                    variant_name: ci.variant_name || null,
                                    quantity: ci.quantity || 1,
                                    unit_price: Number(ci.unit_price) || 0,
                                    subtotal: itemSubtotal,
                                    status: 'pending'
                                })
                            );
                        }

                        return Promise.all(itemPromises).then(function () {
                            // Create payment record
                            return sb.from('payments').insert({
                                order_id: orderId,
                                payment_method_id: _checkoutPaymentId,
                                amount: total,
                                currency: 'MMK',
                                status: 'pending',
                                proof_url: proofUrl,
                                transaction_ref: _checkoutTransactionRef || null
                            });
                        }).then(function () {
                            return { orderId: orderId, orderNumber: orderNumber };
                        });
                    });
            }).then(function (result) {
                showToast('Order placed successfully! Order #' + result.orderNumber, 'success');

                // Log activity
                if (typeof logActivity === 'function') {
                    logActivity('place_order', 'order', result.orderId);
                }

                // Clear cart
                CartManager._couponDiscount = 0;
                CartManager._couponCode = '';
                _cartData = { items: [] };
                CartManager.renderCart();

                // Show success state
                var container = sg('checkoutContent');
                if (container) {
                    container.innerHTML =
                        '<div class="text-center py-20">' +
                        '<div class="w-20 h-20 rounded-full bg-sage/20 flex items-center justify-center mb-6 mx-auto"><i class="fa-solid fa-circle-check text-3xl text-sage"></i></div>' +
                        '<h2 class="font-display text-2xl font-bold text-softWhite mb-2">Order Placed!</h2>' +
                        '<p class="text-subtle mb-1">Your order <strong class="text-accent">#' + result.orderNumber + '</strong> has been placed successfully.</p>' +
                        '<p class="text-sm text-muted mb-8">You can track your order status in the dashboard.</p>' +
                        '<div class="flex gap-3 justify-center">' +
                        '<button onclick="navigateTo(\'collection\')" class="rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-3 text-sm font-semibold text-subtle hover:border-accent/30 transition">Continue Shopping</button>' +
                        '<button onclick="navigateTo(\'dashboard\')" class="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-bg hover:bg-accentDim transition">View Dashboard</button>' +
                        '</div></div>';
                }
            }).catch(function (err) {
                console.error('Place order error:', err);
                showToast('Failed to place order. Please try again.', 'error');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-lock text-sm"></i> Place Order · ' + fp(total);
                }
            });
        }
    };

    window.CheckoutManager = CheckoutManager;


    // ═══════════════════════════════════════════════════════════════════════════
    // 12. GLOBAL PATCHES COMPLETE — log it
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('[integration] All function patches applied. ' +
        'handleSearch, filterCollection, filterCollectionWithSearch, ' +
        'handleSubscribe, handleContactSubmit, navigateTo, updateAuthUI — patched.');

})();
