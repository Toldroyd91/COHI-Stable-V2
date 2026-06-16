import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, doc, updateDoc, query, where, onSnapshot, addDoc, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine"
};
const app = initializeApp(appConfig);
const db = getFirestore(app);

// PRODUCTION CLOUDINARY CONFIG 
const cloudinaryConfig = { 
    cloudName: "dqk1hz0f8", 
    uploadPreset: "crm_document_uploads" 
};

const views = { login: document.getElementById('view-login'), customer: document.getElementById('view-customer'), designer: document.getElementById('view-designer'), nav: document.getElementById('global-nav') };

// --- RESTORED 13-STEP ROADMAP ---
const projectPhases = [
    { 
        category: "Sales & Planning", 
        name: "Sales & Planning", 
        totalTime: "2-4 Weeks",
        steps: [
            { id: "1. Consultation & Survey", time: "1 wk" },
            { id: "2. Design & Proposal", time: "1-2 wks" },
            { id: "3. Order Placed", time: "Immediate" }
        ]
    },
    { 
        category: "Pre-Commencement", 
        name: "Planning & Survey", 
        totalTime: "10-18 Weeks",
        steps: [
            { id: "4. Survey Appointment", time: "2 wks" },
            { id: "5. Planning Permission", time: "8-16 wks" },
            { id: "6. Survey Report", time: "1 wk" },
            { id: "7. Test Dig Conducted", time: "1 wk" },
            { id: "8. Building Regulations", time: "1 wk" },
            { id: "9. Customer Sign-Off", time: "1 wk" }
        ]
    },
    { 
        category: "Build & Finish", 
        name: "Execution", 
        totalTime: "5-8 Weeks",
        steps: [
            { id: "10. Procurement", time: "2 wks" },
            { id: "11. Commencement of Building Works", time: "1-2 wks" },
            { id: "12. Installation Commences", time: "1 wk" },
            { id: "13. Finishing Trades & Completion", time: "2-4 wks" }
        ]
    }
];
const journeySteps = projectPhases.flatMap(p => p.steps.map(s => s.id));

function switchView(targetView, roleLabel = "") {
    Object.values(views).forEach(v => v.classList.add('hidden-view'));
    views[targetView].classList.remove('hidden-view');
    if (targetView === 'designer') { views.nav.classList.remove('hidden-view'); document.getElementById('nav-role-badge').innerText = roleLabel; }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = type === 'success' ? 'var(--accent-cyan)' : '#ef4444';
    toast.innerHTML = `<strong>${type === 'success' ? 'Success' : 'Error'}</strong><br><span style="font-size:0.85rem; color:#aaa;">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// === AUTHENTICATION ===
document.getElementById('btn-login').addEventListener('click', async () => {
    const id = document.getElementById('loginId').value.trim().toUpperCase();
    const pin = document.getElementById('loginPin').value.trim();
    const btn = document.getElementById('btn-login');
    btn.innerText = "Authenticating...";
    
    if (id === 'ADMIN' && pin === 'master123') { switchView('designer', 'GLOBAL ADMIN'); initDesignerDashboard(); btn.innerText="Authenticate"; return; }
    if (id === 'DESIGNER' && pin === 'survey123') { window.currentActiveRole='designer'; switchView('designer', 'DESIGNER HUB'); initDesignerDashboard(); btn.innerText="Authenticate"; return; }

    try {
        const q = query(collection(db, "surveys"), where("data.inputs.postCode", "==", id), where("data.inputs.clientNum", "==", pin));
        const snap = await getDocs(q);
        if (!snap.empty) {
            document.getElementById('btn-return-designer').classList.add('hidden-view');
            switchView('customer'); initCustomerVault(snap.docs[0]);
        } else {
            document.getElementById('login-error').innerText = "Credentials not recognized."; document.getElementById('login-error').classList.remove('hidden-view');
        }
    } catch (error) { console.error(error); showToast("Network error. Please try again.", "error"); }
    btn.innerText = "Authenticate";
});
document.getElementById('btn-logout').addEventListener('click', () => { window.location.reload(); });

// === DESIGNER DASHBOARD ===
window.activeDesignerStageFilter = 'ALL';
window.setDesignerFilter = function(stage, btnElement) {
    window.activeDesignerStageFilter = stage;
    Array.from(btnElement.parentElement.children).forEach(btn => { btn.style.background = 'transparent'; btn.style.color = 'var(--text-muted)'; });
    btnElement.style.background = 'rgba(255,255,255,0.1)'; btnElement.style.color = '#fff';
    initDesignerDashboard();
}

window.activeActionSurveyId = null;

async function fetchAndRenderPipeline() {
    const container = document.getElementById('designer-pipeline-container');
    container.innerHTML = '<p style="color:var(--text-muted);">Syncing secure environment...</p>';
    try {
        const snap = await getDocs(collection(db, "surveys"));
        container.innerHTML = ''; 
        
        snap.forEach(docSnap => {
            const data = docSnap.data(); const inputs = data.data?.inputs || {};
            // RESTORED DEFAULT STATUS
            const status = inputs._pipelineStatus || '1. Consultation & Survey';
            const lastContacted = inputs._lastContacted || Date.now();
            
            let currentCategory = "Sales & Planning";
            projectPhases.forEach(p => { if(p.steps.map(s=>s.id).includes(status)) currentCategory = p.category; });
            if (window.activeDesignerStageFilter !== 'ALL' && currentCategory !== window.activeDesignerStageFilter) return;

            const daysSinceContact = (Date.now() - lastContacted) / (1000 * 60 * 60 * 24);
            let ragStatus = 'status-active'; let heatText = 'Pulse: Active';
            if (daysSinceContact > 7) { ragStatus = 'status-critical'; heatText = 'Action Required'; }
            else if (daysSinceContact > 3) { ragStatus = 'status-stalled'; heatText = 'Stalled'; }
            
            container.innerHTML += `
                <div class="glass-panel" style="padding: 25px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.25rem; color: #fff;">${data.clientName || 'Unnamed Project'}</h3>
                            <p style="margin: 5px 0 0 0; color: var(--text-muted); font-size: 0.85rem;">${inputs.postCode || 'N/A'}</p>
                        </div>
                        <div style="background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; display: flex; align-items: center; gap: 6px;">
                            <span class="rag-dot ${ragStatus}"></span> ${heatText}
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Current Phase</p>
                        <p style="margin: 4px 0 0 0; color: var(--accent-cyan); font-weight: 600; font-size: 0.95rem;">${status}</p>
                    </div>
                    
                    <div style="display: flex; gap: 8px; border-top: 1px solid var(--glass-border); padding-top: 15px;">
                        <button class="btn-quick btn-quick-primary" onclick="openVaultPreview('${docSnap.id}')">Vault</button>
                        <button class="btn-quick" onclick="openActionModal('notes', '${docSnap.id}')">Notes</button>
                        <button class="btn-quick" onclick="triggerQuickUpload('${docSnap.id}')">Sync PDF</button>
                        <button class="btn-quick" onclick="openActionModal('contact', '${docSnap.id}')">Log</button>
                        <button class="btn-quick" onclick="openActionModal('status', '${docSnap.id}', '${status}')">Status</button>
                    </div>
                </div>`;
        });
    } catch (error) { console.error(error); showToast("Failed to load pipeline.", "error"); }
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
document.getElementById('btn-return-designer').addEventListener('click', () => { 
    if(window.activeChatUnsubscribe) window.activeChatUnsubscribe();
    if(window.activeDocsUnsubscribe) window.activeDocsUnsubscribe();
    switchView('designer', 'DESIGNER HUB'); 
    initDesignerDashboard(); 
});

// === ACTION MODALS LOGIC ===
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
    await addDoc(collection(db, `surveys/${window.activeActionSurveyId}/internalNotes`), { content: `[Internal Note] ${val}`, timestamp: serverTimestamp() });
    document.getElementById('modal-notes').classList.add('hidden-view'); document.getElementById('input-note-text').value='';
    showToast("Internal note secured.");
});

document.getElementById('btn-save-contact').addEventListener('click', async () => {
    const type = document.getElementById('input-contact-type').value; const val = document.getElementById('input-contact-note').value;
    await addDoc(collection(db, `surveys/${window.activeActionSurveyId}/internalNotes`), { content: `[Contact: ${type}] ${val}`, timestamp: serverTimestamp() });
    await updateDoc(doc(db, "surveys", window.activeActionSurveyId), { "data.inputs._lastContacted": Date.now() });
    document.getElementById('modal-contact').classList.add('hidden-view'); document.getElementById('input-contact-note').value=''; 
    showToast(`Logged contact via ${type}.`);
    initDesignerDashboard();
});

document.getElementById('btn-save-status').addEventListener('click', async () => {
    const newStatus = document.getElementById('input-status-select').value;
    await updateDoc(doc(db, "surveys", window.activeActionSurveyId), { "data.inputs._pipelineStatus": newStatus, "data.inputs._lastContacted": Date.now() });
    document.getElementById('modal-status').classList.add('hidden-view'); 
    showToast(`Project advanced to: ${newStatus}`);
    initDesignerDashboard();
});

// Quick PDF Sync Button
window.triggerQuickUpload = function(surveyId) {
    window.activeVaultSurveyId = surveyId; 
    document.getElementById('designer-quick-upload-input').click();
};
document.getElementById('designer-quick-upload-input').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if(!file) return;
    if (file.type !== 'application/pdf') { showToast("Please select a PDF document.", "error"); return; }
    
    showToast("Syncing Blueprint to Cloudinary...");
    const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) {
            await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/documents`), { name: file.name, url: data.secure_url, type: 'pdf', uploadedAt: serverTimestamp() });
            showToast("Blueprint successfully mounted.");
        }
    } catch (err) { showToast("Upload Failed. Check connection.", "error"); }
});

// === CUSTOMER VAULT LOGIC ===
window.activeChatUnsubscribe = null;
window.activeDocsUnsubscribe = null;

window.initCustomerVault = function(docSnap) {
    const data = docSnap.data(); const inputs = data.data?.inputs || {};
    window.activeVaultSurveyId = docSnap.id; 
    const currentStatus = inputs._pipelineStatus || "1. Consultation & Survey";
    
    const brand = inputs._brand || 'CO Home Improvements';
    if(brand === 'Yorkshire Windows') { document.getElementById('vault-brand-logo').src = '../yorkshire.png'; document.getElementById('vault-brand-logo').classList.remove('hidden-view'); }
    else if (brand === 'Clearview') { document.getElementById('vault-brand-logo').src = '../clearview.png'; document.getElementById('vault-brand-logo').classList.remove('hidden-view'); }
    else { document.getElementById('vault-brand-logo').src = '../co-logo.png'; document.getElementById('vault-brand-logo').classList.remove('hidden-view'); }
    
    document.getElementById('vault-client-name').innerText = data.clientName || "Valued Client";

    // 13-Step Collapsible Phase Timeline
    const tContainer = document.getElementById('vault-timeline-container');
    tContainer.innerHTML = '';
    
    let globalStepIndex = 0; let currentGlobalStatusIndex = 0;
    projectPhases.forEach(phase => { phase.steps.forEach(step => { if(step.id === currentStatus) currentGlobalStatusIndex = globalStepIndex; globalStepIndex++; }); });
    globalStepIndex = 0;

    projectPhases.forEach((phase, phaseIndex) => {
        let phaseIsActive = false;
        const stepsHtml = phase.steps.map(step => {
            let style = 'color: var(--text-muted);'; let icon = '○';
            if (globalStepIndex < currentGlobalStatusIndex) { style = 'color: #fff; text-decoration: line-through; opacity: 0.4;'; icon = '✓'; }
            else if (globalStepIndex === currentGlobalStatusIndex) { style = 'color: var(--accent-cyan); font-weight: bold;'; icon = '●'; phaseIsActive = true; }
            globalStepIndex++;
            return `<div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-left: 15px; border-left: 2px solid ${style.includes('--accent-cyan') ? 'var(--accent-cyan)' : 'var(--glass-border)'}; margin-left: 10px;">
                        <span style="${style}"><span style="display:inline-block; width:22px;">${icon}</span> ${step.id}</span>
                        <span style="color: var(--text-muted); font-size: 0.75rem; font-family: monospace;">${step.time}</span>
                    </div>`;
        }).join('');

        const isExpanded = phaseIsActive || (phaseIndex === 0 && currentGlobalStatusIndex === 0);
        tContainer.innerHTML += `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid ${isExpanded ? 'var(--accent-cyan)' : 'var(--glass-border)'}; border-radius: 12px; padding: 20px; transition: all 0.3s; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${isExpanded ? '15px' : '0'};">
                    <h4 style="margin: 0; font-size: 1.05rem; color: ${isExpanded ? '#fff' : 'var(--text-muted)'};">${phase.name}</h4>
                    <span style="background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; color: var(--text-muted);">Est. ${phase.totalTime}</span>
                </div>
                <div style="display: ${isExpanded ? 'block' : 'none'};">${stepsHtml}</div>
            </div>`;
    });

    initDocumentCenter(window.activeVaultSurveyId);
    initVaultChat(window.activeVaultSurveyId);
}

// --- CINEMATIC PDF MOUNTER ---
function initDocumentCenter(surveyId) {
    if(window.activeDocsUnsubscribe) window.activeDocsUnsubscribe();
    window.activeDocsUnsubscribe = onSnapshot(query(collection(db, `surveys/${surveyId}/documents`), orderBy('uploadedAt', 'desc')), (snapshot) => {
        const viewer = document.getElementById('vault-pdf-viewer');
        const placeholder = document.getElementById('pdf-placeholder');
        
        let latestPdfUrl = null;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!latestPdfUrl && (data.type === 'pdf' || data.name.toLowerCase().endsWith('.pdf'))) {
                latestPdfUrl = data.url;
            }
        });

        if (latestPdfUrl) {
            viewer.src = latestPdfUrl + "#view=FitH&toolbar=0"; 
            viewer.classList.remove('hidden-view'); placeholder.classList.add('hidden-view');
        } else {
            viewer.classList.add('hidden-view'); placeholder.classList.remove('hidden-view');
        }
    });
}

// --- CONCIERGE CHAT ---
function initVaultChat(surveyId) {
    const chatWindow = document.getElementById('chat-window');
    if(window.activeChatUnsubscribe) window.activeChatUnsubscribe();
    
    window.activeChatUnsubscribe = onSnapshot(query(collection(db, `surveys/${surveyId}/messages`), orderBy('timestamp', 'asc')), (snapshot) => {
        chatWindow.innerHTML = snapshot.empty ? '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-top:20px;">Connection encrypted and secure.</p>' : '';
        snapshot.forEach(doc => {
            const msg = doc.data(); const isMe = msg.sender === (window.currentActiveRole==='designer'?'Designer':'Customer');
            chatWindow.innerHTML += `<div class="chat-bubble ${isMe ? 'chat-me' : 'chat-them'}">${msg.text}</div>`;
        });
        chatWindow.scrollTop = chatWindow.scrollHeight; 
    });
}

document.getElementById('btn-send-chat').addEventListener('click', async () => {
    const text = document.getElementById('chat-input').value.trim();
    if(!text) return; document.getElementById('chat-input').value = '';
    await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/messages`), { sender: window.currentActiveRole==='designer'?'Designer':'Customer', text: text, timestamp: serverTimestamp() });
});
