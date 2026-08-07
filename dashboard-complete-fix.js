/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * K.Subject-1 — Dashboard Fix FINAL (Simple & Working)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ⚡ SIMPLE VERSION - Just works!
 * 
 * INSTALL: Add ONE line to your HTML before </body>:
 *   <script src="dashboard-fix-FINAL.js"></script>
 *
 * DELETE any other dashboard-fix files first!
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    console.log('🚀 [DashFix] Loading...');

    // =============================================
    // STEP 1: ADD STYLES
    // =============================================

    var s = document.createElement('style');
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

    // =============================================
    // STEP 2: STATE
    // =============================================

    var cols = null;

    // =============================================
    // STEP 3: DETECT COLUMNS
    // =============================================

    function getCols() {
        if (cols) return Promise.resolve(cols);
        
        return sb.from('products').select('*').limit(1).then(function(r) {
            if (r.data && r.data.length > 0) {
                cols = Object.keys(r.data[0]);
            } else {
                cols = ['id','title','price','description','seller_id','status','category',
                        'stock_quantity','sku','image_url','created_at'];
            }
            console.log('✅ [DashFix] Columns:', cols.length);
            return cols;
        }).catch(function(e) {
            console.warn('[DashFix] Using default columns');
            cols = ['id','title','price','seller_id','status','created_at'];
            return cols;
        });
    }

    function has(c) { return !cols || cols.indexOf(c) !== -1; }
    
    function find(field) {
        var map = {
            title:['title','name'], price:['price','amount'],
            desc:['description','desc'], category:['category','cat'],
            stock:['stock_quantity','stock'], sku:['sku','code'],
            image:['image_url','image'], status:['status'],
            seller:['seller_id','user_id']
        };
        var names = map[field] || [field];
        for (var i=0;i<names.length;i++) { if(has(names[i])) return names[i]; }
        return names[0];
    }

    // =============================================
    // STEP 4: FIX BUTTONS
    // =============================================

    function fixButtons() {
        document.querySelectorAll('[onclick*="Product management will be available"]').forEach(function(b){
            b.removeAttribute('onclick');
            b.addEventListener('click',function(e){e.preventDefault();openForm();});
            b.style.cursor='pointer';
        });
        document.querySelectorAll('.dash-quick-action[onclick*="Product management"]').forEach(function(d){
            d.removeAttribute('onclick');
            d.addEventListener('click',function(e){e.preventDefault();openForm();});
        });
    }

    // =============================================
    // STEP 5: OPEN FORM MODAL
    // =============================================

    window.openDashboardAddProduct = function openForm() {
        console.log('✨ [DashFix] Opening form...');
        
        // Close existing
        close();

        var m=document.createElement('div');
        m.className='df-overlay';
        m.id='dfModal';
        m.innerHTML='<div class="df-box" onclick="event.stopPropagation()"><div class="df-head"><h3>✨ Add New Product</h3><button class="df-close" type="button">&times;</button></div><form id="dfForm" class="df-body"><div class="df-group"><label for="dft">Product Title *</label><input id="dft" name="title" required placeholder="Enter product title" autocomplete="off"></div><div class="df-row"><div class="df-group"><label for="dfp">Price ($) *</label><input id="dfp" name="price" type="number" step="0.01" min="0" required placeholder="0.00"></div><div class="df-group"><label for="dfc">Category</label><select id="dfc" name="category"><option value="">Select...</option><option value="electronics">Electronics</option><option value="clothing">Clothing</option><option value="home">Home & Garden</option><option value="books">Books</option><option value="toys">Toys & Games</option><option value="sports">Sports</option><option value="art">Art & Crafts</option><option value="other">Other</option></select></div></div><div class="df-group"><label for="dfd">Description</label><textarea id="dfd" name="description" rows="3" placeholder="Describe your product..."></textarea></div><div class="df-row"><div class="df-group"><label for="dfs">Stock Quantity</label><input id="dfs" name="stock" type="number" min="0" value="1"></div><div class="df-group"><label for="dfsk">SKU</label><input id="dfsk" name="sku" placeholder="PROD-001"></div></div><div class="df-actions"><button type="submit" id="dfSub" class="df-btn-main">🚀 Create Product</button><button type="button" id="dfCan" class="df-btn-cancel">Cancel</button></div></form></div>';
        
        document.body.appendChild(m);
        
        m.querySelector('.df-close').onclick=close;
        document.getElementById('dfCan').onclick=close;
        m.onclick=function(e){if(e.target===m)close();};
        document.getElementById('dfForm').onsubmit=submit;
        
        setTimeout(function(){document.getElementById('dft').focus();},150);
    };

    function close(){
        var m=document.getElementById('dfModal');
        if(m)m.remove();
    }

    // =============================================
    // STEP 6: SUBMIT FORM
    // =============================================

    function submit(e){
        e.preventDefault();
        
        var user=window.currentUser;
        if(!user||!user.id){alert('Please login first!');return;}
        
        var fd=new FormData(e.target);
        
        getCols().then(function(){
            var data={};
            
            data[find('title')]=(fd.get('title')||'').trim();
            data[find('price')]=parseFloat(fd.get('price'))||0;
            data[find('seller')]=user.id;
            data[find('status')]='active';
            
            var d=(fd.get('description')||'').trim();
            if(d&&has(find('desc')))data[find('desc')]=d;
            
            var c=(fd.get('category')||'').trim();
            if(c&&has(find('category')))data[find('category')]=c;
            
            var st=parseInt(fd.get('stock'))||1;
            if(has(find('stock')))data[find('stock')]=st;
            
            var sk=(fd.get('sku')||'').trim();
            if(sk&&has(find('sku')))data[find('sku')]=sk;
            
            if(has('created_at'))data.created_at=new Date().toISOString();
            
            if(!data[find('title')]){alert('Please enter a title');return;}
            
            console.log('💾 [DashFix] Inserting:',data);
            
            var btn=document.getElementById('dfSub');
            var orig=btn.textContent;
            btn.textContent='Creating...';
            btn.disabled=true;
            
            sb.from('products').insert([data]).then(function(r){
                btn.disabled=false;
                btn.textContent=orig;
                
                if(r.error)throw r.error;
                
                close();
                alert('✅ Product created successfully!');
                loadStats();
                
            }).catch(function(err){
                btn.disabled=false;
                btn.textContent=orig;
                
                console.error('❌ [DashFix] Error:',err.code,err.message);
                
                if(err.code==='PGRST204'||err.message.indexOf('column')!==-1){
                    showHelp(err.message);
                }else{
                    alert('Error: '+(err.message||'Could not create product'));
                }
            });
        });
    }

    function showHelp(msg){
        close();
        var h=document.createElement('div');
        h.className='df-overlay';
        h.innerHTML='<div class="df-box" style="max-width:480px" onclick="event.stopPropagation()"><div class="df-head"><h3>⚠️ Database Setup Needed</h3><button class="df-close">&times;</button></div><div style="padding:24px;color:#ccc;line-height:1.7"><p style="font-size:16px;margin-bottom:18px"><strong>Your products table is missing some columns.</strong></p><p><strong>To fix:</strong></p><ol style="margin:14px 0;padding-left:24px"><li>Open <strong>Supabase → SQL Editor</strong></li><li>Paste contents of <code>02-add-products-columns-FIXED.sql</code></li><li>Run it</li><li>Refresh page</li></ol><div style="background:#16213e;padding:14px;border-radius:10px;margin-top:18px;font-size:12px"><p><strong>Error:</strong> '+(msg||'Unknown')+'</p><p style="margin-top:8px"><strong>Columns found:</strong> '+(cols?cols.join(', '):'None')+'</p></div><button id="dfHelpOk" style="margin-top:20px;width:100%;padding:14px;background:#e94560;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">Got it!</button></div></div>';
        document.body.appendChild(h);
        h.querySelector('.df-close').onclick=function(){h.remove();};
        document.getElementById('dfHelpOk').onclick=function(){h.remove();};
        h.onclick=function(e){if(e.target===h)h.remove();};
    }

    // =============================================
    // STEP 7: LOAD STATS
    // =============================================

    function loadStats(){
        var user=window.currentUser;
        if(!user||!user.id)return;
        
        getCols().then(function(){
            var q=sb.from('products').select('*');
            if(has(find('seller')))q=q.eq(find('seller'),user.id);
            
            return q.then(function(r){
                if(r.error)throw r.error;
                
                var p=r.data||[];
                var active=0,revenue=0;
                
                p.forEach(function(x){
                    var s=x[find('status')]||x.status||'active';
                    if(s==='active'||s==='published')active++;
                    revenue+=parseFloat(x[find('price')]||x.price||0);
                });
                
                var stats=document.querySelectorAll('.dash-count-anim');
                if(stats[0])stats[0].textContent=active;
                if(stats[1])stats[1].textContent=Math.min(p.length,99);
                if(stats[2])stats[2].textContent='$'+revenue.toFixed(2);
                if(stats[3])stats[3].textContent=p.length*12;
                
                console.log('📊 [DashFix] Stats loaded');
            });
        }).catch(function(e){console.warn('[DashFix] Stats error:',e.message);});
    }

    // =============================================
    // STEP 8: INIT
    // =============================================

    function init(){
        if(!window.sb){
            setTimeout(init,200);
            return;
        }
        
        console.log('✅ [DashFix] Ready!');
        fixButtons();
        getCols();
        
        setInterval(function(){
            var d=document.getElementById('sellerDashboard')||document.querySelector('.seller-dashboard.show');
            if(d&&window.currentUser)loadStats();
        },3000);
    }

    if(document.readyState==='loading'){
        document.addEventListener('DOMContentLoaded',init);
    }else{
        init();
    }

})();
