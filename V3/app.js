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

// CLOUDINARY CONFIG (Bypassing Firebase Storage completely)
const cloudinaryConfig = {
    cloudName: "YOUR_CLOUD_NAME", // Update this with your Cloudinary name
    uploadPreset: "crm_document_uploads" // The unsigned preset we discussed
};

const views = { login: document.getElementById('view-login'), customer: document.getElementById('view-customer'), designer: document.getElementById('view-designer'), nav: document.getElementById('global-nav') };

// --- 13-STEP JOURNEY & STATUS CONFIG ---
const journeySteps = [
    "1. Consultation & Survey", "2. Design & Proposal", "3. Order Placed",
    "4. Awaiting Survey Appt", "5. Awaiting Planning", "6. Awaiting Survey Report",
    "7. Awaiting Test Dig", "8. Awaiting Building Regs", "9. Awaiting Customer Sign-Off",
    "10. Procurement", "11. Commencement of Building Works", "12. Installation Commences", "13. Finishing Trades & Completion"
];

// --- BRANDING & BROCHURE ENGINE ---
const brandConfig = {
    'Yorkshire Windows': { logo: '../yorkshire.png', brochures: { roof: 'https://example.com/yw-roof.pdf', bifold: 'https://example.com/yw-bifold.pdf' } },
    'CO Home Improvements': { logo: '../co-logo.png', brochures: { roof: 'https://example.com/cohi-roof.pdf', bifold: 'https://example.com/cohi-bifold.pdf' } },
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
    if (id === 'DESIGNER' && pin === 'survey123') { switchView('designer', 'DESIGNER PORTAL'); initDesignerDashboard('Tom'); return; }

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

// === DESIGNER PIPELINE & QUICK ACTIONS ===
window.activeActionSurveyId = null;

async function fetchAndRenderPipeline() {
    const container = document.getElementById('designer-pipeline-container');
    container.innerHTML = 'Syncing Matrix...';
    try {
        const snap = await getDocs(collection(db, "surveys"));
        container.innerHTML = ''; 
        
        snap.forEach(docSnap => {
            const data = docSnap.data(); const inputs = data.data?.inputs || {};
            const clientName = data.clientName || 'Unnamed Client';
            const status = inputs._pipelineStatus || '1. Consultation & Survey';
            
            // Build the 5 Quick Action Buttons
            const actionHTML = `
                <div style="display: flex; gap: 8px; margin-top: 15px; border-top: 1px solid #333; padding-top: 15px;">
                    <button class="btn-quick btn-quick-primary" onclick="openVaultPreview('${docSnap.id}')">Vault</button>
                    <button class="btn-quick" onclick="openActionModal('notes', '${docSnap.id}')">Notes</button>
                    <button class="btn-quick" onclick="document.getElementById('doc-upload-input').click(); window.activeVaultSurveyId = '${docSnap.id}';">Sync PDF</button>
                    <button class="btn-quick" onclick="openActionModal('contact', '${docSnap.id}')">Log</button>
                    <button class="btn-quick" onclick="openActionModal('status', '${docSnap.id}', '${status}')">Status</button>
                </div>
            `;

            container.innerHTML += `
                <div class="rag-card">
                    <div class="rag-indicator bg-green"></div>
                    <div style="padding-left: 10px;">
                        <h3 style="margin: 0; font-size: 1.1rem; color: #fff;">${clientName}</h3>
                        <p style="margin: 4px 0 0 0; color: #888; font-size: 0.8rem;">${inputs.postCode || 'N/A'} | Stage: <span style="color:#0dcaf0;">${status}</span></p>
                    </div>
                    ${actionHTML}
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

// --- QUICK ACTION MODAL LOGIC (Internal Audit Trail) ---
window.openActionModal = function(type, surveyId, currentStatus = "") {
    window.activeActionSurveyId = surveyId;
    if (type === 'notes') document.getElementById('modal-notes').classList.remove('hidden-view');
    if (type === 'contact') document.getElementById('modal-contact').classList.remove('hidden-view');
    if (type === 'status') {
        const select = document.getElementById('input-status-select');
        select.innerHTML = journeySteps.concat(['Stalled', 'Dead Lead']).map(s => `<option value="${s}" ${s===currentStatus?'selected':''}>${s}</option>`).join('');
        document.getElementById('modal-status').classList.remove('hidden-view');
    }
}

async function logInternalNote(surveyId, actionPrefix, noteText) {
    await addDoc(collection(db, `surveys/${surveyId}/internalNotes`), {
        content: `[${actionPrefix}] ${noteText}`, timestamp: serverTimestamp(), designer: "Tom"
    });
}

document.getElementById('btn-save-note').addEventListener('click', async () => {
    const val = document.getElementById('input-note-text').value; if(!val) return;
    await logInternalNote(window.activeActionSurveyId, "Manual Note", val);
    document.getElementById('modal-notes').classList.add('hidden-view'); document.getElementById('input-note-text').value='';
});

document.getElementById('btn-save-contact').addEventListener('click', async () => {
    const type = document.getElementById('input-contact-type').value;
    const val = document.getElementById('input-contact-note').value;
    await logInternalNote(window.activeActionSurveyId, `Contacted - ${type}`, val);
    await updateDoc(doc(db, "surveys", window.activeActionSurveyId), { "data.inputs._lastContacted": Date.now() });
    document.getElementById('modal-contact').classList.add('hidden-view'); document.getElementById('input-contact-note').value='';
});

document.getElementById('btn-save-status').addEventListener('click', async () => {
    const newStatus = document.getElementById('input-status-select').value;
    const note = document.getElementById('input-status-note').value;
    await updateDoc(doc(db, "surveys", window.activeActionSurveyId), { "data.inputs._pipelineStatus": newStatus });
    await logInternalNote(window.activeActionSurveyId, `Status Updated to ${newStatus}`, note);
    document.getElementById('modal-status').classList.add('hidden-view');
    initDesignerDashboard();
});


// === CUSTOMER VAULT LOGIC (The 13-Step Engine) ===
window.initCustomerVault = function(docSnap) {
    const data = docSnap.data(); const inputs = data.data?.inputs || {};
    window.activeVaultSurveyId = docSnap.id; 
    const currentStatus = inputs._pipelineStatus || journeySteps[0];
    
    // 1. Dynamic Branding & Brochures
    const brand = inputs._brand || 'CO Home Improvements';
    const conf = brandConfig[brand] || brandConfig['CO Home Improvements'];
    if(conf.logo) {
        document.getElementById('vault-brand-logo').src = conf.logo;
        document.getElementById('vault-brand-logo').classList.remove('hidden-view');
    }
    document.getElementById('vault-brochure-container').innerHTML = `
        <button onclick="window.open('${conf.brochures.roof}')" class="filter-btn">Roofing Systems</button>
        <button onclick="window.open('${conf.brochures.bifold}')" class="filter-btn">Bifold Doors</button>
    `;

    // 2. Render 13-Step Timeline
    const tContainer = document.getElementById('vault-timeline-container');
    tContainer.innerHTML = '';
    let currentIdx = journeySteps.indexOf(currentStatus);
    if(currentIdx === -1) currentIdx = 0; // fallback
    
    journeySteps.forEach((step, idx) => {
        let stateClass = 'step-upcoming'; let icon = `${idx + 1}`;
        if(idx < currentIdx) { stateClass = 'step-completed'; icon = '✓'; }
        else if (idx === currentIdx) { stateClass = 'step-active'; }
        
        tContainer.innerHTML += `
            <div class="timeline-step ${stateClass}">
                <div class="timeline-line"></div>
                <div class="timeline-icon">${icon}</div>
                <div class="step-text" style="padding-top: 5px;">${step}</div>
            </div>`;
    });

    // 3. Smart Parser Fallbacks (Architectural Specs)
    const renderSpec = (label, val, hideIfEmpty = false, fallbackStr = null) => {
        if (!val || val === "No" || val === "0" || val === "") {
            if(hideIfEmpty) return "";
            if(fallbackStr) return `<div class="spec-row"><span>${label}:</span> <strong style="color:#aaa; font-style:italic;">${fallbackStr}</strong></div>`;
        }
        return `<div class="spec-row"><span>${label}:</span> <strong>${val}</strong></div>`;
    };

    document.getElementById('vault-specs-container').innerHTML = `
        ${renderSpec("Build Directive", inputs.buildType)}
        ${renderSpec("Dimensions", inputs.proposedSize)}
        ${renderSpec("Roofing Sys", inputs.roofType)}
        ${renderSpec("Finish Matrix", inputs.frameColour)}
        ${renderSpec("Electrics", inputs.electrics, false, "No electrical work included.")}
        ${renderSpec("Plumbing", inputs.plumbing, false, "No plumbing work included.")}
        ${renderSpec("Building Regs", inputs.buildingRegs, true)}
        ${renderSpec("Breakthrough", inputs.breakthrough, true)}
        ${renderSpec("Extra Excavation", inputs.extraExcavation, true)}
    `;

    // 4. Dynamic Photo Gallery (Prioritizing Roof Type)
    // Placeholder array simulating what Cloudinary API will return based on tagging
    const mockCloudinaryImages = [
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=500&q=80",
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=500&q=80"
    ];
    document.getElementById('vault-gallery-container').innerHTML = mockCloudinaryImages.map(img => `<img src="${img}" class="gallery-img">`).join('');

    initDocumentCenter(window.activeVaultSurveyId);
    initVaultChat(window.activeVaultSurveyId);
}

// --- CLOUDINARY DOCUMENT CENTER ---
function initDocumentCenter(surveyId) {
    const q = query(collection(db, `surveys/${surveyId}/documents`), orderBy('uploadedAt', 'desc'));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('vault-docs-container');
        container.innerHTML = snapshot.empty ? '<p style="color:#666; font-size:0.85rem;">No documents uploaded yet.</p>' : '';
        snapshot.forEach(docSnap => {
            const docData = docSnap.data();
            container.innerHTML += `
                <div class="doc-card">
                    <div>
                        <p style="margin: 0; font-size: 0.95rem; font-weight: bold;">${docData.name}</p>
                        <p style="margin: 2px 0 0 0; font-size: 0.7rem; color: #888;">Document Link Available</p>
                    </div>
                    <button onclick="window.open('${docData.url}', '_blank')" class="filter-btn" style="color:#0dcaf0;">View</button>
                </div>`;
        });
    });
}

document.getElementById('btn-upload-doc').addEventListener('click', async () => {
    const file = document.getElementById('doc-upload-input').files[0];
    const statusText = document.getElementById('upload-status');
    if(!file || !window.activeVaultSurveyId) { statusText.innerText = "Select file first."; return; }
    
    statusText.innerText = "Uploading to Cloudinary..."; statusText.style.color = "#0dcaf0";
    
    // Bypass Google Storage Limits via Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`, { method: 'POST', body: formData });
        const cloudData = await res.json();
        
        if (cloudData.secure_url) {
            await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/documents`), {
                name: file.name, url: cloudData.secure_url, uploadedAt: serverTimestamp(), uploadedBy: 'Designer'
            });
            await logInternalNote(window.activeVaultSurveyId, "System", `Uploaded PDF/Image: ${file.name}`);
            statusText.innerText = "Upload Successful!"; statusText.style.color = "#28a745";
        } else { throw new Error("Cloudinary Error"); }
    } catch (err) {
        console.error(err); statusText.innerText = "Update Cloudinary Config."; statusText.style.color = "#ff4444";
    }
});

// --- BASIC CHAT LOGIC ---
function initVaultChat(surveyId) {
    const chatWindow = document.getElementById('chat-window');
    onSnapshot(query(collection(db, `surveys/${surveyId}/messages`), orderBy('timestamp', 'asc')), (snapshot) => {
        chatWindow.innerHTML = snapshot.empty ? '<p style="text-align:center; color:#555;">Connection secure.</p>' : '';
        snapshot.forEach(doc => {
            const msg = doc.data(); const isCustomer = msg.sender === 'Customer';
            chatWindow.innerHTML += `<div class="chat-bubble ${isCustomer ? 'chat-bubble-user' : 'chat-bubble-them'}">${msg.text}</div>`;
        });
        chatWindow.scrollTop = chatWindow.scrollHeight; 
    });
}

document.getElementById('btn-send-chat').addEventListener('click', async () => {
    const text = document.getElementById('chat-input').value.trim();
    if(!text) return; document.getElementById('chat-input').value = '';
    await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/messages`), { sender: window.currentActiveRole==='designer'?'Designer':'Customer', text: text, timestamp: serverTimestamp() });
});
