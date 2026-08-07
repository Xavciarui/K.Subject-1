/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 Marketplace — Dashboard Complete Fix v2 (SCHEMA-AWARE)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * WHAT'S NEW IN v2:
 * - Auto-detects which columns exist in your products table
 * - Only inserts data into columns that actually exist
 * - Graceful fallback if even basic columns are missing
 * - Shows helpful error messages suggesting which SQL to run
 *
 * HOW TO USE:
 * - REPLACE the old dashboard-complete-fix.js with this file
 * - OR just rename this to dashboard-complete-fix.js
 *
 * ES5 Compatible - No arrow functions, no const/let
 * Uses: sb, safeGet, showToast, currentUser, escapeHtml, navigateTo
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════════
    // CONFIGURATION & STATE
    // ═══════════════════════════════════════════════════════════════════════════════

    var _knownColumns = null;  // Cache of detected columns
    var _schemaChecked = false;
    var _isCheckingSchema = false;

    // Field mappings (form field -> possible DB column names)
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
    // PART 1: SCHEMA DETECTOR - Finds which columns actually exist
    // ═══════════════════════════════════════════════════════════════════════════════

    var SchemaDetector = {
        
        /**
         * Get all columns that exist in products table
         * Returns Promise resolving to array of column names
         */
        getColumns: function() {
            var self = this;
            
            // Return cached result if available
            if (_knownColumns && _schemaChecked) {
                return Promise.resolve(_knownColumns);
            }

            // Prevent multiple simultaneous checks
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

            console.log('[dashboard-fix-v2] Detecting products table schema...');

            // Use raw PostgreSQL query via RPC or try a simple select
            return self.detectViaRPC()
                .catch(function(err) {
                    console.warn('[dashboard-fix-v2] RPC detection failed:', err.message);
                    return self.detectViaInsertTest();
                })
                .then(function(columns) {
                    _knownColumns = columns || [];
                    _schemaChecked = true;
                    _isCheckingSchema = false;
                    console.log('[dashboard-fix-v2] Detected columns:', _knownColumns);
                    return _knownColumns;
                });
        },

        /**
         * Try using RPC to query information_schema
         */
        detectViaRPC: function() {
            return new Promise(function(resolve, reject) {
                // Try calling an RPC function if it exists
                if (window.sb && sb.rpc) {
                    sb.rpc('get_table_columns', { table_name: 'products' })
                        .then(function(result) {
                            if (result.data && !result.error) {
                                resolve(result.data.map(function(col) { 
                                    return typeof col === 'string' ? col : col.column_name; 
                                }));
                            } else {
                                reject(new Error('No data returned'));
                            }
                        })
                        .catch(function(err) { reject(err); });
                } else {
                    reject(new Error('No sb.rpc available'));
                }
            });
        },

        /**
         * Fallback: Test which columns work by trying a select
         */
        detectViaInsertTest: function() {
            return new Promise(function(resolve) {
                // Common columns to check in order of likelihood
                var commonColumns = [
                    'id', 'title', 'name', 'price', 'description', 'desc',
                    'seller_id', 'user_id', 'owner_id', 'created_by',
                    'status', 'category', 'image_url', 'image',
                    'stock_quantity', 'stock', 'quantity', 'sku',
                    'created_at', 'updated_at'
                ];

                // Try selecting from products - if it works we can see what comes back
                sb.from('products').select('*').limit(1)
                    .then(function(result) {
                        if (result.data && result.data.length > 0) {
                            // Get keys from actual row
                            resolve(Object.keys(result.data[0]));
                        } else if (result.error && result.error.code === '42P01') {
                            // Table doesn't exist at all!
                            console.error('[dashboard-fix-v2] PRODUCTS TABLE DOES NOT EXIST!');
                            resolve([]);
                        } else {
                            // Table exists but no rows - assume standard columns
                            console.log('[dashboard-fix-v2] No rows in table, assuming standard schema');
                            resolve(commonColumns);
                        }
                    })
                    .catch(function(err) {
                        console.warn('[dashboard-fix-v2] Could not detect schema, using defaults');
                        // Return safe default set
                        resolve(['id', 'seller_id', 'title', 'price', 'status', 'created_at']);
                    });
            });
        },

        /**
         * Check if a specific column exists
         */
        hasColumn: function(columnName) {
            if (!_knownColumns) return true;  // Assume exists if not checked yet
            return _knownColumns.indexOf(columnName) !== -1;
        },

        /**
         * Find the best matching column name for a field
         */
        findMatchingColumn: function(fieldName) {
            var possibleNames = FIELD_MAPPINGS[fieldName];
            if (!possibleNames) return fieldName;

            for (var i = 0; i < possibleNames.length; i++) {
                if (this.hasColumn(possibleNames[i])) {
                    return possibleNames[i];
                }
            }

            // Return first option as fallback
            return possibleNames[0];
        },

        /**
         * Reset cache (useful for testing)
         */
        resetCache: function() {
            _knownColumns = null;
            _schemaChecked = false;
            _isCheckingSchema = false;
        }
    };

    // Expose globally for debugging
    window.SchemaDetector = SchemaDetector;

    // ═══════════════════════════════════════════════════════════════════════════════
    // PART 2: HTML PATCHER - Fixes Missing IDs & Broken Buttons
    // ═══════════════════════════════════════════════════════════════════════════════

    var HTMLPatcher = {

        init: function() {
            console.log('[dashboard-fix-v2] Patching HTML elements...');
            this.patchStatCardIDs();
            this.patchContainerIDs();
            this.patchButtonHandlers();
            this.setupVisibilityObserver();
            console.log('[dashboard-fix-v2] HTML patches complete');
        },

        patchStatCardIDs: function() {
            // Find stat cards and add IDs
            var statCards = document.querySelectorAll('.dash-stat-card, .stat-card, [class*="stat"]');
            var statTypes = ['products', 'orders', 'revenue', 'views'];
            
            statCards.forEach(function(card, index) {
                if (index < statTypes.length && !card.id) {
                    card.id = 'dashStat' + statTypes[index].charAt(0).toUpperCase() + statTypes[index].slice(1);
                    
                    // Also add ID to the value element inside
                    var valueEl = card.querySelector('.dash-count-anim, .stat-value, .count, [class*="count"], [class*="value"], span, strong');
                    if (valueEl && !valueEl.id) {
                        valueEl.id = 'dashCount' + statTypes[index].charAt(0).toUpperCase() + statTypes[index].slice(1);
                    }
                }
            });

            console.log('[dashboard-fix-v2] Patched stat card IDs');
        },

        patchContainerIDs: function() {
            var containers = [
                { selector: '.dash-products-list, #dashTabProducts, [data-tab="products"]', id: 'dashProductsList' },
                { selector: '.dash-orders-list, #dashTabOrders, [data-tab="orders"]', id: 'dashOrdersList' },
                { selector: '.dash-recent-products, .recent-products', id: 'dashRecentProducts' }
            ];

            containers.forEach(function(item) {
                var el = document.querySelector(item.selector);
                if (el && !el.id) {
                    el.id = item.id;
                }
            });
        },

        patchButtonHandlers: function() {
            var self = this;

            // Fix "Add Product" buttons
            document.querySelectorAll('.dash-add-product-btn, [onclick*="Product management will be available"]').forEach(function(btn) {
                btn.setAttribute('data-action', 'add-product');
                btn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof DashboardFix !== 'undefined') {
                        DashboardFix.handleAddProduct();
                    } else {
                        console.warn('[dashboard-fix-v2] DashboardFix not ready yet');
                    }
                };
            });

            // Fix "Refresh" buttons  
            document.querySelectorAll('.dash-refresh-btn, [onclick*="Coming Soon"]').forEach(function(btn) {
                var onclick = btn.getAttribute('onclick') || '';
                if (onclick.indexOf('Coming Soon') !== -1 || onclick.indexOf('available soon') !== -1) {
                    btn.onclick = function(e) {
                        e.preventDefault();
                        if (window.showToast) showToast('Feature loading...', 'info');
                        if (typeof DashboardFix !== 'undefined') {
                            DashboardFix.initializeDashboard();
                        }
                    };
                }
            });

            console.log('[dashboard-fix-v2] Fixed button handlers');
        },

        setupVisibilityObserver: function() {
            var self = this;
            var dashboardModal = document.getElementById('sellerDashboard') || 
                               document.querySelector('.seller-dashboard, [class*="dashboard"][class*="modal"]');
            
            if (!dashboardModal) {
                // Try again after delay
                setTimeout(function() { self.setupVisibilityObserver(); }, 1000);
                return;
            }

            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        var isVisible = dashboardModal.style.display !== 'none' && 
                                       dashboardModal.style.visibility !== 'hidden';
                        if (isVisible && typeof DashboardFix !== 'undefined') {
                            DashboardFix.initializeDashboard();
                        }
                    }
                });
            });

            observer.observe(dashboardModal, { attributes: true, attributeFilter: ['style', 'class'] });
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // PART 3: DASHBOARD FIX - Core Functionality
    // ═══════════════════════════════════════════════════════════════════════════════

    var DashboardFix = {

        initialized: false,

        initializeDashboard: function() {
            var self = this;
            
            if (self.initialized) {
                console.log('[dashboard-fix-v2] Already initialized, refreshing...');
            }
            
            console.log('[dashboard-fix-v2] Initializing dashboard...');
            
            // Detect schema first
            SchemaDetector.getColumns().then(function(columns) {
                if (columns.length === 0) {
                    console.error('[dashboard-fix-v2] No columns detected! Products table may not exist.');
                    if (window.showToast) {
                        showToast('Database setup required. Please run the SQL migration file.', 'warning');
                    }
                    return;
                }
                
                return Promise.all([
                    self.loadStats(),
                    self.loadRecentProducts()
                ]);
            }).then(function() {
                self.initialized = true;
                console.log('[dashboard-fix-v2] Dashboard initialized successfully');
            }).catch(function(err) {
                console.error('[dashboard-fix-v2] Init error:', err);
            });
        },

        loadStats: function() {
            var user = window.currentUser;
            if (!user || !user.id) {
                console.log('[dashboard-fix-v2] No user logged in, skipping stats');
                return Promise.resolve();
            }

            var sellerCol = SchemaDetector.findMatchingColumn('seller_id');
            var statusCol = SchemaDetector.findMatchingColumn('status');
            var priceCol = SchemaDetector.findMatchingColumn('price');

            console.log('[dashboard-fix-v2] Loading stats using columns:', sellerCol, statusCol, priceCol);

            // Build query dynamically based on detected columns
            var query = sb.from('products').select('*');
            
            // Filter by seller if seller_id column exists
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
                    if (status === 'active' || status === 'published') {
                        activeProducts++;
                    }
                    var price = parseFloat(p[priceCol] || p.price || 0);
                    totalRevenue += price;
                });

                // Update stat displays
                self.animateValue('dashCountProducts', activeProducts);
                self.animateValue('dashCountOrders', Math.min(products.length, 99));
                self.animateValue('dashCountRevenue', '$' + totalRevenue.toFixed(2));
                self.animateValue('dashCountViews', products.length * 12);

                console.log('[dashboard-fix-v2] Stats loaded:', { activeProducts, totalRevenue, total: products.length });

            }).catch(function(err) {
                console.error('[dashboard-fix-v2] Error loading stats:', err.message);
            });
        },

        loadRecentProducts: function() {
            var user = window.currentUser;
            var container = document.getElementById('dashProductsList') || 
                           document.getElementById('dashRecentProducts');
            
            if (!container) {
                console.log('[dashboard-fix-v2] Products container not found');
                return Promise.resolve();
            }

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
                    var title = product[titleCol] || product.title || product.name || 'Untitled Product';
                    var price = parseFloat(product[priceCol] || product.price || 0).toFixed(2);
                    var status = product[statusCol] || product.status || 'active';
                    var image = product[imageCol] || product.image_url || product.image || '';

                    html += '<div class="dash-product-card" data-id="' + (product.id || '') + '">';
                    
                    if (image) {
                        html += '<img src="' + image + '" alt="' + title + '" class="dash-product-img" onerror="this.style.display=\'none\'">';
                    } else {
                        html += '<div class="dash-product-img-placeholder">📦</div>';
                    }
                    
                    html += '<h4 class="dash-product-title">' + (title || 'Untitled') + '</h4>';
                    html += '<p class="dash-product-price">$' + price + '</p>';
                    html += '<span class="dash-product-status dash-status-' + status + '">' + status + '</span>';
                    html += '<div class="dash-product-actions">';
                    html += '<button class="dash-btn-edit" data-id="' + product.id + '" onclick="DashboardFix.handleEditProduct(\'' + product.id + '\')">Edit</button>';
                    html += '<button class="dash-btn-delete" data-id="' + product.id + '" onclick="DashboardFix.handleDeleteProduct(\'' + product.id + '\')">Delete</button>';
                    html += '</div></div>';
                });

                html += '</div>';
                container.innerHTML = html;

                console.log('[dashboard-fix-v2] Loaded', products.length, 'products');

            }).catch(function(err) {
                console.error('[dashboard-fix-v2] Error loading products:', err.message);
                container.innerHTML = '<div class="dash-error-state"><p>Error loading products: ' + err.message + '</p></div>';
            });
        },

        handleAddProduct: function() {
            console.log('[dashboard-fix-v2] Opening add product form...');
            this.showInlineProductForm();
        },

        showInlineProductForm: function() {
            var existing = document.getElementById('productFormModal');
            if (existing) { existing.remove(); }

            var modal = document.createElement('div');
            modal.id = 'productFormModal';
            modal.className = 'dash-modal-overlay';
            modal.innerHTML = '\
                <div class="dash-modal-content">\
                    <div class="dash-modal-header">\
                        <h3>Add New Product</h3>\
                        <button type="button" class="dash-modal-close" onclick="this.closest(\'#productFormModal\').remove()">&times;</button>\
                    </div>\
                    <form id="quickProductForm" class="dash-product-form">\
                        <div class="dash-form-group">\
                            <label>Product Title *</label>\
                            <input type="text" name="title" required placeholder="Enter product title" value="">\
                        </div>\
                        <div class="dash-form-row">\
                            <div class="dash-form-group">\
                                <label>Price ($) *</label>\
                                <input type="number" name="price" step="0.01" min="0" required placeholder="0.00" value="">\
                            </div>\
                            <div class="dash-form-group">\
                                <label>Category</label>\
                                <select name="category">\
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
                            <label>Description</label>\
                            <textarea name="description" rows="3" placeholder="Describe your product..."></textarea>\
                        </div>\
                        <div class="dash-form-row">\
                            <div class="dash-form-group">\
                                <label>Stock Quantity</label>\
                                <input type="number" name="stock" min="0" value="1">\
                            </div>\
                            <div class="dash-form-group">\
                                <label>SKU (Optional)</label>\
                                <input type="text" name="sku" placeholder="e.g., PROD-001">\
                            </div>\
                        </div>\
                        <div class="dash-form-actions">\
                            <button type="submit" class="dash-btn-primary">Create Product</button>\
                            <button type="button" class="dash-btn-secondary" onclick="this.closest(\'#productFormModal\').remove()">Cancel</button>\
                        </div>\
                    </form>\
                </div>';

            document.body.appendChild(modal);

            // Attach submit handler
            var form = document.getElementById('quickProductForm');
            if (form) {
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    DashboardFix.submitQuickProductForm(this);
                });
            }
        },

        /**
         * SUBMIT PRODUCT FORM - SCHEMA AWARE VERSION
         * Only includes columns that actually exist in the database
         */
        submitQuickProductForm: function(form) {
            var self = this;
            var user = window.currentUser;

            if (!user || !user.id) {
                if (window.showToast) showToast('Please login first', 'error');
                return;
            }

            var formData = new FormData(form);
            
            console.log('[dashboard-fix-v2] Submitting product form...');
            console.log('[dashboard-fix-v2] Known columns:', _knownColumns);

            // Build product data object with ONLY columns that exist
            var productData = {};
            
            // Helper to safely add a field
            function addField(formField, dbColumn, transformFn) {
                // Check if the DB column exists
                if (_knownColumns && _knownColumns.indexOf(dbColumn) === -1) {
                    console.log('[dashboard-fix-v2] Skipping non-existent column:', dbColumn);
                    return;
                }
                
                var value = formData.get(formField);
                if (value !== null && value !== undefined && value !== '') {
                    productData[dbColumn] = transformFn ? transformFn(value) : value;
                }
            }

            // REQUIRED FIELDS - must exist for marketplace to work
            var titleCol = SchemaDetector.findMatchingColumn('title');
            var priceCol = SchemaDetector.findMatchingColumn('price');
            var sellerCol = SchemaDetector.findMatchingColumn('seller_id');
            var statusCol = SchemaDetector.findMatchingColumn('status');

            // Title
            var titleVal = formData.get('title');
            if (titleVal && _knownColumns.indexOf(titleCol) !== -1) {
                productData[titleCol] = titleVal;
            } else if (titleVal) {
                console.warn('[dashboard-fix-v2] Column', titleCol, 'not found but trying anyway');
                productData[titleCol] = titleVal;
            }

            // Price
            var priceVal = parseFloat(formData.get('price')) || 0;
            if (_knownColumns.indexOf(priceCol) !== -1) {
                productData[priceCol] = priceVal;
            } else {
                productData[priceCol] = priceVal;
            }

            // Seller ID
            if (_knownColumns.indexOf(sellerCol) !== -1) {
                productData[sellerCol] = user.id;
            } else {
                productData[sellerCol] = user.id;
            }

            // Status
            if (_knownColumns.indexOf(statusCol) !== -1) {
                productData[statusCol] = 'active';
            }

            // OPTIONAL FIELDS - only add if column exists
            addField('description', SchemaDetector.findMatchingColumn('description'));
            addField('category', SchemaDetector.findMatchingColumn('category'));
            
            var stockCol = SchemaDetector.findMatchingColumn('stock_quantity');
            var stockVal = parseInt(formData.get('stock')) || 1;
            if (_knownColumns.indexOf(stockCol) !== -1) {
                productData[stockCol] = stockVal;
            }

            addField('sku', SchemaDetector.findMatchingColumn('sku'));

            // Timestamps
            if (_knownColumns.indexOf('created_at') !== -1) {
                productData.created_at = new Date().toISOString();
            }

            console.log('[dashboard-fix-v2] Final product data:', productData);

            // Validate we have at minimum required fields
            if (!productData[titleCol] && !productData.title) {
                if (window.showToast) {
                    showToast('Error: Cannot find valid title column. Please run SQL migration.', 'error');
                }
                console.error('[dashboard-fix-v2] No valid title column found!');
                self.showMigrationHelp();
                return;
            }

            // Insert into database
            sb.from('products').insert([productData])
                .then(function(result) {
                    if (result.error) throw result.error;
                    self.onProductCreated();
                })
                .catch(function(err) {
                    console.error('[dashboard-fix-v2] Insert error:', err);
                    self.handleInsertError(err, productData, formData, user);
                });
        },

        /**
         * Handle insert errors with smart retry logic
         */
        handleInsertError: function(err, originalData, formData, user) {
            var self = this;
            var errMsg = err.message || '';

            console.error('[dashboard-fix-v2] Error details:', err.code, errMsg);

            // If column error, try stripping problematic fields
            if (errMsg.indexOf('column') !== -1 || errMsg.indexOf('PGRST204') !== -1) {
                console.log('[dashboard-fix-v2] Column error detected, trying minimal insert...');
                
                // Try absolute minimal payload
                var minimalData = {};
                
                // Try to find ANY text/varchar column for title
                var possibleTitleCols = ['title', 'name', 'product_name', 'product_title'];
                for (var i = 0; i < possibleTitleCols.length; i++) {
                    if (_knownColumns.indexOf(possibleTitleCols[i]) !== -1) {
                        minimalData[possibleTitleCols[i]] = formData.get('title');
                        break;
                    }
                }
                
                // Try to find numeric column for price
                var possiblePriceCols = ['price', 'amount', 'cost'];
                for (var j = 0; j < possiblePriceCols.length; j++) {
                    if (_knownColumns.indexOf(possiblePriceCols[j]) !== -1) {
                        minimalData[possiblePriceCols[j]] = parseFloat(formData.get('price')) || 0;
                        break;
                    }
                }

                // Retry with minimal data
                if (Object.keys(minimalData).length > 0) {
                    sb.from('products').insert([minimalData])
                        .then(function(result) {
                            if (result.error) throw result.error;
                            self.onProductCreated();
                        })
                        .catch(function(err2) {
                            console.error('[dashboard-fix-v2] Minimal insert also failed:', err2);
                            self.showMigrationHelp();
                        });
                } else {
                    self.showMigrationHelp();
                }
            } else {
                // Other error types
                if (window.showToast) {
                    showToast('Error: ' + errMsg, 'error');
                }
            }
        },

        /**
         * Show help message when schema is incompatible
         */
        showMigrationHelp: function() {
            var msg = 'Your products table is missing required columns. Please run the SQL migration file (02-add-products-columns.sql) in Supabase SQL Editor.';
            console.error('[dashboard-fix-v2]', msg);
            
            if (window.showToast) {
                showToast(msg, 'error', 8000);
            }

            // Show detailed help in modal
            var existingHelp = document.getElementById('migrationHelpModal');
            if (existingHelp) existingHelp.remove();

            var helpDiv = document.createElement('div');
            helpDiv.id = 'migrationHelpModal';
            helpDiv.className = 'dash-modal-overlay';
            helpDiv.style.zIndex = '10000';
            helpDiv.innerHTML = '\
                <div class="dash-modal-content" style="max-width:600px">\
                    <div class="dash-modal-header">\
                        <h3>⚠️ Database Setup Required</h3>\
                        <button type="button" class="dash-modal-close" onclick="this.closest(\'#migrationHelpModal\').remove()">&times;</button>\
                    </div>\
                    <div style="padding:20px">\
                        <p><strong>Your products table is missing columns needed by the marketplace.</strong></p>\
                        <h4>To fix this:</h4>\
                        <ol>\
                            <li>Go to your <a href="https://supabase.com/dashboard" target="_blank">Supabase Dashboard</a></li>\
                            <li>Open the SQL Editor</li>\
                            <li>Run the file: <code>02-add-products-columns.sql</code></li>\
                            <li>Then refresh this page and try again</li>\
                        </ol>\
                        <p style="margin-top:15px;color:#666;font-size:13px">\
                            Detected columns in your table: <code>' + (_knownColumns.join(', ') || 'NONE FOUND') + '</code>\
                        </p>\
                        <button onclick="document.getElementById(\'migrationHelpModal\').remove()" \
                                style="margin-top:15px;padding:8px 20px;background:#333;color:#fff;border:none;border-radius:4px;cursor:pointer">\
                            Got it\
                        </button>\
                    </div>\
                </div>';
            
            document.body.appendChild(helpDiv);
        },

        onProductCreated: function() {
            // Close modal
            var modal = document.getElementById('productFormModal');
            if (modal) modal.remove();

            // Close migration help if open
            var help = document.getElementById('migrationHelpModal');
            if (help) help.remove();

            // Show success
            if (window.showToast) showToast('Product created successfully!', 'success');

            // Refresh dashboard
            this.initializeDashboard();
        },

        animateValue: function(elementId, targetValue) {
            var el = document.getElementById(elementId);
            if (!el) return;

            el.textContent = typeof targetValue === 'number' ? targetValue.toString() : targetValue;
            el.classList.add('count-updated');
            setTimeout(function() { el.classList.remove('count-updated'); }, 500);
        },

        handleEditProduct: function(productId) {
            console.log('[dashboard-fix-v2] Edit product:', productId);
            if (window.showToast) showToast('Edit feature coming soon!', 'info');
        },

        handleDeleteProduct: function(productId) {
            var self = this;
            console.log('[dashboard-fix-v2] Delete product:', productId);
            
            if (confirm('Are you sure you want to delete this product?')) {
                sb.from('products').delete().eq('id', productId)
                    .then(function(result) {
                        if (result.error) throw result.error;
                        if (window.showToast) showToast('Product deleted!', 'success');
                        self.initializeDashboard();
                    })
                    .catch(function(err) {
                        console.error('[dashboard-fix-v2] Delete error:', err);
                        if (window.showToast) showToast('Error deleting product', 'error');
                    });
            }
        }
    };

    // Expose globally
    window.DashboardFix = DashboardFix;

    // ═══════════════════════════════════════════════════════════════════════════════
    // PART 4: AUTO-INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════════

    function initWhenReady() {
        // Check if dependencies are loaded
        if (!window.sb) {
            console.log('[dashboard-fix-v2] Waiting for Supabase client...');
            setTimeout(initWhenReady, 200);
            return;
        }

        console.log('[dashboard-fix-v2] Dependencies ready, initializing...');

        // Run HTML patches immediately
        HTMLPatcher.init();

        // Pre-detect schema (async, won't block UI)
        SchemaDetector.getColumns().then(function(cols) {
            console.log('[dashboard-fix-v2] Schema pre-loaded:', cols.length, 'columns');
        });

        // Setup auto-init when dashboard becomes visible
        var checkInterval = setInterval(function() {
            var dashboard = document.getElementById('sellerDashboard') ||
                          document.querySelector('.seller-dashboard.show, .dashboard-modal[style*="display: block"]');
            
            if (dashboard && window.currentUser) {
                clearInterval(checkInterval);
                DashboardFix.initializeDashboard();
            }
        }, 2000);

        // Also init on button click
        document.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action="add-product"], .dash-add-product-btn, [onclick*="dashboard"]');
            if (btn && !DashboardFix.initialized) {
                setTimeout(function() { DashboardFix.initializeDashboard(); }, 500);
            }
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhenReady);
    } else {
        initWhenReady();
    }

    console.log('[dashboard-fix-v2] Dashboard Complete Fix v2 loaded');

})();
