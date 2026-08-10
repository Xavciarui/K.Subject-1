/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 Marketplace — Feature Completion Module (FIXED VERSION)
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
 * FIXES APPLIED IN THIS VERSION:
 * - Issue #1: Image Upload button now properly patched
 * - Issue #2: Settings form field IDs corrected to match HTML
 * - Issue #3: Dashboard stats now self-sufficient (doesn't depend on missing DashboardManager)
 * - Issue #4: Custom modals replace browser confirm()/alert()
 * - Issue #5: XSS prevention via escapeHtml() on all dynamic content
 * - Issue #6: Filter/Sort UI added for product listing
 * 
 * VERSION: 2.0.0 (All Critical Issues Fixed)
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
        // Create safeGet if not exists
        window.safeGet = function (id) {
            try {
                return document.getElementById(id);
            } catch (e) {
                return null;
            }
        };
    }

    if (typeof window.showToast !== 'function') {
        // Create showToast if not exists
        window.showToast = function (message, type) {
            type = type || 'info';
            console.log('[toast] ' + type + ': ' + message);
            alert(type.toUpperCase() + ': ' + message);
        };
    }

    // Reference to global utilities
    var sb = window.sb;
    var safeGet = window.safeGet;
    var showToast = window.showToast;
    
    // FIXED: Enhanced escapeHtml with full XSS protection
    var escapeHtml = window.escapeHtml || function (str) { 
        if (str === null || str === undefined) return '';
        var input = String(str);
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/\//g, '&#x2F;');
    };
    
    // Make escapeHtml globally available
    window.escapeHtml = escapeHtml;
    
    var formatPrice = window.formatPrice || function (v) { return '$' + (Number(v) || 0).toFixed(2); };
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
    // FIXED: Custom Modal Functions (Replace browser alert/confirm)
    // ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Show custom styled confirmation dialog
     * FIXED: Replaces browser confirm() for consistent UI
     */
    function showConfirmDialog(title, message, onConfirm, onCancel) {
        // Remove any existing modal first
        closeCustomModal();
        
        var overlay = document.createElement('div');
        overlay.className = 'df-overlay';
        overlay.id='dfConfirmModal';
        overlay.innerHTML = 
            '<div class="df-box" style="max-width:420px" onclick="event.stopPropagation()">' +
                '<div class="df-head">' +
                    '<h3>' + escapeHtml(title) + '</h3>' +
                    '<button class="df-close" type="button" id="dfConfirmClose">&times;</button>' +
                '</div>' +
                '<div style="padding:24px;color:#ccc;line-height:1.7">' +
                    '<p style="font-size:15px;margin-bottom:24px">' + escapeHtml(message) + '</p>' +
                    '<div style="display:flex;gap:12px">' +
                        '<button type="button" id="dfConfirmCancel" class="df-btn-cancel" style="flex:1">Cancel</button>' +
                        '<button type="button" id="dfConfirmOk" class="df-btn-main" style="flex:1">Confirm</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        
        document.body.appendChild(overlay);
        
        // Event listeners
        document.getElementById('dfConfirmClose').onclick = function() { 
            closeCustomModal(); 
            if (typeof onCancel === 'function') onCancel(); 
        };
        document.getElementById('dfConfirmCancel').onclick = function() { 
            closeCustomModal(); 
            if (typeof onCancel === 'function') onCancel(); 
        };
        document.getElementById('dfConfirmOk').onclick = function() { 
            closeCustomModal(); 
            if (typeof onConfirm === 'function') onConfirm(); 
        };
        overlay.onclick = function(e) { 
            if (e.target === overlay) { 
                closeCustomModal(); 
                if (typeof onCancel === 'function') onCancel(); 
            } 
        };
        
        // Add styles if not exists
        addModalStyles();
    }

    /**
     * Show custom styled alert dialog
     * FIXED: Replaces browser alert() for consistent UI
     */
    function showAlertDialog(title, message, onOk) {
        closeCustomModal();
        
        var overlay = document.createElement('div');
        overlay.className = 'df-overlay';
        overlay.id='dfAlertModal';
        overlay.innerHTML = 
            '<div class="df-box" style="max-width:420px" onclick="event.stopPropagation()">' +
                '<div class="df-head">' +
                    '<h3>' + escapeHtml(title) + '</h3>' +
                    '<button class="df-close" type="button" id="dfAlertClose">&times;</button>' +
                '</div>' +
                '<div style="padding:24px;color:#ccc;line-height:1.7">' +
                    '<p style="font-size:15px;margin-bottom:24px">' + escapeHtml(message) + '</p>' +
                    '<button type="button" id="dfAlertOk" class="df-btn-main" style="width:100%">OK</button>' +
                '</div>' +
            '</div>';
        
        document.body.appendChild(overlay);
        
        document.getElementById('dfAlertClose').onclick = function() { 
            closeCustomModal(); 
            if (typeof onOk === 'function') onOk(); 
        };
        document.getElementById('dfAlertOk').onclick = function() { 
            closeCustomModal(); 
            if (typeof onOk === 'function') onOk(); 
        };
        overlay.onclick = function(e) { 
            if (e.target === overlay) closeCustomModal(); 
        };
        
        addModalStyles();
    }

    /**
     * Close any custom modal
     */
    function closeCustomModal() {
        var modal = document.getElementById('dfConfirmModal');
        if (modal) modal.remove();
        modal = document.getElementById('dfAlertModal');
        if (modal) modal.remove();
    }

    /**
     * Add modal styles if not already present
     */
    function addModalStyles() {
        if (document.getElementById('df-modal-styles')) return;
        
        var s = document.createElement('style');
        s.id = 'df-modal-styles';
        s.textContent = [
            '.df-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.9);z-index:999999;display:flex;align-items:center;justify-content:center;animation:.2s dfIn}@keyframes dfIn{from{opacity:0}to{opacity:1}}',
            '.df-box{background:#1a1a2e;border-radius:16px;width:94%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.15)}',
            '.df-head{display:flex;justify-content:space-between;align-items:center;padding:22px 26px;border-bottom:1px solid rgba(255,255,255,.1)}',
            '.df-head h3{margin:0;color:#fff;font-size:19px}',
            '.df-close{background:none;border:none;color:#888;font-size:30px;cursor:pointer;line-height:1}.df-close:hover{color:#fff}',
            '.df-body{padding:26px}',
            '.df-group{margin-bottom:20px}',
            '.df-group label{display:block;color:#aaa;font-size:12px;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}',
            '.df-group input,.df-group select,.df-group textarea{width:100%;padding:14px 16px;background:#16213e;border:2px solid rgba(255,255,255,.12);border-radius:10px;color:#fff;font-size:15px;box-sizing:border-box;transition:.2s}',
            '.df-group input:focus,.df-group select:focus,.df-group textarea:focus{outline:none;border-color:#e94560;box-shadow:0 0 0 4px rgba(233,69,96,.2)}',
            '.df-row{display:flex;gap:14px}.df-row .df-group{flex:1}',
            '.df-actions{display:flex;gap:12px;margin-top:26px;padding-top:22px;border-top:1px solid rgba(255,255,255,.1)}',
            '.df-btn-main{flex:1;padding:16px 28px;background:linear-gradient(135deg,#e94560,#c73e54);color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:800;cursor:pointer;transition:.25s}.df-btn-main:hover{transform:translateY(-3px);box-shadow:0 10px 30px rgba(233,69,96,.5)}.df-btn-main:disabled{opacity:.5;cursor:not-allowed;transform:none}',
            '.df-btn-cancel{padding:16px 28px;background:transparent;color:#888;border:2px solid rgba(255,255,255,.2);border-radius:10px;font-size:16px;cursor:pointer;transition:.2s}.df-btn-cancel:hover{background:rgba(255,255,255,.05);color:#fff}'
        ].join('');
        document.head.appendChild(s);
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
            this.loadDashboardStatsEnhanced();  // FIXED: Use enhanced version
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
            var statCards = document.querySelectorAll('.dash-stat-card .stat-value, .dash-count-anim');
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
                    var searchInput = this;
                    debounceTimer = setTimeout(function () {
                        self.filterDashboardProducts(searchInput.value);
                    }, 300);
                });
            }

            // FIXED: Add filter dropdown handler
            var productFilter = safeGet('dashProductFilter');
            if (productFilter) {
                productFilter.addEventListener('change', function () {
                    self.filterDashboardByStatus(this.value);
                });
            }

            // FIXED: Add sort dropdown handler
            var productSort = safeGet('dashProductSort');
            if (productSort) {
                productSort.addEventListener('change', function () {
                    self.sortDashboardProducts(this.value);
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
                case 'library':
                    if (typeof LibraryManager !== 'undefined') {
                        LibraryManager.loadLibraryItems();
                    }
                    break;
                case 'collections':
                    if (typeof CollectionManager !== 'undefined') {
                        CollectionManager.loadCollections();
                    }
                    break;
            }
        },

        /**
         * FIXED: Handle settings submission with CORRECT field IDs matching HTML
         */
        handleSettingsSubmit: function () {
            var settings = {};

            // FIXED: Use correct field IDs that match actual HTML
            var shopName = safeGet('settingsShopName');
            if (shopName) settings.brand_name = shopName.value;

            var description = safeGet('settingsDesc');
            if (description) settings.description = description.value;

            var phone = safeGet('settingsPhone');
            if (phone) settings.phone = phone.value;

            var address = safeGet('settingsAddress');
            if (address) settings.address_line1 = address.value;

            var email = safeGet('settingsEmail');
            // Email is typically read-only from auth, but allow if editable
            
            // Also support legacy field names if they exist
            var firstName = safeGet('settingsFirstName');
            if (firstName) settings.first_name = firstName.value;

            var lastName = safeGet('settingsLastName');
            if (lastName) settings.last_name = lastName.value;

            var brandName = safeGet('settingsBrandName');
            if (brandName && !settings.brand_name) settings.brand_name = brandName.value;

            var descField = safeGet('settingsDescription');
            if (descField && !settings.description) settings.description = descField.value;

            var addressLine1 = safeGet('settingsAddressLine1');
            if (addressLine1 && !settings.address_line1) settings.address_line1 = addressLine1.value;

            var city = safeGet('settingsCity');
            if (city) settings.city = city.value;

            var region = safeGet('settingsRegion');
            if (region) settings.region = region.value;

            var postalCode = safeGet('settingsPostalCode');
            if (postalCode) settings.postal_code = postalCode.value;

            console.log('[dashboard] Saving settings:', settings);

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
                .then(function (result) {
                    if (result.error) throw result.error;
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
         * FIXED: Load current settings into form fields with CORRECT IDs
         */
        loadSettingsData: function () {
            var user = window.currentUser;
            if (!user) return;

            // FIXED: Field map now matches actual HTML IDs
            var fieldMap = {
                // Primary field IDs (matching actual HTML)
                'settingsShopName': user.brand_name,
                'settingsDesc': user.description,
                'settingsPhone': user.phone,
                'settingsAddress': user.address_line1,
                'settingsEmail': user.email,
                
                // Legacy/alternative field IDs (if they exist)
                'settingsFirstName': user.first_name,
                'settingsLastName': user.last_name,
                'settingsBrandName': user.brand_name,
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
            var fileExt = file.name.split('.').pop().toLowerCase();
            var fileName = 'avatar_' + user.id + '_' + Date.now() + '.' + fileExt;

            sb.storage.from('avatars')
                .upload(fileName, file, { cacheControl: '3600', upsert: true })
                .then(function (uploadResult) {
                    if (uploadResult.error) throw uploadResult.error;

                    // Get public URL
                    var publicUrl = sb.storage.from('avatars').getPublicUrl(fileName);

                    // Update profile with new avatar URL
                    return sb.from('profiles').update({ avatar_url: publicUrl.data.publicURL }).eq('id', user.id);
                })
                .then(function (result) {
                    if (result && result.error) throw result.error;
                    
                    showToast('Profile image updated!', 'success');
                    
                    // Update local user object
                    if (typeof window.refreshCurrentUser === 'function') {
                        window.refreshCurrentUser();
                    } else if (window.currentUser) {
                        var publicUrlData = sb.storage.from('avatars').getPublicUrl(fileName);
                        window.currentUser.avatar_url = publicUrlData.data ? publicUrlData.data.publicURL : publicUrlData.publicURL;
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
                        showToast('Failed to upload image. Please check your connection and try again.', 'error');
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
                    .then(function (result) {
                        if (result.error) throw result.error;
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
         * FIXED: Filter products by status
         * @param {string} status - Status to filter by
         */
        filterDashboardByStatus: function (status) {
            var container = safeGet('dashProductsList');
            if (!container) return;

            var rows = container.querySelectorAll('.dash-product-row');
            
            for (var i = 0; i < rows.length; i++) {
                if (!status || status === 'all') {
                    rows[i].style.display = '';
                } else {
                    var rowStatus = rows[i].getAttribute('data-status') || '';
                    if (rowStatus === status) {
                        rows[i].style.display = '';
                    } else {
                        rows[i].style.display = 'none';
                    }
                }
            }
        },

        /**
         * FIXED: Sort products in dashboard list
         * @param {string} sortBy - Sort criteria
         */
        sortDashboardProducts: function (sortBy) {
            var container = safeGet('dashProductsList');
            if (!container) return;

            var rows = Array.prototype.slice.call(container.querySelectorAll('.dash-product-row'));
            
            rows.sort(function (a, b) {
                switch (sortBy) {
                    case 'price_asc':
                        return parseFloat(a.getAttribute('data-price') || 0) - parseFloat(b.getAttribute('data-price') || 0);
                    case 'price_desc':
                        return parseFloat(b.getAttribute('data-price') || 0) - parseFloat(a.getAttribute('data-price') || 0);
                    case 'name_az':
                        return (a.getAttribute('data-title') || '').localeCompare(b.getAttribute('data-title') || '');
                    case 'name_za':
                        return (b.getAttribute('data-title') || '').localeCompare(a.getAttribute('data-title') || '');
                    case 'newest':
                        return new Date(b.getAttribute('data-created') || 0) - new Date(a.getAttribute('data-created') || 0);
                    case 'oldest':
                    default:
                        return new Date(a.getAttribute('data-created') || 0) - new Date(b.getAttribute('data-created') || 0);
                }
            });

            // Re-append sorted rows
            var fragment = document.createDocumentFragment();
            for (var i = 0; i < rows.length; i++) {
                fragment.appendChild(rows[i]);
            }
            container.appendChild(fragment);
        },

        /**
         * FIXED: Self-sufficient dashboard stats loader (doesn't depend on DashboardManager)
         * Queries Supabase directly and updates DOM elements
         */
        loadDashboardStatsEnhanced: function () {
            var user = window.currentUser;
            if (!user || !user.id) return;

            var userId = user.id;
            var role = user.role || 'seller';

            console.log('[dashboard] Loading stats for user:', userId);

            // Try to use get_seller_stats function first (more efficient)
            sb.rpc('get_seller_stats', { p_seller_id: userId })
                .then(function (result) {
                    if (result.error) throw result.error;
                    if (result.data && result.data.length > 0) {
                        updateStatElements(result.data[0]);
                    } else {
                        // Fallback to individual queries
                        loadStatsIndividually(userId);
                    }
                })
                .catch(function (err) {
                    console.warn('[dashboard] RPC failed, using individual queries:', err.message);
                    loadStatsIndividually(userId);
                });

            /**
             * Update stat DOM elements with data
             */
            function updateStatElements(data) {
                // Remove loading state from stat cards
                var statCards = document.querySelectorAll('.dash-stat-card .stat-value.loading, .dash-count-anim.loading');
                for (var i = 0; i < statCards.length; i++) {
                    statCards[i].classList.remove('loading');
                }

                // Update Total Products
                var totalProducts = safeGet('statTotalProducts');
                if (totalProducts) totalProducts.textContent = data.total_products || 0;

                // Update Active Products
                var activeProducts = safeGet('statActiveProducts');
                if (activeProducts) activeProducts.textContent = data.active_products || 0;

                // Update Revenue
                var revenue = safeGet('statRevenue');
                if (revenue) revenue.textContent = formatPrice(data.total_revenue || 0);

                // Update Orders
                var orders = safeGet('statOrders');
                if (orders) orders.textContent = data.total_orders || 0;

                // Update Views (if element exists)
                var views = safeGet('statViews');
                if (views) views.textContent = data.total_views || 0;

                // Also try alternative stat element IDs/names
                updateStatByClass('stat-total-products', data.total_products);
                updateStatByClass('stat-active-products', data.active_products);
                updateStatByClass('stat-revenue', formatPrice(data.total_revenue || 0));
                updateStatByClass('stat-orders', data.total_orders);
                updateStatByClass('stat-views', data.total_views);

                console.log('[dashboard] Stats loaded:', data);
            }

            /**
             * Helper to update stats by class name
             */
            function updateStatByClass(className, value) {
                var els = document.querySelectorAll('.' + className);
                for (var i = 0; i < els.length; i++) {
                    els[i].textContent = value;
                    els[i].classList.remove('loading');
                }
            }

            /**
             * Fallback: Load stats with individual queries
             */
            function loadStatsIndividually(uid) {
                Promise.all([
                    sb.from('products').select('id', { count: 'exact' }).eq('seller_id', uid),
                    sb.from('products').select('id', { count: 'exact' }).eq('seller_id', uid).eq('status', 'active'),
                    sb.from('orders').select('total', { count: 'exact' }).eq('seller_id', uid).neq('status', 'cancelled')
                ]).then(function (results) {
                    var stats = {
                        total_products: results[0].count || 0,
                        active_products: results[1].count || 0,
                        total_revenue: 0,
                        total_orders: results[2].count || 0,
                        pending_orders: 0,
                        total_views: 0
                    };

                    // Get revenue sum
                    return sb.from('orders').select('total').eq('seller_id', uid).neq('status', 'cancelled')
                        .then(function (revenueResult) {
                            if (revenueResult.data) {
                                var total = 0;
                                for (var i = 0; i < revenueResult.data.length; i++) {
                                    total += parseFloat(revenueResult.data[i].total) || 0;
                                }
                                stats.total_revenue = total;
                            }
                            return stats;
                        });
                }).then(function (stats) {
                    updateStatElements(stats);
                }).catch(function (err) {
                    console.error('[dashboard] Stats load error:', err);
                    
                    // Remove loading state even on error
                    var statCards = document.querySelectorAll('.dash-stat-card .stat-value.loading, .dash-count-anim.loading');
                    for (var i = 0; i < statCards.length; i++) {
                        statCards[i].classList.remove('loading');
                        statCards[i].textContent = '--';
                    }
                });
            }
        },

        /**
         * Load products for dashboard display
         */
        loadDashboardProducts: function () {
            var user = window.currentUser;
            if (!user || !user.id) return;

            var container = safeGet('dashProductsList');
            if (!container) return;

            console.log('[dashboard] Loading products');

            sb.from('products')
                .select('*, product_images(*)')
                .eq('seller_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50)
                .then(function (result) {
                    if (result.error) throw result.error;

                    var products = result.data || [];

                    if (products.length === 0) {
                        // FIXED: Better empty state with CTA
                        container.innerHTML = 
                            '<div class="text-center py-12">' +
                                '<div class="text-6xl mb-4">📦</div>' +
                                '<h3 class="text-xl font-bold text-white mb-2">No products yet</h3>' +
                                '<p class="text-gray-400 mb-6">Start by adding your first product to your store!</p>' +
                                '<button onclick="if(typeof ProductManagerComplete!==\'undefined\')ProductManagerComplete.showAddProductModal()" ' +
                                        'class="px-6 py-3 bg-accent hover:bg-accentDim text-bg font-semibold rounded-xl transition">' +
                                    '+ Add Your First Product' +
                                '</button>' +
                            '</div>';
                        return;
                    }

                    // Build product list HTML with proper escaping
                    var html = '';
                    for (var i = 0; i < products.length; i++) {
                        var p = products[i];
                        var images = p.product_images || [];
                        var primaryImage = '';
                        for (var j = 0; j < images.length; j++) {
                            if (images[j].is_primary) {
                                primaryImage = images[j].url;
                                break;
                            }
                        }
                        if (!primaryImage && images.length > 0) {
                            primaryImage = images[0].url;
                        }

                        // FIXED: Use escapeHtml for all dynamic content
                        var statusClass = p.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                          p.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                                          'bg-red-500/20 text-red-400';

                        html += 
                            '<div class="dash-product-row flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition" ' +
                                 'data-id="' + (p.id || '') + '" ' +
                                 'data-status="' + escapeHtml(p.status || '') + '" ' +
                                 'data-price="' + (p.price || 0) + '" ' +
                                 'data-title="' + escapeHtml(p.title || '') + '" ' +
                                 'data-created="' + (p.created_at || '') + '">' +
                                '<div class="w-16 h-16 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">' +
                                    (primaryImage ? 
                                        '<img src="' + escapeHtml(primaryImage) + '" alt="" class="w-full h-full object-cover">' :
                                        '<div class="w-full h-full flex items-center justify-center text-2xl">📦</div>') +
                                '</div>' +
                                '<div class="flex-1 min-w-0">' +
                                    '<h4 class="font-semibold text-white truncate">' + escapeHtml(p.title || 'Untitled') + '</h4>' +
                                    '<p class="text-accent font-bold">' + formatPrice(p.price) + '</p>' +
                                '</div>' +
                                '<span class="px-3 py-1 rounded-full text-xs font-medium ' + statusClass + '">' +
                                    escapeHtml(p.status || 'draft') +
                                '</span>' +
                                '<div class="flex gap-2">' +
                                    '<button onclick="if(typeof ProductManagerComplete!==\'undefined\')ProductManagerComplete.showEditProductModal(\'' + (p.id || '') + '\')" ' +
                                            'class="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="Edit">' +
                                        '<i class="fa-solid fa-pen-to-square"></i>' +
                                    '</button>' +
                                    '<button onclick="if(typeof ProductManagerComplete!==\'undefined\')ProductManagerComplete.handleDeleteProduct(\'' + (p.id || '') + '\')" ' +
                                            'class="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="Delete">' +
                                        '<i class="fa-solid fa-trash"></i>' +
                                    '</button>' +
                                '</div>' +
                            '</div>';
                    }

                    container.innerHTML = html;
                    console.log('[dashboard] Loaded ' + products.length + ' products');
                })
                .catch(function (err) {
                    console.error('[dashboard] Products load error:', err);
                    container.innerHTML = 
                        '<div class="text-center py-8 text-red-400">' +
                            '<p>Failed to load products. Please try again.</p>' +
                            '<button onclick="DashboardCompletion.loadDashboardProducts()" class="mt-4 px-4 py-2 bg-white/10 rounded-lg">Retry</button>' +
                        '</div>';
                });
        },

        /**
         * Load orders for dashboard display
         */
        loadDashboardOrders: function () {
            var user = window.currentUser;
            if (!user || !user.id) return;

            var container = safeGet('dashOrdersList');
            if (!container) return;

            console.log('[dashboard] Loading orders');

            sb.from('orders')
                .select('*, order_items(*, products(title))')
                .eq('seller_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20)
                .then(function (result) {
                    if (result.error) throw result.error;

                    var orders = result.data || [];

                    if (orders.length === 0) {
                        container.innerHTML = 
                            '<div class="text-center py-12">' +
                                '<div class="text-6xl mb-4">🛒</div>' +
                                '<h3 class="text-xl font-bold text-white mb-2">No orders yet</h3>' +
                                '<p class="text-gray-400">Orders will appear here when customers make purchases.</p>' +
                            '</div>';
                        return;
                    }

                    var html = '';
                    for (var i = 0; i < orders.length; i++) {
                        var o = orders[i];
                        var items = o.order_items || [];
                        
                        var statusColors = {
                            'pending': 'bg-yellow-500/20 text-yellow-400',
                            'processing': 'bg-blue-500/20 text-blue-400',
                            'shipped': 'bg-purple-500/20 text-purple-400',
                            'delivered': 'bg-green-500/20 text-green-400',
                            'cancelled': 'bg-red-500/20 text-red-400'
                        };
                        var statusClass = statusColors[o.status] || 'bg-gray-500/20 text-gray-400';

                        html += 
                            '<div class="p-4 bg-white/5 rounded-xl border border-white/10 mb-3">' +
                                '<div class="flex justify-between items-start mb-2">' +
                                    '<div>' +
                                        '<span class="text-sm text-gray-400">Order #' + String(o.id || '').substring(0, 8) + '</span>' +
                                        '<h4 class="font-semibold text-white">' + formatPrice(o.total) + '</h4>' +
                                    '</div>' +
                                    '<span class="px-3 py-1 rounded-full text-xs font-medium ' + statusClass + '">' +
                                        escapeHtml(o.status || 'pending') +
                                    '</span>' +
                                '</div>' +
                                '<p class="text-sm text-gray-400">' + (items.length || 0) + ' item(s) • ' + timeAgo(o.created_at) + '</p>' +
                            '</div>';
                    }

                    container.innerHTML = html;
                    console.log('[dashboard] Loaded ' + orders.length + ' orders');
                })
                .catch(function (err) {
                    console.error('[dashboard] Orders load error:', err);
                    container.innerHTML = 
                        '<div class="text-center py-8 text-red-400">' +
                            '<p>Failed to load orders.</p>' +
                        '</div>';
                });
        },

        /**
         * Load activity feed
         */
        loadActivityFeed: function () {
            var container = safeGet('dashActivityFeed');
            if (!container) return;

            // For now, show recent activity placeholder or combine recent products/orders
            var user = window.currentUser;
            if (!user || !user.id) return;

            Promise.all([
                sb.from('products').select('title, created_at, status').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(5),
                sb.from('orders').select('id, total, status, created_at').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(5)
            ]).then(function (results) {
                var products = results[0].data || [];
                var orders = results[1].data || [];

                var activities = [];

                // Add product activities
                for (var i = 0; i < products.length; i++) {
                    activities.push({
                        type: 'product',
                        action: products[i].status === 'active' ? 'published' : 'created',
                        title: products[i].title,
                        time: products[i].created_at
                    });
                }

                // Add order activities
                for (var j = 0; j < orders.length; j++) {
                    activities.push({
                        type: 'order',
                        action: 'order_' + orders[j].status,
                        title: 'Order #' + String(orders[j].id || '').substring(0, 8),
                        amount: orders[j].total,
                        time: orders[j].created_at
                    });
                }

                // Sort by time
                activities.sort(function (a, b) {
                    return new Date(b.time || 0) - new Date(a.time || 0);
                });

                if (activities.length === 0) {
                    container.innerHTML = 
                        '<div class="text-center py-8 text-gray-400">' +
                            '<p>No recent activity</p>' +
                        '</div>';
                    return;
                }

                var html = '';
                for (var k = 0; k < Math.min(activities.length, 10); k++) {
                    var act = activities[k];
                    var icon = act.type === 'order' ? '🛒' : '📦';
                    var text = '';

                    if (act.type === 'product') {
                        if (act.action === 'published') {
                            text = 'Product <strong>' + escapeHtml(act.title) + '</strong> was published';
                        } else {
                            text = 'Product <strong>' + escapeHtml(act.title) + '</strong> was created as draft';
                        }
                    } else if (act.type === 'order') {
                        text = 'New order <strong>' + escapeHtml(act.title) + '</strong> for ' + formatPrice(act.amount);
                    }

                    html += 
                        '<div class="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">' +
                            '<span class="text-xl">' + icon + '</span>' +
                            '<div class="flex-1">' +
                                '<p class="text-sm text-gray-300">' + text + '</p>' +
                                '<p class="text-xs text-gray-500 mt-1">' + timeAgo(act.time) + '</p>' +
                            '</div>' +
                        '</div>';
                }

                container.innerHTML = html;
            }).catch(function (err) {
                console.error('[dashboard] Activity feed error:', err);
            });
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // SECTION: PRODUCT MANAGEMENT COMPLETION
    // ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Complete Product Manager with full CRUD functionality
     */
    var ProductManagerComplete = {

        /**
         * Show Add Product Modal
         */
        showAddProductModal: function () {
            _currentEditingProduct = null;
            _uploadedImages = [];
            var modalHtml = this.buildProductFormModal(null);
            this.showModal(modalHtml);
            this.attachFormHandlers();
        },

        /**
         * Show Edit Product Modal
         * @param {string} productId - UUID of product to edit
         */
        showEditProductModal: function (productId) {
            if (!productId || !isValidUuid(productId)) {
                showToast('Invalid product ID', 'error');
                return;
            }

            var self = this;
            showToast('Loading product...', 'info');

            sb.from('products')
                .select('*, categories(*), product_images(*)')
                .eq('id', productId)
                .single()
                .then(function (result) {
                    if (result.error) throw result.error;
                    if (!result.data) throw new Error('Product not found');

                    _currentEditingProduct = result.data;
                    _uploadedImages = result.data.product_images || [];
                    
                    var modalHtml = self.buildProductFormModal(result.data);
                    self.showModal(modalHtml);
                    self.attachFormHandlers();
                })
                .catch(function (err) {
                    console.error('Load product error:', err);
                    showToast('Failed to load product details: ' + (err.message || 'Unknown error'), 'error');
                });
        },

        /**
         * Build product form modal HTML
         * @param {Object} product - Existing product data (null for new)
         * @returns {string} HTML string
         */
        buildProductFormModal: function (product) {
            var isEdit = !!product;
            var title = isEdit ? 'Edit Product' : 'Add New Product';
            
            return '<div class="df-overlay" id="productModal">' +
                    '<div class="df-box" style="max-width:600px" onclick="event.stopPropagation()">' +
                        '<div class="df-head">' +
                            '<h3>' + (isEdit ? '✏️ ' : '✨ ') + escapeHtml(title) + '</h3>' +
                            '<button class="df-close" type="button" onclick="ProductManagerComplete.closeModal()">&times;</button>' +
                        '</div>' +
                        '<form id="productForm" class="df-body">' +
                            '<div class="df-group">' +
                                '<label for="prodTitle">Product Title *</label>' +
                                '<input type="text" id="prodTitle" name="title" required ' +
                                       'value="' + escapeHtml(product ? product.title : '') + '" ' +
                                       'placeholder="Enter product title" maxlength="200">' +
                            '</div>' +
                            
                            '<div class="df-row">' +
                                '<div class="df-group">' +
                                    '<label for="prodPrice">Price ($) *</label>' +
                                    '<input type="number" id="prodPrice" name="price" step="0.01" min="0" required ' +
                                           'value="' + (product ? product.price : '') + '" placeholder="0.00">' +
                                '</div>' +
                                '<div class="df-group">' +
                                    '<label for="prodComparePrice">Compare at Price</label>' +
                                    '<input type="number" id="prodComparePrice" name="compare_price" step="0.01" min="0" ' +
                                           'value="' + (product ? product.compare_price : '') + '" placeholder="Optional">' +
                                '</div>' +
                            '</div>' +

                            '<div class="df-row">' +
                                '<div class="df-group">' +
                                    '<label for="prodCategory">Category</label>' +
                                    '<select id="prodCategory" name="category">' +
                                        '<option value="">Select category...</option>' +
                                        '<option value="electronics"' + (product && product.category === 'electronics' ? ' selected' : '') + '>Electronics</option>' +
                                        '<option value="clothing"' + (product && product.category === 'clothing' ? ' selected' : '') + '>Clothing</option>' +
                                        '<option value="home"' + (product && product.category === 'home' ? ' selected' : '') + '>Home & Garden</option>' +
                                        '<option value="books"' + (product && product.category === 'books' ? ' selected' : '') + '>Books</option>' +
                                        '<option value="toys"' + (product && product.category === 'toys' ? ' selected' : '') + '>Toys & Games</option>' +
                                        '<option value="sports"' + (product && product.category === 'sports' ? ' selected' : '') + '>Sports</option>' +
                                        '<option value="art"' + (product && product.category === 'art' ? ' selected' : '') + '>Art & Crafts</option>' +
                                        '<option value="other"' + (product && product.category === 'other' ? ' selected' : '') + '>Other</option>' +
                                    '</select>' +
                                '</div>' +
                                '<div class="df-group">' +
                                    '<label for="prodStatus">Status</label>' +
                                    '<select id="prodStatus" name="status">' +
                                        '<option value="draft"' + (!product || product.status === 'draft' ? ' selected' : '') + '>Draft</option>' +
                                        '<option value="active"' + (product && product.status === 'active' ? ' selected' : '') + '>Active/Published</option>' +
                                        '<option value="archived"' + (product && product.status === 'archived' ? ' selected' : '') + '>Archived</option>' +
                                    '</select>' +
                                '</div>' +
                            '</div>' +

                            '<div class="df-group">' +
                                '<label for="prodDescription">Description</label>' +
                                '<textarea id="prodDescription" name="description" rows="4" ' +
                                          'placeholder="Describe your product...">' + 
                                          (product ? escapeHtml(product.description || '') : '') + 
                                '</textarea>' +
                            '</div>' +

                            '<div class="df-row">' +
                                '<div class="df-group">' +
                                    '<label for="prodStock">Stock Quantity</label>' +
                                    '<input type="number" id="prodStock" name="stock_quantity" min="0" ' +
                                           'value="' + (product ? (product.stock_quantity || 0) : '1') + '">' +
                                '</div>' +
                                '<div class="df-group">' +
                                    '<label for="prodSku">SKU</label>' +
                                    '<input type="text" id="prodSku" name="sku" ' +
                                           'value="' + escapeHtml(product ? product.sku : '') + '" ' +
                                           'placeholder="PROD-001 (optional)">' +
                                '</div>' +
                            '</div>' +

                            '<div class="df-group">' +
                                '<label>Product Images</label>' +
                                '<div id="imageUploadArea" class="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-accent transition">' +
                                    '<i class="fa-solid fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>' +
                                    '<p class="text-sm text-gray-400">Click or drag images here to upload</p>' +
                                    '<p class="text-xs text-gray-500 mt-1">JPEG, PNG, GIF, WebP (max 5MB each)</p>' +
                                    '<input type="file" id="prodImages" accept="image/*" multiple class="hidden">' +
                                '</div>' +
                                '<div id="imagePreviewArea" class="grid grid-cols-4 gap-3 mt-4">' +
                                    /* Image previews will be added here */ +
                                '</div>' +
                            '</div>' +

                            '<div class="df-actions">' +
                                '<button type="submit" id="prodSaveBtn" class="df-btn-main">' +
                                    (isEdit ? '💾 Save Changes' : '🚀 Create Product') +
                                '</button>' +
                                '<button type="button" class="df-btn-cancel" onclick="ProductManagerComplete.closeModal()">Cancel</button>' +
                            '</div>' +
                        '</form>' +
                    '</div>' +
                '</div>';
        },

        /**
         * Show modal with HTML content
         */
        showModal: function (html) {
            // Remove existing modal first
            this.closeModal();
            
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            var modal = tempDiv.firstChild;
            document.body.appendChild(modal);
            
            addModalStyles();
            
            // Close on overlay click
            modal.addEventListener('click', function (e) {
                if (e.target === modal) {
                    ProductManagerComplete.closeModal();
                }
            });

            // Focus first input
            setTimeout(function () {
                var firstInput = modal.querySelector('input:not([type="hidden"]), textarea, select');
                if (firstInput) firstInput.focus();
            }, 150);
        },

        /**
         * Close product modal
         */
        closeModal: function () {
            var modal = document.getElementById('productModal');
            if (modal) modal.remove();
        },

        /**
         * Attach event handlers to form elements
         */
        attachFormHandlers: function () {
            var self = this;

            // Form submission
            var form = document.getElementById('productForm');
            if (form) {
                form.addEventListener('submit', function (e) {
                    e.preventDefault();
                    self.handleSaveProduct();
                });
            }

            // Image upload area click
            var uploadArea = document.getElementById('imageUploadArea');
            var fileInput = document.getElementById('prodImages');
            if (uploadArea && fileInput) {
                uploadArea.addEventListener('click', function () {
                    fileInput.click();
                });
                
                fileInput.addEventListener('change', function (e) {
                    self.handleImageSelect(e.target.files);
                });

                // Drag and drop
                uploadArea.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    uploadArea.classList.add('border-accent', 'bg-accent/10');
                });
                
                uploadArea.addEventListener('dragleave', function (e) {
                    e.preventDefault();
                    uploadArea.classList.remove('border-accent', 'bg-accent/10');
                });
                
                uploadArea.addEventListener('drop', function (e) {
                    e.preventDefault();
                    uploadArea.classList.remove('border-accent', 'bg-accent/10');
                    self.handleImageSelect(e.dataTransfer.files);
                });
            }

            // Load existing images if editing
            if (_uploadedImages && _uploadedImages.length > 0) {
                this.renderImagePreviews();
            }
        },

        /**
         * Handle image file selection
         * @param {FileList} files - Selected files
         */
        handleImageSelect: function (files) {
            if (!files || files.length === 0) return;

            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    showToast(file.name + ' is not an image file', 'warning');
                    continue;
                }

                // Validate file size (5MB max)
                if (file.size > 5 * 1024 * 1024) {
                    showToast(file.name + ' is too large (max 5MB)', 'warning');
                    continue;
                }

                // Add to uploaded images array
                var tempImage = {
                    id: generateTempId(),
                    file: file,
                    url: URL.createObjectURL(file),
                    is_primary: _uploadedImages.length === 0,
                    isNew: true
                };
                _uploadedImages.push(tempImage);
            }

            this.renderImagePreviews();
        },

        /**
         * Render image preview thumbnails
         */
        renderImagePreviews: function () {
            var container = document.getElementById('imagePreviewArea');
            if (!container) return;

            var html = '';
            for (var i = 0; i < _uploadedImages.length; i++) {
                var img = _uploadedImages[i];
                html += 
                    '<div class="relative group rounded-lg overflow-hidden bg-white/10 aspect-square">' +
                        '<img src="' + escapeHtml(img.url || '') + '" alt="" class="w-full h-full object-cover">' +
                        '<div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">' +
                            (!_uploadedImages[i].is_primary ?
                                '<button type="button" onclick="ProductManagerComplete.setPrimaryImage(' + i + ')" ' +
                                        'class="p-2 bg-white/20 rounded-full hover:bg-white/40" title="Set as primary">' +
                                    '<i class="fa-solid fa-star text-white text-xs"></i>' +
                                '</button>' : '') +
                            '<button type="button" onclick="ProductManagerComplete.removeImage(' + i + ')" ' +
                                    'class="p-2 bg-red-500/80 rounded-full hover:bg-red-600" title="Remove">' +
                                '<i class="fa-solid fa-times text-white text-xs"></i>' +
                            '</button>' +
                        '</div>' +
                        (_uploadedImages[i].is_primary ? 
                            '<span class="absolute top-1 left-1 px-2 py-0.5 bg-accent text-bg text-xs rounded-full font-medium">Primary</span>' 
                            : '') +
                    '</div>';
            }

            container.innerHTML = html;
        },

        /**
         * Set image as primary
         * @param {number} index - Image index in array
         */
        setPrimaryImage: function (index) {
            if (index < 0 || index >= _uploadedImages.length) return;

            for (var i = 0; i < _uploadedImages.length; i++) {
                _uploadedImages[i].is_primary = (i === index);
            }
            this.renderImagePreviews();
        },

        /**
         * Remove image from array
         * @param {number} index - Image index
         */
        removeImage: function (index) {
            if (index < 0 || index >= _uploadedImages.length) return;

            var removed = _uploadedImages.splice(index, 1)[0];
            
            // Revoke object URL to prevent memory leak
            if (removed.url && removed.url.startsWith('blob:')) {
                URL.revokeObjectURL(removed.url);
            }

            // If removed was primary, set first remaining as primary
            if (removed.is_primary && _uploadedImages.length > 0) {
                _uploadedImages[0].is_primary = true;
            }

            this.renderImagePreviews();
        },

        /**
         * Handle product save (create or update)
         */
        handleSaveProduct: function () {
            var self = this;
            var user = window.currentUser;
            
            if (!user || !user.id) {
                showToast('Please sign in first', 'error');
                return;
            }

            // Get form values
            var title = (document.getElementById('prodTitle').value || '').trim();
            var price = parseFloat(document.getElementById('prodPrice').value) || 0;
            var comparePrice = parseFloat(document.getElementById('prodComparePrice').value) || null;
            var category = document.getElementById('prodCategory').value || null;
            var status = document.getElementById('prodStatus').value || 'draft';
            var description = (document.getElementById('prodDescription').value || '').trim();
            var stockQuantity = parseInt(document.getElementById('prodStock').value) || 0;
            var sku = (document.getElementById('prodSku').value || '').trim();

            // Validation
            if (!title) {
                showToast('Please enter a product title', 'error');
                document.getElementById('prodTitle').focus();
                return;
            }

            if (price <= 0) {
                showToast('Please enter a valid price greater than 0', 'error');
                document.getElementById('prodPrice').focus();
                return;
            }

            // Prepare product data
            var productData = {
                seller_id: user.id,
                title: title,
                price: price,
                compare_price: comparePrice,
                category: category,
                status: status,
                description: description,
                stock_quantity: stockQuantity,
                sku: sku,
                is_active: status === 'active',
                published_at: status === 'active' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            };

            var saveBtn = document.getElementById('prodSaveBtn');
            var originalText = saveBtn.textContent;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            var saveOperation;

            if (_currentEditingProduct) {
                // Update existing product
                saveOperation = sb.from('products')
                    .update(productData)
                    .eq('id', _currentEditingProduct.id);
            } else {
                // Create new product
                productData.created_at = new Date().toISOString();
                saveOperation = sb.from('products')
                    .insert([productData])
                    .select();
            }

            saveOperation
                .then(function (result) {
                    if (result.error) throw result.error;

                    var productId = _currentEditingProduct ? _currentEditingProduct.id : result.data[0].id;

                    // Upload images if any
                    return self.saveProductImages(productId);
                })
                .then(function () {
                    showToast(
                        _currentEditingProduct ? 'Product updated successfully!' : 'Product created successfully!',
                        'success'
                    );
                    
                    self.closeModal();
                    
                    // Refresh product list
                    if (typeof DashboardCompletion !== 'undefined') {
                        DashboardCompletion.loadDashboardProducts();
                        DashboardCompletion.loadDashboardStatsEnhanced();
                    }
                })
                .catch(function (err) {
                    console.error('Save product error:', err);
                    showToast('Failed to save product: ' + (err.message || 'Unknown error'), 'error');
                })
                .finally(function () {
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalText;
                });
        },

        /**
         * Save product images to Supabase Storage
         * @param {string} productId - Product UUID
         * @returns {Promise}
         */
        saveProductImages: function (productId) {
            var newImages = _uploadedImages.filter(function (img) { return img.isNew; });
            
            if (newImages.length === 0) {
                return Promise.resolve();
            }

            var uploadPromises = [];

            for (var i = 0; i < newImages.length; i++) {
                (function (image) {
                    var promise = sb.storage.from('product-images')
                        .upload(
                            productId + '/' + Date.now() + '_' + image.file.name,
                            image.file,
                            { cacheControl: '3600', upsert: true }
                        )
                        .then(function (uploadResult) {
                            if (uploadResult.error) throw uploadResult.error;
                            
                            var publicUrl = sb.storage.from('product-images').getPublicUrl(uploadResult.data.path);
                            
                            // Insert into product_images table
                            return sb.from('product_images').insert([{
                                product_id: productId,
                                url: publicUrl.data.publicURL,
                                path: uploadResult.data.path,
                                is_primary: image.is_primary,
                                sort_order: _uploadedImages.indexOf(image)
                            }]);
                        });
                    
                    uploadPromises.push(promise);
                })(newImages[i]);
            }

            return Promise.all(uploadPromises);
        },

        /**
         * FIXED: Delete product with custom confirmation dialog
         * @param {string} productId - Product UUID
         */
        handleDeleteProduct: function (productId) {
            if (!productId || !isValidUuid(productId)) {
                showToast('Invalid product ID', 'error');
                return;
            }

            // FIXED: Use custom confirm dialog instead of browser confirm()
            showConfirmDialog(
                'Delete Product',
                'Are you sure you want to delete this product? This action cannot be undone and will permanently remove the product and all its images.',
                function () { // onConfirm
                    showToast('Deleting product...', 'info');

                    sb.from('products')
                        .delete()
                        .eq('id', productId)
                        .then(function (result) {
                            if (result.error) throw result.error;
                            
                            showToast('Product deleted successfully', 'success');
                            
                            // Refresh lists
                            if (typeof DashboardCompletion !== 'undefined') {
                                DashboardCompletion.loadDashboardProducts();
                                DashboardCompletion.loadDashboardStatsEnhanced();
                            }
                        })
                        .catch(function (err) {
                            console.error('Delete product error:', err);
                            showToast('Failed to delete product: ' + (err.message || 'Unknown error'), 'error');
                        });
                },
                function () { // onCancel - do nothing
                    console.log('[product] Delete cancelled');
                }
            );
        },

        /**
         * Change product status
         * @param {string} productId - Product UUID
         * @param {string} newStatus - New status value
         */
        changeProductStatus: function (productId, newStatus) {
            if (!productId || !newStatus) return;

            var validStatuses = ['draft', 'active', 'archived', 'sold_out'];
            if (validStatuses.indexOf(newStatus) === -1) return;

            sb.from('products')
                .update({
                    status: newStatus,
                    is_active: newStatus === 'active',
                    published_at: newStatus === 'active' ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productId)
                .then(function (result) {
                    if (result.error) throw result.error;
                    showToast('Product status updated to ' + newStatus, 'success');
                    
                    if (typeof DashboardCompletion !== 'undefined') {
                        DashboardCompletion.loadDashboardProducts();
                    }
                })
                .catch(function (err) {
                    console.error('Status change error:', err);
                    showToast('Failed to update status', 'error');
                });
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // SECTION: LIBRARY/ASSET MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Complete Library Manager for asset/file management
     */
    var LibraryManager = {

        /**
         * Load library items for current user
         */
        loadLibraryItems: function () {
            var user = window.currentUser;
            if (!user || !user.id) return;

            var container = safeGet('libraryContent') || safeGet('libraryGrid');
            if (!container) return;

            console.log('[library] Loading library items');

            sb.from('library_items')
                .select('*')
                .eq('user_id', user.id)
                .order('uploaded_at', { ascending: false })
                .limit(100)
                .then(function (result) {
                    if (result.error) throw result.error;

                    _libraryItemsCache = result.data || [];
                    renderLibraryList(_libraryItemsCache);
                })
                .catch(function (err) {
                    console.error('[library] Load error:', err);
                    if (container) {
                        container.innerHTML = '<p class="text-red-400 text-center py-8">Failed to load library items.</p>';
                    }
                });

            var self = this;

            function renderLibraryList(items) {
                if (!container) return;

                if (items.length === 0) {
                    container.innerHTML = 
                        '<div class="text-center py-12">' +
                            '<div class="text-6xl mb-4">📁</div>' +
                            '<h3 class="text-xl font-bold text-white mb-2">No files in library</h3>' +
                            '<p class="text-gray-400 mb-6">Upload files to use in your products and collections.</p>' +
                            '<button onclick="LibraryManager.showUploadModal()" ' +
                                    'class="px-6 py-3 bg-accent hover:bg-accentDim text-bg font-semibold rounded-xl transition">' +
                                '📤 Upload Files' +
                            '</button>' +
                        '</div>';
                    return;
                }

                var html = '';
                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    var icon = getFileIcon(item.file_type);
                    var sizeText = formatFileSize(item.file_size);

                    html += 
                        '<div class="library-item flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition" ' +
                             'data-id="' + (item.id || '') + '">' +
                            '<div class="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">' +
                                icon +
                            '</div>' +
                            '<div class="flex-1 min-w-0">' +
                                '<h4 class="font-medium text-white truncate">' + escapeHtml(item.name || 'Unnamed file') + '</h4>' +
                                '<p class="text-sm text-gray-400">' + escapeHtml(item.file_type || 'file') + ' • ' + sizeText + '</p>' +
                            '</div>' +
                            '<div class="flex gap-2">' +
                                '<button onclick="LibraryManager.previewItem(\'' + (item.id || '') + '\')" ' +
                                        'class="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="Preview">' +
                                    '<i class="fa-solid fa-eye"></i>' +
                                '</button>' +
                                '<button onclick="LibraryManager.useInProduct(\'' + (item.id || '') + '\')" ' +
                                        'class="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition" title="Use in Product">' +
                                    '<i class="fa-solid fa-plus"></i>' +
                                '</button>' +
                                '<button onclick="LibraryManager.deleteItem(\'' + (item.id || '') + '\')" ' +
                                        'class="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="Delete">' +
                                    '<i class="fa-solid fa-trash"></i>' +
                                '</button>' +
                            '</div>' +
                        '</div>';
                }

                container.innerHTML = html;
            }

            function getFileIcon(fileType) {
                switch (fileType) {
                    case 'image': return '🖼️';
                    case 'document': return '📄';
                    case 'video': return '🎬';
                    case 'audio': return '🎵';
                    default: return '📎';
                }
            }
        },

        /**
         * Show upload modal
         */
        showUploadModal: function () {
            var self = this;
            
            var modalHtml = 
                '<div class="df-overlay" id="libraryUploadModal">' +
                    '<div class="df-box" style="max-width:500px" onclick="event.stopPropagation()">' +
                        '<div class="df-head">' +
                            '<h3>📤 Upload Files</h3>' +
                            '<button class="df-close" type="button" onclick="LibraryManager.closeUploadModal()">&times;</button>' +
                        '</div>' +
                        '<div class="df-body">' +
                            '<div id="libDropZone" class="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-accent transition mb-4">' +
                                '<i class="fa-solid fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>' +
                                '<p class="text-gray-300 mb-2">Drag & drop files here</p>' +
                                '<p class="text-sm text-gray-500">or click to browse</p>' +
                                '<p class="text-xs text-gray-500 mt-2">Max 10MB per file</p>' +
                                '<input type="file" id="libFileInput" multiple class="hidden">' +
                            '</div>' +
                            '<div id="libUploadProgress" class="hidden">' +
                                '<div class="flex items-center gap-3 mb-2">' +
                                    '<div class="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">' +
                                        '<div id="libProgressBar" class="h-full bg-accent transition-all duration-300" style="width:0%"></div>' +
                                    '</div>' +
                                    '<span id="libProgressText" class="text-sm text-gray-400">0%</span>' +
                                '</div>' +
                            '</div>' +
                            '<div class="df-actions">' +
                                '<button type="button" id="libUploadBtn" class="df-btn-main" disabled>Upload Files</button>' +
                                '<button type="button" class="df-btn-cancel" onclick="LibraryManager.closeUploadModal()">Cancel</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';

            // Remove existing modal
            this.closeUploadModal();
            
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = modalHtml;
            document.body.appendChild(tempDiv.firstChild);
            
            addModalStyles();

            // Setup events
            var dropZone = document.getElementById('libDropZone');
            var fileInput = document.getElementById('libFileInput');
            var uploadBtn = document.getElementById('libUploadBtn');
            var selectedFiles = [];

            if (dropZone && fileInput) {
                dropZone.addEventListener('click', function () { fileInput.click(); });
                
                fileInput.addEventListener('change', function (e) {
                    selectedFiles = Array.prototype.slice.call(e.target.files || []);
                    if (selectedFiles.length > 0) {
                        uploadBtn.disabled = false;
                        uploadBtn.textContent = 'Upload (' + selectedFiles.length + ' file(s))';
                    }
                });

                // Drag and drop
                dropZone.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    dropZone.classList.add('border-accent', 'bg-accent/10');
                });
                dropZone.addEventListener('dragleave', function (e) {
                    e.preventDefault();
                    dropZone.classList.remove('border-accent', 'bg-accent/10');
                });
                dropZone.addEventListener('drop', function (e) {
                    e.preventDefault();
                    dropZone.classList.remove('border-accent', 'bg-accent/10');
                    selectedFiles = Array.prototype.slice.call(e.dataTransfer.files || []);
                    if (selectedFiles.length > 0) {
                        uploadBtn.disabled = false;
                        uploadBtn.textContent = 'Upload (' + selectedFiles.length + ' file(s))';
                    }
                });
            }

            if (uploadBtn) {
                uploadBtn.addEventListener('click', function () {
                    if (selectedFiles.length > 0) {
                        self.processFileUpload(selectedFiles);
                    }
                });
            }
        },

        /**
         * Close upload modal
         */
        closeUploadModal: function () {
            var modal = document.getElementById('libraryUploadModal');
            if (modal) modal.remove();
        },

        /**
         * Process file uploads
         * @param {Array} files - Array of File objects
         */
        processFileUpload: function (files) {
            var user = window.currentUser;
            if (!user || !user.id) {
                showToast('Please sign in first', 'error');
                return;
            }

            var progressContainer = document.getElementById('libUploadProgress');
            var progressBar = document.getElementById('libProgressBar');
            var progressText = document.getElementById('libProgressText');
            var uploadBtn = document.getElementById('libUploadBtn');

            if (progressContainer) progressContainer.classList.remove('hidden');
            if (uploadBtn) {
                uploadBtn.disabled = true;
                uploadBtn.textContent = 'Uploading...';
            }

            var totalFiles = files.length;
            var completedFiles = 0;
            var errors = [];

            function updateProgress() {
                var percent = Math.round((completedFiles / totalFiles) * 100);
                if (progressBar) progressBar.style.width = percent + '%';
                if (progressText) progressText.textContent = percent + '%';
            }

            for (var i = 0; i < files.length; i++) {
                (function (file) {
                    var fileType = getFileTypeFromMime(file.type);
                    var fileName = 'library/' + user.id + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

                    sb.storage.from('library')
                        .upload(fileName, file, { cacheControl: '3600', upsert: true })
                        .then(function (uploadResult) {
                            if (uploadResult.error) throw uploadResult.error;

                            var publicUrl = sb.storage.from('library').getPublicUrl(fileName);

                            return sb.from('library_items').insert([{
                                user_id: user.id,
                                name: file.name,
                                url: publicUrl.data ? publicUrl.data.publicURL : publicUrl.publicURL,
                                path: fileName,
                                file_type: fileType,
                                file_size: file.size,
                                mime_type: file.type
                            }]);
                        })
                        .then(function () {
                            completedFiles++;
                            updateProgress();
                            
                            if (completedFiles === totalFiles) {
                                setTimeout(function () {
                                    LibraryManager.closeUploadModal();
                                    LibraryManager.loadLibraryItems();
                                    
                                    if (errors.length === 0) {
                                        showToast(totalFiles + ' file(s) uploaded successfully!', 'success');
                                    } else {
                                        showToast('Uploaded ' + (totalFiles - errors.length) + ' of ' + totalFiles + ' files. Some failed.', 'warning');
                                    }
                                }, 500);
                            }
                        })
                        .catch(function (err) {
                            console.error('[library] Upload error:', err);
                            errors.push(file.name);
                            completedFiles++;
                            updateProgress();
                            
                            if (completedFiles === totalFiles) {
                                setTimeout(function () {
                                    LibraryManager.closeUploadModal();
                                    LibraryManager.loadLibraryItems();
                                    showToast('Some files failed to upload. Please try again.', 'error');
                                }, 500);
                            }
                        });
                })(files[i]);
            }

            function getFileTypeFromMime(mime) {
                if (!mime) return 'other';
                if (mime.startsWith('image/')) return 'image';
                if (mime.startsWith('video/')) return 'video';
                if (mime.startsWith('audio/')) return 'audio';
                if (mime.includes('pdf') || mime.includes('document') || mime.includes('text')) return 'document';
                return 'other';
            }
        },

        /**
         * Preview library item
         * @param {string} itemId - Item UUID
         */
        previewItem: function (itemId) {
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

            var modalHtml = 
                '<div class="df-overlay" id="libraryPreviewModal" onclick="LibraryManager.closePreviewModal()">' +
                    '<div class="df-box" style="max-width:700px" onclick="event.stopPropagation()">' +
                        '<div class="df-head">' +
                            '<h3>👁️ ' + escapeHtml(item.name) + '</h3>' +
                            '<button class="df-close" type="button" onclick="LibraryManager.closePreviewModal()">&times;</button>' +
                        '</div>' +
                        '<div class="df-body">' +
                            (item.file_type === 'image' ?
                                '<img src="' + escapeHtml(item.url) + '" alt="' + escapeHtml(item.name) + '" class="w-full rounded-lg max-h-96 object-contain">' :
                                '<div class="text-center py-8">' +
                                    '<div class="text-6xl mb-4">' + (item.file_type === 'video' ? '🎬' : item.file_type === 'audio' ? '🎵' : '📄') + '</div>' +
                                    '<p class="text-gray-400">Preview not available for this file type</p>' +
                                    '<a href="' + escapeHtml(item.url) + '" target="_blank" class="inline-block mt-4 px-4 py-2 bg-accent text-white rounded-lg">Open File</a>' +
                                '</div>'
                            ) +
                            '<div class="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4 text-sm">' +
                                '<div><span class="text-gray-400">Type:</span> <span class="text-white">' + escapeHtml(item.mime_type || item.file_type || 'Unknown') + '</span></div>' +
                                '<div><span class="text-gray-400">Size:</span> <span class="text-white">' + formatFileSize(item.file_size) + '</span></div>' +
                                '<div><span class="text-gray-400">Uploaded:</span> <span class="text-white">' + timeAgo(item.uploaded_at) + '</span></div>' +
                            '</div>' +
                            '<div class="mt-4">' +
                                '<button onclick="LibraryManager.useInProduct(\'' + itemId + '\')" class="df-btn-main w-full">+ Use in Product</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';

            this.closePreviewModal();
            
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = modalHtml;
            document.body.appendChild(tempDiv.firstChild);
            addModalStyles();
        },

        /**
         * Close preview modal
         */
        closePreviewModal: function () {
            var modal = document.getElementById('libraryPreviewModal');
            if (modal) modal.remove();
        },

        /**
         * Use library item in product (opens product form pre-filled)
         * @param {string} itemId - Item UUID
         */
        useInProduct: function (itemId) {
            var item = null;
            for (var i = 0; i < _libraryItemsCache.length; i++) {
                if (_libraryItemsCache[i].id === itemId) {
                    item = _libraryItemsCache[i];
                    break;
                }
            }

            if (!item) return;

            this.closePreviewModal();
            
            // Open add product modal
            if (typeof ProductManagerComplete !== 'undefined') {
                ProductManagerComplete.showAddProductModal();
                
                // Pre-fill with library item info after modal is open
                setTimeout(function () {
                    var descField = document.getElementById('prodDescription');
                    if (descField && item.file_type === 'image') {
                        descField.value = '[Image: ' + item.name + '](' + item.url + ')';
                    }
                }, 200);
            }
        },

        /**
         * FIXED: Delete library item with custom confirmation
         * @param {string} itemId - Item UUID
         */
        deleteItem: function (itemId) {
            var self = this;
            
            // Find item for context
            var item = null;
            for (var i = 0; i < _libraryItemsCache.length; i++) {
                if (_libraryItemsCache[i].id === itemId) {
                    item = _libraryItemsCache[i];
                    break;
                }
            }

            // FIXED: Use custom confirm dialog
            showConfirmDialog(
                'Delete File',
                'Are you sure you want to delete "' + (item ? item.name : 'this file') + '"? This cannot be undone.',
                function () { // onConfirm
                    showToast('Deleting file...', 'info');

                    // Delete from storage first
                    if (item && item.path) {
                        sb.storage.from('library').remove([item.path])
                            .then(function () {
                                // Then delete database record
                                return sb.from('library_items').delete().eq('id', itemId);
                            })
                            .then(function (result) {
                                if (result.error) throw result.error;
                                showToast('File deleted successfully', 'success');
                                self.loadLibraryItems();
                            })
                            .catch(function (err) {
                                console.error('[library] Delete error:', err);
                                
                                // Try deleting just the record if storage delete fails
                                return sb.from('library_items').delete().eq('id', itemId)
                                    .then(function (r) {
                                        if (r.error) throw r.error;
                                        showToast('File record deleted', 'success');
                                        self.loadLibraryItems();
                                    });
                            });
                    } else {
                        // No path, just delete record
                        sb.from('library_items').delete().eq('id', itemId)
                            .then(function (result) {
                                if (result.error) throw result.error;
                                showToast('File deleted successfully', 'success');
                                self.loadLibraryItems();
                            })
                            .catch(function (err) {
                                console.error('[library] Delete error:', err);
                                showToast('Failed to delete file', 'error');
                            });
                    }
                }
            );
        },

        /**
         * Search/filter library items
         * @param {string} query - Search term
         */
        searchLibrary: function (query) {
            var container = safeGet('libraryContent') || safeGet('libraryGrid');
            if (!container || !_libraryItemsCache.length) return;

            query = (query || '').toLowerCase().trim();
            
            var filtered = _libraryItemsCache.filter(function (item) {
                if (!query) return true;
                return (item.name || '').toLowerCase().indexOf(query) !== -1 ||
                       (item.file_type || '').toLowerCase().indexOf(query) !== -1;
            });

            // Re-render with filtered results (would need to extract render logic to shared function)
            // For now, just hide/show items
            var items = container.querySelectorAll('.library-item');
            for (var i = 0; i < items.length; i++) {
                var id = items[i].getAttribute('data-id');
                var visible = filtered.some(function (f) { return f.id === id; });
                items[i].style.display = visible ? '' : 'none';
            }
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // SECTION: COLLECTIONS MANAGER
    // ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Complete Collections Manager with CRUD and product linking
     */
    var CollectionManager = {

        /**
         * Load collections for current user
         */
        loadCollections: function () {
            var user = window.currentUser;
            if (!user || !user.id) return;

            var container = safeGet('collectionsList') || safeGet('collectionsContent');
            if (!container) return;

            console.log('[collections] Loading collections');

            sb.from('collections')
                .select('*, collection_products(*, products(id, title, price, product_images(url)))')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50)
                .then(function (result) {
                    if (result.error) throw result.error;

                    _collectionsCache = result.data || [];
                    renderCollections(_collectionsCache);
                })
                .catch(function (err) {
                    console.error('[collections] Load error:', err);
                    container.innerHTML = '<p class="text-red-400 text-center py-8">Failed to load collections.</p>';
                });

            var self = this;

            function renderCollections(collections) {
                if (!container) return;

                if (collections.length === 0) {
                    container.innerHTML = 
                        '<div class="text-center py-12">' +
                            '<div class="text-6xl mb-4">📚</div>' +
                            '<h3 class="text-xl font-bold text-white mb-2">No collections yet</h3>' +
                            '<p class="text-gray-400 mb-6">Collections help organize your products into groups.</p>' +
                            '<button onclick="CollectionManager.showCreateModal()" ' +
                                    'class="px-6 py-3 bg-accent hover:bg-accentDim text-bg font-semibold rounded-xl transition">' +
                                '+ Create Collection' +
                            '</button>' +
                        '</div>';
                    return;
                }

                var html = '';
                for (var i = 0; i < collections.length; i++) {
                    var col = collections[i];
                    var products = col.collection_products || [];
                    var productCount = products.length;

                    html += 
                        '<div class="collection-card bg-white/5 rounded-xl border border-white/10 p-4 hover:bg-white/10 transition" ' +
                             'data-id="' + (col.id || '') + '">' +
                            '<div class="flex justify-between items-start mb-3">' +
                                '<div>' +
                                    '<h4 class="font-bold text-white text-lg">' + escapeHtml(col.name || 'Untitled Collection') + '</h4>' +
                                    (col.description ? '<p class="text-sm text-gray-400 mt-1">' + escapeHtml(col.description) + '</p>' : '') +
                                '</div>' +
                                '<div class="flex gap-2">' +
                                    '<button onclick="CollectionManager.showEditModal(\'' + (col.id || '') + '\')" ' +
                                            'class="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="Edit">' +
                                        '<i class="fa-solid fa-pen-to-square"></i>' +
                                    '</button>' +
                                    '<button onclick="CollectionManager.deleteCollection(\'' + (col.id || '') + '\')" ' +
                                            'class="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="Delete">' +
                                        '<i class="fa-solid fa-trash"></i>' +
                                    '</button>' +
                                '</div>' +
                            '</div>' +
                            '<div class="flex items-center justify-between">' +
                                '<span class="text-sm text-gray-400">' + productCount + ' product(s)</span>' +
                                '<button onclick="CollectionManager.showDetailModal(\'' + (col.id || '') + '\')" ' +
                                        'class="text-sm text-accent hover:text-accentDim transition">View Details →</button>' +
                            '</div>' +
                            /* Product thumbnails */ +
                            (productCount > 0 ?
                                '<div class="flex gap-2 mt-3">' +
                                    products.slice(0, 4).map(function (cp) {
                                        var img = cp.products && cp.products.product_images && cp.products.product_images[0];
                                        return '<div class="w-12 h-12 rounded bg-white/10 overflow-hidden">' +
                                            (img ? '<img src="' + escapeHtml(img.url) + '" class="w-full h-full object-cover">' : '') +
                                           '</div>';
                                    }).join('') +
                                    (productCount > 4 ? '<div class="w-12 h-12 rounded bg-white/10 flex items-center justify-center text-xs text-gray-400">+' + (productCount - 4) + '</div>' : '') +
                                '</div>'
                                : ''
                            ) +
                        '</div>';
                }

                container.innerHTML = html;
            }
        },

        /**
         * Show create collection modal
         */
        showCreateModal: function () {
            this.showCollectionForm(null);
        },

        /**
         * Show edit collection modal
         * @param {string} collectionId - Collection UUID
         */
        showEditModal: function (collectionId) {
            if (!collectionId || !isValidUuid(collectionId)) return;

            var col = null;
            for (var i = 0; i < _collectionsCache.length; i++) {
                if (_collectionsCache[i].id === collectionId) {
                    col = _collectionsCache[i];
                    break;
                }
            }

            if (!col) {
                showToast('Collection not found', 'error');
                return;
            }

            this.showCollectionForm(col);
        },

        /**
         * Show collection form (create/edit)
         * @param {Object} collection - Existing collection (null for create)
         */
        showCollectionForm: function (collection) {
            var isEdit = !!collection;
            var title = isEdit ? 'Edit Collection' : 'Create New Collection';

            var modalHtml = 
                '<div class="df-overlay" id="collectionModal">' +
                    '<div class="df-box" style="max-width:500px" onclick="event.stopPropagation()">' +
                        '<div class="df-head">' +
                            '<h3>' + (isEdit ? '✏️ ' : '📚 ') + escapeHtml(title) + '</h3>' +
                            '<button class="df-close" type="button" onclick="CollectionManager.closeModal()">&times;</button>' +
                        '</div>' +
                        '<form id="collectionForm" class="df-body" onsubmit="return false;">' +
                            '<div class="df-group">' +
                                '<label for="colName">Collection Name *</label>' +
                                '<input type="text" id="colName" required maxlength="100" ' +
                                       'value="' + escapeHtml(collection ? collection.name : '') + '" ' +
                                       'placeholder="e.g., Summer Collection, Featured Items">' +
                            '</div>' +
                            '<div class="df-group">' +
                                '<label for="colDesc">Description</label>' +
                                '<textarea id="colDesc" rows="3" placeholder="Optional description...">' + 
                                    (collection ? escapeHtml(collection.description || '') : '') + 
                                '</textarea>' +
                            '</div>' +
                            '<div class="df-group">' +
                                '<label class="flex items-center gap-2 cursor-pointer">' +
                                    '<input type="checkbox" id="colPublic" ' + (collection && collection.is_public ? 'checked' : '') + ' class="w-4 h-4 rounded">' +
                                    '<span class="text-gray-300">Make this collection public</span>' +
                                '</label>' +
                            '</div>' +
                            '<div class="df-actions">' +
                                '<button type="submit" id="colSaveBtn" class="df-btn-main" onclick="CollectionManager.handleSave(\'' + (collection ? collection.id : '') + '\')">' +
                                    (isEdit ? '💾 Save Changes' : '🚀 Create Collection') +
                                '</button>' +
                                '<button type="button" class="df-btn-cancel" onclick="CollectionManager.closeModal()">Cancel</button>' +
                            '</div>' +
                        '</form>' +
                    '</div>' +
                '</div>';

            this.closeModal();
            
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = modalHtml;
            document.body.appendChild(tempDiv.firstChild);
            addModalStyles();
        },

        /**
         * Close collection modal
         */
        closeModal: function () {
            var modal = document.getElementById('collectionModal');
            if (modal) modal.remove();
            var detailModal = document.getElementById('collectionDetailModal');
            if (detailModal) detailModal.remove();
        },

        /**
         * Handle collection save (create or update)
         * @param {string} existingId - ID if editing, empty if creating
         */
        handleSave: function (existingId) {
            var user = window.currentUser;
            if (!user || !user.id) {
                showToast('Please sign in first', 'error');
                return;
            }

            var name = (document.getElementById('colName').value || '').trim();
            var description = (document.getElementById('colDesc').value || '').trim();
            var isPublic = document.getElementById('colPublic').checked;

            if (!name) {
                showToast('Please enter a collection name', 'error');
                return;
            }

            var saveBtn = document.getElementById('colSaveBtn');
            var originalText = saveBtn.textContent;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            var collectionData = {
                name: name,
                description: description || null,
                is_public: isPublic,
                updated_at: new Date().toISOString()
            };

            var saveOperation;

            if (existingId) {
                saveOperation = sb.from('collections')
                    .update(collectionData)
                    .eq('id', existingId);
            } else {
                collectionData.user_id = user.id;
                collectionData.created_at = new Date().toISOString();
                saveOperation = sb.from('collections')
                    .insert([collectionData]);
            }

            saveOperation
                .then(function (result) {
                    if (result.error) throw result.error;
                    
                    showToast(
                        existingId ? 'Collection updated!' : 'Collection created!',
                        'success'
                    );
                    
                    CollectionManager.closeModal();
                    CollectionManager.loadCollections();
                })
                .catch(function (err) {
                    console.error('[collections] Save error:', err);
                    showToast('Failed to save collection: ' + (err.message || 'Unknown error'), 'error');
                })
                .finally(function () {
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalText;
                });
        },

        /**
         * Show collection detail with products
         * @param {string} collectionId - Collection UUID
         */
        showDetailModal: function (collectionId) {
            var self = this;
            
            if (!collectionId || !isValidUuid(collectionId)) return;

            showToast('Loading collection...', 'info');

            sb.from('collections')
                .select('*, collection_products(*, products(*, product_images(*)))')
                .eq('id', collectionId)
                .single()
                .then(function (result) {
                    if (result.error) throw result.error;
                    if (!result.data) throw new Error('Collection not found');

                    var col = result.data;
                    var products = col.collection_products || [];

                    var productsHtml = '';
                    if (products.length === 0) {
                        productsHtml = 
                            '<div class="text-center py-8 text-gray-400">' +
                                '<p>No products in this collection yet.</p>' +
                                '<button onclick="CollectionManager.showAddProductModal(\'' + collectionId + '\')" ' +
                                        'class="mt-4 px-4 py-2 bg-accent text-white rounded-lg">+ Add Products</button>' +
                            '</div>';
                    } else {
                        for (var i = 0; i < products.length; i++) {
                            var cp = products[i];
                            var prod = cp.products || {};
                            var images = prod.product_images || [];
                            var primaryImg = images.find(function (img) { return img.is_primary; }) || images[0];

                            productsHtml += 
                                '<div class="flex items-center gap-4 p-3 bg-white/5 rounded-lg" data-cp-id="' + (cp.id || '') + '">' +
                                    (primaryImg ? 
                                        '<img src="' + escapeHtml(primaryImg.url) + '" alt="" class="w-16 h-16 rounded-lg object-cover">' :
                                        '<div class="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">📦</div>'
                                    ) +
                                    '<div class="flex-1">' +
                                        '<h5 class="font-medium text-white">' + escapeHtml(prod.title || 'Untitled') + '</h5>' +
                                        '<p class="text-accent text-sm">' + formatPrice(prod.price) + '</p>' +
                                    '</div>' +
                                    '<button onclick="CollectionManager.removeProduct(\'' + collectionId + '\', \'' + (cp.id || '') + '\')" ' +
                                            'class="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="Remove">' +
                                        '<i class="fa-solid fa-times"></i>' +
                                    '</button>' +
                                '</div>';
                        }
                    }

                    var modalHtml = 
                        '<div class="df-overlay" id="collectionDetailModal" onclick="CollectionManager.closeModal()">' +
                            '<div class="df-box" style="max-width:600px" onclick="event.stopPropagation()" style="max-height:90vh;overflow-y:auto;">' +
                                '<div class="df-head">' +
                                    '<h3>📚 ' + escapeHtml(col.name) + '</h3>' +
                                    '<button class="df-close" type="button" onclick="CollectionManager.closeModal()">&times;</button>' +
                                '</div>' +
                                '<div class="df-body">' +
                                    (col.description ? '<p class="text-gray-400 mb-4">' + escapeHtml(col.description) + '</p>' : '') +
                                    '<div class="flex justify-between items-center mb-4">' +
                                        '<h4 class="font-semibold text-white">Products (' + products.length + ')</h4>' +
                                        '<button onclick="CollectionManager.showAddProductModal(\'' + collectionId + '\')" ' +
                                                'class="px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accentDim transition">' +
                                            '+ Add Product' +
                                        '</button>' +
                                    '</div>' +
                                    '<div id="detailProductsList">' + productsHtml + '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>';

                    self.closeModal();
                    
                    var tempDiv = document.createElement('div');
                    tempDiv.innerHTML = modalHtml;
                    document.body.appendChild(tempDiv.firstChild);
                    addModalStyles();
                })
                .catch(function (err) {
                    console.error('[collections] Detail load error:', err);
                    showToast('Failed to load collection details', 'error');
                });
        },

        /**
         * Show add products to collection modal
         * @param {string} collectionId - Collection UUID
         */
        showAddProductModal: function (collectionId) {
            var user = window.currentUser;
            if (!user || !user.id) return;

            var self = this;

            // Load seller's products that aren't already in collection
            sb.from('products')
                .select('id, title, price, product_images(url)')
                .eq('seller_id', user.id)
                .eq('status', 'active')
                .order('title')
                .limit(100)
                .then(function (result) {
                    if (result.error) throw result.error;

                    // Get existing product IDs in collection
                    return sb.from('collection_products')
                        .select('product_id')
                        .eq('collection_id', collectionId)
                        .then(function (existingResult) {
                            var existingIds = (existingResult.data || []).map(function (ep) { return ep.product_id; });
                            var availableProducts = (result.data || []).filter(function (p) {
                                return existingIds.indexOf(p.id) === -1;
                            });
                            return availableProducts;
                        });
                })
                .then(function (availableProducts) {
                    if (availableProducts.length === 0) {
                        showAlertDialog('No Products Available', 'All your active products are already in this collection.');
                        return;
                    }

                    var optionsHtml = availableProducts.map(function (p) {
                        return '<option value="' + p.id + '">' + escapeHtml(p.title) + ' - ' + formatPrice(p.price) + '</option>';
                    }).join('');

                    var modalHtml = 
                        '<div class="df-overlay" id="addProductModal">' +
                            '<div class="df-box" style="max-width:450px" onclick="event.stopPropagation()">' +
                                '<div class="df-head">' +
                                    '<h3>+ Add Products</h3>' +
                                    '<button class="df-close" type="button" onclick="this.closest(\'.df-overlay\').remove()">&times;</button>' +
                                '</div>' +
                                '<div class="df-body">' +
                                    '<div class="df-group">' +
                                        '<label>Select Products to Add</label>' +
                                        '<select id="addProductSelect" multiple size="8" class="w-full p-3 bg-[#16213e] border-2 border-white/12 rounded-xl text-white" style="height:auto;min-height:200px">' +
                                            optionsHtml +
                                        '</select>' +
                                        '<p class="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>' +
                                    '</div>' +
                                    '<div class="df-actions">' +
                                        '<button type="button" onclick="CollectionManager.addSelectedProducts(\'' + collectionId + '\')" class="df-btn-main">Add Selected</button>' +
                                        '<button type="button" onclick="this.closest(\'.df-overlay\').remove()" class="df-btn-cancel">Cancel</button>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>';

                    // Remove existing add modal
                    var existing = document.getElementById('addProductModal');
                    if (existing) existing.remove();

                    var tempDiv = document.createElement('div');
                    tempDiv.innerHTML = modalHtml;
                    document.body.appendChild(tempDiv.firstChild);
                    addModalStyles();
                })
                .catch(function (err) {
                    console.error('[collections] Load products error:', err);
                    showToast('Failed to load products', 'error');
                });
        },

        /**
         * Add selected products to collection
         * @param {string} collectionId - Collection UUID
         */
        addSelectedProducts: function (collectionId) {
            var select = document.getElementById('addProductSelect');
            if (!select) return;

            var selectedIds = [];
            for (var i = 0; i < select.options.length; i++) {
                if (select.options[i].selected) {
                    selectedIds.push(select.options[i].value);
                }
            }

            if (selectedIds.length === 0) {
                showToast('Please select at least one product', 'warning');
                return;
            }

            showToast('Adding products...', 'info');

            var inserts = selectedIds.map(function (productId) {
                return {
                    collection_id: collectionId,
                    product_id: productId
                };
            });

            sb.from('collection_products')
                .insert(inserts)
                .then(function (result) {
                    if (result.error) throw result.error;
                    
                    showToast(selectedIds + ' product(s) added to collection!', 'success');
                    
                    // Close modal and refresh
                    var modal = document.getElementById('addProductModal');
                    if (modal) modal.remove();
                    
                    CollectionManager.showDetailModal(collectionId);
                    CollectionManager.loadCollections();
                })
                .catch(function (err) {
                    console.error('[collections] Add products error:', err);
                    showToast('Failed to add products', 'error');
                });
        },

        /**
         * Remove product from collection
         * @param {string} collectionId - Collection UUID
         * @param {string} cpId - Collection Product link ID
         */
        removeProduct: function (collectionId, cpId) {
            // FIXED: Use custom confirm dialog
            showConfirmDialog(
                'Remove Product',
                'Remove this product from the collection?',
                function () { // onConfirm
                    sb.from('collection_products')
                        .delete()
                        .eq('id', cpId)
                        .then(function (result) {
                            if (result.error) throw result.error;
                            showToast('Product removed from collection', 'success');
                            CollectionManager.showDetailModal(collectionId);
                            CollectionManager.loadCollections();
                        })
                        .catch(function (err) {
                            console.error('[collections] Remove product error:', err);
                            showToast('Failed to remove product', 'error');
                        });
                }
            );
        },

        /**
         * FIXED: Delete collection with custom confirmation
         * @param {string} collectionId - Collection UUID
         */
        deleteCollection: function (collectionId) {
            // FIXED: Use custom confirm dialog instead of browser confirm()
            showConfirmDialog(
                'Delete Collection',
                'Are you sure you want to delete this collection? This will also remove all product associations.',
                function () { // onConfirm
                    showToast('Deleting collection...', 'info');

                    sb.from('collections')
                        .delete()
                        .eq('id', collectionId)
                        .then(function (result) {
                            if (result.error) throw result.error;
                            showToast('Collection deleted successfully', 'success');
                            CollectionManager.loadCollections();
                        })
                        .catch(function (err) {
                            console.error('[collections] Delete error:', err);
                            showToast('Failed to delete collection: ' + (err.message || 'Unknown error'), 'error');
                        });
                }
            );
        }
    };


    // ═════════════════════════════════════════════════════════════════════════════════
    // SECTION: BUTTON PATCHING (Fix "Coming Soon" placeholders)
    // ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Patch all "Coming Soon" buttons to actually work
     * FIXED: Now also patches Image Upload button
     */
    function patchComingSoonFeatures() {
        console.log('[patch] Scanning for placeholder buttons...');
        
        var patchedCount = 0;
        var allElements = document.querySelectorAll('[onclick]');
        
        // Patterns to detect and patch
        var patterns = [
            {
                regex: /Product management will be available soon/i,
                handler: function (element) {
                    element.removeAttribute('onclick');
                    element.addEventListener('click', function (e) {
                        e.preventDefault();
                        if (typeof ProductManagerComplete !== 'undefined') {
                            ProductManagerComplete.showAddProductModal();
                        } else {
                            showToast('Product manager loading...', 'info');
                        }
                    });
                    element.style.cursor = 'pointer';
                    console.log('[patch] ✅ Product management button patched');
                }
            },
            {
                // FIXED: Pattern for Analytics
                regex: /Analytics will be available soon/i,
                handler: function (element) {
                    element.removeAttribute('onclick');
                    element.addEventListener('click', function (e) {
                        e.preventDefault();
                        showBasicAnalytics();
                    });
                    element.style.cursor = 'pointer';
                    console.log('[patch] ✅ Analytics button patched');
                }
            },
            {
                // FIXED: Pattern for Image Upload (Issue #1)
                regex: /Image upload will be available soon/i,
                handler: function (element) {
                    element.removeAttribute('onclick');
                    element.addEventListener('click', function (e) {
                        e.preventDefault();
                        var avatarInput = document.getElementById('dashAvatarInput');
                        if (avatarInput) {
                            avatarInput.click();
                        } else if (typeof DashboardCompletion !== 'undefined' && window.currentUser) {
                            // Fallback: trigger file selection manually
                            var input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/jpeg,image/png,image/gif,image/webp';
                            input.style.display = 'none';
                            input.onchange = function (e) {
                                if (e.target.files && e.target.files[0]) {
                                    DashboardCompletion.uploadProfileImage(e.target.files[0]);
                                }
                            };
                            document.body.appendChild(input);
                            input.click();
                            document.body.removeChild(input);
                        }
                    });
                    element.style.cursor = 'pointer';
                    console.log('[patch] ✅ Image upload button patched');
                }
            },
            {
                // Additional pattern variations
                regex: /coming\s*soon/i,
                handler: function (element) {
                    // Only patch if not already handled
                    var onclick = element.getAttribute('onclick') || '';
                    if (/Product management|Analytics|Image upload/i.test(onclick)) return;
                    
                    console.log('[patch] ⚠️ Unhandled "coming soon" pattern:', onclick.substring(0, 50));
                }
            }
        ];

        for (var i = 0; i < allElements.length; i++) {
            var el = allElements[i];
            var onclick = el.getAttribute('onclick') || '';
            
            for (var j = 0; j < patterns.length; j++) {
                if (patterns[j].regex.test(onclick)) {
                    patterns[j].handler(el);
                    patchedCount++;
                    break; // Only apply first matching pattern
                }
            }
        }

        console.log('[patch] Patched ' + patchedCount + ' button(s)');
        return patchedCount;
    }

    /**
     * Show basic analytics (placeholder implementation)
     */
    function showBasicAnalytics() {
        var user = window.currentUser;
        if (!user || !user.id) {
            showToast('Please sign in to view analytics', 'info');
            return;
        }

        // FIXED: Use custom alert instead of browser alert()
        sb.rpc('get_seller_stats', { p_seller_id: user.id })
            .then(function (result) {
                if (result.error) throw result.error;
                var stats = result.data && result.data[0] ? result.data[0] : {};
                
                var message = 
                    '📊 Your Store Analytics\n\n' +
                    'Total Products: ' + (stats.total_products || 0) + '\n' +
                    'Active Products: ' + (stats.active_products || 0) + '\n' +
                    'Draft Products: ' + (stats.draft_products || 0) + '\n' +
                    'Total Revenue: $' + (stats.total_revenue || 0).toFixed(2) + '\n' +
                    'Total Orders: ' + (stats.total_orders || 0) + '\n' +
                    'Pending Orders: ' + (stats.pending_orders || 0);
                
                showAlertDialog('Store Analytics', message);
            })
            .catch(function (err) {
                console.error('[analytics] Error:', err);
                showAlertDialog('Analytics Error', 'Could not load analytics data. Please try again.');
            });
    }


    // ═════════════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ════════════════════════════════════════════════════════════════════════════════

    // Export managers to global scope
    window.DashboardCompletion = DashboardCompletion;
    window.ProductManagerComplete = ProductManagerComplete;
    window.LibraryManager = LibraryManager;
    window.CollectionManager = CollectionManager;

    // Initialize when DOM is ready
    function initialize() {
        console.log('[completion] Initializing feature completion module...');
        
        // Patch placeholder buttons
        patchComingSoonFeatures();

        // Setup mutation observer to catch dynamically added placeholders
        var observer = new MutationObserver(function (mutations) {
            var shouldPatch = false;
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].addedNodes.length > 0) {
                    shouldPatch = true;
                    break;
                }
            }
            if (shouldPatch) {
                // Debounce patching
                clearTimeout(observer._patchTimer);
                observer._patchTimer = setTimeout(patchComingSoonFeatures, 100);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Auto-initialize dashboard if we're on dashboard page
        var dashboardEl = document.getElementById('sellerDashboard') || 
                          document.querySelector('.seller-dashboard.show') ||
                          document.querySelector('[data-view="dashboard"]');
        
        if (dashboardEl && window.currentUser && window.currentUser.id) {
            DashboardCompletion.initDashboard();
        }

        console.log('[completion] ✅ Module initialized successfully');
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // Small delay to ensure other scripts load first
        setTimeout(initialize, 100);
    }

})();
