import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, doc, updateDoc, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine"
};
const app = initializeApp(appConfig);
const db = getFirestore(app);

// --- CLOUDINARY SECURE CONFIG ---
const cloudinaryConfig = { cloudName: "dqk1hz0f8", uploadPreset: "crm_document_uploads" };
const views = { login: document.getElementById('view-login'), customer: document.getElementById('view-customer'), designer: document.getElementById('view-designer'), nav: document.getElementById('global-nav') };

// --- 13-STEP BULLETPROOF ROADMAP ---
const projectPhases = [
    { category: "Sales & Planning", name: "Sales & Planning", totalTime: "2-4 Wks", steps: [{ id: "1. Consultation & Survey", time: "1 wk" }, { id: "2. Design & Proposal", time: "1-2 wks" }, { id: "3. Order Placed", time: "Immediate" }] },
    { category: "Pre-Commencement", name: "Planning & Survey", totalTime: "2-4 Wks (Base)", steps: [{ id: "4. Survey Appointment", time: "2 wks" }, { id: "5. Planning Permission", time: "8-16 wks (If Reqd)" }, { id: "6. Survey Report", time: "1 wk" }, { id: "7. Test Dig Conducted", time: "1 wk" }, { id: "8. Building Regulations", time: "1 wk" }, { id: "9. Customer Sign-Off", time: "1 wk" }] },
    { category: "Build & Finish", name: "Execution", totalTime: "5-8 Wks", steps: [{ id: "10. Procurement", time: "2 wks" }, { id: "11. Commencement of Building Works", time: "1-2 wks" }, { id: "12. Installation Commences", time: "1 wk" }, { id: "13. Finishing Trades & Completion", time: "2-4 wks" }] }
];
const journeySteps = projectPhases.flatMap(p => p.steps.map(s => s.id));

// --- GITHUB ASSET LOGO MAPPING ---
const brandLogoMap = {
    'Yorkshire Windows': '../yorkshire.png',
    'Clearview': '../clearview.png',
    'Trent Valley': '../trentvalley.png',
    'West Yorkshire': '../westyorkshire.png',
    'COHI': '../co-logo.png',
    'CO Home Improvements': '../co-logo2.png'
};

function switchView(targetView, roleLabel = "") {
    Object.values(views).forEach(v => v.classList.add('hidden-view'));
    views[targetView].classList.remove('hidden-view');
    if (targetView === 'designer') { views.nav.classList.remove('hidden-view'); document.getElementById('nav-role-badge').innerText = roleLabel; }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div'); toast.className = 'toast';
    toast.style.borderLeftColor = type === 'success' ? 'var(--accent-primary)' : '#ef4444';
    toast.innerHTML = `<strong>${type === 'success' ? 'Protocol Success' : 'System Alert'}</strong><br><span style="font-size:0.85rem; color:var(--text-dim);">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateX(100%) scale(0.9)'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3500);
}

function getTemporalGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning"; if (hour < 18) return "Good Afternoon"; return "Good Evening";
}

if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") { Notification.requestPermission(); }

// --- NETFLIX BRAND TRANSITION ENGINE ---
async function triggerBrandTransition(brandName) {
    const overlay = document.getElementById('brand-growth-overlay');
    const logoElement = document.getElementById('active-brand-logo');
    
    logoElement.src = brandLogoMap[brandName] || '../co-logo.png';
    overlay.classList.remove('hidden-view');
    
    requestAnimationFrame(() => {
        setTimeout(() => {
            logoElement.style.transform = "scale(3)";
            logoElement.style.opacity = "0";
        }, 100);
    });

    return new Promise(resolve => setTimeout(() => {
        overlay.classList.add('hidden-view');
        logoElement.style.transform = "scale(1)";
        logoElement.style.opacity = "1";
        resolve();
    }, 1000));
}

// === PERSISTENT AUTHENTICATION ===
window.addEventListener('DOMContentLoaded', async () => {
    const auth = JSON.parse(sessionStorage.getItem('powerhouse_auth'));
    if(auth) {
        window.currentActiveRole = auth.role;
        if(auth.role === 'admin' || auth.role === 'designer') {
            switchView('designer', auth.role === 'admin' ? 'GLOBAL ADMIN' : 'OPERATIONS HUB'); initDesignerDashboard();
        } else if (auth.role === 'customer' && auth.surveyId) {
            try {
                const docSnap = await getDoc(doc(db, "surveys", auth.surveyId));
                if(docSnap.exists()) { switchView('customer'); initCustomerVault(docSnap); } else { sessionStorage.removeItem('powerhouse_auth'); }
            } catch(e) { sessionStorage.removeItem('powerhouse_auth'); }
        }
    }
});

// === AUTHENTICATION & ANALYTICS ===
document.getElementById('btn-login').addEventListener('click', async () => {
    const id = document.getElementById('loginId').value.trim().toUpperCase(); const pin = document.getElementById('loginPin').value.trim();
    const btn = document.getElementById('btn-login'); btn.innerText = "Authenticating...";
    
    if (id === 'ADMIN' && pin === 'master123') { sessionStorage.setItem('powerhouse_auth', JSON.stringify({ role: 'admin' })); switchView('designer', 'GLOBAL ADMIN'); initDesignerDashboard(); btn.innerText="Authenticate"; return; }
    if (id === 'DESIGNER' && pin === 'survey123') { window.currentActiveRole='designer'; sessionStorage.setItem('powerhouse_auth', JSON.stringify({ role: 'designer' })); switchView('designer', 'OPERATIONS HUB'); initDesignerDashboard(); btn.innerText="Authenticate"; return; }

    try {
        const q = query(collection(db, "surveys"), where("data.inputs.postCode", "==", id), where("data.inputs.clientNum", "==", pin));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const surveyDoc = snap.docs[0];
            const brandName = surveyDoc.data().data?.inputs?._brand || 'COHI';
            
            // ANALYTICS TRIGGER
            await updateDoc(doc(db, "surveys", surveyDoc.id), { "analytics.loginCount": increment(1), "analytics.lastActive": Date.now() });

            sessionStorage.setItem('powerhouse_auth', JSON.stringify({ role: 'customer', surveyId: surveyDoc.id }));
            
            // EXECUTE CINEMATIC TRANSITION
            await triggerBrandTransition(brandName);
            
            document.getElementById('btn-return-designer').classList.add('hidden-view');
            switchView('customer'); initCustomerVault(surveyDoc);
        } else {
            document.getElementById('login-error').innerText = "Credentials not recognized."; document.getElementById('login-error').classList.remove('hidden-view');
        }
    } catch (error) { showToast("Network anomaly detected.", "error"); }
    btn.innerText = "Authenticate";
});

document.getElementById('btn-logout').addEventListener('click', () => { sessionStorage.removeItem('powerhouse_auth'); window.location.reload(); });

// === COMMAND CENTER & SEMANTIC SEARCH ===
window.activeDesignerStageFilter = 'ALL'; window.allPipelineData = []; 
window.setDesignerFilter = function(stage, btnElement) {
    window.activeDesignerStageFilter = stage;
    Array.from(btnElement.parentElement.children).forEach(btn => { btn.style.background = 'transparent'; btn.style.color = 'var(--text-dim)'; btn.style.borderColor = 'transparent'; });
    btnElement.style.background = 'rgba(13,202,240,0.1)'; btnElement.style.color = 'var(--accent-primary)'; btnElement.style.borderColor = 'rgba(13,202,240,0.3)';
    renderPipelineCards(); 
}
document.getElementById('designer-search').addEventListener('input', (e) => { renderPipelineCards(e.target.value.trim().toLowerCase()); });

async function fetchAndRenderPipeline() {
    const container = document.getElementById('designer-pipeline-container');
    container.innerHTML = '<div class="glass-panel"><div class="skeleton" style="height:30px; width:60%; margin-bottom:15px;"></div><div class="skeleton" style="height:40px; width:100%;"></div></div>';
    try {
        const snap = await getDocs(collection(db, "surveys"));
        window.allPipelineData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderPipelineCards();
    } catch (error) { showToast("Failed to initialize pipeline matrix.", "error"); }
}

function renderPipelineCards(searchQuery = "") {
    const container = document.getElementById('designer-pipeline-container'); container.innerHTML = ''; let renderCount = 0;

    window.allPipelineData.forEach(data => {
        const inputs = data.data?.inputs || {}; const analytics = data.analytics || { loginCount: 0, lastActive: 0 };
        const status = inputs._pipelineStatus || '1. Consultation & Survey';
        const clientName = data.clientName || 'Unnamed Entity'; const postCode = inputs.postCode || 'N/A';
        
        let currentCategory = "Sales & Planning";
        projectPhases.forEach(p => { if(p.steps.map(s=>s.id).includes(status)) currentCategory = p.category; });
        if (window.activeDesignerStageFilter !== 'ALL' && currentCategory !== window.activeDesignerStageFilter) return;

        if (searchQuery) { const matchName = clientName.toLowerCase().includes(searchQuery); const matchId = postCode.toLowerCase().includes(searchQuery); if (!matchName && !matchId) return; }
        renderCount++;

        const daysSinceClientActive = analytics.lastActive ? (Date.now() - analytics.lastActive) / (1000 * 60 * 60 * 24) : 999;
        let heatHtml = ''; let cardBorder = 'var(--glass-border)';
        
        if (analytics.loginCount > 2 && daysSinceClientActive < 3) {
            heatHtml = `<div style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); padding: 6px 12px; border-radius: 12px; font-size: 0.75rem; display: flex; align-items: center; gap: 8px; color: #ef4444; font-weight:bold;">
                            <span class="rag-dot status-hot"></span> 🔥 HOT LEAD (${analytics.loginCount} Logins)
                        </div>`;
            cardBorder = 'rgba(239, 68, 68, 0.4)';
        } else {
            heatHtml = `<div style="background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); padding: 6px 12px; border-radius: 12px; font-size: 0.75rem; display: flex; align-items: center; gap: 8px;">
                            <span class="rag-dot status-active"></span> Pulse: Stable
                        </div>`;
        }
        
        container.innerHTML += `
            <div class="glass-panel" style="padding: 30px; border-color: ${cardBorder}; transition: all 0.3s;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px;">
                    <div><h3 style="margin: 0; font-size: 1.3rem; color: #fff;">${clientName}</h3><p style="margin: 6px 0 0 0; color: var(--text-dim); font-size: 0.85rem; letter-spacing: 1px;">ID: ${postCode}</p></div>
                    ${heatHtml}
                </div>
                <div style="margin-bottom: 25px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 12px; border: 1px solid var(--glass-border);">
                    <p style="margin: 0; font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">Active Phase</p><p style="margin: 6px 0 0 0; color: var(--accent-primary); font-weight: 600; font-size: 1.05rem;">${status}</p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-quick btn-quick-primary" onclick="openVaultPreview('${data.id}')">Vault</button>
                    <button class="btn-quick" onclick="openActionModal('notes', '${data.id}')">Notes</button>
                    <button class="btn-quick" onclick="triggerQuickUpload('${data.id}')">PDF</button>
                    <button class="btn-quick" onclick="openActionModal('contact', '${data.id}')">Log</button>
                    <button class="btn-quick" onclick="openActionModal('status', '${data.id}', '${status}')">Status</button>
                </div>
            </div>`;
    });
    if(renderCount === 0) container.innerHTML = '<p style="color:var(--text-dim); grid-column: 1/-1; text-align:center;">No records match your criteria.</p>';
}

window.initDesignerDashboard = function() { fetchAndRenderPipeline(); }

window.openVaultPreview = async function(surveyId) {
    const docSnap = await getDoc(doc(db, "surveys", surveyId));
    if (docSnap.exists()) { switchView('customer'); document.getElementById('btn-return-designer').classList.remove('hidden-view'); initCustomerVault(docSnap); }
};
document.getElementById('btn-return-designer').addEventListener('click', () => { 
    if(window.activeChatUnsubscribe) window.activeChatUnsubscribe(); if(window.activeDocsUnsubscribe) window.activeDocsUnsubscribe();
    switchView('designer', 'OPERATIONS HUB'); fetchAndRenderPipeline(); 
});

// === MODALS & VISIBILITY TOGGLE ===
window.openActionModal = function(type, surveyId, currentStatus = "") {
    window.activeActionSurveyId = surveyId;
    if (type === 'notes') { document.getElementById('input-note-visibility').checked = false; document.getElementById('modal-notes').classList.remove('hidden-view'); }
    if (type === 'contact') document.getElementById('modal-contact').classList.remove('hidden-view');
    if (type === 'status') { document.getElementById('input-status-select').innerHTML = journeySteps.concat(['Stalled', 'Dead Lead']).map(s => `<option value="${s}" ${s===currentStatus?'selected':''}>${s}</option>`).join(''); document.getElementById('modal-status').classList.remove('hidden-view'); }
}

document.getElementById('btn-save-note').addEventListener('click', async () => {
    const val = document.getElementById('input-note-text').value; if(!val) return;
    const isExternal = document.getElementById('input-note-visibility').checked;
    
    if (isExternal) {
        if (!confirm("WARNING: This note will be visible to the client in their secure vault. Proceed?")) return;
    }

    await addDoc(collection(db, `surveys/${window.activeActionSurveyId}/internalNotes`), { 
        content: `[${isExternal ? 'Client Facing' : 'Internal Audit'}] ${val}`, 
        visibility: isExternal ? 'external' : 'internal',
        timestamp: serverTimestamp() 
    });
    document.getElementById('modal-notes').classList.add('hidden-view'); document.getElementById('input-note-text').value=''; showToast("Record securely appended.");
});

document.getElementById('btn-save-contact').addEventListener('click', async () => {
    const type = document.getElementById('input-contact-type').value; const val = document.getElementById('input-contact-note').value;
    await addDoc(collection(db, `surveys/${window.activeActionSurveyId}/internalNotes`), { content: `[Dispatch: ${type}] ${val}`, visibility: 'internal', timestamp: serverTimestamp() });
    await updateDoc(doc(db, "surveys", window.activeActionSurveyId), { "data.inputs._lastContacted": Date.now() });
    document.getElementById('modal-contact').classList.add('hidden-view'); document.getElementById('input-contact-note').value=''; showToast(`Dispatch via ${type} logged.`); fetchAndRenderPipeline();
});

document.getElementById('btn-save-status').addEventListener('click', async () => {
    const newStatus = document.getElementById('input-status-select').value;
    await updateDoc(doc(db, "surveys", window.activeActionSurveyId), { "data.inputs._pipelineStatus": newStatus, "data.inputs._lastContacted": Date.now() });
    document.getElementById('modal-status').classList.add('hidden-view'); showToast(`Roadmap advanced to: ${newStatus}`); fetchAndRenderPipeline();
});

// === CLOUDINARY UPLOAD OVERDRIVE (/RAW FIX) ===
async function uploadToCloudinary(file) {
    const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    
    // Explicitly force 'raw' for PDFs to bypass image processing rejection
    const resourceType = file.type === 'application/pdf' ? 'raw' : 'image';
    
    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) return data.secure_url; throw new Error(data.error?.message || "API Rejection");
    } catch (err) { throw err; }
}

window.triggerQuickUpload = function(surveyId) { window.activeVaultSurveyId = surveyId; document.getElementById('designer-quick-upload-input').click(); };
document.getElementById('designer-quick-upload-input').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if(!file) return; showToast("Establishing secure uplink for Blueprint...");
    try {
        const url = await uploadToCloudinary(file);
        await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/documents`), { name: file.name, url: url, category: "Official Quote", uploadedAt: serverTimestamp() });
        showToast("Blueprint successfully secured.");
    } catch (err) { showToast(`Uplink failed: ${err.message}`, "error"); }
});

// === CUSTOMER VAULT (Fog of War & Hero Mapping) ===
window.activeChatUnsubscribe = null; window.activeDocsUnsubscribe = null;

window.initCustomerVault = function(docSnap) {
    const data = docSnap.data(); const inputs = data.data?.inputs || {};
    window.activeVaultSurveyId = docSnap.id; 
    const currentStatus = inputs._pipelineStatus || "1. Consultation & Survey";
    
    if (window.currentActiveRole === 'designer' || window.currentActiveRole === 'admin') document.getElementById('designer-vault-controls').classList.remove('hidden-view');
    else document.getElementById('designer-vault-controls').classList.add('hidden-view');

    const brand = inputs._brand || 'COHI';
    document.getElementById('vault-brand-logo').src = brandLogoMap[brand] || '../co-logo.png';
    document.getElementById('vault-brand-logo').classList.remove('hidden-view');
    
    document.getElementById('vault-greeting').innerText = getTemporalGreeting();
    document.getElementById('vault-client-name').innerText = data.clientName || "Valued Client";
    
    // Automated Hero Stat Mapping
    document.getElementById('spec-uvalue').innerText = inputs.uValue ? `${inputs.uValue} W/m²K` : "Analyzing";
    document.getElementById('spec-footprint').innerText = inputs.floorArea ? `${inputs.floorArea} m²` : "Pending";

    // Bulletproof Timeline Matcher
    const tContainer = document.getElementById('vault-timeline-container'); tContainer.innerHTML = '';
    let globalStepIndex = 0; let currentGlobalStatusIndex = 0;
    projectPhases.forEach(phase => { phase.steps.forEach(step => { if(step.id === currentStatus || step.id.includes(currentStatus) || currentStatus.includes(step.id)) { currentGlobalStatusIndex = globalStepIndex; } globalStepIndex++; }); });
    globalStepIndex = 0;

    projectPhases.forEach((phase, phaseIndex) => {
        let phaseIsActive = false; let phaseIsFuture = true;
        const stepsHtml = phase.steps.map(step => {
            let style = 'color: var(--text-dim); opacity: 0.3;'; let icon = '🔒'; let isDone = false;
            if (globalStepIndex < currentGlobalStatusIndex) { style = 'color: #fff; text-decoration: line-through; opacity: 0.5;'; icon = '✓'; phaseIsFuture = false; isDone = true; } 
            else if (globalStepIndex === currentGlobalStatusIndex) { style = 'color: var(--accent-primary); font-weight: 600; text-shadow: 0 0 10px rgba(13,202,240,0.3);'; icon = '●'; phaseIsActive = true; phaseIsFuture = false; }
            globalStepIndex++;
            return `<div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-left: 20px; border-left: 2px solid ${style.includes('--accent-primary') ? 'var(--accent-primary)' : 'var(--glass-border)'}; margin-left: 10px; transition: all 0.3s;">
                        <span style="${style}"><span style="display:inline-block; width:26px;">${icon}</span> ${step.id}</span>
                        <span style="color: var(--text-dim); font-size: 0.75rem; letter-spacing: 1px; ${isDone ? 'opacity:0;' : ''}">${step.time}</span>
                    </div>`;
        }).join('');

        const isExpanded = phaseIsActive || (!phaseIsFuture && phaseIndex === 0) || (currentGlobalStatusIndex === 0 && phaseIndex === 0);
        const lockHtml = phaseIsFuture ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>` : '';
        
        tContainer.innerHTML += `
            <div style="background: rgba(0,0,0,0.3); border: 1px solid ${isExpanded ? 'rgba(13,202,240,0.4)' : 'var(--glass-border)'}; border-radius: 16px; padding: 25px; transition: all 0.5s; margin-bottom: 20px; ${phaseIsFuture ? 'opacity: 0.5;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${isExpanded ? '20px' : '0'};">
                    <h4 style="margin: 0; font-size: 1.1rem; color: ${isExpanded ? '#fff' : 'var(--text-dim)'}; display:flex; align-items:center; gap:8px;">${lockHtml} ${phase.name}</h4>
                    <span style="background: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 8px; font-size: 0.75rem; color: var(--text-dim); letter-spacing: 1px;">EST. ${phase.totalTime}</span>
                </div>
                <div style="display: ${isExpanded ? 'block' : 'none'}; animation: fadeIn 0.5s;">${stepsHtml}</div>
            </div>`;
    });

    initDocumentCenter(window.activeVaultSurveyId); initVaultChat(window.activeVaultSurveyId);
}

// === VAULT SECURE UPLINK ===
document.getElementById('btn-vault-upload').addEventListener('click', async () => {
    const fileInput = document.getElementById('vault-upload-file'); const category = document.getElementById('vault-upload-category').value;
    const file = fileInput.files[0]; const btn = document.getElementById('btn-vault-upload');
    if(!file) { showToast("Select payload first.", "error"); return; }
    showToast(`Establishing uplink for ${category}...`); btn.innerText = "Transmitting..."; btn.style.opacity = "0.7";
    try {
        const url = await uploadToCloudinary(file);
        await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/documents`), { name: file.name, url: url, category: category, uploadedAt: serverTimestamp() });
        showToast(`${category} secured in Vault.`); fileInput.value = "";
    } catch (err) { showToast(`Transmission failed: ${err.message}`, "error"); }
    btn.innerText = "Execute Upload"; btn.style.opacity = "1";
});

// === CINEMATIC PDF & ARCHIVE ===
window.loadPdfInViewer = function(url, category) {
    const viewer = document.getElementById('vault-pdf-viewer'); const placeholder = document.getElementById('pdf-placeholder');
    const actionBar = document.getElementById('pdf-actions'); const btnExpand = document.getElementById('btn-pdf-expand');
    document.getElementById('active-doc-badge').innerText = category;
    viewer.src = url + "#view=FitH&toolbar=0"; viewer.classList.remove('hidden-view'); placeholder.classList.add('hidden-view'); actionBar.classList.remove('hidden-view');
    btnExpand.onclick = () => window.open(url, '_blank');
}

function initDocumentCenter(surveyId) {
    if(window.activeDocsUnsubscribe) window.activeDocsUnsubscribe();
    window.activeDocsUnsubscribe = onSnapshot(query(collection(db, `surveys/${surveyId}/documents`), orderBy('uploadedAt', 'desc')), (snapshot) => {
        const archive = document.getElementById('vault-doc-archive'); archive.innerHTML = ''; document.getElementById('spec-docs').innerText = snapshot.size;
        let latestPdfFound = false;
        if (snapshot.empty) {
            archive.innerHTML = '<p style="color: var(--text-dim); font-size: 0.85rem; margin: 0;">Archive empty.</p>';
            document.getElementById('vault-pdf-viewer').classList.add('hidden-view'); document.getElementById('pdf-actions').classList.add('hidden-view'); document.getElementById('pdf-placeholder').classList.remove('hidden-view');
            document.getElementById('pdf-placeholder').innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1" style="margin-bottom: 15px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg><p style="margin:0; font-size: 1.1rem; color:#fff;">Awaiting Initialization</p><p style="color: var(--text-dim); font-size: 0.9rem; margin-top: 5px;">Your designer is compiling the blueprint.</p>';
            document.getElementById('active-doc-badge').innerText = "Awaiting Initialization"; return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data(); const cat = data.category || "Official Document";
            archive.innerHTML += `
                <div class="doc-item" onclick="window.loadPdfInViewer('${data.url}', '${cat}')">
                    <div><p style="margin: 0; font-weight: 600; font-size: 0.95rem; color: #fff; letter-spacing:0.5px;">${cat}</p><p style="margin: 4px 0 0 0; font-size: 0.75rem; color: var(--text-dim);">${data.name}</p></div>
                    <span style="background: rgba(13,202,240,0.1); color: var(--accent-primary); padding: 8px 16px; border-radius: 8px; font-size: 0.75rem; font-weight: 600; text-transform:uppercase;">View</span>
                </div>`;
            if (!latestPdfFound) { window.loadPdfInViewer(data.url, cat); latestPdfFound = true; }
        });
    });
}

// === SECURE IDENTITY COMMS & PUSH ALERTS ===
let initialChatLoad = true;
function initVaultChat(surveyId) {
    const chatWindow = document.getElementById('chat-window'); initialChatLoad = true;
    if(window.activeChatUnsubscribe) window.activeChatUnsubscribe();
    
    window.activeChatUnsubscribe = onSnapshot(query(collection(db, `surveys/${surveyId}/messages`), orderBy('timestamp', 'asc')), (snapshot) => {
        chatWindow.innerHTML = snapshot.empty ? '<div style="text-align:center; margin-top:40px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="1.5" style="margin-bottom:10px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><p style="color:var(--text-dim); font-size:0.9rem; margin:0;">Secure channel established.</p></div>' : '';
        
        snapshot.docChanges().forEach((change) => {
            const msg = change.doc.data(); const isMe = msg.sender === (window.currentActiveRole==='designer'?'Designer':'Customer');
            if (change.type === "added" && !initialChatLoad && !isMe && window.currentActiveRole === 'designer') {
                if (Notification.permission === 'granted') { new Notification("New Client Message", { body: msg.text, icon: "../co-logo.png" }); }
                showToast("New direct message received.", "success");
            }
        });

        snapshot.forEach(doc => {
            const msg = doc.data(); const isMe = msg.sender === (window.currentActiveRole==='designer'?'Designer':'Customer');
            const identityLabel = isMe ? (window.currentActiveRole === 'designer' ? 'Tom (Director)' : 'You') : (window.currentActiveRole === 'designer' ? 'Client' : 'Tom (Director)');
            
            chatWindow.innerHTML += `
                <div class="chat-row" style="justify-content: ${isMe ? 'flex-end' : 'flex-start'};">
                    <div class="chat-bubble ${isMe ? 'chat-me' : 'chat-them'}">
                        <div class="chat-identity">${identityLabel}</div>
                        ${msg.text}
                    </div>
                </div>`;
        });
        
        setTimeout(() => chatWindow.scrollTop = chatWindow.scrollHeight, 100); 
        initialChatLoad = false;
    });
}

document.getElementById('btn-send-chat').addEventListener('click', async () => {
    const text = document.getElementById('chat-input').value.trim(); if(!text) return; document.getElementById('chat-input').value = '';
    await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/messages`), { sender: window.currentActiveRole==='designer'?'Designer':'Customer', text: text, timestamp: serverTimestamp() });
});
