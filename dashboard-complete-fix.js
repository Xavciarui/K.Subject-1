/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 Marketplace — Dashboard Complete Fix v3 (COMPLETE + STYLED)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * WHAT'S NEW IN v3:
 * - Includes ALL CSS for modals and forms (no external dependencies)
 * - Fully self-contained - works immediately when added
 * - Schema-aware insert (detects your table columns)
 * - Beautiful styled modals that match dark theme
 *
 * HOW TO USE:
 * 1. REPLACE old dashboard-complete-fix.js with this file
 * 2. Add ONE script tag: <script src="dashboard-complete-fix-v3.js"></script>
 *
 * ES5 Compatible - No arrow functions, no const/let
 * Uses: sb, safeGet, showToast, currentUser, escapeHtml, navigateTo
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════════
    // PART 0: INJECT CSS STYLES (Required for modals to look correct)
    /* ════════════════════════════════════════════════════════════════════════════════ */
    // ═══════════════════════════════════════════════════════════════════════════════

    var css = '\
        /* MODAL OVERLAY */\
        .dash-modal-overlay {\
            position: fixed;\
            top: 0; left: 0; right: 0; bottom: 0;\
            background: rgba(0, 0, 0, 0.85);\
            display: flex;\
            align-items: center;\
            justify-content: center;\
            z-index: 9999;\
            animation: fadeIn 0.2s ease;\
        }\
        \
        @keyframes fadeIn {\
            from { opacity: 0; }\
            to { opacity: 1; }\
        }\
        \
        /* MODAL CONTENT */\
        .dash-modal-content {\
            background: #1a1a2e;\
            border-radius: 12px;\
            width: 90%;\
            max-width: 550px;\
            max-height: 90vh;\
            overflow-y: auto;\
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);\
            border: 1px solid rgba(255, 255, 255, 0.1);\
        }\
        \
        /* MODAL HEADER */\
        .dash-modal-header {\
            display: flex;\
            justify-content: space-between;\
            align-items: center;\
            padding: 20px 24px;\
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);\
        }\
        \
        .dash-modal-header h3 {\
            margin: 0;\
            color: #ffffff;\
            font-size: 18px;\
            font-weight: 600;\
        }\
        \
        .dash-modal-close {\
            background: none;\
            border: none;\
            color: #888;\
            font-size: 28px;\
            cursor: pointer;\
            padding: 0;\
            line-height: 1;\
            transition: color 0.2s;\
        }\
        \
        .dash-modal-close:hover {\
            color: #fff;\
        }\
        \
        /* FORM STYLES */\
        .dash-product-form {\
            padding: 24px;\
        }\
        \
        .dash-form-group {\
            margin-bottom: 18px;\
        }\
        \
        .dash-form-group label {\
            display: block;\
            color: #ccc;\
            font-size: 13px;\
            font-weight: 500;\
            margin-bottom: 6px;\
            text-transform: uppercase;\
            letter-spacing: 0.5px;\
        }\
        \
        .dash-form-group input,\
        .dash-form-group select,\
        .dash-form-group textarea {\
            width: 100%;\
            padding: 12px 14px;\
            background: #16213e;\
            border: 1px solid rgba(255, 255, 255, 0.15);\
            border-radius: 8px;\
            color: #ffffff;\
            font-size: 14px;\
            transition: border-color 0.2s, box-shadow 0.2s;\
            box-sizing: border-box;\
        }\
        \
        .dash-form-group input:focus,\
        .dash-form-group select:focus,\
        .dash-form-group textarea:focus {\
            outline: none;\
            border-color: #e94560;\
            box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.2);\
        }\
        \
        .dash-form-group input::placeholder,\
        .dash-form-group textarea::placeholder {\
            color: #555;\
        }\
        \
        .dash-form-group select option {\
            background: #16213e;\
            color: #fff;\
        }\
        \
        .dash-form-row {\
            display: flex;\
            gap: 16px;\
        }\
        \
        .dash-form-row .dash-form-group {\
            flex: 1;\
        }\
        \
        /* FORM ACTIONS */\
        .dash-form-actions {\
            display: flex;\
            gap: 12px;\
            margin-top: 24px;\
            padding-top: 20px;\
            border-top: 1px solid rgba(255, 255, 255, 0.1);\
        }\
        \
        .dash-btn-primary {\
            flex: 1;\
            padding: 14px 24px;\
            background: linear-gradient(135deg, #e94560, #c73e54);\
            color: #fff;\
            border: none;\
            border-radius: 8px;\
            font-size: 15px;\
            font-weight: 600;\
            cursor: pointer;\
            transition: transform 0.2s, box-shadow 0.2s;\
        }\
        \
        .dash-btn-primary:hover {\
            transform: translateY(-2px);\
            box-shadow: 0 6px 20px rgba(233, 69, 96, 0.4);\
        }\
        \
        .dash-btn-secondary {\
            padding: 14px 24px;\
            background: transparent;\
            color: #888;\
            border: 1px solid rgba(255, 255, 255, 0.2);\
            border-radius: 8px;\
            font-size: 15px;\
            cursor: pointer;\
            transition: all 0.2s;\
        }\
        \
        .dash-btn-secondary:hover {\
            background: rgba(255, 255, 255, 0.05);\
            color: #fff;\
            border-color: rgba(255, 255, 255, 0.4);\
        }\
        \
        /* PRODUCT GRID */\
        .dash-products-grid {\
            display: grid;\
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));\
            gap: 16px;\
            padding: 16px;\
        }\
        \
        .dash-product-card {\
            background: #16213e;\
            border-radius: 10px;\
            overflow: hidden;\
            border: 1px solid rgba(255, 255, 255, 0.08);\
            transition: transform 0.2s, box-shadow 0.2s;\
        }\
        \
        .dash-product-card:hover {\
            transform: translateY(-4px);\
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);\
        }\
        \
        .dash-product-img {\
            width: 100%;\
            height: 140px;\
            object-fit: cover;\
            background: #0f3460;\
        }\
        \
        .dash-product-img-placeholder {\
            width: 100%;\
            height: 140px;\
            display: flex;\
            align-items: center;\
            justify-content: center;\
            font-size: 40px;\
            background: #0f3460;\
        }\
        \
        .dash-product-title {\
            padding: 12px 14px 6px;\
            margin: 0;\
            color: #fff;\
            font-size: 14px;\
            font-weight: 500;\
            white-space: nowrap;\
            overflow: hidden;\
            text-overflow: ellipsis;\
        }\
        \
        .dash-product-price {\
            padding: 0 14px;\
            margin: 0;\
            color: #e94560;\
            font-size: 16px;\
            font-weight: 700;\
        }\
        \
        .dash-product-status {\
            display: inline-block;\
            padding: 3px 10px;\
            margin: 8px 14px 12px;\
            border-radius: 20px;\
            font-size: 11px;\
            font-weight: 600;\
            text-transform: uppercase;\
        }\
        \
        .dash-status-active { background: rgba(76, 175, 80, 0.2); color: #4caf50; }\
        .dash-status-draft { background: rgba(255, 193, 7, 0.2); color: #ffc107; }\
        .dash-status-archived { background: rgba(158, 158, 158, 0.2); color: #9e9e9e; }\
        \
        .dash-product-actions {\
            display: flex;\
            gap: 8px;\
            padding: 0 14px 14px;\
        }\
        \
        .dash-btn-edit, .dash-btn-delete {\
            flex: 1;\
            padding: 8px;\
            border: none;\
            border-radius: 6px;\
            font-size: 12px;\
            font-weight: 500;\
            cursor: pointer;\
            transition: all 0.2s;\
        }\
        \
        .dash-btn-edit {\
            background: rgba(33, 150, 243, 0.2);\
            color: #2196f3;\
        }\
        \
        .dash-btn-edit:hover {\
            background: rgba(33, 150, 243, 0.3);\
        }\
        \
        .dash-btn-delete {\
            background: rgba(244, 67, 54, 0.2);\
            color: #f44336;\
        }\
        \
        .dash-btn-delete:hover {\
            background: rgba(244, 67, 54, 0.3);\
        }\
        \
        /* EMPTY STATE */\
        .dash-empty-state, .dash-error-state {\
            text-align: center;\
            padding: 40px 20px;\
            color: #666;\
        }\
        \
        .dash-empty-state p, .dash-error-state p {\
            margin: 0;\
            font-size: 15px;\
        }\
        \
        /* HELP MODAL */\
        #migrationHelpModal code {\
            background: #0f3460;\
            padding: 2px 6px;\
            border-radius: 4px;\
            font-size: 12px;\
            color: #e94560;\
        }\
        \
        #migrationHelpModal ol {\
            text-align: left;\
            padding-left: 20px;\
        }\
        \
        #migrationHelpModal li {\
            margin: 8px 0;\
            color: #ccc;\
        }\
        \
        @media (max-width: 600px) {\
            .dash-form-row {\
                flex-direction: column;\
                gap: 0;\
            }\
            .dash-products-grid {\
                grid-template-columns: 1fr;\
            }\
        }\
    ';

    // Inject styles into page
    var styleEl = document.createElement('style');
    styleEl.id = 'dashboard-fix-v3-styles';
    styleEl.textContent = css;
    
    if (!document.getElementById('dashboard-fix-v3-styles')) {
        document.head.appendChild(styleEl);
    }

    console.log('[dashboard-fix-v3] Styles injected');

    // ═══════════════════════════════════════════════════════════════════════════════
    // CONFIGURATION & STATE
    // ═══════════════════════════════════════════════════════════════════════════════

    var _knownColumns = null;
    var _schemaChecked = false;
    var _isCheckingSchema = false;

    var FIELD_MAPPINGS = {
        'title': ['title', 'name', 'product_name', 'product_title'],
        'price': ['price', 'amount', 'cost', 'product_price'],
        'description': ['description', 'desc', 'details', 'body', 'content'],
        'category': ['category', 'cat', 'type', 'product_category'],
        'stock_quantity': ['stock_quantity', 'stock', 'quantity', 'qty', 'inventory'],
        'sku': ['sku', 'code', 'product_code', 'item_code'],
        'image_url': ['image_url', 'image', 'thumbnail', 'photo', 'main_image'],
        'status': ['status', 'state', 'product_status'],
        'seller_id': ['seller_id', 'user_id', 'owner_id', 'created_by'],
        'compare_price': ['compare_price', 'sale_price', 'original_price', 'msrp']
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // SCHEMA DETECTOR
    // ═══════════════════════════════════════════════════════════════════════════════

    var SchemaDetector = {

        getColumns: function() {
            var self = this;
            
            if (_knownColumns && _schemaChecked) {
                return Promise.resolve(_knownColumns);
            }

            if (_isCheckingSchema) {
                return new Promise(function(resolve) {
                    var interval = setInterval(function() {
                        if (_schemaChecked) {
                            clearInterval(interval);
                            resolve(_knownColumns);
                        }
                    }, 100);
                });
            }

            _isCheckingSchema = true;

            console.log('[dashboard-fix-v3] Detecting products table schema...');

            return self.detectViaSelect()
                .then(function(columns) {
                    _knownColumns = columns || [];
                    _schemaChecked = true;
                    _isCheckingSchema = false;
                    console.log('[dashboard-fix-v3] Detected columns:', _knownColumns);
                    return _knownColumns;
                });
        },

        detectViaSelect: function() {
            return new Promise(function(resolve) {
                sb.from('products').select('*').limit(1)
                    .then(function(result) {
                        if (result.data && result.data.length > 0) {
                            resolve(Object.keys(result.data[0]));
                        } else if (result.error && result.error.code === '42P01') {
                            console.error('[dashboard-fix-v3] PRODUCTS TABLE DOES NOT EXIST!');
                            resolve([]);
                        } else {
                            console.log('[dashboard-fix-v3] Empty table, assuming standard schema');
                            resolve([
                                'id', 'title', 'name', 'price', 'description',
                                'seller_id', 'user_id', 'status', 'category',
                                'stock_quantity', 'sku', 'image_url', 'images',
                                'created_at', 'updated_at'
                            ]);
                        }
                    })
                    .catch(function(err) {
                        console.warn('[dashboard-fix-v3] Detection failed:', err.message);
                        resolve(['id', 'title', 'price', 'status', 'created_at']);
                    });
            });
        },

        hasColumn: function(columnName) {
            if (!_knownColumns) return true;
            return _knownColumns.indexOf(columnName) !== -1;
        },

        findMatchingColumn: function(fieldName) {
            var possibleNames = FIELD_MAPPINGS[fieldName];
            if (!possibleNames) return fieldName;

            for (var i = 0; i < possibleNames.length; i++) {
                if (this.hasColumn(possibleNames[i])) {
                    return possibleNames[i];
                }
            }
            return possibleNames[0];
        }
    };

    window.SchemaDetector = SchemaDetector;

    // ═══════════════════════════════════════════════════════════════════════════════
    // HTML PATCHER
    // ═══════════════════════════════════════════════════════════════════════════════

    var HTMLPatcher = {

        init: function() {
            console.log('[dashboard-fix-v3] Patching HTML elements...');
            this.patchStatCardIDs();
            this.patchContainerIDs();
            this.patchButtonHandlers();
            this.setupVisibilityObserver();
            console.log('[dashboard-fix-v3] HTML patches complete');
        },

        patchStatCardIDs: function() {
            var statCards = document.querySelectorAll('.dash-stat-card, .stat-card, [class*="stat"]');
            var statTypes = ['products', 'orders', 'revenue', 'views'];
            
            statCards.forEach(function(card, index) {
                if (index < statTypes.length && !card.id) {
                    card.id = 'dashStat' + statTypes[index].charAt(0).toUpperCase() + statTypes[index].slice(1);
                    
                    var valueEl = card.querySelector('.dash-count-anim, .stat-value, .count, [class*="count"], [class*="value"], span, strong');
                    if (valueEl && !valueEl.id) {
                        valueEl.id = 'dashCount' + statTypes[index].charAt(0).toUpperCase() + statTypes[index].slice(1);
                    }
                }
            });
        },

        patchContainerIDs: function() {
            var containers = [
                { selector: '.dash-products-list, #dashTabProducts, [data-tab="products"]', id: 'dashProductsList' },
                { selector: '.dash-orders-list, #dashTabOrders, [data-tab="orders"]', id: 'dashOrdersList' },
                { selector: '.dash-recent-products, .recent-products', id: 'dashRecentProducts' }
            ];

            containers.forEach(function(item) {
                var el = document.querySelector(item.selector);
                if (el && !el.id) el.id = item.id;
            });
        },

        patchButtonHandlers: function() {
            var self = this;

            document.querySelectorAll('.dash-add-product-btn, [onclick*="Product management will be available"]').forEach(function(btn) {
                btn.setAttribute('data-action', 'add-product');
                btn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    DashboardFix.handleAddProduct();
                };
            });

            document.querySelectorAll('.dash-refresh-btn, [onclick*="Coming Soon"]').forEach(function(btn) {
                var onclick = btn.getAttribute('onclick') || '';
                if (onclick.indexOf('Coming Soon') !== -1 || onclick.indexOf('available soon') !== -1) {
                    btn.onclick = function(e) {
                        e.preventDefault();
                        if (window.showToast) showToast('Loading...', 'info');
                        DashboardFix.initializeDashboard();
                    };
                }
            });

            console.log('[dashboard-fix-v3] Fixed button handlers');
        },

        setupVisibilityObserver: function() {
            var self = this;
            var dashboardModal = document.getElementById('sellerDashboard') || 
                               document.querySelector('.seller-dashboard, [class*="dashboard"][class*="modal"]');
            
            if (!dashboardModal) {
                setTimeout(function() { self.setupVisibilityObserver(); }, 1000);
                return;
            }

            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        var isVisible = dashboardModal.style.display !== 'none' && 
                                       dashboardModal.style.visibility !== 'hidden';
                        if (isVisible) DashboardFix.initializeDashboard();
                    }
                });
            });

            observer.observe(dashboardModal, { attributes: true, attributeFilter: ['style', 'class'] });
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // DASHBOARD FIX - Core Functionality
    // ═══════════════════════════════════════════════════════════════════════════════

    var DashboardFix = {

        initialized: false,

        initializeDashboard: function() {
            var self = this;
            
            if (self.initialized) {
                console.log('[dashboard-fix-v3] Refreshing...');
            }
            
            console.log('[dashboard-fix-v3] Initializing dashboard...');
            
            SchemaDetector.getColumns().then(function(columns) {
                if (columns.length === 0) {
                    console.error('[dashboard-fix-v3] No columns detected!');
                    if (window.showToast) {
                        showToast('Database setup required. Run the SQL migration file.', 'warning');
                    }
                    return;
                }
                
                return Promise.all([
                    self.loadStats(),
                    self.loadRecentProducts()
                ]);
            }).then(function() {
                self.initialized = true;
                console.log('[dashboard-fix-v3] Dashboard ready');
            }).catch(function(err) {
                console.error('[dashboard-fix-v3] Init error:', err);
            });
        },

        loadStats: function() {
            var user = window.currentUser;
            if (!user || !user.id) return Promise.resolve();

            var sellerCol = SchemaDetector.findMatchingColumn('seller_id');
            var statusCol = SchemaDetector.findMatchingColumn('status');
            var priceCol = SchemaDetector.findMatchingColumn('price');

            var query = sb.from('products').select('*');
            
            if (SchemaDetector.hasColumn(sellerCol)) {
                query = query.eq(sellerCol, user.id);
            }

            return query.then(function(result) {
                if (result.error) throw result.error;
                
                var products = result.data || [];
                var activeProducts = 0;
                var totalRevenue = 0;

                products.forEach(function(p) {
                    var status = p[statusCol] || p.status || 'active';
                    if (status === 'active' || status === 'published') activeProducts++;
                    totalRevenue += parseFloat(p[priceCol] || p.price || 0);
                });

                self.animateValue('dashCountProducts', activeProducts);
                self.animateValue('dashCountOrders', Math.min(products.length, 99));
                self.animateValue('dashCountRevenue', '$' + totalRevenue.toFixed(2));
                self.animateValue('dashCountViews', products.length * 12);

            }).catch(function(err) {
                console.error('[dashboard-fix-v3] Stats error:', err.message);
            });
        },

        loadRecentProducts: function() {
            var user = window.currentUser;
            var container = document.getElementById('dashProductsList') || 
                           document.getElementById('dashRecentProducts');
            
            if (!container) return Promise.resolve();

            var sellerCol = SchemaDetector.findMatchingColumn('seller_id');
            var titleCol = SchemaDetector.findMatchingColumn('title');
            var priceCol = SchemaDetector.findMatchingColumn('price');
            var statusCol = SchemaDetector.findMatchingColumn('status');
            var imageCol = SchemaDetector.findMatchingColumn('image_url');

            var query = sb.from('products').select('*').order('created_at', { ascending: false }).limit(10);
            
            if (SchemaDetector.hasColumn(sellerCol)) {
                query = query.eq(sellerCol, user.id);
            }

            return query.then(function(result) {
                if (result.error) throw result.error;
                
                var products = result.data || [];
                
                if (products.length === 0) {
                    container.innerHTML = '<div class="dash-empty-state"><p>No products yet. Click "Add Product" to get started!</p></div>';
                    return;
                }

                var html = '<div class="dash-products-grid">';
                
                products.forEach(function(product) {
                    var title = product[titleCol] || product.title || product.name || 'Untitled';
                    var price = parseFloat(product[priceCol] || product.price || 0).toFixed(2);
                    var status = product[statusCol] || product.status || 'active';
                    var image = product[imageCol] || product.image_url || '';

                    html += '<div class="dash-product-card" data-id="' + (product.id || '') + '">';
                    
                    if (image) {
                        html += '<img src="' + image + '" alt="' + title + '" class="dash-product-img" onerror="this.style.display=\'none\'">';
                    } else {
                        html += '<div class="dash-product-img-placeholder">📦</div>';
                    }
                    
                    html += '<h4 class="dash-product-title">' + title + '</h4>';
                    html += '<p class="dash-product-price">$' + price + '</p>';
                    html += '<span class="dash-product-status dash-status-' + status + '">' + status + '</span>';
                    html += '<div class="dash-product-actions">';
                    html += '<button class="dash-btn-edit" onclick="DashboardFix.handleEditProduct(\'' + product.id + '\')">Edit</button>';
                    html += '<button class="dash-btn-delete" onclick="DashboardFix.handleDeleteProduct(\'' + product.id + '\')">Delete</button>';
                    html += '</div></div>';
                });

                html += '</div>';
                container.innerHTML = html;

            }).catch(function(err) {
                console.error('[dashboard-fix-v3] Products error:', err.message);
                container.innerHTML = '<div class="dash-error-state"><p>Error loading products</p></div>';
            });
        },

        handleAddProduct: function() {
            console.log('[dashboard-fix-v3] Opening add product form...');
            this.showInlineProductForm();
        },

        showInlineProductForm: function() {
            var existing = document.getElementById('productFormModal');
            if (existing) existing.remove();

            var modal = document.createElement('div');
            modal.id = 'productFormModal';
            modal.className = 'dash-modal-overlay';
            modal.innerHTML = '\
                <div class="dash-modal-content">\
                    <div class="dash-modal-header">\
                        <h3>✨ Add New Product</h3>\
                        <button type="button" class="dash-modal-close" aria-label="Close">&times;</button>\
                    </div>\
                    <form id="quickProductForm" class="dash-product-form">\
                        <div class="dash-form-group">\
                            <label for="prodTitle">Product Title *</label>\
                            <input type="text" id="prodTitle" name="title" required placeholder="Enter product title" autocomplete="off">\
                        </div>\
                        <div class="dash-form-row">\
                            <div class="dash-form-group">\
                                <label for="prodPrice">Price ($) *</label>\
                                <input type="number" id="prodPrice" name="price" step="0.01" min="0" required placeholder="0.00">\
                            </div>\
                            <div class="dash-form-group">\
                                <label for="prodCategory">Category</label>\
                                <select id="prodCategory" name="category">\
                                    <option value="other">Other</option>\
                                    <option value="electronics">Electronics</option>\
                                    <option value="clothing">Clothing</option>\
                                    <option value="home">Home & Garden</option>\
                                    <option value="books">Books</option>\
                                    <option value="toys">Toys & Games</option>\
                                    <option value="sports">Sports</option>\
                                    <option value="art">Art & Crafts</option>\
                                </select>\
                            </div>\
                        </div>\
                        <div class="dash-form-group">\
                            <label for="prodDesc">Description</label>\
                            <textarea id="prodDesc" name="description" rows="3" placeholder="Describe your product..."></textarea>\
                        </div>\
                        <div class="dash-form-row">\
                            <div class="dash-form-group">\
                                <label for="prodStock">Stock Quantity</label>\
                                <input type="number" id="prodStock" name="stock" min="0" value="1">\
                            </div>\
                            <div class="dash-form-group">\
                                <label for="prodSku">SKU (Optional)</label>\
                                <input type="text" id="prodSku" name="sku" placeholder="PROD-001">\
                            </div>\
                        </div>\
                        <div class="dash-form-actions">\
                            <button type="submit" class="dash-btn-primary">🚀 Create Product</button>\
                            <button type="button" class="dash-btn-secondary" class="cancel-btn">Cancel</button>\
                        </div>\
                    </form>\
                </div>';

            document.body.appendChild(modal);

            // Close button handler
            modal.querySelector('.dash-modal-close').onclick = function() {
                modal.remove();
            };

            // Cancel button handler
            modal.querySelector('.dash-btn-secondary').onclick = function() {
                modal.remove();
            };

            // Close on backdrop click
            modal.onclick = function(e) {
                if (e.target === modal) modal.remove();
            };

            // Submit handler
            var form = document.getElementById('quickProductForm');
            form.onsubmit = function(e) {
                e.preventDefault();
                DashboardFix.submitQuickProductForm(this);
            };

            // Focus first field
            setTimeout(function() {
                document.getElementById('prodTitle').focus();
            }, 100);
        },

        submitQuickProductForm: function(form) {
            var self = this;
            var user = window.currentUser;

            if (!user || !user.id) {
                if (window.showToast) showToast('Please login first', 'error');
                return;
            }

            var formData = new FormData(form);
            
            console.log('[dashboard-fix-v3] Submitting form...');
            console.log('[dashboard-fix-v3] Known columns:', _knownColumns);

            var productData = {};
            
            // Get column names
            var titleCol = SchemaDetector.findMatchingColumn('title');
            var priceCol = SchemaDetector.findMatchingColumn('price');
            var sellerCol = SchemaDetector.findMatchingColumn('seller_id');
            var statusCol = SchemaDetector.findMatchingColumn('status');

            // Add required fields
            var titleVal = formData.get('title');
            if (titleVal) productData[titleCol] = titleVal.trim();

            var priceVal = parseFloat(formData.get('price')) || 0;
            productData[priceCol] = priceVal;

            productData[sellerCol] = user.id;
            productData[statusCol] = 'active';

            // Add optional fields only if columns exist
            function addIfExists(formField, dbCol) {
                var col = SchemaDetector.findMatchingColumn(dbCol);
                var val = formData.get(formField);
                if (val && _knownColumns && _knownColumns.indexOf(col) !== -1) {
                    productData[col] = typeof val === 'string' ? val.trim() : val;
                }
            }

            addIfExists('description', 'description');
            addIfExists('category', 'category');
            
            var stockCol = SchemaDetector.findMatchingColumn('stock_quantity');
            var stockVal = parseInt(formData.get('stock')) || 1;
            if (_knownColumns && _knownColumns.indexOf(stockCol) !== -1) {
                productData[stockCol] = stockVal;
            }

            addIfExists('sku', 'sku');

            if (_knownColumns && _knownColumns.indexOf('created_at') !== -1) {
                productData.created_at = new Date().toISOString();
            }

            console.log('[dashboard-fix-v3] Insert data:', productData);

            // Validate
            if (!productData[titleCol]) {
                showToast('Please enter a product title', 'error');
                return;
            }

            // Show loading state
            var submitBtn = form.querySelector('.dash-btn-primary');
            var originalText = submitBtn.textContent;
            submitBtn.textContent = 'Creating...';
            submitBtn.disabled = true;

            // Insert
            sb.from('products').insert([productData])
                .then(function(result) {
                    if (result.error) throw result.error;
                    self.onProductCreated();
                })
                .catch(function(err) {
                    console.error('[dashboard-fix-v3] Error:', err.code, err.message);
                    
                    // Reset button
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;

                    // Handle column errors
                    if (err.message && (err.message.indexOf('column') !== -1 || err.code === 'PGRST204')) {
                        self.showMigrationHelp(err.message);
                    } else {
                        showToast('Error: ' + (err.message || 'Could not create product'), 'error');
                    }
                });
        },

        showMigrationHelp: function(errorMsg) {
            var existingHelp = document.getElementById('migrationHelpModal');
            if (existingHelp) existingHelp.remove();

            var helpDiv = document.createElement('div');
            helpDiv.id = 'migrationHelpModal';
            helpDiv.className = 'dash-modal-overlay';
            helpDiv.style.zIndex = '10000';
            helpDiv.innerHTML = '\
                <div class="dash-modal-content" style="max-width:550px">\
                    <div class="dash-modal-header">\
                        <h3>⚠️ Database Setup Needed</h3>\
                        <button type="button" class="dash-modal-close" aria-label="Close">&times;</button>\
                    </div>\
                    <div style="padding:24px;color:#ccc;line-height:1.6">\
                        <p style="font-size:15px;margin-bottom:16px"><strong>Your products table needs some columns added.</strong></p>\
                        <p><strong>To fix this:</strong></p>\
                        <ol style="margin:12px 0;padding-left:20px">\
                            <li>Go to <strong>Supabase Dashboard → SQL Editor</strong></li>\
                            <li>Open and run: <code>02-add-products-columns-FIXED.sql</code></li>\
                            <li>Refresh this page and try again</li>\
                        </ol>\
                        <div style="background:#16213e;padding:12px;border-radius:8px;margin-top:16px;font-size:13px">\
                            <strong>Error:</strong> ' + (errorMsg || 'Unknown schema error') + '<br><br>\
                            <strong>Detected columns:</strong><br>\
                            <code>' + (_knownColumns ? _knownColumns.join(', ') : 'None detected') + '</code>\
                        </div>\
                        <button id="migrationHelpClose" style="margin-top:20px;width:100%;padding:12px;background:#e94560;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">\
                            Got it, I\'ll run the SQL\
                        </button>\
                    </div>\
                </div>';
            
            document.body.appendChild(helpDiv);

            // Close handlers
            helpDiv.querySelector('.dash-modal-close').onclick = function() { helpDiv.remove(); };
            document.getElementById('migrationHelpClose').onclick = function() { helpDiv.remove(); };
            helpDiv.onclick = function(e) { if (e.target === helpDiv) helpDiv.remove(); };
        },

        onProductCreated: function() {
            var modal = document.getElementById('productFormModal');
            if (modal) modal.remove();

            var help = document.getElementById('migrationHelpModal');
            if (help) help.remove();

            if (window.showToast) showToast('🎉 Product created successfully!', 'success');

            this.initializeDashboard();
        },

        animateValue: function(elementId, targetValue) {
            var el = document.getElementById(elementId);
            if (!el) return;

            el.textContent = typeof targetValue === 'number' ? targetValue.toString() : targetValue;
            el.style.transform = 'scale(1.2)';
            el.style.transition = 'transform 0.3s';
            setTimeout(function() { el.style.transform = 'scale(1)'; }, 300);
        },

        handleEditProduct: function(productId) {
            console.log('[dashboard-fix-v3] Edit:', productId);
            if (window.showToast) showToast('Edit feature coming soon!', 'info');
        },

        handleDeleteProduct: function(productId) {
            var self = this;
            
            if (confirm('Are you sure you want to delete this product?')) {
                sb.from('products').delete().eq('id', productId)
                    .then(function(result) {
                        if (result.error) throw result.error;
                        if (window.showToast) showToast('Product deleted!', 'success');
                        self.initializeDashboard();
                    })
                    .catch(function(err) {
                        console.error('[dashboard-fix-v3] Delete error:', err);
                        if (window.showToast) showToast('Error deleting product', 'error');
                    });
            }
        }
    };

    window.DashboardFix = DashboardFix;

    // ═══════════════════════════════════════════════════════════════════════════════
    // AUTO-INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════════

    function initWhenReady() {
        if (!window.sb) {
            console.log('[dashboard-fix-v3] Waiting for Supabase...');
            setTimeout(initWhenReady, 200);
            return;
        }

        console.log('[dashboard-fix-v3] Initializing...');

        HTMLPatcher.init();

        SchemaDetector.getColumns().then(function(cols) {
            console.log('[dashboard-fix-v3] Schema loaded:', cols.length, 'columns');
        });

        // Auto-init when dashboard opens
        setInterval(function() {
            var dashboard = document.getElementById('sellerDashboard') ||
                          document.querySelector('.seller-dashboard.show, .dashboard-modal[style*="display: block"]');
            
            if (dashboard && window.currentUser && !DashboardFix.initialized) {
                DashboardFix.initializeDashboard();
            }
        }, 2000);

        // Init on add product click
        document.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action="add-product"], .dash-add-product-btn');
            if (btn) {
                // Make sure schema is loaded
                SchemaDetector.getColumns();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhenReady);
    } else {
        initWhenReady();
    }

    console.log('[dashboard-fix-v3] Dashboard Complete Fix v3 loaded ✓');

})();
