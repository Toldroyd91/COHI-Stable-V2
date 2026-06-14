import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
            document.getElementById('brand-selector').classList.remove('hidden');
        } else {
            document.getElementById('brand-selector').classList.add('hidden');
        }
    }
}

// === 3. AUTHENTICATION LOGIC ===
document.getElementById('btn-login').addEventListener('click', async () => {
    const id = document.getElementById('loginId').value.trim().toLowerCase();
    const pin = document.getElementById('loginPin').value.trim();
    const err = document.getElementById('login-error');
    
    err.classList.add('hidden');

    // Admin Access
    if (id === 'admin' && pin === 'master123') {
        switchView('admin', 'GLOBAL ADMIN COMMAND');
        initAdminDashboard();
        return;
    }

    // Designer Access
    if (id === 'designer' && pin === 'survey123') {
        switchView('designer', 'DESIGNER PORTAL');
        initDesignerDashboard('Tom'); 
        return;
    }

    // Customer Vault Lookup
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
            err.innerText = "Access Denied. Please check your details.";
            err.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Login Error:", error);
        err.innerText = "Database connection failed.";
        err.classList.remove('hidden');
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    document.getElementById('loginId').value = '';
    document.getElementById('loginPin').value = '';
    switchView('login');
});

// === 4. DASHBOARD INITIALIZERS & RAG ENGINE ===

async function fetchAndRenderPipeline(targetContainerId, designerFilter = null) {
    const container = document.getElementById(targetContainerId);
    container.innerHTML = '<p style="color: #888;">Fetching live pipeline data...</p>';

    try {
        const snap = await getDocs(collection(db, "surveys"));
        if (snap.empty) {
            container.innerHTML = '<p style="color: #888;">No leads found in the system.</p>';
            return;
        }

        container.innerHTML = ''; 
        
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const inputs = data.data?.inputs || {};
            
            const clientName = data.clientName || 'Unnamed Client';
            const postCode = inputs.postCode || 'No Postcode';
            const assignedDesigner = inputs._designerName || 'Unassigned';
            const pipelineStatus = inputs._pipelineStatus || 'Pre-Quote';
            
            // Fallback to the document creation date if _lastContacted isn't available yet
            const lastContacted = inputs._lastContacted || (data.updatedAt ? data.updatedAt.toMillis() : Date.now());
            
            if (designerFilter && assignedDesigner !== designerFilter) return;

            // --- THE RAG MATH ---
            const daysSinceContact = (Date.now() - lastContacted) / (1000 * 60 * 60 * 24);
            let ragClass = 'green';
            let ragText = 'Active (Recently updated)';
            
            if (daysSinceContact > 7) { 
                ragClass = 'red'; 
                ragText = 'Action Required (> 7 Days)'; 
            } else if (daysSinceContact > 3) { 
                ragClass = 'amber'; 
                ragText = 'Pending (3-7 Days)'; 
            }

            // --- BUILD THE UI CARD ---
            const cardHtml = `
                <div class="rag-card ${ragClass}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h3 style="margin: 0; font-size: 1.1rem;">${clientName}</h3>
                        <span style="font-size: 0.8rem; background: rgba(255,255,255,0.1); padding: 3px 6px; border-radius: 4px;">${postCode}</span>
                    </div>
                    <p style="margin: 8px 0 0 0; color: #ccc; font-size: 0.9rem;">Designer: <strong style="color: #fff;">${assignedDesigner}</strong></p>
                    <p style="margin: 4px 0 0 0; color: #aaa; font-size: 0.9rem;">Stage: ${pipelineStatus}</p>
                    <div style="margin-top: 15px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                        Status: ${ragText}
                    </div>
                </div>
            `;
            container.innerHTML += cardHtml;
        });
        
        if(container.innerHTML === '') container.innerHTML = '<p style="color: #888;">No leads match this view.</p>';

    } catch (error) {
        console.error("Error fetching pipeline:", error);
        container.innerHTML = '<p style="color: #ff4444;">Failed to load database.</p>';
    }
}

// These are called automatically when you log in via the router above!
window.initAdminDashboard = function() {
    console.log("Loading Admin Global Data...");
    fetchAndRenderPipeline('admin-rag-container', null); // null means show ALL designers
}

window.initDesignerDashboard = function(designerName) {
    console.log(`Loading Pipeline for ${designerName}...`);
    fetchAndRenderPipeline('designer-pipeline-container', designerName); // specifically pulls "Tom"
}

window.initCustomerVault = function(docs) {
    console.log(`Loading Vault...`);
    const clientName = docs[0].data().clientName || "Valued Client";
    document.getElementById('vault-client-name').innerText = clientName;
}
