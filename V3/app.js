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

// --- 13-STEP ROADMAP CONFIG ---
const projectPhases = [
    { category: "Sales & Planning", steps: ["1. Consultation & Survey", "2. Design & Proposal", "3. Order Placed"] },
    { category: "Pre-Commencement", steps: ["4. Awaiting Survey Appt", "5. Awaiting Planning", "6. Awaiting Survey Report", "7. Awaiting Test Dig", "8. Awaiting Building Regs", "9. Awaiting Customer Sign-Off"] },
    { category: "Build & Finish", steps: ["10. Procurement", "11. Commencement of Building Works", "12. Installation Commences", "13. Finishing Trades & Completion"] }
];
const journeySteps = projectPhases.flatMap(p => p.steps);

function switchView(targetView, roleLabel = "") {
    Object.values(views).forEach(v => v.classList.add('hidden-view'));
    views[targetView].classList.remove('hidden-view');
    if (targetView === 'designer') { views.nav.classList.remove('hidden-view'); document.getElementById('nav-role-badge').innerText = roleLabel; }
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
    } catch (error) { console.error(error); }
    btn.innerText = "Authenticate";
});
document.getElementById('btn-logout').addEventListener('click', () => { window.location.reload(); });

// === DESIGNER DASHBOARD LOGIC ===
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
            const status = inputs._pipelineStatus || '1. Consultation & Survey';
            const lastContacted = inputs._lastContacted || Date.now();
            
            let currentCategory = "Sales & Planning";
            projectPhases.forEach(p => { if(p.steps.includes(status)) currentCategory = p.category; });
            if (window.activeDesignerStageFilter !== 'ALL' && currentCategory !== window.activeDesignerStageFilter) return;

            const daysSinceContact = (Date.now() - lastContacted) / (1000 * 60 * 60 * 24);
            let ragStatus = 'status-active'; let heatText = 'Pulse: Active';
            if (daysSinceContact > 7) { ragStatus = 'status-critical'; heatText = 'Action Required'; }
            else if (daysSinceContact > 3) { ragStatus = 'status-stalled'; heatText = 'Stalled'; }
            
            container.innerHTML += `
                <div class="glass-panel" style="padding: 25px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.3rem; color: #fff;">${data.clientName || 'Unnamed Project'}</h3>
                            <p style="margin: 5px 0 0 0; color: var(--text-muted); font-size: 0.85rem;">${inputs.postCode || 'N/A'}</p>
                        </div>
                        <div style="background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; display: flex; align-items: center; gap: 8px;">
                            <span class="rag-dot ${ragStatus}"></span> ${heatText}
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 25px;">
                        <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Current Phase</p>
                        <p style="margin: 4px 0 0 0; color: var(--accent-cyan); font-weight: 600; font-size: 1rem;">${status}</p>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="openVaultPreview('${docSnap.id}')" style="flex:1; padding:10px; background:var(--accent-cyan); color:#000; border-radius:8px; font-weight:bold;">View Vault</button>
                        <button onclick="triggerQuickUpload('${docSnap.id}')" style="flex:1; padding:10px; background:rgba(255,255,255,0.05); color:#fff; border-radius:8px; font-weight:bold;">Attach PDF</button>
                        <button onclick="openActionModal('status', '${docSnap.id}', '${status}')" style="flex:none; padding:10px 15px; background:rgba(255,255,255,0.05); color:#fff; border-radius:8px;">⚙️</button>
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
document.getElementById('btn-return-designer').addEventListener('click', () => { switchView('designer', 'DESIGNER HUB'); initDesignerDashboard(); });

window.openActionModal = function(type, surveyId, currentStatus = "") {
    window.activeActionSurveyId = surveyId;
    if (type === 'status') {
        document.getElementById('input-status-select').innerHTML = journeySteps.concat(['Stalled', 'Dead Lead']).map(s => `<option value="${s}" ${s===currentStatus?'selected':''}>${s}</option>`).join('');
        document.getElementById('modal-status').classList.remove('hidden-view');
    }
}
document.getElementById('btn-save-status').addEventListener('click', async () => {
    const newStatus = document.getElementById('input-status-select').value;
    await updateDoc(doc(db, "surveys", window.activeActionSurveyId), { "data.inputs._pipelineStatus": newStatus, "data.inputs._lastContacted": Date.now() });
    document.getElementById('modal-status').classList.add('hidden-view'); initDesignerDashboard();
});

// Quick PDF Sync Button Logic (Uploads to Cloudinary, auto-displays in Vault)
window.triggerQuickUpload = function(surveyId) {
    window.activeVaultSurveyId = surveyId; 
    document.getElementById('designer-quick-upload-input').click();
};
document.getElementById('designer-quick-upload-input').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if(!file) return;
    
    // Quick validation to ensure it's a PDF for the viewer
    if (file.type !== 'application/pdf') { alert("Please select a PDF document for the Master Blueprint."); return; }
    
    alert("Uploading Blueprint...");
    const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) {
            await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/documents`), { name: file.name, url: data.secure_url, type: 'pdf', uploadedAt: serverTimestamp() });
            alert("Success! PDF mounted in client vault.");
        }
    } catch (err) { alert("Upload Failed. Check Cloudinary settings."); }
});


// === LUXURY CUSTOMER VAULT LOGIC ===
window.initCustomerVault = function(docSnap) {
    const data = docSnap.data(); const inputs = data.data?.inputs || {};
    window.activeVaultSurveyId = docSnap.id; 
    const currentStatus = inputs._pipelineStatus || "1. Consultation & Survey";
    
    document.getElementById('vault-client-name').innerText = data.clientName || "Valued Client";

    // 13-Step Vertical Timeline with Glow Effects
    const tContainer = document.getElementById('vault-timeline-container');
    tContainer.innerHTML = '';
    
    let globalIndex = 0; let currentIndex = 0;
    journeySteps.forEach((step, idx) => { if(step === currentStatus) currentIndex = idx; });

    journeySteps.forEach((step, idx) => {
        let stateClass = ''; let icon = ''; let textColor = 'var(--text-muted)';
        
        if (idx < currentIndex) { stateClass = 'step-done'; icon = '✓'; }
        else if (idx === currentIndex) { stateClass = 'step-active'; icon = '●'; textColor = '#fff'; }
        else { icon = '○'; }

        tContainer.innerHTML += `
            <div class="timeline-step ${stateClass}">
                <div class="timeline-track"></div>
                <div class="timeline-node" style="font-size: 0.8rem; font-weight: bold;">${icon}</div>
                <div style="padding-top: 5px;">
                    <p style="margin: 0; color: ${textColor}; font-weight: ${idx === currentIndex ? '600' : '400'}; font-size: 1.05rem;">${step}</p>
                </div>
            </div>`;
    });

    // Auto-Mount PDF Logic
    initDocumentCenter(window.activeVaultSurveyId);
    initVaultChat(window.activeVaultSurveyId);
}

// --- SMART PDF MOUNTER ---
function initDocumentCenter(surveyId) {
    onSnapshot(query(collection(db, `surveys/${surveyId}/documents`), orderBy('uploadedAt', 'desc')), (snapshot) => {
        const viewer = document.getElementById('vault-pdf-viewer');
        const placeholder = document.getElementById('pdf-placeholder');
        
        // Find the first PDF document uploaded
        let latestPdfUrl = null;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!latestPdfUrl && (data.type === 'pdf' || data.name.toLowerCase().endsWith('.pdf'))) {
                latestPdfUrl = data.url;
            }
        });

        // Mount the PDF into the Cinematic Frame
        if (latestPdfUrl) {
            // Append #toolbar=0 to disable downloading/printing on standard browsers if desired
            viewer.src = latestPdfUrl + "#view=FitH&toolbar=0"; 
            viewer.classList.remove('hidden-view');
            placeholder.classList.add('hidden-view');
        } else {
            viewer.classList.add('hidden-view');
            placeholder.classList.remove('hidden-view');
        }
    });
}

// --- CONCIERGE CHAT ---
function initVaultChat(surveyId) {
    const chatWindow = document.getElementById('chat-window');
    onSnapshot(query(collection(db, `surveys/${surveyId}/messages`), orderBy('timestamp', 'asc')), (snapshot) => {
        chatWindow.innerHTML = snapshot.empty ? '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; margin-top:20px;">Connection encrypted and secure.</p>' : '';
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
