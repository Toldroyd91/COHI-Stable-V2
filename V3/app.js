import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, query, where, onSnapshot, addDoc, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// === 1. FIREBASE CONFIGURATION (LIVE) ===
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

// === 2. UI ROUTING ENGINE ===
const views = {
    login: document.getElementById('view-login'),
    customer: document.getElementById('view-customer'),
    designer: document.getElementById('view-designer'),
    admin: document.getElementById('view-admin'),
    nav: document.getElementById('global-nav')
};

function switchView(targetView, roleLabel = "") {
    Object.values(views).forEach(v => v.classList.add('hidden-view'));
    views[targetView].classList.remove('hidden-view');
    
    if (targetView === 'admin' || targetView === 'designer') {
        views.nav.classList.remove('hidden-view');
        document.getElementById('nav-role-badge').innerText = roleLabel;
        
        if(targetView === 'admin') {
            document.getElementById('brand-selector').classList.remove('hidden-view');
        } else {
            document.getElementById('brand-selector').classList.add('hidden-view');
        }
    }
}

// === 3. AUTHENTICATION LOGIC ===
document.getElementById('btn-login').addEventListener('click', async () => {
    const id = document.getElementById('loginId').value.trim().toLowerCase();
    const pin = document.getElementById('loginPin').value.trim();
    const err = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');
    
    err.classList.add('hidden-view');
    btn.innerText = "Authenticating...";
    btn.disabled = true;

    // --- Hardcoded Roles ---
    if (id === 'admin' && pin === 'master123') {
        switchView('admin', 'GLOBAL ADMIN');
        initAdminDashboard();
        btn.innerText = "Access Vault"; btn.disabled = false;
        return;
    }

    if (id === 'designer' && pin === 'survey123') {
        switchView('designer', 'DESIGNER PORTAL');
        initDesignerDashboard('Tom'); // Default test profile
        btn.innerText = "Access Vault"; btn.disabled = false;
        return;
    }

    // --- Customer Lookup ---
    try {
        const q = query(collection(db, "surveys"), 
            where("data.inputs.postCode", "==", id.toUpperCase()), 
            where("data.inputs.clientNum", "==", pin)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
            switchView('customer');
            initCustomerVault(snap.docs); 
        } else {
            err.innerText = "Credentials not recognized. Please check your Postcode and PIN.";
            err.classList.remove('hidden-view');
        }
    } catch (error) {
        console.error("Auth Error:", error);
        err.innerText = "Network secure connection failed.";
        err.classList.remove('hidden-view');
    }
    
    btn.innerText = "Access Vault"; btn.disabled = false;
});

document.getElementById('btn-logout').addEventListener('click', () => {
    document.getElementById('loginId').value = '';
    document.getElementById('loginPin').value = '';
    // Unsubscribe from any active listeners to prevent memory leaks
    if(window.activeDesignerChatUnsubscribe) window.activeDesignerChatUnsubscribe();
    if(window.activeVaultChatUnsubscribe) window.activeVaultChatUnsubscribe();
    switchView('login');
});

// === 4. CORE ENGINE: PIPELINE RENDERER ===

// Expose status update function globally so inline HTML buttons can trigger it
window.updateLeadStatus = async (docId, newStatus) => {
    try {
        const docRef = doc(db, "surveys", docId);
        await updateDoc(docRef, { "data.inputs._pipelineStatus": newStatus, "data.inputs._lastContacted": Date.now() });
        // Force refresh the dashboard
        if(document.getElementById('view-designer').classList.contains('hidden-view') === false) {
            initDesignerDashboard('Tom');
        } else {
            initAdminDashboard();
        }
    } catch (error) {
        console.error("Failed to update status", error);
        alert("Failed to sync status to cloud.");
    }
};

async function fetchAndRenderPipeline(targetContainerId, designerFilter = null, brandFilter = "ALL") {
    const container = document.getElementById(targetContainerId);
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #888; grid-column: 1 / -1;">
            <div style="width: 30px; height: 30px; border: 3px solid #333; border-top-color: #0dcaf0; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
            Syncing data matrix...
        </div>
    `;

    let countActive = 0, countStalled = 0, countCritical = 0;

    try {
        const snap = await getDocs(collection(db, "surveys"));
        container.innerHTML = ''; 
        let foundRecords = false;
        
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const inputs = data.data?.inputs || {};
            
            const clientName = data.clientName || 'Unnamed Client';
            const postCode = inputs.postCode || 'No Postcode';
            
            // Fallback for older V2 data that lacks metadata
            const assignedDesigner = inputs._designerName || 'Tom'; 
            const pipelineStatus = inputs._pipelineStatus || 'Pre-Quote';
            const projectBrand = inputs._brand || 'CO Home Improvements';
            
            if (designerFilter && assignedDesigner !== designerFilter) return;
            if (brandFilter !== "ALL" && projectBrand !== brandFilter) return;

            foundRecords = true;
            
            // --- RAG Calculus ---
            const lastContacted = inputs._lastContacted || (data.updatedAt ? data.updatedAt.toMillis() : Date.now());
            const daysSinceContact = (Date.now() - lastContacted) / (1000 * 60 * 60 * 24);
            
            let ragClass = 'bg-green', ragText = 'Active', borderClass = 'border-green-500';
            if (daysSinceContact > 7) { 
                ragClass = 'bg-red'; ragText = 'Critical Action Required'; countCritical++;
            } else if (daysSinceContact > 3) { 
                ragClass = 'bg-amber'; ragText = 'Pending Follow-up'; countStalled++;
            } else { countActive++; }

            // --- Status Updater Dropdown (Interactive Component) ---
            const statusOptions = ['Pre-Quote', 'Quoted', 'Follow-Up', 'Surveyed', 'Sold', 'Dead Lead'];
            let statusSelectHtml = `<select onchange="window.updateLeadStatus('${docSnap.id}', this.value)" class="glass-input" style="padding: 4px 8px; font-size: 0.8rem; border-color: #444; width: 100%; margin-top: 5px;">`;
            statusOptions.forEach(opt => {
                statusSelectHtml += `<option value="${opt}" ${pipelineStatus === opt ? 'selected' : ''}>${opt}</option>`;
            });
            statusSelectHtml += `</select>`;

            // Action Buttons based on role
            let actionArea = '';
            if (designerFilter) {
                // Designer gets interactive controls
                actionArea = `
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <label style="font-size: 0.75rem; color: #888; text-transform: uppercase;">Update Pipeline Stage:</label>
                        ${statusSelectHtml}
                        <button onclick="openDesignerChat('${docSnap.id}', '${clientName}')" style="margin-top: 10px; width: 100%; padding: 10px; background: rgba(13, 202, 240, 0.1); color: #0dcaf0; border: 1px solid rgba(13, 202, 240, 0.3); border-radius: 6px; font-weight: bold; cursor: pointer;">Open Communication</button>
                    </div>
                `;
            }

            container.innerHTML += `
                <div class="rag-card">
                    <div class="rag-indicator ${ragClass}"></div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-left: 10px;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.1rem; color: #fff;">${clientName}</h3>
                            <p style="margin: 4px 0 0 0; color: #888; font-size: 0.8rem;">${postCode} &nbsp;|&nbsp; ${projectBrand}</p>
                        </div>
                    </div>
                    
                    <div style="padding-left: 10px; margin-top: 15px; flex-grow: 1;">
                        <p style="margin: 0; color: #aaa; font-size: 0.85rem;">Designer: <span style="color: #fff;">${assignedDesigner}</span></p>
                        <p style="margin: 5px 0 0 0; color: #aaa; font-size: 0.85rem;">Current Stage: <span style="color: #fff; font-weight: bold;">${pipelineStatus}</span></p>
                    </div>

                    <div style="padding-left: 10px; margin-top: 10px;">
                        <span style="font-size: 0.7rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: #ccc;">
                            ${ragText}
                        </span>
                    </div>
                    ${actionArea}
                </div>
            `;
        });
        
        if (targetContainerId === 'admin-rag-container') {
            document.getElementById('v3-stat-active').innerText = countActive;
            document.getElementById('v3-stat-stalled').innerText = countStalled;
            document.getElementById('v3-stat-critical').innerText = countCritical;
        }

        if(!foundRecords) container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px; background: #15202b; border-radius: 12px; border: 1px dashed #333;">No records match current filters.</div>';

    } catch (error) {
        console.error("Dashboard error:", error);
        container.innerHTML = '<p style="color: #ff4444; text-align: center;">Secure connection interrupted.</p>';
    }
}

window.initAdminDashboard = function() { fetchAndRenderPipeline('admin-rag-container', null, document.getElementById('brand-selector').value); }
window.initDesignerDashboard = function(designerName) { fetchAndRenderPipeline('designer-pipeline-container', designerName, "ALL"); }

document.getElementById('brand-selector').addEventListener('change', window.initAdminDashboard);


// === 5. CUSTOMER VAULT LOGIC ===
window.activeVaultChatUnsubscribe = null;

window.initCustomerVault = function(docs) {
    const docSnap = docs[0];
    const data = docSnap.data();
    const inputs = data.data?.inputs || {};
    window.activeVaultSurveyId = docSnap.id; 
    
    document.getElementById('vault-client-name').innerText = data.clientName || "Valued Client";
    document.getElementById('vault-designer-name').innerText = inputs._designerName || "Tom";

    // 1. Setup Specs Panel
    document.getElementById('vault-specs-container').innerHTML = `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 8px;">
            <span style="color: #888;">Build Directive:</span> <strong style="color: #fff;">${inputs.buildType || "TBC"}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 8px;">
            <span style="color: #888;">Dimensions:</span> <strong style="color: #fff;">${inputs.proposedSize || "Subject to final measure"}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 8px;">
            <span style="color: #888;">Roofing Sys:</span> <strong style="color: #fff;">${inputs.roofType || "TBC"}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 20px;">
            <span style="color: #888;">Finish Matrix:</span> <strong style="color: #fff;">${inputs.frameColour || "TBC"}</strong>
        </div>
        <div style="background: rgba(13, 202, 240, 0.05); padding: 15px; border-radius: 8px; border-left: 3px solid #0dcaf0;">
            <p style="margin: 0; font-size: 0.75rem; color: #0dcaf0; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; letter-spacing: 0.5px;">Architectural Notes</p>
            <p style="margin: 0; font-style: italic; color: #ddd; font-size: 0.95rem;">"${inputs.customerNotes || "Design notes are currently being formalized. Check back shortly."}"</p>
        </div>
    `;

    // 2. Check for finalized PDF URL
    const downloadArea = document.getElementById('vault-download-area');
    if (data.generatedPdfUrl) {
        downloadArea.classList.remove('hidden-view');
        document.getElementById('btn-download-pack').onclick = () => window.open(data.generatedPdfUrl, '_blank');
    } else {
        downloadArea.classList.add('hidden-view');
    }

    // 3. Init Chat
    initVaultChat(window.activeVaultSurveyId);
}

// === 6. TWO-WAY SECURE WEBSOCKET CHAT ===

// Format timestamps nicely
function formatTime(timestamp) {
    if(!timestamp) return 'Just now';
    const d = timestamp.toDate();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- Customer View Chat ---
function initVaultChat(surveyId) {
    const chatWindow = document.getElementById('chat-window');
    if(window.activeVaultChatUnsubscribe) window.activeVaultChatUnsubscribe();
    
    const q = query(collection(db, `surveys/${surveyId}/messages`), orderBy('timestamp', 'asc'));
    
    window.activeVaultChatUnsubscribe = onSnapshot(q, (snapshot) => {
        chatWindow.innerHTML = '';
        if(snapshot.empty) {
            chatWindow.innerHTML = '<p style="text-align: center; color: #555; font-size: 0.85rem; margin: auto;">Connection secure. Send a message to your designer.</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isCustomer = msg.sender === 'Customer';
            const bubbleClass = isCustomer ? 'chat-bubble-user' : 'chat-bubble-them';
            
            chatWindow.innerHTML += `
                <div class="chat-bubble ${bubbleClass}">
                    ${msg.text}
                    <div class="chat-meta">${formatTime(msg.timestamp)}</div>
                </div>
            `;
        });
        chatWindow.scrollTop = chatWindow.scrollHeight; 
    });
}

document.getElementById('btn-send-chat').addEventListener('click', async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text || !window.activeVaultSurveyId) return;
    
    input.value = ''; 
    await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/messages`), {
        sender: 'Customer',
        text: text,
        timestamp: serverTimestamp()
    });
});

document.getElementById('chat-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') document.getElementById('btn-send-chat').click(); });

// --- Designer View Chat Modal ---
window.activeDesignerChatUnsubscribe = null;

window.openDesignerChat = function(surveyId, clientName) {
    window.activeDesignerSurveyId = surveyId;
    document.getElementById('designer-chat-title').innerText = clientName;
    document.getElementById('designer-chat-modal').classList.remove('hidden-view');
    
    const chatWindow = document.getElementById('designer-chat-window');
    const q = query(collection(db, `surveys/${surveyId}/messages`), orderBy('timestamp', 'asc'));
    
    if (window.activeDesignerChatUnsubscribe) window.activeDesignerChatUnsubscribe();
    
    window.activeDesignerChatUnsubscribe = onSnapshot(q, (snapshot) => {
        chatWindow.innerHTML = '';
        if(snapshot.empty) {
            chatWindow.innerHTML = '<p style="text-align: center; color: #555; font-size: 0.85rem; margin: auto;">No message history. Reach out to the client to initialize.</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isDesigner = msg.sender === 'Designer';
            const bubbleClass = isDesigner ? 'chat-bubble-user' : 'chat-bubble-them';
            
            chatWindow.innerHTML += `
                <div class="chat-bubble ${bubbleClass}">
                    ${msg.text}
                    <div class="chat-meta">${formatTime(msg.timestamp)}</div>
                </div>
            `;
        });
        chatWindow.scrollTop = chatWindow.scrollHeight; 
    });
}

document.getElementById('btn-close-designer-chat').addEventListener('click', () => {
    document.getElementById('designer-chat-modal').classList.add('hidden-view');
    if (window.activeDesignerChatUnsubscribe) { window.activeDesignerChatUnsubscribe(); window.activeDesignerChatUnsubscribe = null; }
});

document.getElementById('btn-designer-send-chat').addEventListener('click', async () => {
    const input = document.getElementById('designer-chat-input');
    const text = input.value.trim();
    if(!text || !window.activeDesignerSurveyId) return;
    
    input.value = ''; 
    await addDoc(collection(db, `surveys/${window.activeDesignerSurveyId}/messages`), {
        sender: 'Designer',
        text: text,
        timestamp: serverTimestamp()
    });
});

document.getElementById('designer-chat-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') document.getElementById('btn-designer-send-chat').click(); });
