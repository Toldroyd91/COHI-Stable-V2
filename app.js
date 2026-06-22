import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 1. SINGLE FIREBASE INITIALIZATION ---
const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine",
    storageBucket: "cohi-survey-engine.firebasestorage.app",
    messagingSenderId: "208212115382",
    appId: "1:208212115382:web:db7d4276b194f89a274b17"
};

// This prevents the "App already exists" crash
const app = !getApps().length ? initializeApp(appConfig) : getApp();
const auth = getAuth(app); 
const db = getFirestore(app);
window.db = db;

const versionDisplay = document.getElementById('appVersionDisplay');
if (versionDisplay) versionDisplay.innerText = "Engine Build: V13 Master";

// --- 2. CORE UI & AUTHENTICATION ---
const authOverlay = document.getElementById('authOverlay');
const designerApp = document.getElementById('designerApp');
const adminDashboard = document.getElementById('adminDashboard');
const activeProfileUI = document.getElementById('activeDesignerProfile');

document.getElementById('showRegisterBtn')?.addEventListener('click', () => { document.getElementById('loginView').style.display = 'none'; document.getElementById('registerView').style.display = 'block'; });
document.getElementById('cancelRegisterBtn')?.addEventListener('click', () => { document.getElementById('registerView').style.display = 'none'; document.getElementById('loginView').style.display = 'block'; });

const splash = document.getElementById('splashScreen');
const logoCoh = document.getElementById('logoCoh');
const logoBrand = document.getElementById('logoBrand');

const logoMap = {
    'CO Home Improvements': 'co-logo.png',
    'Clearview': 'clearview.png',
    'Orion Windows': 'orion.png',
    'Planet': 'planet.png',
    'Trent Valley Windows': 'trentvalley.png',
    'West Yorkshire Windows': 'westyorkshire.png',
    'Yorkshire Windows': 'yorkshire.png'
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data(); window.currentUserProfile = userData;
            
            const brandFile = logoMap[userData.brand] || 'logo.png';
            if(logoBrand) logoBrand.src = brandFile;

            setTimeout(() => {
                if(logoCoh) logoCoh.classList.add('fade-out');
                if(logoBrand) logoBrand.classList.add('fade-in');
            }, 500); 

            setTimeout(() => {
                if(splash) { splash.style.opacity = '0'; setTimeout(() => splash.style.display = 'none', 800); }
                if(authOverlay) authOverlay.style.display = 'none';

                if (userData.role === 'admin') {
                    if(designerApp) designerApp.style.display = 'none'; 
                    if(adminDashboard) adminDashboard.style.display = 'block';
                    if(activeProfileUI) { activeProfileUI.innerHTML = `MANAGER HUB | ${userData.name}`; activeProfileUI.style.display = 'inline'; }
                    fetchAdminLeads();
                } else {
                    if(adminDashboard) adminDashboard.style.display = 'none'; 
                    if(designerApp) designerApp.style.display = 'block';
                    if(activeProfileUI) { activeProfileUI.innerHTML = `${userData.brand} | ${userData.name}`; activeProfileUI.style.display = 'inline'; }
                    fetchCloudDrafts(user.uid);
                }
            }, 2200);
        }
    } else { 
        setTimeout(() => { if(logoCoh) logoCoh.classList.add('fade-out'); }, 500);
        setTimeout(() => {
            if(splash) { splash.style.opacity = '0'; setTimeout(() => splash.style.display = 'none', 800); }
            if(authOverlay) authOverlay.style.display = 'flex'; 
            if(designerApp) designerApp.style.display = 'none'; 
            if(adminDashboard) adminDashboard.style.display = 'none'; 
            if(activeProfileUI) activeProfileUI.style.display = 'none'; 
        }, 1200);
    }
});

document.getElementById('registerBtn')?.addEventListener('click', async () => {
    const errEl = document.getElementById('authError'); errEl.style.display = 'none';
    const brand = document.getElementById('regBrand').value, name = document.getElementById('regName').value.trim(), email = document.getElementById('regEmail').value.trim(), pass = document.getElementById('regPassword').value;
    if(!brand || !name || !email || !pass) return errEl.innerText = "Fill all required fields.", errEl.style.display = 'block';
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", cred.user.uid), { brand, name, phone: document.getElementById('regPhone').value, bio: document.getElementById('regBio').value, email, role: 'designer', createdAt: serverTimestamp() });
    } catch (error) { errEl.innerText = error.message.replace('Firebase: ', ''); errEl.style.display = 'block'; }
});

document.getElementById('loginBtn')?.addEventListener('click', () => signInWithEmailAndPassword(auth, document.getElementById('authEmail').value, document.getElementById('authPassword').value));
document.getElementById('logoutBtn')?.addEventListener('click', () => { signOut(auth).then(() => { location.reload(); }); });

// --- 3. VAULT & BACKWARDS COMPATIBILITY FIX ---
const loadFormState = (payload) => {
    if (payload.inputs) { for (let key in payload.inputs) { const el = document.getElementById(key); if (el) el.value = payload.inputs[key]; } }
    if (payload.canvases && window.appCanvases) { for (let key in payload.canvases) if (window.appCanvases[key]) window.appCanvases[key].loadFromJSON(payload.canvases[key], window.appCanvases[key].renderAll.bind(window.appCanvases[key])); }
    ['misc', 'survey', 'access'].forEach(k => { if(window.updatePhotoCount) window.updatePhotoCount(k); });
    if(window.showToast) window.showToast("Survey Loaded");
};

let currentDrafts = {};
async function fetchCloudDrafts(uid) {
    const q = query(collection(db, "surveys"), where("userId", "==", uid));
    try {
        const snap = await getDocs(q);
        const select = document.getElementById('cloudDrafts'); 
        if(select) {
            select.innerHTML = '<option value="">Load Previous...</option>';
            snap.forEach((doc) => { currentDrafts[doc.id] = doc.data(); select.innerHTML += `<option value="${doc.id}">${doc.data().clientName || doc.data().customerProfile?.leadName || 'Survey'}</option>`; });
        }
    } catch (e) { console.error(e); }
}
document.getElementById('loadCloudBtn')?.addEventListener('click', () => { const id = document.getElementById('cloudDrafts').value; if(id && currentDrafts[id]) loadFormState(currentDrafts[id].data || currentDrafts[id]); });

async function fetchAdminLeads() {
    const container = document.getElementById('adminLeadsContainer');
    if(!container) return;
    try {
        const snapshot = await getDocs(collection(db, "surveys"));
        container.innerHTML = snapshot.empty ? '<p style="color:#888;">No surveys yet.</p>' : '';
        
        let totalSurveys = 0, todaySurveys = 0; let designersSet = new Set();
        const todayStr = new Date().toLocaleDateString();

        snapshot.forEach(doc => {
            const data = doc.data();
            
            // VAULT FIX: Optional Chaining (?) applied to all old data paths
            const clientName = data.clientName || data.customerProfile?.leadName || 'Unnamed';
            const postCode = data.data?.inputs?.postCode || data.customerProfile?.postcode || '';
            const buildType = data.data?.inputs?.buildType || data.technicalSurvey?.buildCategory || 'TBC';
            const propSize = data.data?.inputs?.proposedSize || data.technicalSurvey?.proposedSizeSQM || 'TBC';
            const userId = data.userId || data.customerProfile?.designerId || 'Unknown';
            const dDate = data.updatedAt ? new Date(data.updatedAt.toDate()).toLocaleDateString() : (data.timestamps?.updatedAt ? new Date(data.timestamps.updatedAt.toDate()).toLocaleDateString() : 'N/A');
            
            totalSurveys++; designersSet.add(userId); if (dDate === todayStr) todaySurveys++;

            container.innerHTML += `
                <div class="admin-lead-card" style="background:#2a2a2a; padding:15px; border-radius:8px; border-left:4px solid #ff9800; display:flex; justify-content:space-between; margin-bottom:10px;">
                    <div>
                        <h3 style="margin:0 0 5px 0; color:#fff;">${clientName} <span style="font-size:0.8rem; color:#ff9800;">${postCode}</span></h3>
                        <p style="margin:0; color:#aaa; font-size:0.85rem;">Build: ${buildType} | Size: ${propSize}</p>
                        <p style="margin:5px 0 0 0; color:#888; font-size:0.8rem;">Date Saved: ${dDate}</p>
                    </div>
                </div>`;
        });
        if(document.getElementById('statTotal')) document.getElementById('statTotal').innerText = totalSurveys;
        if(document.getElementById('statDesigners')) document.getElementById('statDesigners').innerText = designersSet.size;
        if(document.getElementById('statToday')) document.getElementById('statToday').innerText = todaySurveys;
    } catch (error) { console.error(error); }
}

document.getElementById('adminSearch')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.admin-lead-card').forEach(card => { card.style.display = card.innerText.toLowerCase().includes(term) ? 'flex' : 'none'; });
});

// =====================================================================
// --- 4. PINNACLE V13: UNIFIED BRIDGE & SNIPER ENGINE ---
// =====================================================================
console.log("Pinnacle V13 Master Engine Active");

const getValSafe = (id1, id2) => document.getElementById(id1)?.value || document.getElementById(id2)?.value || '';

// GENTLE UI ASSASSIN (Hides FabricJS buttons)
setInterval(() => {
    document.querySelectorAll('.canvas-controls').forEach(c => c.style.display = 'none');
}, 500);

// INJECT ENTERPRISE DASHBOARD BUTTONS
const pdfBtn = document.getElementById('generateCustomerPdfBtn') || document.getElementById('generateInternalPdfBtn');
if(pdfBtn && !document.getElementById('btn-legacy-dash')) {
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = "display:flex; gap:10px; margin-top:15px; justify-content:center; flex-wrap:wrap; width:100%;";
    btnContainer.innerHTML = `
        <button id="btn-legacy-dash" style="background:#1A1A1A; color:#0dcaf0; border:1px solid #0dcaf0; padding:12px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">📋 Copy Payload</button>
        <button id="btn-sync-v3" style="background:#10b981; color:white; border:none; padding:12px 20px; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow:0 4px 10px rgba(16,185,129,0.3);">☁️ Sync to Command Center</button>
    `;
    pdfBtn.parentNode.insertBefore(btnContainer, pdfBtn.nextSibling);
}

// MASTER JSON DATA BRIDGE
document.addEventListener('click', async (e) => {
    if(e.target.id === 'btn-legacy-dash') {
        const client = getValSafe('clientName', 'customerName');
        const txt = `=== COHI EXPORT ===\nClient: ${client}\nPostcode: ${getValSafe('postCode', 'input-postcode')}\nBuild: ${getValSafe('buildType', 'input-build-type')}\nVectors: ${(window.sniperLogs || []).join(', ')}`;
        navigator.clipboard.writeText(txt).then(() => { if(window.showToast) window.showToast("Copied to Clipboard!", true); });
    }
    
    if(e.target.id === 'btn-sync-v3') {
        if(window.showToast) window.showToast("Packaging for Command Center...", true);
        const btn = document.getElementById('btn-sync-v3');
        btn.innerText = "Syncing..."; btn.disabled = true;

        try {
            const fCv = document.getElementById('canvas-frontelevation') || document.getElementById('canvasFront');
            const fImg = fCv && fCv.hasAttribute('data-sniper') ? fCv.getAttribute('data-sniper') : null;
            
            await addDoc(collection(db, "surveys"), {
                userId: auth.currentUser ? auth.currentUser.uid : "Designer",
                clientName: getValSafe('clientName', 'customerName') || 'Unnamed Lead',
                pipelineStatus: "1. Survey Complete", 
                customerProfile: {
                    leadName: getValSafe('clientName', 'customerName') || 'Unnamed Lead',
                    postcode: getValSafe('postCode', 'input-postcode') || 'N/A',
                    vaultPIN: getValSafe('clientNum', 'customerNumber') || Math.floor(1000 + Math.random() * 9000).toString(),
                    brandIdentity: getValSafe('regBrand', 'companyBrand') || "Yorkshire Windows",
                    designerId: window.currentUserProfile?.name || 'Tom'
                },
                technicalSurvey: {
                    buildCategory: getValSafe('buildType', 'input-build-type') || 'Extension',
                    roofSystem: getValSafe('roofType', 'input-roof-type') || 'Not Specified',
                    proposedSizeSQM: getValSafe('proposedSize', 'input-proposed-size') || '',
                    foundations: getValSafe('dpcDepth', 'input-foundations') || '',
                    drainage: getValSafe('manholeExist', 'input-drainage') || '',
                    brickMatch: getValSafe('houseMaterial', 'input-brick-match') || '',
                    designerNotes: getValSafe('designerNotes', 'customerNotes') || ''
                },
                rawAssets: {
                    frontElevationImage: fImg || null,
                    structuralVectors: window.sniperLogs || []
                },
                uDesignBridge: { isUploaded: false, totalQuoteValue: null, depositRequired: null, quotePdfUrl: null, render3DUrl: null },
                vaultTelemetry: { isUnlocked: false, totalOpens: 0, timeSpentMinutes: 0, lastHovered: "Awaiting Initial Open" },
                timestamps: { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
            });
            
            if(window.showToast) window.showToast("Deployed to Command Center!", true);
            setTimeout(() => window.location.reload(), 1500);

        } catch(err) { 
            console.error(err); 
            if(window.showToast) window.showToast("Sync Failed - Network Error", false); 
            btn.innerText = "☁️ Sync to Command Center"; btn.disabled = false;
        }
    }
});
