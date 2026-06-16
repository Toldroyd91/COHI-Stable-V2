import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, doc, updateDoc, query, where, onSnapshot, addDoc, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine"
};
const app = initializeApp(appConfig);
const db = getFirestore(app);

// CLOUDINARY CONFIG 
const cloudinaryConfig = { cloudName: "YOUR_CLOUD_NAME", uploadPreset: "crm_document_uploads" };

const views = { login: document.getElementById('view-login'), customer: document.getElementById('view-customer'), designer: document.getElementById('view-designer'), nav: document.getElementById('global-nav') };

// --- LUXURY PHASE ROADMAP CONFIG ---
const projectPhases = [
    { category: "Sales & Planning", name: "Design & Planning", totalTime: "2-4 Weeks", steps: [{ id: "1. Consultation & Survey", time: "1 Wk" }, { id: "2. Design & Proposal", time: "1-2 Wks" }, { id: "3. Order Placed", time: "Immediate" }] },
    { category: "Pre-Commencement", name: "Pre-Commencement", totalTime: "8-12 Weeks", steps: [{ id: "4. Awaiting Survey Appt", time: "1 Wk" }, { id: "5. Awaiting Planning", time: "6-8 Wks" }, { id: "6. Awaiting Survey Report", time: "1 Wk" }, { id: "7. Awaiting Test Dig", time: "1 Wk" }, { id: "8. Awaiting Building Regs", time: "2-3 Wks" }, { id: "9. Awaiting Customer Sign-Off", time: "1 Wk" }] },
    { category: "Build & Finish", name: "Build & Finish", totalTime: "3-5 Weeks", steps: [{ id: "10. Procurement", time: "1-2 Wks" }, { id: "11. Commencement of Building Works", time: "1-2 Wks" }, { id: "12. Installation Commences", time: "1 Wk" }, { id: "13. Finishing Trades & Completion", time: "1 Wk" }] }
];
const journeySteps = projectPhases.flatMap(p => p.steps.map(s => s.id));

const brandConfig = {
    'Yorkshire Windows': { logo: '../yorkshire.png' },
    'CO Home Improvements': { logo: '../co-logo.png' }
};

function switchView(targetView, roleLabel = "") {
    Object.values(views).forEach(v => v.classList.add('hidden-view'));
    views[targetView].classList.remove('hidden-view');
    if (targetView === 'designer') { views.nav.classList.remove('hidden-view'); document.getElementById('nav-role-badge').innerText = roleLabel; }
}

// === AUTHENTICATION ===
document.getElementById('btn-login').addEventListener('click', async () => {
    const id = document.getElementById('loginId').value.trim().toUpperCase();
    const pin = document.getElementById('loginPin').value.trim();
    
    if (id === 'ADMIN' && pin === 'master123') { switchView('designer', 'GLOBAL ADMIN'); initDesignerDashboard(); return; }
    if (id === 'DESIGNER' && pin === 'survey123') { window.currentActiveRole='designer'; switchView('designer', 'DESIGNER PORTAL'); initDesignerDashboard(); return; }

    try {
        const q = query(collection(db, "surveys"), where("data.inputs.postCode", "==", id), where("data.inputs.clientNum", "==", pin));
        const snap = await getDocs(q);
        if (!snap.empty) {
            document.getElementById('btn-return-designer').classList.add('hidden-view');
            switchView('customer'); initCustomerVault(snap.docs[0]);
        } else {
            document.getElementById('login-error').innerText = "Credentials not recognized."; document.getElementById('login-error').classList.remove('hidden-view');
        }
    } catch (error) { console.error(error); }
});
document.getElementById('btn-logout').addEventListener('click', () => { window.location.reload(); });


// === RESTORED DESIGNER DASHBOARD WITH TABS, RAG, & 5 BUTTONS ===
window.activeDesignerStageFilter = 'ALL';

window.setDesignerFilter = function(stage, btnElement) {
    window.activeDesignerStageFilter = stage;
    document.querySelectorAll('#designer-filters .filter-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    initDesignerDashboard();
}

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
            const lastContacted = inputs._lastContacted || Date.now();
            
            // 1. Determine Pipeline Category for Tabs
            let currentCategory = "Sales & Planning";
            projectPhases.forEach(p => { if(p.steps.some(s => s.id === status)) currentCategory = p.category; });

            // 2. Filter Logic
            if (window.activeDesignerStageFilter !== 'ALL' && window.activeDesignerStageFilter !== 'Action Required' && currentCategory !== window.activeDesignerStageFilter) return;

            // 3. RAG Heat Map Logic (Client Pulse)
            const daysSinceContact = (Date.now() - lastContacted) / (1000 * 60 * 60 * 24);
            let ragColor = 'var(--rag-green)'; let heatText = 'Pulse: Active'; let heatClass = 'bg-green';
            if (daysSinceContact > 7) { ragColor = 'var(--rag-red)'; heatText = 'Critical Setup'; heatClass = 'bg-red'; }
            else if (daysSinceContact > 3) { ragColor = 'var(--rag-amber)'; heatText = 'Stalled'; heatClass = 'bg-amber'; }
            
            if (window.activeDesignerStageFilter === 'Action Required' && daysSinceContact <= 7) return;

            container.innerHTML += `
                <div class="glass-card" style="border-color: ${ragColor}40;">
                    <div class="rag-indicator" style="background: ${ragColor}; box-shadow: 0 0 10px ${ragColor};"></div>
                    <div class="heat-badge" style="background: ${ragColor}20; color: ${ragColor}; border-color: ${ragColor};">${heatText}</div>
                    
                    <h3 style="margin: 0; color: #fff;">${data.clientName || 'Unnamed'}</h3>
                    <p style="margin: 4px 0 15px 0; color: var(--text-muted); font-size: 0.8rem;">${inputs.postCode || 'N/A'} | Stage: <span style="color:var(--accent-cyan);">${status}</span></p>
                    
                    <div style="display: flex; gap: 8px; border-top: 1px solid var(--border-subtle); padding-top: 15px;">
                        <button class="btn-quick btn-quick-primary" onclick="openVaultPreview('${docSnap.id}')">Vault</button>
                        <button class="btn-quick" onclick="openActionModal('notes', '${docSnap.id}')">Notes</button>
                        <button class="btn-quick" onclick="triggerQuickUpload('${docSnap.id}')">Sync PDF</button>
                        <button class="btn-quick" onclick="openActionModal('contact', '${docSnap.id}')">Log</button>
                        <button class="btn-quick" onclick="openActionModal('status', '${docSnap.id}', '${status}')">Status</button>
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
        initCustomerVault(docSnap);
    }
};
document.getElementById('btn-return-designer').addEventListener('click', () => { switchView('designer', 'DESIGNER PORTAL'); initDesignerDashboard(); });

// Quick Action Modal Logic
window.openActionModal = function(type, surveyId, currentStatus = "") {
    window.activeActionSurveyId = surveyId;
    if (type === 'notes') document.getElementById('modal-notes').classList.remove('hidden-view');
    if (type === 'contact') document.getElementById('modal-contact').classList.remove('hidden-view');
    if (type === 'status') {
        document.getElementById('input-status-select').innerHTML = journeySteps.concat(['Stalled', 'Dead Lead']).map(s => `<option value="${s}" ${s===currentStatus?'selected':''}>${s}</option>`).join('');
        document.getElementById('modal-status').classList.remove('hidden-view');
    }
}

document.getElementById('btn-save-note').addEventListener('click', async () => {
    const val = document.getElementById('input-note-text').value; if(!val) return;
    await addDoc(collection(db, `surveys/${window.activeActionSurveyId}/internalNotes`), { content: `[Internal] ${val}`, timestamp: serverTimestamp() });
    document.getElementById('modal-notes').classList.add('hidden-view'); document.getElementById('input-note-text').value='';
});

document.getElementById('btn-save-contact').addEventListener('click', async () => {
    const type = document.getElementById('input-contact-type').value; const val = document.getElementById('input-contact-note').value;
    await addDoc(collection(db, `surveys/${window.activeActionSurveyId}/internalNotes`), { content: `[Contact: ${type}] ${val}`, timestamp: serverTimestamp() });
    await updateDoc(doc(db, "surveys", window.activeActionSurveyId), { "data.inputs._lastContacted": Date.now() });
    document.getElementById('modal-contact').classList.add('hidden-view'); document.getElementById('input-contact-note').value=''; initDesignerDashboard();
});

document.getElementById('btn-save-status').addEventListener('click', async () => {
    const newStatus = document.getElementById('input-status-select').value;
    await updateDoc(doc(db, "surveys", window.activeActionSurveyId), { "data.inputs._pipelineStatus": newStatus, "data.inputs._lastContacted": Date.now() });
    document.getElementById('modal-status').classList.add('hidden-view'); initDesignerDashboard();
});

// Quick PDF Sync Button Logic
window.triggerQuickUpload = function(surveyId) {
    window.activeVaultSurveyId = surveyId; 
    document.getElementById('designer-quick-upload-input').click();
};
document.getElementById('designer-quick-upload-input').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if(!file) return;
    alert("Uploading " + file.name + " to Cloudinary...");
    const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) {
            await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/documents`), { name: file.name, url: data.secure_url, uploadedAt: serverTimestamp() });
            alert("Success! PDF attached to Vault.");
        }
    } catch (err) { alert("Upload Failed. Check Cloudinary limits."); }
});


// === THE OMNI-SCRAPER FOR PRE-QUOTE DATA ===
function renderDynamicGenesisData(inputs) {
    const textContainer = document.getElementById('genesis-data-rows');
    const photoContainer = document.getElementById('genesis-photo-grid');
    const photoHeader = document.getElementById('genesis-photo-header');
    
    textContainer.innerHTML = ''; photoContainer.innerHTML = '';
    let hasPhotos = false;

    // Helper to make camelCase readable ("accessDifficult" -> "Access Difficult")
    const formatKey = k => k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    const ignoredKeys = ['_brand', '_designerName', '_pipelineStatus', '_lastContacted', 'customerNotes'];

    Object.entries(inputs).forEach(([key, val]) => {
        if(ignoredKeys.includes(key) || !val) return;
        
        // Detect Images (Base64 from canvas signatures/uploads or standard URLs)
        const isImage = (typeof val === 'string' && (val.match(/\.(jpeg|jpg|gif|png)$/i) || val.startsWith('data:image')));
        
        if (isImage) {
            hasPhotos = true;
            photoContainer.innerHTML += `<img src="${val}" class="gallery-img" onclick="window.open('${val}')">`;
        } else if (Array.isArray(val)) {
            val.forEach(item => {
                if(typeof item === 'string' && (item.match(/\.(jpeg|jpg|gif|png)$/i) || item.startsWith('data:image'))) {
                    hasPhotos = true; photoContainer.innerHTML += `<img src="${item}" class="gallery-img" onclick="window.open('${item}')">`;
                } else {
                    textContainer.innerHTML += `<div class="spec-row"><span class="spec-label">${formatKey(key)}</span> <span class="spec-value">${item}</span></div>`;
                }
            });
        } else if (typeof val !== 'object') {
            // Render text data rows
            textContainer.innerHTML += `<div class="spec-row"><span class="spec-label">${formatKey(key)}</span> <span class="spec-value">${val}</span></div>`;
        }
    });

    if(hasPhotos) photoHeader.classList.remove('hidden-view'); else photoHeader.classList.add('hidden-view');
}

// === PREMIUM CUSTOMER VAULT LOGIC ===
window.initCustomerVault = function(docSnap) {
    const data = docSnap.data(); const inputs = data.data?.inputs || {};
    window.activeVaultSurveyId = docSnap.id; 
    const currentStatus = inputs._pipelineStatus || "1. Consultation & Survey";
    
    const brand = inputs._brand || 'CO Home Improvements';
    const conf = brandConfig[brand] || brandConfig['CO Home Improvements'];
    if(conf.logo) { document.getElementById('vault-brand-logo').src = conf.logo; document.getElementById('vault-brand-logo').classList.remove('hidden-view'); }
    document.getElementById('vault-client-name').innerText = data.clientName || "Valued Client";

    // Dynamic Phase Timeline
    const tContainer = document.getElementById('vault-timeline-container');
    tContainer.innerHTML = '';
    let globalStepIndex = 0; let currentGlobalStatusIndex = 0; let activePhaseIndex = 0;
    projectPhases.forEach(phase => { phase.steps.forEach(step => { if(step.id === currentStatus) currentGlobalStatusIndex = globalStepIndex; globalStepIndex++; }); });
    globalStepIndex = 0;

    projectPhases.forEach((phase, phaseIndex) => {
        let phaseIsActive = false;
        const stepsHtml = phase.steps.map(step => {
            let style = 'color: var(--text-muted);'; let icon = '○';
            if (globalStepIndex < currentGlobalStatusIndex) { style = 'color: #fff; text-decoration: line-through; opacity: 0.5;'; icon = '✓'; }
            else if (globalStepIndex === currentGlobalStatusIndex) { style = 'color: var(--accent-cyan); font-weight: bold;'; icon = '●'; phaseIsActive = true; activePhaseIndex = phaseIndex; }
            globalStepIndex++;
            return `<div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-left: 15px; border-left: 2px solid ${style.includes('--accent-cyan') ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; margin-left: 10px;">
                        <span style="${style}"><span style="display:inline-block; width:20px;">${icon}</span> ${step.id}</span>
                        <span style="color: var(--text-muted); font-size: 0.8rem; font-family: monospace;">${step.time}</span>
                    </div>`;
        }).join('');

        const isExpanded = phaseIsActive || (phaseIndex === 0 && currentGlobalStatusIndex === 0);
        tContainer.innerHTML += `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid ${isExpanded ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; border-radius: 8px; padding: 20px; transition: all 0.3s; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${isExpanded ? '20px' : '0'};">
                    <h4 style="margin: 0; font-size: 1.1rem; color: ${isExpanded ? '#fff' : 'var(--text-muted)'};">${phase.name}</h4>
                </div>
                <div style="display: ${isExpanded ? 'block' : 'none'};">${stepsHtml}</div>
            </div>`;
    });

    // Run the Omni-Scraper for Pre-Quote Survey data
    renderDynamicGenesisData(inputs);
    
    // Auto-Collapse Genesis after Phase 1
    if (activePhaseIndex === 0) {
        document.getElementById('genesis-content').classList.add('expanded');
        document.getElementById('genesis-icon').parentElement.classList.add('expanded');
    }

    // Architect PDF Scraper Logic (Hide if Empty falls back)
    const renderSpec = (label, val, hide = false, fallback = null) => {
        if (!val || val === "No" || val === "0" || val === "") return hide ? "" : fallback ? `<div class="spec-row"><span class="spec-label">${label}</span> <span class="spec-value" style="color:var(--text-muted); font-style:italic;">${fallback}</span></div>` : "";
        return `<div class="spec-row"><span class="spec-label">${label}</span> <span class="spec-value">${val}</span></div>`;
    };
    
    document.getElementById('vault-specs-container').innerHTML = `
        ${renderSpec("Roofing System", inputs.roofType)}
        ${renderSpec("Frame Matrix", inputs.frameColour)}
        ${renderSpec("Electrics", inputs.electrics, false, "No electrical work included.")}
        ${renderSpec("Plumbing", inputs.plumbing, false, "No plumbing work included.")}
        ${renderSpec("Building Regs", inputs.buildingRegs, true)}
        ${renderSpec("Breakthrough", inputs.breakthrough, true)}
    `;

    initDocumentCenter(window.activeVaultSurveyId);
}

// --- CLOUDINARY DOCUMENT CENTER ---
function initDocumentCenter(surveyId) {
    onSnapshot(query(collection(db, `surveys/${surveyId}/documents`), orderBy('uploadedAt', 'desc')), (snapshot) => {
        const container = document.getElementById('vault-docs-container');
        const galContainer = document.getElementById('vault-gallery-container');
        
        container.innerHTML = snapshot.empty ? '<p style="color:var(--text-muted); font-size:0.85rem;">Pending document upload.</p>' : '';
        galContainer.innerHTML = ''; let hasImages = false;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if(data.name.match(/\.(jpeg|jpg|gif|png)$/i)) {
                hasImages = true; galContainer.innerHTML += `<img src="${data.url}" class="gallery-img" onclick="window.open('${data.url}')">`;
            } else {
                container.innerHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--border-subtle);">
                        <div><p style="margin: 0; font-weight: bold; font-size:0.9rem;">${data.name}</p></div>
                        <button onclick="window.open('${data.url}', '_blank')" class="btn-quick btn-quick-primary" style="flex:none; padding:6px 12px;">View</button>
                    </div>`;
            }
        });
        if(!hasImages) galContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; grid-column:1/-1;">Uploaded Concept Renders will appear here.</p>';
    });
}
