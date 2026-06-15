import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, doc, updateDoc, query, where, onSnapshot, addDoc, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// NEW: Import Firebase Storage for Document Center
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine",
    storageBucket: "cohi-survey-engine.firebasestorage.app",
    messagingSenderId: "208212115382",
    appId: "1:208212115382:web:db7d4276b194f89a274b17"
};
const app = initializeApp(appConfig);
const db = getFirestore(app);
const storage = getStorage(app); // Initialize Storage

const views = {
    login: document.getElementById('view-login'),
    customer: document.getElementById('view-customer'),
    designer: document.getElementById('view-designer'),
    admin: document.getElementById('view-admin'),
    nav: document.getElementById('global-nav')
};

window.currentActiveRole = null; 

// Dynamic Branding Map
const brandLogos = {
    'Yorkshire Windows': '../yorkshire.png',
    'CO Home Improvements': '../co-logo.png',
    'Clearview': '../clearview.png'
};

function switchView(targetView, roleLabel = "") {
    Object.values(views).forEach(v => v.classList.add('hidden-view'));
    views[targetView].classList.remove('hidden-view');
    
    if (targetView === 'admin' || targetView === 'designer') {
        views.nav.classList.remove('hidden-view');
        document.getElementById('nav-role-badge').innerText = roleLabel;
        document.getElementById('brand-selector').classList.toggle('hidden-view', targetView !== 'admin');
        document.getElementById('header-brand-logo').classList.add('hidden-view');
        document.getElementById('header-default-title').classList.remove('hidden-view');
    }
}

// === AUTHENTICATION ===
document.getElementById('btn-login').addEventListener('click', async () => {
    const id = document.getElementById('loginId').value.trim().toLowerCase();
    const pin = document.getElementById('loginPin').value.trim();
    const err = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');
    
    err.classList.add('hidden-view');
    btn.innerText = "Authenticating..."; btn.disabled = true;

    if (id === 'admin' && pin === 'master123') {
        window.currentActiveRole = 'admin';
        switchView('admin', 'GLOBAL ADMIN');
        initAdminDashboard();
        btn.innerText = "Access Vault"; btn.disabled = false; return;
    }

    if (id === 'designer' && pin === 'survey123') {
        window.currentActiveRole = 'designer';
        switchView('designer', 'DESIGNER PORTAL');
        initDesignerDashboard('Tom'); 
        btn.innerText = "Access Vault"; btn.disabled = false; return;
    }

    try {
        const q = query(collection(db, "surveys"), where("data.inputs.postCode", "==", id.toUpperCase()), where("data.inputs.clientNum", "==", pin));
        const snap = await getDocs(q);
        if (!snap.empty) {
            window.currentActiveRole = 'customer';
            document.getElementById('btn-return-designer').classList.add('hidden-view');
            document.getElementById('designer-upload-panel').classList.add('hidden-view'); // Hide upload from customer
            switchView('customer');
            initCustomerVault(snap.docs[0]); 
        } else {
            err.innerText = "Credentials not recognized."; err.classList.remove('hidden-view');
        }
    } catch (error) {
        console.error("Auth Error:", error);
        err.innerText = "Network secure connection failed."; err.classList.remove('hidden-view');
    }
    btn.innerText = "Access Vault"; btn.disabled = false;
});

document.getElementById('btn-logout').addEventListener('click', () => {
    document.getElementById('loginId').value = ''; document.getElementById('loginPin').value = '';
    window.currentActiveRole = null;
    if(window.activeDesignerChatUnsubscribe) window.activeDesignerChatUnsubscribe();
    if(window.activeVaultChatUnsubscribe) window.activeVaultChatUnsubscribe();
    if(window.activeDocsUnsubscribe) window.activeDocsUnsubscribe();
    switchView('login');
});

// === PIPELINE ENGINE ===
window.activeDesignerStageFilter = 'ALL';

window.setDesignerFilter = function(stage, btnElement) {
    window.activeDesignerStageFilter = stage;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    initDesignerDashboard('Tom');
}

window.updateLeadStatus = async (docId, newStatus) => {
    try {
        await updateDoc(doc(db, "surveys", docId), { "data.inputs._pipelineStatus": newStatus, "data.inputs._lastContacted": Date.now() });
        if(window.currentActiveRole === 'designer') initDesignerDashboard('Tom'); else initAdminDashboard();
    } catch (error) { console.error("Status sync failed", error); }
};

window.openVaultPreview = async function(surveyId) {
    try {
        const docSnap = await getDoc(doc(db, "surveys", surveyId));
        if (docSnap.exists()) {
            switchView('customer');
            const returnBtn = document.getElementById('btn-return-designer');
            returnBtn.classList.remove('hidden-view');
            returnBtn.style.display = 'inline-flex';
            document.getElementById('designer-upload-panel').classList.remove('hidden-view'); // Show upload for designer
            initCustomerVault(docSnap);
        }
    } catch (error) { console.error("Preview error:", error); }
};

document.getElementById('btn-return-designer').addEventListener('click', () => {
    if(window.activeVaultChatUnsubscribe) { window.activeVaultChatUnsubscribe(); window.activeVaultChatUnsubscribe = null; }
    if(window.activeDocsUnsubscribe) { window.activeDocsUnsubscribe(); window.activeDocsUnsubscribe = null; }
    switchView('designer', 'DESIGNER PORTAL');
    initDesignerDashboard('Tom');
});

async function fetchAndRenderPipeline(targetContainerId, designerFilter = null, brandFilter = "ALL") {
    const container = document.getElementById(targetContainerId);
    container.innerHTML = `<div style="text-align: center; padding: 40px; color: #888; grid-column: 1 / -1;"><div style="width: 30px; height: 30px; border: 3px solid #333; border-top-color: #0dcaf0; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>Syncing data matrix...</div>`;

    let countActive = 0, countStalled = 0, countCritical = 0;

    try {
        const snap = await getDocs(collection(db, "surveys"));
        container.innerHTML = ''; let foundRecords = false;
        
        snap.forEach(docSnap => {
            const data = docSnap.data(); const inputs = data.data?.inputs || {};
            const clientName = data.clientName || 'Unnamed Client';
            const postCode = inputs.postCode || 'No Postcode';
            const assignedDesigner = inputs._designerName || 'Tom'; 
            const pipelineStatus = inputs._pipelineStatus || 'Pre-Quote';
            const projectBrand = inputs._brand || 'CO Home Improvements';
            const hasUnread = inputs._unreadByDesigner === true;
            
            if (designerFilter && assignedDesigner !== designerFilter) return;
            if (brandFilter !== "ALL" && projectBrand !== brandFilter) return;
            if (designerFilter && window.activeDesignerStageFilter !== 'ALL' && pipelineStatus !== window.activeDesignerStageFilter) return;

            foundRecords = true;
            const lastContacted = inputs._lastContacted || (data.updatedAt ? data.updatedAt.toMillis() : Date.now());
            const daysSinceContact = (Date.now() - lastContacted) / (1000 * 60 * 60 * 24);
            
            let ragClass = 'bg-green', ragText = 'Active';
            if (daysSinceContact > 7) { ragClass = 'bg-red'; ragText = 'Critical Action Required'; countCritical++; }
            else if (daysSinceContact > 3) { ragClass = 'bg-amber'; ragText = 'Pending Follow-up'; countStalled++; }
            else { countActive++; }

            const unreadBadge = hasUnread ? `<span class="notification-pulse" style="position: absolute; top: -8px; right: -8px; background: #dc3545; color: #fff; font-size: 0.7rem; font-weight: bold; padding: 4px 10px; border-radius: 12px; z-index: 10;">New Message</span>` : '';

            const statusOptions = ['Pre-Quote', 'Quoted', 'Follow-Up', 'Surveyed', 'Sold', 'Dead Lead'];
            let statusSelectHtml = `<select onchange="window.updateLeadStatus('${docSnap.id}', this.value)" class="glass-input" style="padding: 6px 8px; font-size: 0.8rem; border-color: #444; width: 100%; margin-top: 5px; color: #0dcaf0; font-weight: bold;">`;
            statusOptions.forEach(opt => { statusSelectHtml += `<option style="color:#000;" value="${opt}" ${pipelineStatus === opt ? 'selected' : ''}>${opt}</option>`; });
            statusSelectHtml += `</select>`;

            let actionArea = designerFilter ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
                    <label style="font-size: 0.75rem; color: #888; text-transform: uppercase;">Pipeline Stage:</label>
                    ${statusSelectHtml}
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button onclick="openDesignerChat('${docSnap.id}', '${clientName}')" style="flex: 1; padding: 10px; background: rgba(13, 202, 240, 0.1); color: #0dcaf0; border: 1px solid rgba(13, 202, 240, 0.3); border-radius: 6px; font-weight: bold;">Chat</button>
                        <button onclick="window.openVaultPreview('${docSnap.id}')" style="flex: 1; padding: 10px; background: #333; color: #fff; border: none; border-radius: 6px; font-weight: bold;">View Vault</button>
                    </div>
                </div>` : '';

            container.innerHTML += `
                <div class="rag-card">
                    ${unreadBadge} <div class="rag-indicator ${ragClass}"></div>
                    <div style="padding-left: 10px;">
                        <h3 style="margin: 0; font-size: 1.1rem; color: #fff;">${clientName}</h3>
                        <p style="margin: 4px 0 0 0; color: #888; font-size: 0.8rem;">${postCode} | ${projectBrand}</p>
                    </div>
                    <div style="padding-left: 10px; margin-top: 15px; flex-grow: 1;">
                        <p style="margin: 0; color: #aaa; font-size: 0.85rem;">Designer: <span style="color: #fff;">${assignedDesigner}</span></p>
                        <p style="margin: 5px 0 0 0; color: #aaa; font-size: 0.85rem;">Stage: <span style="color: #fff; font-weight: bold;">${pipelineStatus}</span></p>
                    </div>
                    ${actionArea}
                </div>`;
        });
        
        if (targetContainerId === 'admin-rag-container') {
            document.getElementById('v3-stat-active').innerText = countActive;
            document.getElementById('v3-stat-stalled').innerText = countStalled;
            document.getElementById('v3-stat-critical').innerText = countCritical;
        }

        if(!foundRecords) container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px; background: #15202b; border-radius: 12px; border: 1px dashed #333;">No records match filters.</div>';

    } catch (error) { console.error("Dashboard error:", error); container.innerHTML = '<p style="color: #ff4444; text-align: center;">Secure connection interrupted.</p>'; }
}

window.initAdminDashboard = function() { fetchAndRenderPipeline('admin-rag-container', null, document.getElementById('brand-selector').value); }
window.initDesignerDashboard = function(designerName) { fetchAndRenderPipeline('designer-pipeline-container', designerName, "ALL"); }
document.getElementById('brand-selector').addEventListener('change', window.initAdminDashboard);


// === CUSTOMER VAULT LOGIC (BRANDING, SPECS, DOCS, CHAT) ===
window.activeDocsUnsubscribe = null;

window.initCustomerVault = function(docSnap) {
    const data = docSnap.data();
    const inputs = data.data?.inputs || {};
    window.activeVaultSurveyId = docSnap.id; 
    
    // 1. Apply Dynamic Branding
    const brand = inputs._brand || 'CO Home Improvements';
    const logoSrc = brandLogos[brand];
    
    if (logoSrc) {
        views.nav.classList.remove('hidden-view');
        document.getElementById('header-default-title').classList.add('hidden-view');
        const headerLogo = document.getElementById('header-brand-logo');
        headerLogo.src = logoSrc; headerLogo.classList.remove('hidden-view');
        
        const vaultLogo = document.getElementById('vault-brand-logo');
        vaultLogo.src = logoSrc; vaultLogo.classList.remove('hidden-view');
    }

    document.getElementById('vault-client-name').innerText = data.clientName || "Valued Client";
    document.getElementById('vault-designer-name').innerText = inputs._designerName || "Tom";

    // 2. Expanded Architectural Specs from V2 Form Data
    document.getElementById('vault-specs-container').innerHTML = `
        <div class="spec-row"><span style="color: #888;">Build Directive:</span> <strong style="color: #fff;">${inputs.buildType || "TBC"}</strong></div>
        <div class="spec-row"><span style="color: #888;">Dimensions:</span> <strong style="color: #fff;">${inputs.proposedSize || "Subject to final measure"}</strong></div>
        <div class="spec-row"><span style="color: #888;">Roofing Sys:</span> <strong style="color: #fff;">${inputs.roofType || "TBC"}</strong></div>
        <div class="spec-row"><span style="color: #888;">Finish Matrix:</span> <strong style="color: #fff;">${inputs.frameColour || "TBC"}</strong></div>
        <div class="spec-row"><span style="color: #888;">House Material:</span> <strong style="color: #fff;">${inputs.houseMaterial || "N/A"}</strong></div>
        <div class="spec-row"><span style="color: #888;">DPC Depth:</span> <strong style="color: #fff;">${inputs.dpcDepth ? inputs.dpcDepth + 'mm' : "N/A"}</strong></div>
        <div class="spec-row"><span style="color: #888;">Access Info:</span> <strong style="color: #fff;">${inputs.accessDifficult === 'Yes' ? 'Restricted (' + inputs.accessWidth + 'mm)' : "Clear"}</strong></div>
        
        <div style="background: rgba(13, 202, 240, 0.05); padding: 15px; border-radius: 8px; border-left: 3px solid #0dcaf0; margin-top: 15px;">
            <p style="margin: 0; font-size: 0.75rem; color: #0dcaf0; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; letter-spacing: 0.5px;">Design Notes</p>
            <p style="margin: 0; font-style: italic; color: #ddd; font-size: 0.95rem;">"${inputs.customerNotes || "Design notes are currently being formalized."}"</p>
        </div>
    `;

    initVaultChat(window.activeVaultSurveyId);
    initDocumentCenter(window.activeVaultSurveyId);
}

// --- DOCUMENT CENTER UPLOAD LOGIC ---
function initDocumentCenter(surveyId) {
    const docsContainer = document.getElementById('vault-docs-container');
    if(window.activeDocsUnsubscribe) window.activeDocsUnsubscribe();
    
    const q = query(collection(db, `surveys/${surveyId}/documents`), orderBy('uploadedAt', 'desc'));
    
    window.activeDocsUnsubscribe = onSnapshot(q, (snapshot) => {
        docsContainer.innerHTML = '';
        if(snapshot.empty) { docsContainer.innerHTML = '<p style="color: #666; font-size: 0.85rem; text-align: center; margin-top: 20px;">No documents uploaded yet.</p>'; return; }
        
        snapshot.forEach(docSnap => {
            const docData = docSnap.data();
            docsContainer.innerHTML += `
                <div class="doc-card">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0dcaf0" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        <div>
                            <p style="margin: 0; font-size: 0.95rem; font-weight: bold; color: #fff;">${docData.name}</p>
                            <p style="margin: 2px 0 0 0; font-size: 0.7rem; color: #888;">${formatTime(docData.uploadedAt)}</p>
                        </div>
                    </div>
                    <button onclick="window.open('${docData.url}', '_blank')" style="background: transparent; border: 1px solid #0dcaf0; color: #0dcaf0; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">View</button>
                </div>
            `;
        });
    });
}

document.getElementById('btn-upload-doc').addEventListener('click', async () => {
    const fileInput = document.getElementById('doc-upload-input');
    const statusText = document.getElementById('upload-status');
    const file = fileInput.files[0];
    
    if(!file || !window.activeVaultSurveyId) { statusText.innerText = "Please select a file first."; return; }
    
    statusText.innerText = "Uploading to secure vault...";
    statusText.style.color = "#ffc107";
    
    const storageRef = ref(storage, `vaults/${window.activeVaultSurveyId}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
        null, 
        (error) => { console.error("Upload error:", error); statusText.innerText = "Upload failed."; statusText.style.color = "#ff4444"; }, 
        async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/documents`), {
                name: file.name,
                url: downloadURL,
                uploadedAt: serverTimestamp(),
                uploadedBy: 'Designer'
            });
            statusText.innerText = "Upload successful!";
            statusText.style.color = "#28a745";
            fileInput.value = ''; // clear input
            setTimeout(() => { statusText.innerText = ''; }, 3000);
        }
    );
});


// --- CHAT LOGIC ---
function formatTime(timestamp) { if(!timestamp) return 'Just now'; return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

function initVaultChat(surveyId) {
    const chatWindow = document.getElementById('chat-window');
    if(window.activeVaultChatUnsubscribe) window.activeVaultChatUnsubscribe();
    const q = query(collection(db, `surveys/${surveyId}/messages`), orderBy('timestamp', 'asc'));
    
    window.activeVaultChatUnsubscribe = onSnapshot(q, (snapshot) => {
        chatWindow.innerHTML = '';
        if(snapshot.empty) { chatWindow.innerHTML = '<p style="text-align: center; color: #555; font-size: 0.85rem; margin: auto;">Connection secure. Send a message to your designer.</p>'; return; }
        
        snapshot.forEach(doc => {
            const msg = doc.data(); const isCustomer = msg.sender === 'Customer';
            const bubbleClass = isCustomer ? 'chat-bubble-user' : 'chat-bubble-them';
            chatWindow.innerHTML += `<div class="chat-bubble ${bubbleClass}">${msg.text}<div class="chat-meta">${formatTime(msg.timestamp)}</div></div>`;
        });
        chatWindow.scrollTop = chatWindow.scrollHeight; 
    });
}

document.getElementById('btn-send-chat').addEventListener('click', async () => {
    const input = document.getElementById('chat-input'); const text = input.value.trim();
    if(!text || !window.activeVaultSurveyId) return;
    input.value = ''; 
    await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/messages`), { sender: 'Customer', text: text, timestamp: serverTimestamp() });
    await updateDoc(doc(db, "surveys", window.activeVaultSurveyId), { "data.inputs._unreadByDesigner": true });
});
document.getElementById('chat-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') document.getElementById('btn-send-chat').click(); });

window.openDesignerChat = async function(surveyId, clientName) {
    window.activeDesignerSurveyId = surveyId;
    document.getElementById('designer-chat-title').innerText = clientName;
    document.getElementById('designer-chat-modal').classList.remove('hidden-view');
    await updateDoc(doc(db, "surveys", surveyId), { "data.inputs._unreadByDesigner": false });
    initDesignerDashboard('Tom'); 
    
    const chatWindow = document.getElementById('designer-chat-window');
    const q = query(collection(db, `surveys/${surveyId}/messages`), orderBy('timestamp', 'asc'));
    if (window.activeDesignerChatUnsubscribe) window.activeDesignerChatUnsubscribe();
    
    window.activeDesignerChatUnsubscribe = onSnapshot(q, (snapshot) => {
        chatWindow.innerHTML = '';
        if(snapshot.empty) { chatWindow.innerHTML = '<p style="text-align: center; color: #555; font-size: 0.85rem; margin: auto;">No message history.</p>'; return; }
        snapshot.forEach(doc => {
            const msg = doc.data(); const isDesigner = msg.sender === 'Designer';
            const bubbleClass = isDesigner ? 'chat-bubble-user' : 'chat-bubble-them';
            chatWindow.innerHTML += `<div class="chat-bubble ${bubbleClass}">${msg.text}<div class="chat-meta">${formatTime(msg.timestamp)}</div></div>`;
        });
        chatWindow.scrollTop = chatWindow.scrollHeight; 
    });
}

document.getElementById('btn-close-designer-chat').addEventListener('click', () => {
    document.getElementById('designer-chat-modal').classList.add('hidden-view');
    if (window.activeDesignerChatUnsubscribe) { window.activeDesignerChatUnsubscribe(); window.activeDesignerChatUnsubscribe = null; }
});
document.getElementById('btn-designer-send-chat').addEventListener('click', async () => {
    const input = document.getElementById('designer-chat-input'); const text = input.value.trim();
    if(!text || !window.activeDesignerSurveyId) return;
    input.value = ''; 
    await addDoc(collection(db, `surveys/${window.activeDesignerSurveyId}/messages`), { sender: 'Designer', text: text, timestamp: serverTimestamp() });
});
document.getElementById('designer-chat-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') document.getElementById('btn-designer-send-chat').click(); });
