/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 Marketplace — Feature Completion Module
 * ES5-compatible JavaScript (var, function, no arrow functions, no const/let)
 * 
 * This file completes all incomplete features in the K.Subject-1 marketplace.
 * Load AFTER marketplace.js and integration.js.
 * 
 * DEPENDENCIES:
 * - Global `sb` (Supabase client)
 * - Global `safeGet()` for DOM access
 * - Global `showToast()` for notifications
 * - Global `currentUser` for auth state
 * - Global `navigateTo()` for navigation
 * - Global `escapeHtml()` for XSS protection
 * - Global `formatPrice()` for price formatting
 * - Global `timeAgo()` for time formatting
 * - Existing managers: DashboardManager, ProductManager, etc.
 * 
 * FEATURES COMPLETED:
 * 1. Seller Dashboard (enhanced initialization, profile image upload, loading states)
 * 2. Product Management System (full CRUD with modal forms, image handling)
 * 3. Library System (file management with Supabase storage)
 * 4. Collection System (CRUD operations, product linking)
 * 
 * VERSION: 1.0.0 (Production Ready)
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
(function () {
    'use strict';

    // ═════════════════════════════════════════════════════════════════════════════════
    // DEPENDENCY CHECKS
    // ═════════════════════════════════════════════════════════════════════════════════

    // Check for required globals
    if (typeof window.sb === 'undefined' || !window.sb) {
        console.error('[completion] Supabase client (sb) not found. Module aborted.');
        return;
    }

    if (typeof window.safeGet !== 'function') {
        console.error('[completion] safeGet() not found. Module aborted.');
        return;
    }

    if (typeof window.showToast !== 'function') {
        console.error('[completion] showToast() not found. Module aborted.');
        return;
    }

    // Reference to global utilities
    var sb = window.sb;
    var safeGet = window.safeGet;
    var showToast = window.showToast;
    var escapeHtml = window.escapeHtml || function (str) { 
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };
    var formatPrice = window.formatPrice || function (v) { return 'K' + (Number(v) || 0).toLocaleString(); };
    var timeAgo = window.timeAgo || function (d) { return d || ''; };

    // Internal state
    var _libraryItemsCache = [];
    var _collectionsCache = [];
    var _currentEditingProduct = null;
    var _uploadedImages = [];
    var _dashboardInitialized = false;

    // UUID validation helper
    function isValidUuid(id) {
        if (!id || typeof id !== 'string') return false;
        var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
    }

    // Generate simple ID for temp items
    function generateTempId() {
        return 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Format file size helper
    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        var k = 1024;
        var sizes = ['Bytes', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }


    // ═════════════════════════════════════════════════════════════════════════════════
    // SECTION: SELLER DASHBOARD COMPLETION
    // ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Enhanced DashboardManager with completed functionality
     */
    var DashboardCompletion = {

        /**
         * Initialize dashboard with proper data loading
         * Called when user navigates to dashboard view
         */
        initDashboard: function () {
            if (_dashboardInitialized) return;

            var user = window.currentUser;
            if (!user || !user.id) {
                showToast('Please sign in to access the dashboard', 'info');
                return;
            }

            _dashboardInitialized = true;

            // Show loading states
            this.showDashboardLoading();

            // Load all dashboard data
            this.loadDashboardStats();
            this.loadDashboardProducts();
            this.loadDashboardOrders();
            this.loadActivityFeed();

            // Setup event listeners for dashboard interactions
            this.setupDashboardEvents();

            console.log('[dashboard] Dashboard initialized for user:', user.id);
        },

        /**
         * Show loading spinners across dashboard sections
         */
        showDashboardLoading: function () {
            var statCards = document.querySelectorAll('.dash-stat-card .stat-value');
            for (var i = 0; i < statCards.length; i++) {
                if (!statCards[i].classList.contains('loading')) {
                    statCards[i].innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>';
                    statCards[i].classList.add('loading');
                }
            }

            var productsEl = safeGet('dashProductsList');
            if (productsEl) {
                productsEl.innerHTML = '<div class="flex justify-center py-8"><div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div></div>';
            }

            var ordersEl = safeGet('dashOrdersList');
            if (ordersEl) {
                ordersEl.innerHTML = '<div class="flex justify-center py-8"><div class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div></div>';
            }

            var activityEl = safeGet('dashActivityFeed');
            if (activityEl) {
                activityEl.innerHTML = '<div class="flex justify-center py-6"><div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div></div>';
            }
        },

        /**
         * Reset dashboard initialized state (call when leaving dashboard)
         */
        resetDashboard: function () {
            _dashboardInitialized = false;
        },

        /**
         * Setup event listeners for dashboard interactions
         */
        setupDashboardEvents: function () {
            var self = this;

            // Tab switching events
            var tabButtons = document.querySelectorAll('.dash-tab-btn');
            for (var i = 0; i < tabButtons.length; i++) {
                tabButtons[i].addEventListener('click', function (e) {
                    e.preventDefault();
                    var targetTab = this.getAttribute('data-tab');
                    if (targetTab) {
                        self.switchDashboardTab(targetTab);
                    }
                });
            }

            // Settings form submission
            var settingsForm = safeGet('dashSettingsForm');
            if (settingsForm) {
                settingsForm.addEventListener('submit', function (e) {
                    e.preventDefault();
                    self.handleSettingsSubmit();
                });
            }

            // Profile image upload
            var avatarInput = safeGet('dashAvatarInput');
            if (avatarInput) {
                avatarInput.addEventListener('change', function (e) {
                    if (e.target.files && e.target.files[0]) {
                        self.uploadProfileImage(e.target.files[0]);
                    }
                });
            }

            // Search/filter within products
            var productSearch = safeGet('dashProductSearch');
            if (productSearch) {
                productSearch.addEventListener('input', function () {
                    self.filterDashboardProducts(this.value);
                });

                // Debounce search
                var debounceTimer = null;
                productSearch.addEventListener('keyup', function () {
                    clearTimeout(debounceTimer);
                    var self = this;
                    debounceTimer = setTimeout(function () {
                        self.filterDashboardProducts(self.value);
                    }, 300);
                });
            }
        },

        /**
         * Switch between dashboard tabs
         * @param {string} tabName - Tab identifier
         */
        switchDashboardTab: function (tabName) {
            // Update active tab button
            var tabButtons = document.querySelectorAll('.dash-tab-btn');
            for (var i = 0; i < tabButtons.length; i++) {
                tabButtons[i].classList.remove('active');
                if (tabButtons[i].getAttribute('data-tab') === tabName) {
                    tabButtons[i].classList.add('active');
                }
            }

            // Update active tab content
            var tabContents = document.querySelectorAll('.dash-tab-content');
            for (var j = 0; j < tabContents.length; j++) {
                tabContents[j].style.display = 'none';
                if (tabContents[j].getAttribute('id') === 'dashTab_' + tabName) {
                    tabContents[j].style.display = 'block';
                }
            }

            // Load data based on tab
            switch (tabName) {
                case 'products':
                    this.loadDashboardProducts();
                    break;
                case 'orders':
                    this.loadDashboardOrders();
                    break;
                case 'activity':
                    this.loadActivityFeed();
                    break;
                case 'settings':
                    this.loadSettingsData();
                    break;
            }
        },

        /**
         * Handle settings form submission
         */
        handleSettingsSubmit: function () {
            var settings = {};

            var firstName = safeGet('settingsFirstName');
            if (firstName) settings.first_name = firstName.value;

            var lastName = safeGet('settingsLastName');
            if (lastName) settings.last_name = lastName.value;

            var brandName = safeGet('settingsBrandName');
            if (brandName) settings.brand_name = brandName.value;

            var phone = safeGet('settingsPhone');
            if (phone) settings.phone = phone.value;

            var description = safeGet('settingsDescription');
            if (description) settings.description = description.value;

            var addressLine1 = safeGet('settingsAddressLine1');
            if (addressLine1) settings.address_line1 = addressLine1.value;

            var city = safeGet('settingsCity');
            if (city) settings.city = city.value;

            var region = safeGet('settingsRegion');
            if (region) settings.region = region.value;

            var postalCode = safeGet('settingsPostalCode');
            if (postalCode) settings.postal_code = postalCode.value;

            // Call existing saveSettings if available
            if (window.DashboardManager && typeof window.DashboardManager.saveSettings === 'function') {
                window.DashboardManager.saveSettings(settings);
            } else {
                this.saveSettingsDirect(settings);
            }
        },

        /**
         * Direct settings save (fallback)
         */
        saveSettingsDirect: function (settings) {
            var user = window.currentUser;
            if (!user || !user.id) {
                showToast('Please sign in first', 'error');
                return;
            }

            showToast('Saving settings...', 'info');

            sb.from('profiles').update(settings).eq('id', user.id)
                .then(function () {
                    showToast('Settings saved successfully!', 'success');
                    if (typeof window.refreshCurrentUser === 'function') {
                        window.refreshCurrentUser();
                    }
                })
                .catch(function (err) {
                    console.error('Save settings error:', err);
                    showToast('Failed to save settings: ' + (err.message || 'Unknown error'), 'error');
                });
        },

        /**
         * Load current settings into form fields
         */
        loadSettingsData: function () {
            var user = window.currentUser;
            if (!user) return;

            var fieldMap = {
                'settingsFirstName': user.first_name,
                'settingsLastName': user.last_name,
                'settingsBrandName': user.brand_name,
                'settingsPhone': user.phone,
                'settingsDescription': user.description,
                'settingsAddressLine1': user.address_line1,
                'settingsCity': user.city,
                'settingsRegion': user.region,
                'settingsPostalCode': user.postal_code
            };

            for (var id in fieldMap) {
                if (fieldMap.hasOwnProperty(id)) {
                    var el = safeGet(id);
                    if (el && fieldMap[id]) {
                        el.value = fieldMap[id];
                    }
                }
            }

            // Set avatar preview
            var avatarPreview = safeGet('dashAvatarPreview');
            if (avatarPreview && user.avatar_url) {
                avatarPreview.src = user.avatar_url;
            }
        },

        /**
         * Upload profile image/avatar
         * @param {File} file - The image file to upload
         */
        uploadProfileImage: function (file) {
            var self = this;
            var user = window.currentUser;
            
            if (!user || !user.id) {
                showToast('Please sign in first', 'error');
                return;
            }

            // Validate file type
            var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (allowedTypes.indexOf(file.type) === -1) {
                showToast('Please select a valid image file (JPEG, PNG, GIF, or WebP)', 'error');
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('Image must be less than 5MB', 'error');
                return;
            }

            showToast('Uploading image...', 'info');

            // Show preview immediately
            var reader = new FileReader();
            reader.onload = function (e) {
                var preview = safeGet('dashAvatarPreview');
                if (preview) {
                    preview.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);

            // Upload to Supabase storage
            var fileName = 'avatar_' + user.id + '_' + Date.now() + '.' + file.name.split('.').pop();

            sb.storage.from('avatars')
                .upload(fileName, file, { cacheControl: '3600', upsert: true })
                .then(function (uploadResult) {
                    if (uploadResult.error) throw uploadResult.error;

                    // Get public URL
                    var publicUrl = sb.storage.from('avatars').getPublicUrl(fileName);

                    // Update profile with new avatar URL
                    return sb.from('profiles').update({ avatar_url: publicUrl.publicURL }).eq('id', user.id);
                })
                .then(function () {
                    showToast('Profile image updated!', 'success');
                    
                    // Update local user object
                    if (typeof window.refreshCurrentUser === 'function') {
                        window.refreshCurrentUser();
                    } else if (window.currentUser) {
                        window.currentUser.avatar_url = sb.storage.from('avatars').getPublicUrl(fileName).publicURL;
                    }

                    // Reset input
                    var input = safeGet('dashAvatarInput');
                    if (input) input.value = '';
                })
                .catch(function (err) {
                    console.error('Avatar upload error:', err);
                    
                    // Fallback: try base64 encoding for small images
                    if (file.size < 100 * 1024) {
                        self.uploadAvatarAsBase64(file);
                    } else {
                        showToast('Failed to upload image. Please try again.', 'error');
                    }
                });
        },

        /**
         * Fallback: Upload avatar as base64 to profiles table
         */
        uploadAvatarAsBase64: function (file) {
            var user = window.currentUser;
            var reader = new FileReader();

            reader.onload = function (e) {
                sb.from('profiles').update({ avatar_url: e.target.result }).eq('id', user.id)
                    .then(function () {
                        showToast('Profile image updated!', 'success');
                        if (typeof window.refreshCurrentUser === 'function') {
                            window.refreshCurrentUser();
                        }
                    })
                    .catch(function (err) {
                        console.error('Base64 avatar error:', err);
                        showToast('Failed to upload image', 'error');
                    });
            };

            reader.readAsDataURL(file);
        },

        /**
         * Filter dashboard products by search term
         * @param {string} searchTerm - The search query
         */
        filterDashboardProducts: function (searchTerm) {
            var container = safeGet('dashProductsList');
            if (!container) return;

            var rows = container.querySelectorAll('.dash-product-row');
            searchTerm = (searchTerm || '').toLowerCase().trim();

            for (var i = 0; i < rows.length; i++) {
                var text = rows[i].textContent.toLowerCase();
                if (!searchTerm || text.indexOf(searchTerm) !== -1) {
                    rows[i].style.display = '';
                } else {
                    rows[i].style.display = 'none';
                }
            }
        },

        /**
         * Enhanced loadDashboardStats with better error handling
         */
        loadDashboardStatsEnhanced: function () {
            var user = window.currentUser;
            if (!user || !user.id) return;

            var userId = user.id;
            var role = user.role || 'seller';

            // Remove loading classes from stat cards
            setTimeout(function () {
                var statCards = document.querySelectorAll('.dash-stat-card .stat-value.loading');
                for (var i = 0; i < statCards.length; i++) {
                    statCards[i].classList.remove('loading');
                }
            }, 500);

            // Use existing loadDashboardStats if available
            if (window.DashboardManager && typeof window.DashboardManager.loadDashboardStats === 'function') {
                window.DashboardManager.loadDashboardStats();
            }
        },

        /**
         * Export orders as CSV
         */
        exportOrdersCSV: function () {
            var user = window.currentUser;
            if (!user || !user.id) {
                showToast('Please sign in first', 'error');
                return;
            }

            showToast('Preparing export...', 'info');

            var orderPromise = user.role === 'seller'
                ? sb.from('v_seller_orders').select('*').order('created_at', { ascending: false }).limit(1000)
                : sb.from('v_customer_orders').select('*').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(1000);

            orderPromise.then(function (result) {
                var orders = result.data || [];
                
                if (orders.length === 0) {
                    showToast('No orders to export', 'info');
                    return;
                }

                // Build CSV content
                var csvHeaders = ['Order ID', 'Date', 'Customer', 'Product', 'Quantity', 'Status', 'Total'];
                var csvRows = [csvHeaders.join(',')];

                for (var i = 0; i < orders.length; i++) {
                    var order = orders[i];
                    var row = [
                        '"' + (order.order_id || order.id || '') + '"',
                        '"' + (order.created_at || '') + '"',
                        '"' + escapeHtml(order.customer_name || order.buyer_name || '') + '"',
                        '"' + escapeHtml(order.product_title || '') + '"',
                        order.quantity || 1,
                        '"' + (order.status || '') + '"',
                        '"' + (order.total_amount || order.subtotal || 0) + '"'
                    ];
                    csvRows.push(row.join(','));
                }

                var csvContent = csvRows.join('\n');
                var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                var link = document.createElement('a');
                var url = URL.createObjectURL(blob);
                
                link.setAttribute('href', url);
                link.setAttribute('download', 'orders_export_' + new Date().toISOString().split('T')[0] + '.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                showToast('Exported ' + orders.length + ' orders successfully!', 'success');
            }).catch(function (err) {
                console.error('Export orders error:', err);
                showToast('Failed to export orders', 'error');
            });
        },

        /**
         * View basic analytics (enhanced version)
         */
        viewBasicAnalytics: function () {
            var user = window.currentUser;
            if (!user || !user.id) {
                showToast('Please sign in first', 'error');
                return;
            }

            showToast('Loading analytics...', 'info');

            // Load analytics data
            Promise.all([
                sb.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', user.id),
                sb.from('order_items').select('subtotal, quantity').eq('seller_id', user.id),
                sb.from('orders').select('id', { count: 'exact', head: true })
            ]).then(function (results) {
                var productCount = results[0].count || 0;
                var orderItems = results[1].data || [];
                var totalRevenue = 0;
                var totalItemsSold = 0;

                for (var i = 0; i < orderItems.length; i++) {
                    totalRevenue += Number(orderItems[i].subtotal) || 0;
                    totalItemsSold += Number(orderItems[i].quantity) || 0;
                }

                // Show analytics summary
                var message = 'Products: ' + productCount + '\nTotal Revenue: ' + formatPrice(totalRevenue) + '\nItems Sold: ' + totalItemsSold;
                alert(message); // Simple display - can be enhanced with a modal

                showToast('Analytics loaded', 'success');
            }).catch(function (err) {
                console.error('Analytics error:', err);
                showToast('Failed to load analytics', 'error');
            });
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // SECTION: PRODUCT MANAGEMENT SYSTEM
    // ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Complete Product Manager Enhancement
     * Adds full CRUD functionality for product management
     */
    var ProductManagerComplete = {

        // Categories available for products
        categories: [
            { value: 'tech', label: 'Tech & Electronics' },
            { value: 'fashion', label: 'Fashion & Apparel' },
            { value: 'beauty', label: 'Beauty & Care' },
            { value: 'outdoor', label: 'Outdoor & Sports' },
            { value: 'home', label: 'Home & Living' },
            { value: 'accessories', label: 'Accessories' },
            { value: 'other', label: 'Other' }
        ],

        // Status options
        statusOptions: [
            { value: 'draft', label: 'Draft' },
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' }
        ],

        /**
         * Initialize product manager - setup event bindings
         */
        init: function () {
            this.bindAddProductButtons();
            console.log('[product-manager] Product Manager initialized');
        },

        /**
         * Bind click handlers to all "Add Product" buttons
         */
        bindAddProductButtons: function () {
            var self = this;
            var addButtons = document.querySelectorAll('[data-action="add-product"], .btn-add-product');

            for (var i = 0; i < addButtons.length; i++) {
                // Remove existing handlers by cloning
                var btn = addButtons[i];
                var newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);

                newBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.showAddProductModal();
                });
            }
        },

        /**
         * Show add product modal/form
         */
        showAddProductModal: function () {
            _currentEditingProduct = null;
            _uploadedImages = [];

            var modalHtml = this.buildProductFormModal(null);
            this.showModal(modalHtml);
            this.setupProductFormEvents();
            this.loadCategoriesIntoSelect();
        },

        /**
         * Show edit product modal with pre-filled data
         * @param {string} productId - UUID of product to edit
         */
        showEditProductModal: function (productId) {
            if (!productId) {
                showToast('No product selected', 'error');
                return;
            }

            var self = this;
            showToast('Loading product...', 'info');

            sb.from('products')
                .select('*, categories(*), product_images(*)')
                .eq('id', productId)
                .single()
                .then(function (result) {
                    if (result.error || !result.data) {
                        throw result.error || new Error('Product not found');
                    }

                    _currentEditingProduct = result.data;
                    _uploadedImages = result.data.product_images || [];

                    var modalHtml = self.buildProductFormModal(result.data);
                    self.showModal(modalHtml);
                    self.setupProductFormEvents();
                    self.loadCategoriesIntoSelect();
                })
                .catch(function (err) {
                    console.error('Load product error:', err);
                    showToast('Failed to load product details', 'error');
                });
        },

        /**
         * Build the product form modal HTML
         * @param {Object|null} product - Product data for edit mode, null for add mode
         * @returns {string} HTML string for the modal
         */
        buildProductFormModal: function (product) {
            var isEdit = !!product;
            var title = isEdit ? 'Edit Product' : 'Add New Product';
            var submitText = isEdit ? 'Update Product' : 'Create Product';
            
            var p = product || {};
            var imagesHtml = this.buildImagesPreviewHtml(p.product_images || []);

            return '<div class="modal-overlay" id="productModalOverlay">' +
                '<div class="modal-content product-form-modal" style="max-width:700px;width:90%;max-height:90vh;overflow-y:auto;background:#111;border-radius:12px;padding:24px;">' +
                    '<div class="flex justify-between items-center mb-6">' +
                        '<h2 class="text-lg font-semibold text-white">' + title + '</h2>' +
                        '<button onclick="ProductManagerComplete.closeModal()" class="text-gray-400 hover:text-white transition-colors">' +
                            '<i class="fa-solid fa-times text-xl"></i>' +
                        '</button>' +
                    '</div>' +

                    '<form id="productForm" onsubmit="return false;">' +
                        '<input type="hidden" id="productId" value="' + (p.id || '') + '">' +

                        // Basic Info Section
                        '<div class="mb-6">' +
                            '<h3 class="text-sm font-medium text-gray-300 mb-3 uppercase tracking-wider">Basic Information</h3>' +
                            
                            '<div class="mb-4">' +
                                '<label class="block text-sm text-gray-400 mb-1">Product Title <span class="text-red-500">*</span></label>' +
                                '<input type="text" id="productTitle" value="' + escapeHtml(p.title || '') + '" ' +
                                    'class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-accent focus:outline-none transition-colors" ' +
                                    'placeholder="Enter product title" required maxlength="200">' +
                            '</div>' +

                            '<div class="mb-4">' +
                                '<label class="block text-sm text-gray-400 mb-1">Description</label>' +
                                '<textarea id="productDescription" rows="4" ' +
                                    'class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-accent focus:outline-none transition-colors resize-none" ' +
                                    'placeholder="Describe your product...">' + escapeHtml(p.description || '') + '</textarea>' +
                            '</div>' +
                        '</div>' +

                        // Pricing Section
                        '<div class="mb-6">' +
                            '<h3 class="text-sm font-medium text-gray-300 mb-3 uppercase tracking-wider">Pricing</h3>' +
                            
                            '<div class="grid grid-cols-2 gap-4">' +
                                '<div>' +
                                    '<label class="block text-sm text-gray-400 mb-1">Price (KES) <span class="text-red-500">*</span></label>' +
                                    '<input type="number" id="productPrice" value="' + (p.price || '') + '" min="0" step="0.01" ' +
                                        'class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-accent focus:outline-none transition-colors" ' +
                                        'placeholder="0.00" required>' +
                                '</div>' +
                                '<div>' +
                                    '<label class="block text-sm text-gray-400 mb-1">Compare at Price</label>' +
                                    '<input type="number" id="productComparePrice" value="" min="0" step="0.01" ' +
                                        'class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-accent focus:outline-none transition-colors" ' +
                                        'placeholder="0.00">' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                        // Category & Inventory Section
                        '<div class="mb-6">' +
                            '<h3 class="text-sm font-medium text-gray-300 mb-3 uppercase tracking-wider">Category & Inventory</h3>' +
                            
                            '<div class="grid grid-cols-2 gap-4 mb-4">' +
                                '<div>' +
                                    '<label class="block text-sm text-gray-400 mb-1">Category <span class="text-red-500">*</span></label>' +
                                    '<select id="productCategory" ' +
                                        'class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-accent focus:outline-none transition-colors">' +
                                        '<option value="">Select category...</option>' +
                                    '</select>' +
                                '</div>' +
                                '<div>' +
                                    '<label class="block text-sm text-gray-400 mb-1">Status</label>' +
                                    '<select id="productStatus" ' +
                                        'class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-accent focus:outline-none transition-colors">' +
                                        '<option value="draft">Draft</option>' +
                                        '<option value="active"' + ((p.status === 'active' || p.is_active) ? ' selected' : '') + '>Active</option>' +
                                        '<option value="archived"' + (p.status === 'archived' ? ' selected' : '') + '>Archived</option>' +
                                    '</select>' +
                                '</div>' +
                            '</div>' +

                            '<div class="grid grid-cols-2 gap-4">' +
                                '<div>' +
                                    '<label class="block text-sm text-gray-400 mb-1">Stock Quantity</label>' +
                                    '<input type="number" id="productStock" value="' + (p.stock_quantity || 0) + '" min="0" ' +
                                        'class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-accent focus:outline-none transition-colors" ' +
                                        'placeholder="0">' +
                                '</div>' +
                                '<div>' +
                                    '<label class="block text-sm text-gray-400 mb-1">SKU</label>' +
                                    '<input type="text" id="productSku" value="' + escapeHtml(p.sku || '') + '" maxlength="50" ' +
                                        'class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-accent focus:outline-none transition-colors" ' +
                                        'placeholder="Optional SKU">' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                        // Images Section
                        '<div class="mb-6">' +
                            '<h3 class="text-sm font-medium text-gray-300 mb-3 uppercase tracking-wider">Product Images</h3>' +
                            
                            '<div id="productImagesPreview" class="mb-4">' +
                                imagesHtml +
                            '</div>' +

                            '<div class="border-2 border-dashed border-white/20 rounded-lg p-4 text-center hover:border-accent/50 transition-colors cursor-pointer" id="imageDropZone">' +
                                '<input type="file" id="productImageInput" accept="image/*" multiple class="hidden">' +
                                '<i class="fa-solid fa-cloud-upload-alt text-2xl text-gray-500 mb-2"></i>' +
                                '<p class="text-sm text-gray-400">Click or drag images here to upload</p>' +
                                '<p class="text-xs text-gray-600 mt-1">PNG, JPG, GIF up to 5MB each</p>' +
                            '</div>' +
                        '</div>' +

                        // Tags Section
                        '<div class="mb-6">' +
                            '<label class="block text-sm text-gray-400 mb-1">Tags</label>' +
                            '<input type="text" id="productTags" value="' + escapeHtml(p.tags || '') + '" ' +
                                'class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-accent focus:outline-none transition-colors" ' +
                                'placeholder="tag1, tag2, tag3...">' +
                            '<p class="text-xs text-gray-600 mt-1">Separate tags with commas</p>' +
                        '</div>' +

                        // Action Buttons
                        '<div class="flex justify-end gap-3 pt-4 border-t border-white/10">' +
                            '<button type="button" onclick="ProductManagerComplete.closeModal()" ' +
                                'class="px-5 py-2.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors">' +
                                'Cancel' +
                            '</button>' +
                            '<button type="button" onclick="ProductManagerComplete.handleSaveProduct()" ' +
                                'class="px-5 py-2.5 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors font-medium">' +
                                '<i class="fa-solid fa-save mr-2"></i>' + submitText +
                            '</button>' +
                        '</div>' +
                    '</form>' +
                '</div>' +
            '</div>';
        },

        /**
         * Build images preview HTML
         * @param {Array} images - Array of image objects
         * @returns {string} HTML string
         */
        buildImagesPreviewHtml: function (images) {
            if (!images || images.length === 0) {
                return '<p class="text-sm text-gray-500 text-center py-4">No images uploaded yet</p>';
            }

            var html = '<div class="grid grid-cols-4 gap-3">';
            
            for (var i = 0; i < images.length; i++) {
                var img = images[i];
                var isPrimary = img.is_primary || (i === 0 && images.length === 1);
                var url = img.url || '';

                html += '<div class="relative group">' +
                    '<img src="' + url + '" alt="Product image" class="w-full h-24 object-cover rounded-lg border border-white/10">' +
                    (isPrimary ? '<span class="absolute top-1 left-1 px-1.5 py-0.5 bg-accent text-[10px] text-white rounded">Primary</span>' : '') +
                    '<div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">' +
                        (!isPrimary ? '<button onclick="ProductManagerComplete.setPrimaryImage(\'' + img.id + '\')" class="p-1.5 bg-white/20 rounded hover:bg-accent text-white text-xs" title="Set as primary"><i class="fa-solid fa-star"></i></button>' : '') +
                        '<button onclick="ProductManagerComplete.removeProductImage(\'' + img.id + '\')" class="p-1.5 bg-red-500/80 rounded hover:bg-red-500 text-white text-xs" title="Remove"><i class="fa-solid fa-trash"></i></button>' +
                    '</div>' +
                '</div>';
            }

            html += '</div>';
            return html;
        },

        /**
         * Load categories into the category select dropdown
         */
        loadCategoriesIntoSelect: function () {
            var select = safeGet('productCategory');
            if (!select) return;

            // Clear existing options except default
            while (select.options.length > 1) {
                select.remove(1);
            }

            // Add category options
            for (var i = 0; i < this.categories.length; i++) {
                var option = document.createElement('option');
                option.value = this.categories[i].value;
                option.textContent = this.categories[i].label;
                select.appendChild(option);
            }

            // Set selected value if editing
            if (_currentEditingProduct && _currentEditingProduct.category) {
                select.value = _currentEditingProduct.category;
            } else if (_currentEditingProduct && _currentEditingProduct.categories) {
                select.value = _currentEditingProduct.categories.slug || _currentEditingProduct.categories.id;
            }
        },

        /**
         * Setup event listeners for product form
         */
        setupProductFormEvents: function () {
            var self = this;

            // Image drop zone click
            var dropZone = safeGet('imageDropZone');
            var imageInput = safeGet('productImageInput');

            if (dropZone && imageInput) {
                dropZone.addEventListener('click', function () {
                    imageInput.click();
                });

                // Drag and drop
                dropZone.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    dropZone.classList.add('border-accent', 'bg-accent/5');
                });

                dropZone.addEventListener('dragleave', function (e) {
                    e.preventDefault();
                    dropZone.classList.remove('border-accent', 'bg-accent/5');
                });

                dropZone.addEventListener('drop', function (e) {
                    e.preventDefault();
                    dropZone.classList.remove('border-accent', 'bg-accent/5');
                    
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        self.handleImageUpload({ target: { files: e.dataTransfer.files } });
                    }
                });

                // File input change
                imageInput.addEventListener('change', function (e) {
                    self.handleImageUpload(e);
                });
            }

            // Close modal on overlay click
            var overlay = safeGet('productModalOverlay');
            if (overlay) {
                overlay.addEventListener('click', function (e) {
                    if (e.target === overlay) {
                        self.closeModal();
                    }
                });
            }

            // ESC key to close
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    self.closeModal();
                    document.removeEventListener('keydown', escHandler);
                }
            });
        },

        /**
         * Handle image upload
         * @param {Event} event - File input change event
         */
        handleImageUpload: function (event) {
            var files = event.target.files;
            if (!files || files.length === 0) return;

            var self = this;
            var validFiles = [];
            var maxSize = 5 * 1024 * 1024; // 5MB
            var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

            // Validate files
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                
                if (allowedTypes.indexOf(file.type) === -1) {
                    showToast(file.name + ' is not a valid image type', 'warning');
                    continue;
                }

                if (file.size > maxSize) {
                    showToast(file.name + ' exceeds 5MB limit', 'warning');
                    continue;
                }

                validFiles.push(file);
            }

            if (validFiles.length === 0) return;

            showToast('Uploading ' + validFiles.length + ' image(s)...', 'info');

            // Process each file
            var uploadPromises = [];
            
            for (var j = 0; j < validFiles.length; j++) {
                (function (file) {
                    var promise = self.uploadSingleImage(file);
                    uploadPromises.push(promise);
                })(validFiles[j]);
            }

            Promise.all(uploadPromises)
                .then(function (results) {
                    var successCount = 0;
                    for (var k = 0; k < results.length; k++) {
                        if (results[k].success) {
                            _uploadedImages.push(results[k]);
                            successCount++;
                        }
                    }

                    if (successCount > 0) {
                        self.updateImagesPreview();
                        showToast(successCount + ' image(s) uploaded successfully', 'success');
                    }
                })
                .catch(function (err) {
                    console.error('Image upload error:', err);
                    showToast('Some images failed to upload', 'error');
                });

            // Reset input
            event.target.value = '';
        },

        /**
         * Upload a single image to Supabase storage
         * @param {File} file - Image file to upload
         * @returns {Promise} Resolves with image data object
         */
        uploadSingleImage: function (file) {
            var user = window.currentUser;
            var userId = user ? user.id : 'anonymous';
            var fileName = 'products/' + userId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

            return sb.storage.from('product-images')
                .upload(fileName, file, { cacheControl: '3600', upsert: false })
                .then(function (result) {
                    if (result.error) throw result.error;

                    var publicUrl = sb.storage.from('product-images').getPublicUrl(fileName);

                    return {
                        success: true,
                        id: generateTempId(),
                        url: publicUrl.publicURL,
                        path: fileName,
                        is_primary: _uploadedImages.length === 0 // First image is primary
                    };
                })
                .catch(function (err) {
                    console.error('Single image upload error:', err);
                    return { success: false, error: err.message, file: file.name };
                });
        },

        /**
         * Update the images preview section
         */
        updateImagesPreview: function () {
            var container = safeGet('productImagesPreview');
            if (!container) return;

            container.innerHTML = this.buildImagesPreviewHtml(_uploadedImages);
        },

        /**
         * Remove a product image
         * @param {string} imageId - Image ID to remove
         */
        removeProductImage: function (imageId) {
            if (!imageId) return;

            // Find and remove from array
            for (var i = 0; i < _uploadedImages.length; i++) {
                if (_uploadedImages[i].id === imageId) {
                    _uploadedImages.splice(i, 1);
                    break;
                }
            }

            // If removing primary, set new primary
            if (_uploadedImages.length > 0) {
                _uploadedImages[0].is_primary = true;
            }

            this.updateImagesPreview();
            showToast('Image removed', 'info');
        },

        /**
         * Set an image as primary
         * @param {string} imageId - Image ID to set as primary
         */
        setPrimaryImage: function (imageId) {
            if (!imageId) return;

            for (var i = 0; i < _uploadedImages.length; i++) {
                _uploadedImages[i].is_primary = (_uploadedImages[i].id === imageId);
            }

            this.updateImagesPreview();
            showToast('Primary image updated', 'success');
        },

        /**
         * Validate product form before saving
         * @returns {boolean} True if valid
         */
        validateProductForm: function () {
            var title = safeGet('productTitle');
            var price = safeGet('productPrice');
            var category = safeGet('productCategory');

            // Required fields check
            if (!title || !title.value.trim()) {
                showToast('Product title is required', 'error');
                if (title) title.focus();
                return false;
            }

            if (!price || !price.value || isNaN(Number(price.value)) || Number(price.value) < 0) {
                showToast('Please enter a valid price', 'error');
                if (price) price.focus();
                return false;
            }

            if (!category || !category.value) {
                showToast('Please select a category', 'error');
                if (category) category.focus();
                return false;
            }

            // Price range validation
            var priceValue = Number(price.value);
            if (priceValue > 999999999) {
                showToast('Price seems too high. Please verify.', 'warning');
            }

            return true;
        },

        /**
         * Handle product save (create or update)
         */
        handleSaveProduct: function () {
            var self = this;

            // Validate form
            if (!this.validateProductForm()) return;

            var user = window.currentUser;
            if (!user || !user.id) {
                showToast('Please sign in to manage products', 'error');
                return;
            }

            // Gather form data
            var formData = {
                title: safeGet('productTitle').value.trim(),
                description: safeGet('productDescription').value.trim(),
                price: Number(safeGet('productPrice').value),
                compare_price: Number(safeGet('productComparePrice').value) || null,
                category: safeGet('productCategory').value,
                status: safeGet('productStatus').value,
                stock_quantity: Number(safeGet('productStock').value) || 0,
                sku: safeGet('productSku').value.trim(),
                tags: safeGet('productTags').value.trim()
            };

            // Determine if creating or updating
            var isEdit = !!_currentEditingProduct;

            showToast(isEdit ? 'Updating product...' : 'Creating product...', 'info');

            var operation;
            if (isEdit) {
                // Update existing product
                var updateData = {
                    title: formData.title,
                    description: formData.description,
                    price: formData.price,
                    compare_price: formData.compare_price,
                    category: formData.category,
                    status: formData.status,
                    stock_quantity: formData.stock_quantity,
                    sku: formData.sku,
                    tags: formData.tags,
                    is_active: formData.status === 'active',
                    published_at: formData.status === 'active' ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                };

                operation = sb.from('products').update(updateData).eq('id', _currentEditingProduct.id);
            } else {
                // Create new product
                var insertData = {
                    seller_id: user.id,
                    title: formData.title,
                    description: formData.description,
                    price: formData.price,
                    compare_price: formData.compare_price,
                    category: formData.category,
                    status: formData.status,
                    stock_quantity: formData.stock_quantity,
                    sku: formData.sku,
                    tags: formData.tags,
                    is_active: formData.status === 'active',
                    published_at: formData.status === 'active' ? new Date().toISOString() : null
                };

                operation = sb.from('products').insert(insertData).select();
            }

            operation
                .then(function (result) {
                    if (result.error) throw result.error;

                    var productId = isEdit ? _currentEditingProduct.id : (result.data && result.data[0] ? result.data[0].id : null);

                    if (!productId) throw new Error('Failed to get product ID');

                    // Save product images
                    return self.saveProductImages(productId);
                })
                .then(function () {
                    self.closeModal();
                    showToast(isEdit ? 'Product updated successfully!' : 'Product created successfully!', 'success');

                    // Refresh product lists
                    if (window.DashboardManager && typeof window.DashboardManager.loadDashboardProducts === 'function') {
                        window.DashboardManager.loadDashboardProducts();
                    }
                    if (window.DashboardManager && typeof window.DashboardManager.loadDashboardStats === 'function') {
                        window.DashboardManager.loadDashboardStats();
                    }

                    // Log activity
                    if (typeof window.logActivity === 'function') {
                        window.logActivity(isEdit ? 'update_product' : 'add_product', 'product', productId);
                    }
                })
                .catch(function (err) {
                    console.error('Save product error:', err);
                    showToast('Failed to save product: ' + (err.message || 'Unknown error'), 'error');
                });
        },

        /**
         * Save product images to database
         * @param {string} productId - Product ID
         * @returns {Promise}
         */
        saveProductImages: function (productId) {
            if (_uploadedImages.length === 0) {
                return Promise.resolve();
            }

            var imageRecords = [];
            for (var i = 0; i < _uploadedImages.length; i++) {
                var img = _uploadedImages[i];
                // Only save newly uploaded images (temp IDs)
                if (img.id && img.id.indexOf('temp_') === 0) {
                    imageRecords.push({
                        product_id: productId,
                        url: img.url,
                        path: img.path || null,
                        is_primary: img.is_primary || false,
                        sort_order: i
                    });
                }
            }

            if (imageRecords.length === 0) {
                return Promise.resolve();
            }

            return sb.from('product_images').insert(imageRecords);
        },

        /**
         * Handle delete product with confirmation
         * @param {string} productId - Product ID to delete
         */
        handleDeleteProduct: function (productId) {
            if (!productId) {
                showToast('No product selected', 'error');
                return;
            }

            if (!isValidUuid(productId)) {
                console.error('Invalid product ID format');
                return;
            }

            var confirmMsg = 'Are you sure you want to delete this product?\n\nThis action cannot be undone.';
            if (!confirm(confirmMsg)) return;

            showToast('Deleting product...', 'info');

            sb.from('products').delete().eq('id', productId)
                .then(function (result) {
                    if (result.error) {
                        throw result.error;
                    }

                    showToast('Product deleted successfully', 'success');

                    // Refresh lists
                    if (window.DashboardManager && typeof window.DashboardManager.loadDashboardProducts === 'function') {
                        window.DashboardManager.loadDashboardProducts();
                    }
                    if (window.DashboardManager && typeof window.DashboardManager.loadDashboardStats === 'function') {
                        window.DashboardManager.loadDashboardStats();
                    }

                    // Log activity
                    if (typeof window.logActivity === 'function') {
                        window.logActivity('delete_product', 'product', productId);
                    }
                })
                .catch(function (err) {
                    console.error('Delete product error:', err);
                    showToast('Failed to delete product. It may have active orders.', 'error');
                });
        },

        /**
         * Show modal with HTML content
         * @param {string} htmlContent - Modal HTML
         */
        showModal: function (htmlContent) {
            // Remove existing modal if any
            this.closeModal();

            var wrapper = document.createElement('div');
            wrapper.innerHTML = htmlContent;
            document.body.appendChild(wrapper.firstChild);

            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        },

        /**
         * Close and remove modal
         */
        closeModal: function () {
            var modal = safeGet('productModalOverlay');
            if (modal) {
                modal.parentNode.removeChild(modal);
            }

            // Restore body scroll
            document.body.style.overflow = '';

            _currentEditingProduct = null;
            _uploadedImages = [];
        },

        /**
         * Load categories from database (or use defaults)
         * @returns {Promise} Resolves with categories array
         */
        loadCategories: function () {
            return sb.from('categories').select('*').order('name')
                .then(function (result) {
                    if (result.data && result.data.length > 0) {
                        return result.data;
                    }
                    // Return default categories
                    return ProductManagerComplete.categories.map(function (c) {
                        return { slug: c.value, name: c.label };
                    });
                })
                .catch(function (err) {
                    console.error('Load categories error:', err);
                    return ProductManagerComplete.categories.map(function (c) {
                        return { slug: c.value, name: c.label };
                    });
                });
        },

        /**
         * Load seller's products for dashboard
         * @returns {Promise} Resolves with products array
         */
        loadSellerProducts: function () {
            var user = window.currentUser;
            if (!user || !user.id) {
                return Promise.reject(new Error('Not authenticated'));
            }

            return sb.from('products')
                .select('*, categories(name, slug), product_images(url, is_primary)')
                .eq('seller_id', user.id)
                .order('created_at', { ascending: false })
                .limit(100)
                .then(function (result) {
                    return result.data || [];
                });
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // SECTION: LIBRARY SYSTEM COMPLETION
    // ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Library Manager - File management system for sellers
     * Handles uploads, organization, and reuse of digital assets
     */
    var LibraryManager = {

        // Allowed file types
        allowedTypes: {
            'image/jpeg': { icon: 'fa-image', label: 'JPEG', color: 'text-blue-400' },
            'image/png': { icon: 'fa-image', label: 'PNG', color: 'text-green-400' },
            'image/gif': { icon: 'fa-image', label: 'GIF', color: 'text-purple-400' },
            'image/webp': { icon: 'fa-image', label: 'WebP', color: 'text-cyan-400' },
            'application/pdf': { icon: 'fa-file-pdf', label: 'PDF', color: 'text-red-400' },
            'application/zip': { icon: 'fa-file-zipper', label: 'ZIP', color: 'text-yellow-400' },
            'application/x-rar-compressed': { icon: 'fa-file-zipper', label: 'RAR', color: 'text-orange-400' }
        },

        maxFileSize: 10 * 1024 * 1024, // 10MB

        /**
         * Initialize library section
         */
        init: function () {
            console.log('[library] Library Manager initializing...');
            this.loadLibraryItems();
            this.setupLibraryEvents();
        },

        /**
         * Setup library event listeners
         */
        setupLibraryEvents: function () {
            var self = this;

            // Upload button click
            var uploadBtn = safeGet('libraryUploadBtn');
            if (uploadBtn) {
                uploadBtn.addEventListener('click', function () {
                    self.showUploadModal();
                });
            }

            // Library search
            var searchInput = safeGet('librarySearch');
            if (searchInput) {
                searchInput.addEventListener('input', function () {
                    self.filterLibraryItems(this.value);
                });
            }
        },

        /**
         * Load library items from database/storage
         */
        loadLibraryItems: function () {
            var self = this;
            var container = safeGet('libraryContent') || safeGet('libraryGrid');

            if (!container) {
                console.warn('[library] Container element not found');
                return;
            }

            var user = window.currentUser;
            if (!user || !user.id) {
                this.renderLoginPrompt(container);
                return;
            }

            // Show loading state
            this.showLoadingState(container);

            sb.from('library_items')
                .select('*')
                .eq('user_id', user.id)
                .order('uploaded_at', { ascending: false })
                .limit(100)
                .then(function (result) {
                    var items = result.data || [];
                    _libraryItemsCache = items;

                    if (items.length === 0) {
                        self.showEmptyState(container);
                    } else {
                        self.renderLibraryGrid(container, items);
                    }
                })
                .catch(function (err) {
                    console.error('[library] Load error:', err);
                    self.showErrorState(container, err.message);
                });
        },

        /**
         * Render library grid with items
         * @param {HTMLElement} container - Container element
         * @param {Array} items - Library items array
         */
        renderLibraryGrid: function (container, items) {
            if (typeof container === 'string') {
                container = safeGet(container);
            }
            if (!container) return;

            if (!items || items.length === 0) {
                this.showEmptyState(container);
                return;
            }

            var html = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">';

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var typeInfo = this.getFileTypeInfo(item.file_type || item.mime_type);
                var isImage = (item.file_type || item.mime_type || '').indexOf('image/') === 0;

                html += '<div class="library-item group bg-white/5 rounded-lg overflow-hidden border border-white/10 hover:border-accent/50 transition-all" data-item-id="' + item.id + '">';

                // Preview area
                if (isImage && item.url) {
                    html += '<div class="aspect-square bg-black/30 relative overflow-hidden">' +
                        '<img src="' + item.url + '" alt="' + escapeHtml(item.name || 'File') + '" class="w-full h-full object-cover">' +
                        '<div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">' +
                            '<button onclick="LibraryManager.previewItem(\'' + item.id + '\')" class="p-2 bg-white/20 rounded-lg hover:bg-white/30 text-white" title="Preview"><i class="fa-solid fa-eye"></i></button>' +
                            '<button onclick="LibraryManager.useInProduct(\'' + item.id + '\')" class="p-2 bg-accent/80 rounded-lg hover:bg-accent text-white" title="Use in Product"><i class="fa-solid fa-plus"></i></button>' +
                            '<button onclick="LibraryManager.deleteLibraryItem(\'' + item.id + '\')" class="p-2 bg-red-500/80 rounded-lg hover:bg-red-500 text-white" title="Delete"><i class="fa-solid fa-trash"></i></button>' +
                        '</div>' +
                    '</div>';
                } else {
                    html += '<div class="aspect-square bg-black/30 relative flex items-center justify-center">' +
                        '<i class="fa-solid ' + (typeInfo.icon || 'fa-file') + ' text-4xl ' + (typeInfo.color || 'text-gray-400') + '"></i>' +
                        '<div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">' +
                            '<button onclick="LibraryManager.downloadItem(\'' + item.id + '\')" class="p-2 bg-white/20 rounded-lg hover:bg-white/30 text-white" title="Download"><i class="fa-solid fa-download"></i></button>' +
                            '<button onclick="LibraryManager.useInProduct(\'' + item.id + '\')" class="p-2 bg-accent/80 rounded-lg hover:bg-accent text-white" title="Use in Product"><i class="fa-solid fa-plus"></i></button>' +
                            '<button onclick="LibraryManager.deleteLibraryItem(\'' + item.id + '\')" class="p-2 bg-red-500/80 rounded-lg hover:bg-red-500 text-white" title="Delete"><i class="fa-solid fa-trash"></i></button>' +
                        '</div>' +
                    '</div>';
                }

                // Info area
                html += '<div class="p-3">' +
                    '<p class="text-sm text-white truncate" title="' + escapeHtml(item.name || 'Unnamed') + '">' + escapeHtml(item.name || 'Unnamed') + '</p>' +
                    '<div class="flex justify-between items-center mt-1">' +
                        '<span class="text-[11px] text-muted">' + formatFileSize(item.file_size) + '</span>' +
                        '<span class="text-[11px] text-muted">' + timeAgo(item.uploaded_at || item.created_at) + '</span>' +
                    '</div>' +
                '</div>';

                html += '</div>';
            }

            html += '</div>';

            // Add upload button at end
            html += '<div class="library-upload-trigger col-span-full sm:col-span-1 md:col-span-1 aspect-square max-w-[200px] mx-auto sm:mx-0 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all" onclick="LibraryManager.showUploadModal()">' +
                '<i class="fa-solid fa-plus text-2xl text-gray-500 mb-2"></i>' +
                '<span class="text-sm text-gray-500">Upload File</span>' +
            '</div>';

            container.innerHTML = html;
        },

        /**
         * Get file type info object
         * @param {string} mimeType - MIME type string
         * @returns {Object} Type info with icon, label, color
         */
        getFileTypeInfo: function (mimeType) {
            return this.allowedTypes[mimeType] || { icon: 'fa-file', label: 'File', color: 'text-gray-400' };
        },

        /**
         * Show empty state UI
         * @param {HTMLElement} container - Container element
         */
        showEmptyState: function (container) {
            if (typeof container === 'string') {
                container = safeGet(container);
            }
            if (!container) return;

            container.innerHTML =
                '<div class="empty-state flex flex-col items-center justify-center py-12 px-4">' +
                    '<div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-accent/10 flex items-center justify-center mb-4">' +
                        '<i class="fa-solid fa-folder-open text-accent text-2xl sm:text-3xl"></i>' +
                    '</div>' +
                    '<h3 class="text-base sm:text-lg font-medium text-white mb-2">Your Library is Empty</h3>' +
                    '<p class="text-sm text-muted text-center max-w-md mb-6">Upload images, documents, and other files to use in your products.</p>' +
                    '<button onclick="LibraryManager.showUploadModal()" class="px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors font-medium">' +
                        '<i class="fa-solid fa-cloud-upload-alt mr-2"></i>Upload Your First File' +
                    '</button>' +
                '</div>';
        },

        /**
         * Show loading spinner state
         * @param {HTMLElement} container - Container element
         */
        showLoadingState: function (container) {
            if (typeof container === 'string') {
                container = safeGet(container);
            }
            if (!container) return;

            container.innerHTML =
                '<div class="flex flex-col items-center justify-center py-12">' +
                    '<div class="w-10 h-10 border-2 border-white/20 border-t-accent rounded-full animate-spin mb-4"></div>' +
                    '<p class="text-sm text-muted">Loading your library...</p>' +
                '</div>';
        },

        /**
         * Show error state
         * @param {HTMLElement} container - Container element
         * @param {string} message - Error message
         */
        showErrorState: function (container, message) {
            if (typeof container === 'string') {
                container = safeGet(container);
            }
            if (!container) return;

            container.innerHTML =
                '<div class="flex flex-col items-center justify-center py-12">' +
                    '<div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">' +
                        '<i class="fa-solid fa-exclamation-triangle text-red-400 text-2xl"></i>' +
                    '</div>' +
                    '<h3 class="text-base font-medium text-white mb-2">Something Went Wrong</h3>' +
                    '<p class="text-sm text-muted text-center max-w-md mb-4">' + escapeHtml(message || 'Failed to load library') + '</p>' +
                    '<button onclick="LibraryManager.loadLibraryItems()" class="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors">' +
                        '<i class="fa-solid fa-refresh mr-2"></i>Try Again' +
                    '</button>' +
                '</div>';
        },

        /**
         * Show login prompt for unauthenticated users
         * @param {HTMLElement} container - Container element
         */
        renderLoginPrompt: function (container) {
            container.innerHTML =
                '<div class="flex flex-col items-center justify-center py-12">' +
                    '<div class="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">' +
                        '<i class="fa-solid fa-lock text-accent text-2xl"></i>' +
                    '</div>' +
                    '<h3 class="text-base font-medium text-white mb-2">Sign In Required</h3>' +
                    '<p class="text-sm text-muted text-center max-w-md mb-6">Please sign in to access your library and upload files.</p>' +
                    '<button onclick="navigateTo(\'auth\'); openAuth(\'signin\');" class="px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors font-medium">' +
                        'Sign In to Continue' +
                    '</button>' +
                '</div>';
        },

        /**
         * Show file upload modal
         */
        showUploadModal: function () {
            var user = window.currentUser;
            if (!user || !user.id) {
                showToast('Please sign in to upload files', 'info');
                if (typeof window.openAuth === 'function') window.openAuth('signin');
                return;
            }

            var modalHtml =
                '<div class="modal-overlay" id="libraryModalOverlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;">' +
                    '<div class="bg-[#111] rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">' +
                        '<div class="flex justify-between items-center mb-6">' +
                            '<h2 class="text-lg font-semibold text-white">Upload to Library</h2>' +
                            '<button onclick="LibraryManager.closeUploadModal()" class="text-gray-400 hover:text-white transition-colors">' +
                                '<i class="fa-solid fa-times text-xl"></i>' +
                            '</button>' +
                        '</div>' +

                        '<div class="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-accent/50 transition-colors cursor-pointer mb-4" id="libraryDropZone">' +
                            '<input type="file" id="libraryFileInput" multiple class="hidden" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.zip,.rar">' +
                            '<i class="fa-solid fa-cloud-upload-alt text-3xl text-gray-500 mb-3"></i>' +
                            '<p class="text-white mb-1">Drag & drop files here</p>' +
                            '<p class="text-sm text-gray-500">or <span class="text-accent cursor-pointer underline">browse</span> to choose</p>' +
                            '<p class="text-xs text-gray-600 mt-3">Images, PDFs, ZIP files up to 10MB</p>' +
                        '</div>' +

                        '<div id="libraryUploadProgress" class="hidden mb-4"></div>' +

                        '<div class="flex justify-end gap-3">' +
                            '<button onclick="LibraryManager.closeUploadModal()" class="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors">Cancel</button>' +
                            '<button onclick="document.getElementById(\'libraryFileInput\').click()" class="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors">Select Files</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';

            // Create and show modal
            var wrapper = document.createElement('div');
            wrapper.innerHTML = modalHtml;
            document.body.appendChild(wrapper.firstChild);

            document.body.style.overflow = 'hidden';

            this.setupUploadModalEvents();
        },

        /**
         * Setup upload modal event listeners
         */
        setupUploadModalEvents: function () {
            var self = this;
            var dropZone = safeGet('libraryDropZone');
            var fileInput = safeGet('libraryFileInput');

            if (dropZone && fileInput) {
                dropZone.addEventListener('click', function () {
                    fileInput.click();
                });

                dropZone.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    this.classList.add('border-accent', 'bg-accent/5');
                });

                dropZone.addEventListener('dragleave', function (e) {
                    e.preventDefault();
                    this.classList.remove('border-accent', 'bg-accent/5');
                });

                dropZone.addEventListener('drop', function (e) {
                    e.preventDefault();
                    this.classList.remove('border-accent', 'bg-accent/5');
                    if (e.dataTransfer.files) {
                        self.processFileUpload(e.dataTransfer.files);
                    }
                });

                fileInput.addEventListener('change', function (e) {
                    if (e.target.files) {
                        self.processFileUpload(e.target.files);
                    }
                });
            }

            // Close on overlay click
            var overlay = safeGet('libraryModalOverlay');
            if (overlay) {
                overlay.addEventListener('click', function (e) {
                    if (e.target === overlay) {
                        self.closeUploadModal();
                    }
                });
            }

            // ESC key close
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    self.closeUploadModal();
                    document.removeEventListener('keydown', escHandler);
                }
            });
        },

        /**
         * Process file upload(s)
         * @param {FileList} files - Files to upload
         */
        processFileUpload: function (files) {
            var self = this;
            var user = window.currentUser;
            var validFiles = [];
            var allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'zip', 'rar'];

            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                var ext = file.name.split('.').pop().toLowerCase();

                // Check file size
                if (file.size > this.maxFileSize) {
                    showToast(file.name + ' exceeds 10MB limit', 'warning');
                    continue;
                }

                // Check extension
                if (allowedExtensions.indexOf(ext) === -1) {
                    showToast(file.name + ' file type not supported', 'warning');
                    continue;
                }

                validFiles.push(file);
            }

            if (validFiles.length === 0) return;

            // Show progress
            var progressContainer = safeGet('libraryUploadProgress');
            if (progressContainer) {
                progressContainer.classList.remove('hidden');
                progressContainer.innerHTML = '<div class="space-y-2"></div>';
            }

            // Upload each file
            var successCount = 0;
            var processedCount = 0;

            for (var j = 0; j < validFiles.length; j++) {
                (function (file) {
                    self.handleFileUpload(file)
                        .then(function () {
                            successCount++;
                            processedCount++;
                            
                            if (processedCount === validFiles.length) {
                                self.closeUploadModal();
                                self.loadLibraryItems();
                                showToast(successCount + ' of ' + validFiles.length + ' file(s) uploaded', successCount === validFiles.length ? 'success' : 'warning');
                            }
                        })
                        .catch(function (err) {
                            console.error('File upload error:', err);
                            processedCount++;
                            
                            if (processedCount === validFiles.length) {
                                if (progressContainer) progressContainer.classList.add('hidden');
                                showToast('Some files failed to upload', 'error');
                            }
                        });
                })(validFiles[j]);
            }
        },

        /**
         * Handle single file upload to Supabase
         * @param {File} file - File to upload
         * @returns {Promise}
         */
        handleFileUpload: function (file) {
            var user = window.currentUser;
            var userId = user ? user.id : 'anonymous';
            var ext = file.name.split('.').pop().toLowerCase();
            var fileName = 'library/' + userId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

            return sb.storage.from('library')
                .upload(fileName, file, { cacheControl: '3600', upsert: false })
                .then(function (result) {
                    if (result.error) throw result.error;

                    var publicUrl = sb.storage.from('library').getPublicUrl(fileName);

                    // Insert record into library_items table
                    return sb.from('library_items').insert({
                        user_id: userId,
                        name: file.name,
                        url: publicUrl.publicURL,
                        path: fileName,
                        file_type: file.type,
                        file_size: file.size,
                        mime_type: file.type
                    });
                })
                .then(function (result) {
                    if (result.error) throw result.error;
                    return result;
                });
        },

        /**
         * Close upload modal
         */
        closeUploadModal: function () {
            var modal = safeGet('libraryModalOverlay');
            if (modal) {
                modal.parentNode.removeChild(modal);
            }
            document.body.style.overflow = '';
        },

        /**
         * Delete a library item
         * @param {string} itemId - Item ID to delete
         */
        deleteLibraryItem: function (itemId) {
            if (!itemId) return;

            if (!confirm('Are you sure you want to delete this file?')) return;

            var self = this;

            // First get item info to also delete from storage
            sb.from('library_items').select('*').eq('id', itemId).single()
                .then(function (result) {
                    if (result.error || !result.data) throw result.error || new Error('Item not found');

                    var item = result.data;

                    // Delete from storage if path exists
                    var storagePromise = item.path
                        ? sb.storage.from('library').remove([item.path]).catch(function (err) {
                            console.warn('Storage deletion warning:', err);
                            return { error: null }; // Don't fail if storage delete fails
                          })
                        : Promise.resolve({ error: null });

                    return storagePromise.then(function () {
                        // Delete from database
                        return sb.from('library_items').delete().eq('id', itemId);
                    });
                })
                .then(function (result) {
                    if (result.error) throw result.error;

                    showToast('File deleted', 'success');
                    self.loadLibraryItems(); // Refresh list
                })
                .catch(function (err) {
                    console.error('Delete library item error:', err);
                    showToast('Failed to delete file', 'error');
                });
        },

        /**
         * Rename a library item
         * @param {string} itemId - Item ID
         * @param {string} newName - New name
         */
        renameLibraryItem: function (itemId, newName) {
            if (!itemId || !newName) return;

            newName = newName.trim();
            if (newName.length === 0) {
                showToast('Name cannot be empty', 'error');
                return;
            }

            var self = this;

            sb.from('library_items').update({ name: newName }).eq('id', itemId)
                .then(function (result) {
                    if (result.error) throw result.error;

                    showToast('File renamed', 'success');
                    self.loadLibraryItems(); // Refresh
                })
                .catch(function (err) {
                    console.error('Rename error:', err);
                    showToast('Failed to rename file', 'error');
                });
        },

        /**
         * Get cached library items
         * @returns {Array} Cached items array
         */
        getLibraryItems: function () {
            return _libraryItemsCache;
        },

        /**
         * Use a library item in a product (link it)
         * @param {string} itemId - Library item ID
         * @param {string|null} productId - Optional product ID
         */
        useInProduct: function (itemId, productId) {
            var item = null;
            for (var i = 0; i < _libraryItemsCache.length; i++) {
                if (_libraryItemsCache[i].id === itemId) {
                    item = _libraryItemsCache[i];
                    break;
                }
            }

            if (!item) {
                showToast('Item not found', 'error');
                return;
            }

            // If no product specified, open product form with this image
            if (!productId) {
                // Add to product form images if open
                if (_uploadedImages) {
                    _uploadedImages.push({
                        id: generateTempId(),
                        url: item.url,
                        path: item.path,
                        is_primary: _uploadedImages.length === 0
                    });

                    if (typeof ProductManagerComplete !== 'undefined') {
                        ProductManagerComplete.updateImagesPreview();
                    }
                    showToast('Image added to product form', 'success');
                } else {
                    // Open add product modal with this image pre-selected
                    if (typeof ProductManagerComplete !== 'undefined') {
                        ProductManagerComplete.showAddProductModal();
                        // Wait for modal then add image
                        setTimeout(function () {
                            _uploadedImages.push({
                                id: generateTempId(),
                                url: item.url,
                                path: item.path,
                                is_primary: true
                            });
                            ProductManagerComplete.updateImagesPreview();
                        }, 200);
                    }
                }
            } else {
                // Link to specific product
                sb.from('product_images').insert({
                    product_id: productId,
                    url: item.url,
                    path: item.path,
                    is_primary: false
                }).then(function (result) {
                    if (result.error) throw result.error;
                    showToast('Image added to product', 'success');
                }).catch(function (err) {
                    console.error('Link to product error:', err);
                    showToast('Failed to add image to product', 'error');
                });
            }
        },

        /**
         * Preview a library item
         * @param {string} itemId - Item ID
         */
        previewItem: function (itemId) {
            var item = null;
            for (var i = 0; i < _libraryItemsCache.length; i++) {
                if (_libraryItemsCache[i].id === itemId) {
                    item = _libraryItemsCache[i];
                    break;
                }
            }

            if (!item || !item.url) return;

            // Create preview modal
            var modalHtml =
                '<div class="modal-overlay" id="previewModalOverlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:9999;" onclick="LibraryManager.closePreviewModal()">' +
                    '<div class="max-w-4xl max-h-[90vh] p-4" onclick="event.stopPropagation()">' +
                        '<img src="' + item.url + '" alt="' + escapeHtml(item.name) + '" class="max-w-full max-h-[85vh] object-contain rounded-lg">' +
                        '<p class="text-center text-white mt-4">' + escapeHtml(item.name) + '</p>' +
                    '</div>' +
                    '<button class="absolute top-4 right-4 text-white text-2xl hover:text-gray-300" onclick="LibraryManager.closePreviewModal()">' +
                        '<i class="fa-solid fa-times"></i>' +
                    '</button>' +
                '</div>';

            var wrapper = document.createElement('div');
            wrapper.innerHTML = modalHtml;
            document.body.appendChild(wrapper.firstChild);
            document.body.style.overflow = 'hidden';
        },

        /**
         * Close preview modal
         */
        closePreviewModal: function () {
            var modal = safeGet('previewModalOverlay');
            if (modal) {
                modal.parentNode.removeChild(modal);
            }
            document.body.style.overflow = '';
        },

        /**
         * Download a library item
         * @param {string} itemId - Item ID
         */
        downloadItem: function (itemId) {
            var item = null;
            for (var i = 0; i < _libraryItemsCache.length; i++) {
                if (_libraryItemsCache[i].id === itemId) {
                    item = _libraryItemsCache[i];
                    break;
                }
            }

            if (!item || !item.url) return;

            // Create download link
            var link = document.createElement('a');
            link.href = item.url;
            link.download = item.name || 'download';
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },

        /**
         * Filter library items by search term
         * @param {string} searchTerm - Search query
         */
        filterLibraryItems: function (searchTerm) {
            var container = safeGet('libraryContent') || safeGet('libraryGrid');
            if (!container || !_libraryItemsCache.length) return;

            searchTerm = (searchTerm || '').toLowerCase().trim();

            if (!searchTerm) {
                this.renderLibraryGrid(container, _libraryItemsCache);
                return;
            }

            var filtered = [];
            for (var i = 0; i < _libraryItemsCache.length; i++) {
                var item = _libraryItemsCache[i];
                if ((item.name || '').toLowerCase().indexOf(searchTerm) !== -1 ||
                    (item.file_type || '').toLowerCase().indexOf(searchTerm) !== -1) {
                    filtered.push(item);
                }
            }

            this.renderLibraryGrid(container, filtered);
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // SECTION: COLLECTION SYSTEM COMPLETION
    // ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Collection Manager - Organize products into collections
     * Full CRUD operations with many-to-many product relationships
     */
    var CollectionManager = {

        // Current collection being viewed/edited
        _currentCollection: null,

        /**
         * Initialize collection system
         */
        init: function () {
            console.log('[collection] Collection Manager initializing...');
            this.setupCollectionEvents();
        },

        /**
         * Setup collection event listeners
         */
        setupCollectionEvents: function () {
            var self = this;

            // Create collection button
            var createBtn = safeGet('createCollectionBtn');
            if (createBtn) {
                createBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.showCreateModal();
                });
            }
        },

        /**
         * Load collections for current seller
         */
        loadCollections: function () {
            var self = this;
            var container = safeGet('collectionsList') || safeGet('collectionsContent');

            if (!container) return;

            var user = window.currentUser;
            if (!user || !user.id) {
                this.renderCollectionsLoginPrompt(container);
                return;
            }

            this.showCollectionsLoading(container);

            sb.from('collections')
                .select('*, collection_products(product_id)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .then(function (result) {
                    var collections = result.data || [];
                    _collectionsCache = collections;

                    if (collections.length === 0) {
                        self.showCollectionsEmpty(container);
                    } else {
                        self.renderCollectionsList(container, collections);
                    }
                })
                .catch(function (err) {
                    console.error('[collection] Load error:', err);
                    self.showCollectionsError(container, err.message);
                });
        },

        /**
         * Render collections list view
         * @param {HTMLElement} container - Container element
         * @param {Array} collections - Collections array
         */
        renderCollectionsList: function (container, collections) {
            if (typeof container === 'string') {
                container = safeGet(container);
            }
            if (!container) return;

            var html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">';

            for (var i = 0; i < collections.length; i++) {
                var coll = collections[i];
                var productCount = coll.collection_products ? coll.collection_products.length : 0;
                var visibilityIcon = coll.is_public
                    ? '<i class="fa-solid fa-globe text-green-400" title="Public"></i>'
                    : '<i class="fa-solid fa-lock text-yellow-400" title="Private"></i>';

                html += '<div class="collection-card bg-white/5 rounded-xl border border-white/10 overflow-hidden hover:border-accent/50 transition-all group">' +
                    // Header with cover image or gradient
                    '<div class="h-32 bg-gradient-to-br from-accent/20 to-purple-500/20 relative">' +
                        '<div class="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">' +
                            '<button onclick="CollectionManager.showEditModal(\'' + coll.id + '\')" class="p-2 bg-black/50 rounded-lg hover:bg-white/20 text-white text-sm" title="Edit"><i class="fa-solid fa-pen"></i></button>' +
                            '<button onclick="CollectionManager.deleteCollection(\'' + coll.id + '\')" class="p-2 bg-black/50 rounded-lg hover:bg-red-500 text-white text-sm" title="Delete"><i class="fa-solid fa-trash"></i></button>' +
                        '</div>' +
                        '<div class="absolute bottom-3 left-3">' +
                            visibilityIcon +
                        '</div>' +
                    '</div>' +

                    // Content
                    '<div class="p-4">' +
                        '<h3 class="text-white font-medium mb-1 truncate" title="' + escapeHtml(coll.name || 'Untitled') + '">' + escapeHtml(coll.name || 'Untitled') + '</h3>' +
                        '<p class="text-sm text-muted line-clamp-2 mb-3">' + escapeHtml(coll.description || 'No description') + '</p>' +
                        '<div class="flex justify-between items-center">' +
                            '<span class="text-xs text-muted"><i class="fa-solid fa-box mr-1"></i>' + productCount + ' product(s)</span>' +
                            '<button onclick="CollectionManager.viewCollectionDetail(\'' + coll.id + '\')" class="text-xs text-accent hover:underline">View Details →</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }

            html += '</div>';

            // Add create button card
            html += '<div class="collection-create-card bg-white/5 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center min-h-[250px] cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all" onclick="CollectionManager.showCreateModal()">' +
                '<i class="fa-solid fa-plus text-3xl text-gray-500 mb-3"></i>' +
                '<span class="text-sm text-gray-500">Create New Collection</span>' +
            '</div>';

            container.innerHTML = html;
        },

        /**
         * Show create collection modal
         */
        showCreateModal: function () {
            var user = window.currentUser;
            if (!user || !user.id) {
                showToast('Please sign in to create collections', 'info');
                return;
            }

            this._currentCollection = null;

            var modalHtml = this.buildCollectionFormModal(null);
            this.showCollectionModal(modalHtml);
        },

        /**
         * Show edit collection modal
         * @param {string} collectionId - Collection ID to edit
         */
        showEditModal: function (collectionId) {
            if (!collectionId) return;

            var self = this;
            showToast('Loading collection...', 'info');

            sb.from('collections')
                .select('*')
                .eq('id', collectionId)
                .single()
                .then(function (result) {
                    if (result.error || !result.data) {
                        throw result.error || new Error('Collection not found');
                    }

                    self._currentCollection = result.data;

                    var modalHtml = self.buildCollectionFormModal(result.data);
                    self.showCollectionModal(modalHtml);
                })
                .catch(function (err) {
                    console.error('Load collection error:', err);
                    showToast('Failed to load collection', 'error');
                });
        },

        /**
         * Build collection form modal HTML
         * @param {Object|null} collection - Collection data for edit, null for create
         * @returns {string} Modal HTML
         */
        buildCollectionFormModal: function (collection) {
            var isEdit = !!collection;
            var title = isEdit ? 'Edit Collection' : 'Create New Collection';
            var submitText = isEdit ? 'Update Collection' : 'Create Collection';
            var c = collection || {};

            return '<div class="modal-overlay" id="collectionModalOverlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;">' +
                '<div class="bg-[#111] rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">' +
                    '<div class="flex justify-between items-center mb-6">' +
                        '<h2 class="text-lg font-semibold text-white">' + title + '</h2>' +
                        '<button onclick="CollectionManager.closeCollectionModal()" class="text-gray-400 hover:text-white transition-colors">' +
                            '<i class="fa-solid fa-times text-xl"></i>' +
                        '</button>' +
                    '</div>' +

                    '<form id="collectionForm" onsubmit="return false;">' +
                        '<input type="hidden" id="collectionId" value="' + (c.id || '') + '">' +

                        '<div class="mb-4">' +
                            '<label class="block text-sm text-gray-400 mb-1">Collection Name <span class="text-red-500">*</span></label>' +
                            '<input type="text" id="collectionName" value="' + escapeHtml(c.name || '') + '" ' +
                                'class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-accent focus:outline-none" ' +
                                'placeholder="Enter collection name" required maxlength="100">' +
                        '</div>' +

                        '<div class="mb-4">' +
                            '<label class="block text-sm text-gray-400 mb-1">Description</label>' +
                            '<textarea id="collectionDescription" rows="3" ' +
                                'class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-accent focus:outline-none resize-none" ' +
                                'placeholder="Describe this collection...">' + escapeHtml(c.description || '') + '</textarea>' +
                        '</div>' +

                        '<div class="mb-6">' +
                            '<label class="flex items-center gap-3 cursor-pointer">' +
                                '<input type="checkbox" id="collectionIsPublic" ' + (c.is_public ? 'checked' : '') + ' ' +
                                    'class="w-5 h-5 rounded border-white/20 bg-white/5 text-accent focus:ring-accent focus:ring-offset-0">' +
                                '<span class="text-sm text-gray-300">Make this collection publicly visible</span>' +
                            '</label>' +
                        '</div>' +

                        '<div class="flex justify-end gap-3 pt-4 border-t border-white/10">' +
                            '<button type="button" onclick="CollectionManager.closeCollectionModal()" ' +
                                'class="px-5 py-2.5 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-colors">Cancel</button>' +
                            '<button type="button" onclick="CollectionManager.handleSaveCollection()" ' +
                                'class="px-5 py-2.5 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors font-medium">' + submitText + '</button>' +
                        '</div>' +
                    '</form>' +
                '</div>' +
            '</div>';
        },

        /**
         * Show collection modal
         * @param {string} htmlContent - Modal HTML
         */
        showCollectionModal: function (htmlContent) {
            this.closeCollectionModal();

            var wrapper = document.createElement('div');
            wrapper.innerHTML = htmlContent;
            document.body.appendChild(wrapper.firstChild);

            document.body.style.overflow = 'hidden';

            // Close on overlay click
            var overlay = safeGet('collectionModalOverlay');
            if (overlay) {
                overlay.addEventListener('click', function (e) {
                    if (e.target === overlay) {
                        CollectionManager.closeCollectionModal();
                    }
                });
            }

            // ESC key close
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    CollectionManager.closeCollectionModal();
                    document.removeEventListener('keydown', escHandler);
                }
            });
        },

        /**
         * Close collection modal
         */
        closeCollectionModal: function () {
            var modal = safeGet('collectionModalOverlay');
            if (modal) {
                modal.parentNode.removeChild(modal);
            }
            document.body.style.overflow = '';
            this._currentCollection = null;
        },

        /**
         * Handle save collection (create or update)
         */
        handleSaveCollection: function () {
            var self = this;
            var user = window.currentUser;

            if (!user || !user.id) {
                showToast('Please sign in first', 'error');
                return;
            }

            // Validate
            var nameInput = safeGet('collectionName');
            if (!nameInput || !nameInput.value.trim()) {
                showToast('Collection name is required', 'error');
                return;
            }

            var collectionData = {
                user_id: user.id,
                name: nameInput.value.trim(),
                description: (safeGet('collectionDescription') || {}).value.trim(),
                is_public: (safeGet('collectionIsPublic') || {}).checked || false
            };

            var isEdit = !!this._currentCollection;

            showToast(isEdit ? 'Updating collection...' : 'Creating collection...', 'info');

            var operation;
            if (isEdit) {
                operation = sb.from('collections')
                    .update(collectionData)
                    .eq('id', this._currentCollection.id);
            } else {
                operation = sb.from('collections')
                    .insert(collectionData)
                    .select();
            }

            operation
                .then(function (result) {
                    if (result.error) throw result.error;

                    self.closeCollectionModal();
                    showToast(isEdit ? 'Collection updated!' : 'Collection created!', 'success');

                    // Refresh list
                    self.loadCollections();

                    // Log activity
                    if (typeof window.logActivity === 'function') {
                        var collId = isEdit ? self._currentCollection.id : (result.data && result.data[0] ? result.data[0].id : null);
                        window.logActivity(isEdit ? 'update_collection' : 'create_collection', 'collection', collId);
                    }
                })
                .catch(function (err) {
                    console.error('Save collection error:', err);
                    showToast('Failed to save collection: ' + (err.message || 'Unknown error'), 'error');
                });
        },

        /**
         * Delete a collection with confirmation
         * @param {string} collectionId - Collection ID
         */
        deleteCollection: function (collectionId) {
            if (!collectionId) return;

            if (!confirm('Are you sure you want to delete this collection?\n\nThis will not delete the products inside it.')) return;

            var self = this;

            // First delete collection_products links, then the collection
            sb.from('collection_products').delete().eq('collection_id', collectionId)
                .then(function () {
                    return sb.from('collections').delete().eq('id', collectionId);
                })
                .then(function (result) {
                    if (result.error) throw result.error;

                    showToast('Collection deleted', 'success');
                    self.loadCollections();

                    if (typeof window.logActivity === 'function') {
                        window.logActivity('delete_collection', 'collection', collectionId);
                    }
                })
                .catch(function (err) {
                    console.error('Delete collection error:', err);
                    showToast('Failed to delete collection', 'error');
                });
        },

        /**
         * View collection detail with products
         * @param {string} collectionId - Collection ID
         */
        viewCollectionDetail: function (collectionId) {
            var self = this;

            // Load full collection data with products
            Promise.all([
                sb.from('collections').select('*').eq('id', collectionId).single(),
                sb.from('collection_products')
                    .select('*, products(*, product_images(url, is_primary))')
                    .eq('collection_id', collectionId)
                    .order('sort_order', { ascending: true })
            ]).then(function (results) {
                var collection = results[0].data;
                var collectionProducts = results[1].data || [];

                if (results[0].error || !collection) {
                    throw results[0].error || new Error('Collection not found');
                }

                self._currentCollection = collection;
                self.renderCollectionDetail(collection, collectionProducts);
            }).catch(function (err) {
                console.error('Load collection detail error:', err);
                showToast('Failed to load collection detail', 'error');
            });
        },

        /**
         * Render collection detail view
         * @param {Object} collection - Collection data
         * @param {Array} products - Products in collection
         */
        renderCollectionDetail: function (collection, products) {
            var container = safeGet('collectionsContent') || safeGet('collectionsList');
            if (!container) return;

            var productCount = products ? products.length : 0;

            var html =
                '<div class="mb-6">' +
                    '<button onclick="CollectionManager.loadCollections()" class="text-sm text-accent hover:underline mb-4 inline-flex items-center gap-2">' +
                        '<i class="fa-solid fa-arrow-left"></i> Back to Collections' +
                    '</button>' +

                    '<div class="bg-white/5 rounded-xl border border-white/10 overflow-hidden">' +
                        '<div class="h-40 bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center">' +
                            '<h1 class="text-2xl sm:text-3xl font-bold text-white">' + escapeHtml(collection.name || 'Untitled') + '</h1>' +
                        '</div>' +

                        '<div class="p-6">' +
                            '<div class="flex flex-wrap items-start justify-between gap-4 mb-6">' +
                                '<div>' +
                                    '<p class="text-muted mb-2">' + escapeHtml(collection.description || 'No description') + '</p>' +
                                    '<div class="flex items-center gap-4 text-sm text-muted">' +
                                        '<span><i class="fa-solid fa-box mr-1"></i>' + productCount + ' product(s)</span>' +
                                        '<span><i class="fa-solid ' + (collection.is_public ? 'fa-globe text-green-400' : 'fa-lock text-yellow-400') + ' mr-1"></i>' +
                                            (collection.is_public ? 'Public' : 'Private') +
                                        '</span>' +
                                        '<span><i class="fa-solid fa-clock mr-1"></i>Created ' + timeAgo(collection.created_at) + '</span>' +
                                    '</div>' +
                                '</div>' +

                                '<div class="flex gap-2">' +
                                    '<button onclick="CollectionManager.showEditModal(\'' + collection.id + '\')" class="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors text-sm">' +
                                        '<i class="fa-solid fa-pen mr-1"></i>Edit' +
                                    '</button>' +
                                    '<button onclick="CollectionManager.showAddProductModal(\'' + collection.id + '\')" class="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors text-sm">' +
                                        '<i class="fa-solid fa-plus mr-1"></i>Add Products' +
                                    '</button>' +
                                '</div>' +
                            '</div>';

            // Products grid
            if (products && products.length > 0) {
                html += this.renderCollectionProducts(products);
            } else {
                html +=
                    '<div class="text-center py-12 border-2 border-dashed border-white/10 rounded-lg">' +
                        '<i class="fa-solid fa-box-open text-4xl text-gray-600 mb-4"></i>' +
                        '<p class="text-muted mb-4">No products in this collection yet</p>' +
                        '<button onclick="CollectionManager.showAddProductModal(\'' + collection.id + '\')" class="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors text-sm">' +
                            '<i class="fa-solid fa-plus mr-1"></i>Add Products' +
                        '</button>' +
                    '</div>';
            }

            html += '</div></div></div>';

            container.innerHTML = html;
        },

        /**
         * Render products grid within collection detail
         * @param {Array} collectionProducts - Array of collection_product records with nested product data
         * @returns {string} HTML string
         */
        renderCollectionProducts: function (collectionProducts) {
            var html = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">';

            for (var i = 0; i < collectionProducts.length; i++) {
                var cp = collectionProducts[i];
                var product = cp.products;
                if (!product) continue;

                var imageUrl = '';
                if (product.product_images && product.product_images.length > 0) {
                    // Find primary image
                    for (var j = 0; j < product.product_images.length; j++) {
                        if (product.product_images[j].is_primary) {
                            imageUrl = product.product_images[j].url;
                            break;
                        }
                    }
                    if (!imageUrl && product.product_images.length > 0) {
                        imageUrl = product.product_images[0].url;
                    }
                }

                html += '<div class="group bg-white/5 rounded-lg overflow-hidden border border-white/10 hover:border-accent/50 transition-all">' +
                    '<div class="aspect-square bg-black/30 relative">' +
                        (imageUrl
                            ? '<img src="' + imageUrl + '" alt="' + escapeHtml(product.title) + '" class="w-full h-full object-cover">'
                            : '<div class="w-full h-full flex items-center justify-center"><i class="fa-solid fa-image text-2xl text-gray-600"></i></div>'
                        ) +
                        '<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">' +
                            '<button onclick="CollectionManager.removeProductFromCollection(\'' + cp.collection_id + '\', \'' + cp.product_id + '\')" ' +
                                'class="p-1.5 bg-red-500/80 rounded text-white text-xs hover:bg-red-500" title="Remove from collection">' +
                                '<i class="fa-solid fa-times"></i>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="p-3">' +
                        '<p class="text-sm text-white truncate" title="' + escapeHtml(product.title) + '">' + escapeHtml(product.title) + '</p>' +
                        '<p class="text-accent text-sm font-medium mt-1">' + formatPrice(product.price) + '</p>' +
                    '</div>' +
                '</div>';
            }

            html += '</div>';
            return html;
        },

        /**
         * Load products in a collection
         * @param {string} collectionId - Collection ID
         * @returns {Promise} Resolves with products array
         */
        loadCollectionProducts: function (collectionId) {
            return sb.from('collection_products')
                .select('*, products(*, product_images(url, is_primary))')
                .eq('collection_id', collectionId)
                .order('sort_order', { ascending: true })
                .then(function (result) {
                    return result.data || [];
                });
        },

        /**
         * Show modal to add products to collection
         * @param {string} collectionId - Collection ID
         */
        showAddProductModal: function (collectionId) {
            var self = this;
            var user = window.currentUser;

            if (!user || !user.id) {
                showToast('Please sign in first', 'error');
                return;
            }

            showToast('Loading your products...', 'info');

            // Load seller's products
            sb.from('products')
                .select('*, product_images(url, is_primary)')
                .eq('seller_id', user.id)
                .eq('status', 'active')
                .then(function (result) {
                    var products = result.data || [];

                    // Get already added product IDs
                    return sb.from('collection_products')
                        .select('product_id')
                        .eq('collection_id', collectionId)
                        .then(function (existingResult) {
                            var existingIds = {};
                            var existing = existingResult.data || [];
                            for (var i = 0; i < existing.length; i++) {
                                existingIds[existing[i].product_id] = true;
                            }

                            // Filter out already added products
                            var availableProducts = [];
                            for (var j = 0; j < products.length; j++) {
                                if (!existingIds[products[j].id]) {
                                    availableProducts.push(products[j]);
                                }
                            }

                            self.renderAddProductModal(collectionId, availableProducts);
                        });
                })
                .catch(function (err) {
                    console.error('Load products error:', err);
                    showToast('Failed to load products', 'error');
                });
        },

        /**
         * Render the add products modal
         * @param {string} collectionId - Collection ID
         * @param {Array} products - Available products
         */
        renderAddProductModal: function (collectionId, products) {
            var html =
                '<div class="modal-overlay" id="addProductModalOverlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;">' +
                    '<div class="bg-[#111] rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">' +
                        '<div class="flex justify-between items-center mb-6">' +
                            '<h2 class="text-lg font-semibold text-white">Add Products to Collection</h2>' +
                            '<button onclick="CollectionManager.closeAddProductModal()" class="text-gray-400 hover:text-white transition-colors">' +
                                '<i class="fa-solid fa-times text-xl"></i>' +
                            '</button>' +
                        '</div>';

            if (products.length === 0) {
                html +=
                    '<div class="text-center py-8">' +
                        '<p class="text-muted">All your active products are already in this collection.</p>' +
                    '</div>';
            } else {
                html +=
                    '<div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6" id="addProductGrid">';

                for (var i = 0; i < products.length; i++) {
                    var p = products[i];
                    var imgUrl = '';
                    if (p.product_images && p.product_images.length > 0) {
                        imgUrl = p.product_images[0].url || '';
                    }

                    html +=
                        '<div class="add-product-item bg-white/5 rounded-lg border border-white/10 overflow-hidden cursor-pointer hover:border-accent transition-all" data-product-id="' + p.id + '" onclick="CollectionManager.toggleProductSelection(this)">' +
                            '<div class="aspect-square bg-black/30 relative">' +
                                (imgUrl
                                    ? '<img src="' + imgUrl + '" alt="' + escapeHtml(p.title) + '" class="w-full h-full object-cover">'
                                    : '<div class="w-full h-full flex items-center justify-center"><i class="fa-solid fa-image text-xl text-gray-600"></i></div>'
                                ) +
                                '<div class="absolute top-2 left-2 w-6 h-6 rounded border-2 border-white/40 flex items-center justify-center selection-checkbox">' +
                                    '<i class="fa-solid fa-check text-white text-xs opacity-0"></i>' +
                                '</div>' +
                            '</div>' +
                            '<div class="p-2">' +
                                '<p class="text-xs text-white truncate">' + escapeHtml(p.title) + '</p>' +
                                '<p class="text-xs text-accent">' + formatPrice(p.price) + '</p>' +
                            '</div>' +
                        '</div>';
                }

                html += '</div>';

                html +=
                    '<div class="flex justify-end gap-3 pt-4 border-t border-white/10">' +
                        '<button onclick="CollectionManager.closeAddProductModal()" class="px-5 py-2.5 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-colors">Cancel</button>' +
                        '<button onclick="CollectionManager.addSelectedProducts(\'' + collectionId + '\')" class="px-5 py-2.5 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors font-medium">' +
                            '<i class="fa-solid fa-plus mr-2"></i>Add Selected' +
                        '</button>' +
                    '</div>';
            }

            html += '</div></div>';

            // Show modal
            var wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            document.body.appendChild(wrapper.firstChild);
            document.body.style.overflow = 'hidden';

            // Setup close events
            var overlay = safeGet('addProductModalOverlay');
            if (overlay) {
                overlay.addEventListener('click', function (e) {
                    if (e.target === overlay) {
                        CollectionManager.closeAddProductModal();
                    }
                });
            }
        },

        /**
         * Toggle product selection in add modal
         * @param {HTMLElement} el - Product item element
         */
        toggleProductSelection: function (el) {
            el.classList.toggle('selected');
            el.classList.toggle('border-accent');

            var checkbox = el.querySelector('.selection-checkbox');
            var icon = checkbox.querySelector('i');

            if (el.classList.contains('selected')) {
                checkbox.classList.add('bg-accent', 'border-accent');
                checkbox.classList.remove('border-white/40');
                icon.classList.remove('opacity-0');
            } else {
                checkbox.classList.remove('bg-accent', 'border-accent');
                checkbox.classList.add('border-white/40');
                icon.classList.add('opacity-0');
            }
        },

        /**
         * Add selected products to collection
         * @param {string} collectionId - Collection ID
         */
        addSelectedProducts: function (collectionId) {
            var self = this;
            var selected = document.querySelectorAll('.add-product-item.selected');

            if (selected.length === 0) {
                showToast('Please select at least one product', 'info');
                return;
            }

            var productIds = [];
            for (var i = 0; i < selected.length; i++) {
                productIds.push(selected[i].dataset.productId);
            }

            // Create collection_products records
            var records = [];
            for (var j = 0; j < productIds.length; j++) {
                records.push({
                    collection_id: collectionId,
                    product_id: productIds[j],
                    sort_order: j
                });
            }

            showToast('Adding products...', 'info');

            sb.from('collection_products').insert(records)
                .then(function (result) {
                    if (result.error) throw result.error;

                    self.closeAddProductModal();
                    showToast(selected.length + ' product(s) added to collection', 'success');
                    self.viewCollectionDetail(collectionId); // Refresh detail view
                })
                .catch(function (err) {
                    console.error('Add products error:', err);
                    showToast('Failed to add some products', 'error');
                });
        },

        /**
         * Add a single product to collection
         * @param {string} collectionId - Collection ID
         * @param {string} productId - Product ID
         */
        addProductToCollection: function (collectionId, productId) {
            var self = this;

            // Check if already exists
            sb.from('collection_products')
                .select('id')
                .eq('collection_id', collectionId)
                .eq('product_id', productId)
                .maybeSingle()
                .then(function (result) {
                    if (result.data) {
                        showToast('Product already in collection', 'info');
                        return;
                    }

                    return sb.from('collection_products').insert({
                        collection_id: collectionId,
                        product_id: productId,
                        sort_order: Date.now()
                    });
                })
                .then(function (result) {
                    if (result && result.error) throw result.error;
                    if (result && result.data) {
                        showToast('Product added to collection', 'success');
                        self.viewCollectionDetail(collectionId);
                    }
                })
                .catch(function (err) {
                    console.error('Add to collection error:', err);
                    showToast('Failed to add product', 'error');
                });
        },

        /**
         * Remove a product from collection
         * @param {string} collectionId - Collection ID
         * @param {string} productId - Product ID
         */
        removeProductFromCollection: function (collectionId, productId) {
            var self = this;

            sb.from('collection_products')
                .delete()
                .eq('collection_id', collectionId)
                .eq('product_id', productId)
                .then(function (result) {
                    if (result.error) throw result.error;

                    showToast('Product removed from collection', 'success');
                    self.viewCollectionDetail(collectionId); // Refresh
                })
                .catch(function (err) {
                    console.error('Remove from collection error:', err);
                    showToast('Failed to remove product', 'error');
                });
        },

        /**
         * Close add product modal
         */
        closeAddProductModal: function () {
            var modal = safeGet('addProductModalOverlay');
            if (modal) {
                modal.parentNode.removeChild(modal);
            }
            document.body.style.overflow = '';
        },

        /**
         * Show collections loading state
         * @param {HTMLElement} container - Container element
         */
        showCollectionsLoading: function (container) {
            if (typeof container === 'string') container = safeGet(container);
            if (!container) return;

            container.innerHTML =
                '<div class="flex flex-col items-center justify-center py-12">' +
                    '<div class="w-10 h-10 border-2 border-white/20 border-t-accent rounded-full animate-spin mb-4"></div>' +
                    '<p class="text-sm text-muted">Loading collections...</p>' +
                '</div>';
        },

        /**
         * Show collections empty state
         * @param {HTMLElement} container - Container element
         */
        showCollectionsEmpty: function (container) {
            if (typeof container === 'string') container = safeGet(container);
            if (!container) return;

            container.innerHTML =
                '<div class="empty-state flex flex-col items-center justify-center py-12 px-4">' +
                    '<div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-accent/10 flex items-center justify-center mb-4">' +
                        '<i class="fa-solid fa-layer-group text-accent text-2xl sm:text-3xl"></i>' +
                    '</div>' +
                    '<h3 class="text-base sm:text-lg font-medium text-white mb-2">No Collections Yet</h3>' +
                    '<p class="text-sm text-muted text-center max-w-md mb-6">Create collections to organize your products into curated groups.</p>' +
                    '<button onclick="CollectionManager.showCreateModal()" class="px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors font-medium">' +
                        '<i class="fa-solid fa-plus mr-2"></i>Create Your First Collection' +
                    '</button>' +
                '</div>';
        },

        /**
         * Show collections error state
         * @param {HTMLElement} container - Container element
         * @param {string} message - Error message
         */
        showCollectionsError: function (container, message) {
            if (typeof container === 'string') container = safeGet(container);
            if (!container) return;

            container.innerHTML =
                '<div class="flex flex-col items-center justify-center py-12">' +
                    '<div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">' +
                        '<i class="fa-solid fa-exclamation-triangle text-red-400 text-2xl"></i>' +
                    '</div>' +
                    '<h3 class="text-base font-medium text-white mb-2">Something Went Wrong</h3>' +
                    '<p class="text-sm text-muted text-center max-w-md mb-4">' + escapeHtml(message || 'Failed to load collections') + '</p>' +
                    '<button onclick="CollectionManager.loadCollections()" class="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors">' +
                        '<i class="fa-solid fa-refresh mr-2"></i>Try Again' +
                    '</button>' +
                '</div>';
        },

        /**
         * Show login prompt for collections
         * @param {HTMLElement} container - Container element
         */
        renderCollectionsLoginPrompt: function (container) {
            container.innerHTML =
                '<div class="flex flex-col items-center justify-center py-12">' +
                    '<div class="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">' +
                        '<i class="fa-solid fa-lock text-accent text-2xl"></i>' +
                    '</div>' +
                    '<h3 class="text-base font-medium text-white mb-2">Sign In Required</h3>' +
                    '<p class="text-sm text-muted text-center max-w-md mb-6">Please sign in to create and manage collections.</p>' +
                    '<button onclick="navigateTo(\'auth\'); openAuth(\'signin\');" class="px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors font-medium">' +
                        'Sign In to Continue' +
                    '</button>' +
                '</div>';
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // SECTION: EVENT BINDING & INITIALIZATION
    // ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Main initialization function
     * Sets up all completions and binds events
     */
    function initializeCompletions() {
        console.log('[completion] Initializing feature completions...');

        // Initialize Product Manager enhancements
        if (typeof ProductManagerComplete !== 'undefined') {
            ProductManagerComplete.init();
        }

        // Initialize Collection Manager
        if (typeof CollectionManager !== 'undefined') {
            CollectionManager.init();
        }

        // Patch "Add Product" buttons globally
        patchAddProductButtons();

        // Patch "Coming Soon" features
        patchComingSoonFeatures();

        // Setup navigation observer for lazy loading
        setupNavigationObserver();

        console.log('[completion] All feature completions initialized');
    }

    /**
     * Replace "coming soon" toast handlers with real functionality
     */
    function patchAddProductButtons() {
        // Find all elements with inline onclick showing "coming soon" toast for products
        var allElements = document.querySelectorAll('[onclick]');
        var pattern = /Product management will be available soon/i;

        for (var i = 0; i < allElements.length; i++) {
            var el = allElements[i];
            var onclick = el.getAttribute('onclick') || '';
            
            if (pattern.test(onclick)) {
                // Store original handler reference
                el.dataset.originalOnclick = onclick;
                
                // Remove original handler
                el.removeAttribute('onclick');
                
                // Add new handler
                (function (element) {
                    element.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        if (typeof ProductManagerComplete !== 'undefined') {
                            ProductManagerComplete.showAddProductModal();
                        } else {
                            showToast('Product management is loading...', 'info');
                        }
                    });
                })(el);

                console.log('[completion] Patched Add Product button');
            }
        }
    }

    /**
     * Patch other "coming soon" placeholders
     */
    function patchComingSoonFeatures() {
        var allElements = document.querySelectorAll('[onclick]');
        
        // Analytics buttons
        var analyticsPattern = /Analytics will be available soon/i;
        for (var i = 0; i < allElements.length; i++) {
            var el = allElements[i];
            var onclick = el.getAttribute('onclick') || '';
            
            if (analyticsPattern.test(onclick)) {
                (function (element) {
                    element.removeAttribute('onclick');
                    element.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        if (typeof DashboardCompletion !== 'undefined') {
                            DashboardCompletion.viewBasicAnalytics();
                        } else {
                            showToast('Analytics loading...', 'info');
                        }
                    });
                })(el);
            }
        }

        // Checkout button
        var checkoutPattern = /Checkout will be available/i;
        for (var j = 0; j < allElements.length; j++) {
            var checkoutEl = allElements[j];
            var checkoutOnclick = checkoutEl.getAttribute('onclick') || '';
            
            if (checkoutPattern.test(checkoutOnclick)) {
                (function (element) {
                    element.removeAttribute('onclick');
                    element.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Navigate to checkout if CheckoutManager exists
                        if (typeof window.CheckoutManager !== 'undefined' && typeof window.CheckoutManager.initCheckout === 'function') {
                            window.CheckoutManager.initCheckout();
                        } else {
                            navigateTo('checkout');
                        }
                    });
                })(checkoutEl);
            }
        }
    }

    /**
     * Setup observer for view navigation to trigger lazy loading
     */
    function setupNavigationObserver() {
        // Watch for view changes to initialize sections as needed
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var mutation = mutations[i];
                
                // Check for view changes
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    var target = mutation.target;
                    
                    // Check if dashboard became visible
                    if (target.id === 'view-dashboard' && target.classList.contains('active')) {
                        if (typeof DashboardCompletion !== 'undefined') {
                            DashboardCompletion.initDashboard();
                        }
                    }
                    
                    // Check if library became visible
                    if (target.id === 'view-library' && target.classList.contains('active')) {
                        if (typeof LibraryManager !== 'undefined') {
                            LibraryManager.init();
                        }
                    }
                    
                    // Check if collections became visible
                    if ((target.id === 'view-collection' || target.id === 'view-collections') && target.classList.contains('active')) {
                        if (typeof CollectionManager !== 'undefined') {
                            CollectionManager.loadCollections();
                        }
                    }
                }
            }
        });

        // Start observing when DOM is ready
        if (document.body) {
            observer.observe(document.body, {
                attributes: true,
                subtree: true,
                attributeFilter: ['class']
            });
        }
    }


    // ═════════════════════════════════════════════════════════════════════════════════
    // SECTION: EXPOSE TO WINDOW & FINALIZE
    // ═════════════════════════════════════════════════════════════════════════════════

    // Expose managers to global scope
    window.DashboardCompletion = DashboardCompletion;
    window.ProductManagerComplete = ProductManagerComplete;
    window.LibraryManager = LibraryManager;
    window.CollectionManager = CollectionManager;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCompletions);
    } else {
        // Small delay to ensure other scripts loaded first
        setTimeout(initializeCompletions, 100);
    }

    console.log('[completion] K.Subject-1 Marketplace Completion Module loaded v1.0.0');

})();
