import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, doc, updateDoc, query, where, onSnapshot, addDoc, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine",
    messagingSenderId: "208212115382",
    appId: "1:208212115382:web:db7d4276b194f89a274b17"
};
const app = initializeApp(appConfig);
const db = getFirestore(app);

// CLOUDINARY CONFIG 
const cloudinaryConfig = {
    cloudName: "YOUR_CLOUD_NAME", // Update this
    uploadPreset: "crm_document_uploads" 
};

const views = { login: document.getElementById('view-login'), customer: document.getElementById('view-customer'), designer: document.getElementById('view-designer'), nav: document.getElementById('global-nav') };

// --- LUXURY PHASE ROADMAP CONFIG ---
const projectPhases = [
    { 
        name: "Design & Planning", 
        totalTime: "2-4 Weeks",
        steps: [
            { id: "1. Consultation & Survey", time: "1 Wk" },
            { id: "2. Design & Proposal", time: "1-2 Wks" },
            { id: "3. Order Placed", time: "Immediate" }
        ]
    },
    { 
        name: "Pre-Commencement", 
        totalTime: "8-12 Weeks",
        steps: [
            { id: "4. Awaiting Survey Appt", time: "1 Wk" },
            { id: "5. Awaiting Planning", time: "6-8 Wks" },
            { id: "6. Awaiting Survey Report", time: "1 Wk" },
            { id: "7. Awaiting Test Dig", time: "1 Wk" },
            { id: "8. Awaiting Building Regs", time: "2-3 Wks" },
            { id: "9. Awaiting Customer Sign-Off", time: "1 Wk" }
        ]
    },
    { 
        name: "Build & Finish", 
        totalTime: "3-5 Weeks",
        steps: [
            { id: "10. Procurement", time: "1-2 Wks" },
            { id: "11. Commencement of Building Works", time: "1-2 Wks" },
            { id: "12. Installation Commences", time: "1 Wk" },
            { id: "13. Finishing Trades & Completion", time: "1 Wk" }
        ]
    }
];

// Flat array for easy dropdowns
const journeySteps = projectPhases.flatMap(p => p.steps.map(s => s.id));

const brandConfig = {
    'Yorkshire Windows': { logo: '../yorkshire.png', brochures: { roof: '#', bifold: '#' } },
    'CO Home Improvements': { logo: '../co-logo.png', brochures: { roof: '#', bifold: '#' } },
    'Clearview': { logo: '../clearview.png', brochures: { roof: '#', bifold: '#' } }
};

function switchView(targetView, roleLabel = "") {
    Object.values(views).forEach(v => v.classList.add('hidden-view'));
    views[targetView].classList.remove('hidden-view');
    if (targetView === 'designer') {
        views.nav.classList.remove('hidden-view');
        document.getElementById('nav-role-badge').innerText = roleLabel;
    }
}

// === AUTHENTICATION ===
document.getElementById('btn-login').addEventListener('click', async () => {
    const id = document.getElementById('loginId').value.trim().toUpperCase();
    const pin = document.getElementById('loginPin').value.trim();
    
    // Capitalized ADMIN fix
    if (id === 'ADMIN' && pin === 'master123') { switchView('designer', 'GLOBAL ADMIN'); initDesignerDashboard(); return; }
    if (id === 'DESIGNER' && pin === 'survey123') { window.currentActiveRole='designer'; switchView('designer', 'DESIGNER PORTAL'); initDesignerDashboard(); return; }

    try {
        const q = query(collection(db, "surveys"), where("data.inputs.postCode", "==", id), where("data.inputs.clientNum", "==", pin));
        const snap = await getDocs(q);
        if (!snap.empty) {
            document.getElementById('btn-return-designer').classList.add('hidden-view');
            document.getElementById('designer-upload-panel').classList.add('hidden-view');
            switchView('customer'); initCustomerVault(snap.docs[0]);
        } else {
            document.getElementById('login-error').innerText = "Credentials not recognized."; document.getElementById('login-error').classList.remove('hidden-view');
        }
    } catch (error) { console.error(error); }
});

document.getElementById('btn-logout').addEventListener('click', () => { window.location.reload(); });

// === DESIGNER LOGIC (Simplified execution for prompt constraints) ===
window.activeActionSurveyId = null;

async function fetchAndRenderPipeline() {
    const container = document.getElementById('designer-pipeline-container');
    container.innerHTML = '<p style="color:#888;">Syncing Matrix...</p>';
    try {
        const snap = await getDocs(collection(db, "surveys"));
        container.innerHTML = ''; 
        snap.forEach(docSnap => {
            const data = docSnap.data(); const inputs = data.data?.inputs || {};
            const status = inputs._pipelineStatus || '1. Consultation & Survey';
            
            container.innerHTML += `
                <div class="glass-card">
                    <div style="position:absolute; left:0; top:0; height:100%; width:4px; background:var(--accent-cyan);"></div>
                    <h3 style="margin: 0; color: #fff;">${data.clientName || 'Unnamed'}</h3>
                    <p style="margin: 4px 0 15px 0; color: var(--text-muted); font-size: 0.8rem;">${inputs.postCode || 'N/A'} | Stage: <span style="color:var(--accent-cyan);">${status}</span></p>
                    <div style="display: flex; gap: 8px; border-top: 1px solid var(--border-subtle); padding-top: 15px;">
                        <button class="filter-btn" style="color:var(--accent-cyan); border-color:var(--accent-cyan);" onclick="openVaultPreview('${docSnap.id}')">View Vault</button>
                        <button class="filter-btn" onclick="openActionModal('notes', '${docSnap.id}')">Notes</button>
                        <button class="filter-btn" onclick="openActionModal('status', '${docSnap.id}', '${status}')">Status</button>
                    </div>
                </div>`;
        });
    } catch (error) { console.error(error); }
}

window.initDesignerDashboard = function() { fetchAndRenderPipeline(); }

window.openVaultPreview = async function(surveyId) {
    const docSnap = await getDoc(doc(db, "surveys", surveyId));
    if (docSnap.exists()) {
        switchView('customer');
        document.getElementById('btn-return-designer').classList.remove('hidden-view');
        document.getElementById('designer-upload-panel').classList.remove('hidden-view');
        initCustomerVault(docSnap);
    }
};
document.getElementById('btn-return-designer').addEventListener('click', () => { switchView('designer', 'DESIGNER PORTAL'); initDesignerDashboard(); });

// Quick Action Modal Hookups
window.openActionModal = function(type, surveyId, currentStatus = "") {
    window.activeActionSurveyId = surveyId;
    if (type === 'notes') document.getElementById('modal-notes').classList.remove('hidden-view');
    if (type === 'status') {
        const select = document.getElementById('input-status-select');
        select.innerHTML = journeySteps.concat(['Stalled', 'Dead Lead']).map(s => `<option value="${s}" ${s===currentStatus?'selected':''}>${s}</option>`).join('');
        document.getElementById('modal-status').classList.remove('hidden-view');
    }
}

document.getElementById('btn-save-note').addEventListener('click', async () => {
    const val = document.getElementById('input-note-text').value; if(!val) return;
    await addDoc(collection(db, `surveys/${window.activeActionSurveyId}/internalNotes`), { content: `[Manual] ${val}`, timestamp: serverTimestamp() });
    document.getElementById('modal-notes').classList.add('hidden-view'); document.getElementById('input-note-text').value='';
});

document.getElementById('btn-save-status').addEventListener('click', async () => {
    const newStatus = document.getElementById('input-status-select').value;
    await updateDoc(doc(db, "surveys", window.activeActionSurveyId), { "data.inputs._pipelineStatus": newStatus });
    document.getElementById('modal-status').classList.add('hidden-view'); initDesignerDashboard();
});


// === PREMIUM CUSTOMER VAULT LOGIC ===
window.initCustomerVault = function(docSnap) {
    const data = docSnap.data(); const inputs = data.data?.inputs || {};
    window.activeVaultSurveyId = docSnap.id; 
    const currentStatus = inputs._pipelineStatus || "1. Consultation & Survey";
    
    // 1. Branding
    const brand = inputs._brand || 'CO Home Improvements';
    const conf = brandConfig[brand] || brandConfig['CO Home Improvements'];
    if(conf.logo) { document.getElementById('vault-brand-logo').src = conf.logo; document.getElementById('vault-brand-logo').classList.remove('hidden-view'); }
    document.getElementById('vault-client-name').innerText = data.clientName || "Valued Client";

    // 2. Dynamic Phase Timeline Logic
    const tContainer = document.getElementById('vault-timeline-container');
    tContainer.innerHTML = '';
    
    let globalStepIndex = 0; let currentGlobalStatusIndex = 0;
    projectPhases.forEach(phase => { phase.steps.forEach(step => { if(step.id === currentStatus) currentGlobalStatusIndex = globalStepIndex; globalStepIndex++; }); });
    globalStepIndex = 0;

    let activePhaseIndex = 0;

    projectPhases.forEach((phase, phaseIndex) => {
        let phaseIsActive = false;
        
        const stepsHtml = phase.steps.map(step => {
            let style = 'color: var(--text-muted);'; let icon = '○';
            if (globalStepIndex < currentGlobalStatusIndex) { style = 'color: #fff; text-decoration: line-through; opacity: 0.5;'; icon = '✓'; }
            else if (globalStepIndex === currentGlobalStatusIndex) { style = 'color: var(--accent-cyan); font-weight: bold;'; icon = '●'; phaseIsActive = true; activePhaseIndex = phaseIndex; }
            globalStepIndex++;
            return `
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-left: 15px; border-left: 2px solid ${style.includes('--accent-cyan') ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; margin-left: 10px;">
                    <span style="${style}"><span style="display:inline-block; width:20px;">${icon}</span> ${step.id}</span>
                    <span style="color: var(--text-muted); font-size: 0.8rem; font-family: monospace;">${step.time}</span>
                </div>`;
        }).join('');

        const isExpanded = phaseIsActive || (phaseIndex === 0 && currentGlobalStatusIndex === 0);
        if(phaseIsActive) document.getElementById('vault-active-phase-tag').innerText = `Phase: ${phase.name}`;
        
        tContainer.innerHTML += `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid ${isExpanded ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; border-radius: 8px; padding: 20px; transition: all 0.3s;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${isExpanded ? '20px' : '0'};">
                    <h4 style="margin: 0; font-size: 1.1rem; color: ${isExpanded ? '#fff' : 'var(--text-muted)'};">${phase.name}</h4>
                    <span style="background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; color: var(--text-muted);">Est. ${phase.totalTime}</span>
                </div>
                <div style="display: ${isExpanded ? 'block' : 'none'};">
                    ${stepsHtml}
                </div>
            </div>`;
    });

    // 3. The Original Vision (Pre-Quote Setup & Auto-Collapse logic)
    const genContainer = document.getElementById('genesis-content');
    genContainer.innerHTML = `
        <div style="background: rgba(13,202,240,0.05); padding: 15px; border-radius: 8px; border-left: 3px solid var(--accent-cyan); margin-bottom: 15px;">
            <p style="margin: 0; font-style: italic; color: #ddd;">"${inputs.customerNotes || "Design notes are currently being formalized."}"</p>
        </div>
        <div class="spec-row"><span class="spec-label">Style Directive</span> <span class="spec-value">${inputs.buildType || "TBC"}</span></div>
        <div class="spec-row"><span class="spec-label">Existing Property</span> <span class="spec-value">${inputs.houseMaterial || "N/A"}</span></div>
        <div class="spec-row"><span class="spec-label">Initial Footprint</span> <span class="spec-value">${inputs.proposedSize || "Subject to survey"}</span></div>
        <div class="spec-row"><span class="spec-label">Access Considerations</span> <span class="spec-value">${inputs.accessDifficult === 'Yes' ? 'Restricted' : 'Clear'}</span></div>
    `;
    
    // UX Magic: If they are past Phase 1, automatically collapse the original vision so the screen isn't cluttered.
    if (activePhaseIndex === 0) {
        genContainer.classList.add('expanded');
        document.getElementById('genesis-icon').parentElement.classList.add('expanded');
    }

    // 4. Architectural Blueprint (PDF Specs)
    const renderSpec = (label, val, hide = false, fallback = null) => {
        if (!val || val === "No" || val === "0" || val === "") return hide ? "" : fallback ? `<div class="spec-row"><span class="spec-label">${label}</span> <span class="spec-value" style="color:var(--text-muted); font-weight:normal; font-style:italic;">${fallback}</span></div>` : "";
        return `<div class="spec-row"><span class="spec-label">${label}</span> <span class="spec-value">${val}</span></div>`;
    };
    
    const specsHTML = `
        ${renderSpec("Roofing System", inputs.roofType)}
        ${renderSpec("Frame Matrix", inputs.frameColour)}
        ${renderSpec("Electrics", inputs.electrics, false, "No electrical work included.")}
        ${renderSpec("Plumbing", inputs.plumbing, false, "No plumbing work included.")}
        ${renderSpec("Building Regs", inputs.buildingRegs, true)}
        ${renderSpec("Breakthrough", inputs.breakthrough, true)}
    `;
    document.getElementById('vault-specs-container').innerHTML = specsHTML;
    
    // Auto-expand specs if they are in Phase 2 or higher
    if (activePhaseIndex >= 1 && specsHTML.trim() !== "") {
        document.getElementById('specs-content').classList.add('expanded');
        document.getElementById('specs-icon').parentElement.classList.add('expanded');
    }

    // 5. Inspiration & Brochures
    document.getElementById('vault-brochure-container').innerHTML = `
        <button class="filter-btn" onclick="window.open('${conf.brochures.roof}')">Roofing Guide</button>
        <button class="filter-btn" onclick="window.open('${conf.brochures.bifold}')">Doors & Hardware</button>
    `;

    initDocumentCenter(window.activeVaultSurveyId);
    initVaultChat(window.activeVaultSurveyId);
}

// --- CLOUDINARY DOCUMENT CENTER ---
function initDocumentCenter(surveyId) {
    onSnapshot(query(collection(db, `surveys/${surveyId}/documents`), orderBy('uploadedAt', 'desc')), (snapshot) => {
        const container = document.getElementById('vault-docs-container');
        const galContainer = document.getElementById('vault-gallery-container');
        
        container.innerHTML = snapshot.empty ? '<p style="color:var(--text-muted); font-size:0.85rem;">Pending document upload.</p>' : '';
        galContainer.innerHTML = '';
        let hasImages = false;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Automatically route image files to the gallery instead of the document list
            if(data.name.match(/\.(jpeg|jpg|gif|png)$/i)) {
                hasImages = true;
                galContainer.innerHTML += `<img src="${data.url}" class="gallery-img" onclick="window.open('${data.url}')">`;
            } else {
                container.innerHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--border-subtle);">
                        <div><p style="margin: 0; font-weight: bold; font-size:0.9rem;">${data.name}</p></div>
                        <button onclick="window.open('${data.url}', '_blank')" style="background:var(--accent-cyan); color:#000; padding:6px 12px; border-radius:4px; font-weight:bold; border:none; font-size:0.8rem;">Open</button>
                    </div>`;
            }
        });
        
        if(!hasImages) galContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; grid-column:1/-1;">Renders will appear here.</p>';
    });
}

document.getElementById('btn-upload-doc').addEventListener('click', async () => {
    const file = document.getElementById('doc-upload-input').files[0];
    const status = document.getElementById('upload-status');
    if(!file || !window.activeVaultSurveyId) return;
    
    status.innerText = "Syncing..."; status.style.color = "var(--accent-cyan)";
    const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', cloudinaryConfig.uploadPreset);

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) {
            await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/documents`), { name: file.name, url: data.secure_url, uploadedAt: serverTimestamp() });
            status.innerText = "Synced successfully!"; status.style.color = "#28a745";
        }
    } catch (err) { status.innerText = "Upload failed."; status.style.color = "#ff4444"; }
});

// --- CONCIERGE CHAT ---
function initVaultChat(surveyId) {
    const chatWindow = document.getElementById('chat-window');
    onSnapshot(query(collection(db, `surveys/${surveyId}/messages`), orderBy('timestamp', 'asc')), (snapshot) => {
        chatWindow.innerHTML = snapshot.empty ? '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-top:20px;">Direct connection established.</p>' : '';
        snapshot.forEach(doc => {
            const msg = doc.data(); const isMe = msg.sender === (window.currentActiveRole==='designer'?'Designer':'Customer');
            chatWindow.innerHTML += `<div class="chat-bubble ${isMe ? 'chat-bubble-user' : 'chat-bubble-them'}">${msg.text}</div>`;
        });
        chatWindow.scrollTop = chatWindow.scrollHeight; 
    });
}

document.getElementById('btn-send-chat').addEventListener('click', async () => {
    const text = document.getElementById('chat-input').value.trim();
    if(!text) return; document.getElementById('chat-input').value = '';
    await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/messages`), { sender: window.currentActiveRole==='designer'?'Designer':'Customer', text: text, timestamp: serverTimestamp() });
});
