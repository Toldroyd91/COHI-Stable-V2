import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine"
};

const app = initializeApp(appConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

window.showToast = function(msg, isSuccess = true) {
    let toast = document.getElementById('engineToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'engineToast';
        toast.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); padding: 12px 24px; color: #fff; border-radius: 8px; z-index: 99999; display: none; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.4); transition: opacity 0.3s; pointer-events: none;';
        document.body.appendChild(toast);
    }
    toast.style.background = isSuccess ? '#10b981' : '#ef4444';
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.style.display = 'none', 300); }, 3000);
};

// Everything goes inside DOMContentLoaded to ensure the bridge connects
document.addEventListener('DOMContentLoaded', () => {
    console.log("Enterprise Auth & Sniper Engine Initialized.");

    // --- 1. UNIFIED AUTH GATE ---
    const authGate = document.getElementById('authGate');
    const mainNav = document.getElementById('mainNav');
    const mainApp = document.getElementById('mainApp');
    const loginBtn = document.getElementById('btnLogin');
    const logoutBtn = document.getElementById('btnLogout');
    const authError = document.getElementById('authError');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            authGate.style.display = 'none';
            mainNav.style.display = 'flex'; // Changed to flex for the navbar
            mainApp.style.display = 'block';
            
            // Extract Name from email (e.g. tom@cohi.com -> Tom)
            const designerName = user.email.split('@')[0];
            document.getElementById('input-designer').value = designerName.charAt(0).toUpperCase() + designerName.slice(1);
        } else {
            authGate.style.display = 'flex';
            mainNav.style.display = 'none';
            mainApp.style.display = 'none';
        }
    });

    loginBtn.addEventListener('click', () => {
        const email = document.getElementById('authEmail').value.trim();
        const pass = document.getElementById('authPassword').value;
        if(!email || !pass) return;
        loginBtn.innerText = "Authenticating...";
        signInWithEmailAndPassword(auth, email, pass).catch(err => {
            authError.style.display = 'block';
            loginBtn.innerText = "Authenticate";
        });
    });

    logoutBtn.addEventListener('click', () => signOut(auth));

    // V3 Pass-through (Firebase Auth persists automatically across tabs on the same domain)
    document.getElementById('btn-go-v3').addEventListener('click', () => {
        window.open('portal.html', '_blank'); 
    });
    // --- 2. BUILD THE SNIPER UI MODAL ---
    const sniperModal = document.createElement('div');
    sniperModal.id = 'sniper-modal';
    sniperModal.style.cssText = 'display: none; position: fixed; inset: 0; z-index: 100000; background: #121212; touch-action: none; font-family: system-ui, sans-serif;';
    sniperModal.innerHTML = `
    <div id="sniper-viewport" style="position: absolute; inset: 0; overflow: hidden; touch-action: none;">
        <div id="sniper-canvas-container" style="transform-origin: 0 0; position: absolute; will-change: transform;">
            <img id="sniper-img" src="" style="display: block; min-width: 800px; min-height: 600px;">
            <canvas id="sniper-drawing-layer" style="position: absolute; top: 0; left: 0; pointer-events: none;"></canvas>
            <canvas id="sniper-ghost-layer" style="position: absolute; top: 0; left: 0; pointer-events: none;"></canvas>
        </div>

        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; z-index: 50; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 44px; height: 2px; background: #0dcaf0; box-shadow: 0 0 6px #000;"></div>
            <div style="position: absolute; height: 44px; width: 2px; background: #0dcaf0; box-shadow: 0 0 6px #000;"></div>
            <div style="width: 4px; height: 4px; background: #fff; border-radius: 50%; z-index: 51; box-shadow: 0 0 4px #000;"></div>
        </div>

        <div style="position: absolute; inset: 0; pointer-events: none; z-index: 100; display: flex; flex-direction: column; justify-content: space-between; padding: 15px; padding-bottom: env(safe-area-inset-bottom, 25px); padding-top: env(safe-area-inset-top, 15px);">
            <div style="pointer-events: auto; display: flex; justify-content: space-between; gap: 8px;">
                <button id="btn-close-sniper" style="background: rgba(20,20,20,0.8); color: white; border: 1px solid #444; padding: 12px 20px; border-radius: 8px; font-weight: bold;">Cancel</button>
                <button id="btn-save-sniper" style="background: #10b981; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold;">Save Blueprint</button>
            </div>

            <div style="pointer-events: auto; display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; justify-content: flex-end; width: 100%;">
                    <div style="display: grid; grid-template-columns: 45px 45px 45px; grid-template-rows: 45px 45px 45px; gap: 6px;">
                        <div id="btn-nudge-up" class="nudge-btn" style="grid-column: 2; grid-row: 1;">↑</div>
                        <div id="btn-nudge-left" class="nudge-btn" style="grid-column: 1; grid-row: 2;">←</div>
                        <div id="btn-nudge-right" class="nudge-btn" style="grid-column: 3; grid-row: 2;">→</div>
                        <div id="btn-nudge-down" class="nudge-btn" style="grid-column: 2; grid-row: 3;">↓</div>
                    </div>
                </div>
                <button id="btn-action-sniper" style="width: 100%; padding: 18px; border-radius: 14px; border: none; font-weight: 900; font-size: 16px; background: #0dcaf0; color: #000; text-transform: uppercase;">🎯 Place Anchor</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(sniperModal);

    // --- 3. HIJACK UPLOADS TO SPAWN SNIPER ---
    ['Front', 'Side', 'Rear', 'Drainage'].forEach(suffix => {
        const fileInput = document.getElementById(`photo-${suffix.toLowerCase()}`);
        if(fileInput) {
            const openBtn = document.createElement('button');
            openBtn.className = 'button mt-4';
            openBtn.style.cssText = 'width: 100%; background: #0dcaf0; color: #000; font-weight: 800; border-radius: 8px; padding: 12px; display: none;';
            openBtn.innerText = '🎯 Edit with Precision Touch';
            
            fileInput.addEventListener('change', () => { setTimeout(() => { openBtn.style.display = 'block'; }, 200); });
            openBtn.onclick = (e) => { e.preventDefault(); openSniperEngine(suffix); };
            fileInput.parentElement.appendChild(openBtn);
        }
    });

    // --- 4. SNIPER ENGINE LOGIC ---
    let activeSuffix = null; const sState = { scale: 1, offsetX: 0, offsetY: 0, isDragging: false };
    let sAnchor = null; let sInitialPinch = null; let sLastTouch = {x:0, y:0};
    window.sniperVectors = []; 

    const sImg = document.getElementById('sniper-img');
    const sDraw = document.getElementById('sniper-drawing-layer');
    const sDrawCtx = sDraw.getContext('2d');
    const sGhost = document.getElementById('sniper-ghost-layer');
    const sGhostCtx = sGhost.getContext('2d');
    const sActionBtn = document.getElementById('btn-action-sniper');
    const sContainer = document.getElementById('sniper-canvas-container');

    function openSniperEngine(suffix) {
        const fileInput = document.getElementById(`photo-${suffix.toLowerCase()}`);
        if(!fileInput || !fileInput.files[0]) return;
        activeSuffix = suffix;
        const reader = new FileReader();
        reader.onload = (e) => {
            sImg.onload = () => {
                const w = sImg.naturalWidth || 1000; const h = sImg.naturalHeight || 800;
                sDraw.width = w; sDraw.height = h; sGhost.width = w; sGhost.height = h;
                sDrawCtx.clearRect(0,0,w,h); sGhostCtx.clearRect(0,0,w,h); sAnchor = null;
                sActionBtn.innerText = "🎯 Place Anchor"; sActionBtn.style.background = "#0dcaf0";
                
                sState.offsetX = (window.innerWidth - w) / 2; sState.offsetY = (window.innerHeight - h) / 2;
                sState.scale = Math.min(window.innerWidth / w, window.innerHeight / h) * 0.9;
                updateTransform(); sniperModal.style.display = 'block';
            };
            sImg.src = e.target.result;
        };
        reader.readAsDataURL(fileInput.files[0]);
    }

    document.getElementById('btn-close-sniper').onclick = () => sniperModal.style.display = 'none';
    
    document.getElementById('btn-save-sniper').onclick = () => {
        const comp = document.createElement('canvas'); comp.width = sDraw.width; comp.height = sDraw.height;
        const compCtx = comp.getContext('2d');
        compCtx.drawImage(sImg, 0, 0); compCtx.drawImage(sDraw, 0, 0);
        
        const targetCanvas = document.getElementById(`canvas${activeSuffix}`);
        targetCanvas.setAttribute('data-sniper-saved', comp.toDataURL('image/jpeg', 0.9));
        
        const wrapper = document.getElementById(`canvas${activeSuffix}-wrapper`);
        wrapper.classList.remove('hidden');
        wrapper.style.height = '200px';
        wrapper.style.backgroundImage = `url(${comp.toDataURL('image/jpeg', 0.9)})`;
        wrapper.style.backgroundSize = 'contain';
        wrapper.style.backgroundPosition = 'center';
        wrapper.style.backgroundRepeat = 'no-repeat';
        
        sniperModal.style.display = 'none';
        window.showToast("Blueprint Saved!", true);
    };

    function updateTransform() {
        sContainer.style.transform = `translate(${sState.offsetX}px, ${sState.offsetY}px) scale(${sState.scale})`;
        sGhostCtx.clearRect(0, 0, sGhost.width, sGhost.height);
        if (sAnchor) {
            const cur = { x: (window.innerWidth/2 - sState.offsetX) / sState.scale, y: (window.innerHeight/2 - sState.offsetY) / sState.scale };
            sGhostCtx.beginPath(); sGhostCtx.moveTo(sAnchor.x, sAnchor.y); sGhostCtx.lineTo(cur.x, cur.y);
            sGhostCtx.lineWidth = 4 / sState.scale; sGhostCtx.strokeStyle = '#0dcaf0'; sGhostCtx.setLineDash([10/sState.scale, 10/sState.scale]);
            sGhostCtx.stroke(); sGhostCtx.setLineDash([]);
        }
    }

    const v = document.getElementById('sniper-viewport');
    v.addEventListener('touchstart', (e) => {
        if(e.target.closest('button') || e.target.closest('.nudge-btn')) return;
        e.preventDefault();
        if (e.touches.length === 1) { sState.isDragging = true; sLastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } 
        else if (e.touches.length === 2) { sState.isDragging = false; sInitialPinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
    }, {passive: false});

    v.addEventListener('touchmove', (e) => {
        if(e.target.closest('button') || e.target.closest('.nudge-btn')) return;
        e.preventDefault();
        if (e.touches.length === 1 && sState.isDragging) {
            sState.offsetX += e.touches[0].clientX - sLastTouch.x; sState.offsetY += e.touches[0].clientY - sLastTouch.y;
            sLastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; updateTransform();
        } else if (e.touches.length === 2 && sInitialPinch) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const factor = dist / sInitialPinch;
            const oldScale = sState.scale; sState.scale *= factor;
            if(sState.scale < 0.1) sState.scale = 0.1; if(sState.scale > 10) sState.scale = 10;
            const cx = window.innerWidth/2; const cy = window.innerHeight/2;
            sState.offsetX = cx - ((cx - sState.offsetX) / oldScale * sState.scale);
            sState.offsetY = cy - ((cy - sState.offsetY) / oldScale * sState.scale);
            sInitialPinch = dist; updateTransform();
        }
    }, {passive: false});
    
    v.addEventListener('touchend', (e) => { if (e.touches.length < 2) sInitialPinch = null; if (e.touches.length === 0) sState.isDragging = false; });

    const bindN = (id, dx, dy) => { document.getElementById(id).addEventListener('touchstart', (e) => { e.preventDefault(); sState.offsetX -= dx * sState.scale; sState.offsetY -= dy * sState.scale; updateTransform(); }); };
    bindN('btn-nudge-up', 0, -2); bindN('btn-nudge-down', 0, 2); bindN('btn-nudge-left', -2, 0); bindN('btn-nudge-right', 2, 0);

    sActionBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const cur = { x: (window.innerWidth/2 - sState.offsetX)/sState.scale, y: (window.innerHeight/2 - sState.offsetY)/sState.scale };
        if (!sAnchor) {
            sAnchor = cur; sActionBtn.innerText = "✅ Confirm Endpoint"; sActionBtn.style.background = "#10b981"; updateTransform(); 
        } else {
            sDrawCtx.beginPath(); sDrawCtx.moveTo(sAnchor.x, sAnchor.y); sDrawCtx.lineTo(cur.x, cur.y);
            sDrawCtx.lineWidth = 4 / sState.scale; sDrawCtx.strokeStyle = '#0dcaf0'; sDrawCtx.stroke();
            const measurement = prompt("Enter Measurement (e.g., 2400mm):");
            if(measurement) {
                const mx = (sAnchor.x + cur.x)/2; const my = (sAnchor.y + cur.y)/2; const fs = 20 / sState.scale; const pad = 8 / sState.scale;
                sDrawCtx.fillStyle = '#1A1A1A'; const tw = sDrawCtx.measureText(measurement).width;
                sDrawCtx.fillRect(mx - tw/2 - pad, my - fs, tw + pad*2, fs + pad*2);
                sDrawCtx.fillStyle = '#0dcaf0'; sDrawCtx.font = `bold ${fs}px sans-serif`; sDrawCtx.textAlign = 'center'; sDrawCtx.textBaseline = 'middle';
                sDrawCtx.fillText(measurement, mx, my);
                window.sniperVectors.push(`${activeSuffix}: ${measurement}`); 
            }
            sAnchor = null; sActionBtn.innerText = "🎯 Place Anchor"; sActionBtn.style.background = "#0dcaf0"; sGhostCtx.clearRect(0,0,sGhost.width,sGhost.height);
        }
    });

    // --- 5. PDF, DASHBOARD EXPORT, AND V3 BRIDGE ---
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type, encoderOptions) {
        if (this.hasAttribute('data-sniper-saved')) return this.getAttribute('data-sniper-saved');
        return originalToDataURL.call(this, type, encoderOptions);
    };

    document.getElementById('btn-legacy-sync').addEventListener('click', () => {
        const n = document.getElementById('input-client-name').value || 'N/A';
        const p = document.getElementById('input-postcode').value || 'N/A';
        const r = document.getElementById('input-roof-type').value || 'Edwardian roof';
        const notes = document.getElementById('customerNotes').value || 'None';
        const vecs = window.sniperVectors.length > 0 ? window.sniperVectors.join('\\n') : 'No structural measurements recorded.';
        
        const txt = `=== SURVEY DASHBOARD EXPORT ===\\nDate: ${new Date().toLocaleDateString()}\\nName: ${n}\\nPostcode: ${p}\\nRoof: ${r}\\n\\n-- STRUCTURAL VECTORS --\\n${vecs}\\n\\n-- SITE NOTES --\\n${notes}\\n=============================`;
        navigator.clipboard.writeText(txt).then(() => window.showToast('Copied for Dashboard!', true));
    });

    document.getElementById('btn-export-v3').addEventListener('click', async () => {
        window.showToast("Pushing to V3 Vault...", true);
        try {
            const fCv = document.getElementById('canvasFront');
            const fImg = fCv && fCv.hasAttribute('data-sniper-saved') ? fCv.getAttribute('data-sniper-saved') : null;
            
            const docRef = await addDoc(collection(db, "surveys"), {
                clientName: document.getElementById('input-client-name').value || 'Unnamed Client',
                userId: document.getElementById('input-designer').value || 'Tom',
                updatedAt: serverTimestamp(),
                data: {
                    inputs: {
                        postCode: document.getElementById('input-postcode').value || 'N/A',
                        clientNum: document.getElementById('input-customer-num').value || 'survey123',
                        roofType: document.getElementById('input-roof-type').value || 'Edwardian roof',
                        _pipelineStatus: "1. Consultation & Survey",
                        _brand: document.getElementById('input-brand').value || 'COHI'
                    }
                },
                images: { frontElevation: fImg || null }
            });
            
            const notes = document.getElementById('customerNotes').value;
            if(notes) await addDoc(collection(db, `surveys/${docRef.id}/internalNotes`), { content: notes, visibility: 'external', timestamp: serverTimestamp() });
            
            window.showToast("Successfully Synced to V3 Vault!", true);
        } catch(e) { console.error(e); window.showToast("V3 Sync Failed", false); }
    });

    document.getElementById('generateCustomerPdfBtn').addEventListener('click', () => {
        const roofType = document.getElementById('input-roof-type').value;
        if(window.PDFEngine) window.PDFEngine.generate(null, roofType);
    });

}); // End DOMContentLoaded
