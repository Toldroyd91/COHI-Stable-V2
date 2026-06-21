import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 1. ARCHITECTURE SETUP
const appConfig = { apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0", authDomain: "cohi-survey-engine.firebaseapp.com", projectId: "cohi-survey-engine" };
const app = initializeApp(appConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Use your existing Cloudinary architecture for heavy UDesign files
const cloudinaryUrl = "https://api.cloudinary.com/v1_1/dqk1hz0f8/upload";
const cloudinaryPreset = "crm_document_uploads";

// DOM Elements
const authGate = document.getElementById('authGate');
const dashboardApp = document.getElementById('dashboardApp');
const pipelineGrid = document.getElementById('pipelineGrid');
const bridgeModal = document.getElementById('bridgeModal');
let activeProjectId = null;

// 2. ENTERPRISE AUTHENTICATION
onAuthStateChanged(auth, (user) => {
    if (user) {
        authGate.classList.add('hidden');
        dashboardApp.classList.remove('hidden');
        const name = user.email.split('@')[0];
        document.getElementById('designerWelcome').innerText = `SysAdmin: ${name.charAt(0).toUpperCase() + name.slice(1)} | Secure`;
        initPipelineStream();
    } else {
        authGate.classList.remove('hidden');
        dashboardApp.classList.add('hidden');
    }
});

document.getElementById('btnLogin').addEventListener('click', () => {
    const email = document.getElementById('authEmail').value.trim();
    const pass = document.getElementById('authPassword').value;
    if(!email || !pass) return;
    document.getElementById('btnLogin').innerText = "Verifying...";
    signInWithEmailAndPassword(auth, email, pass).catch(() => {
        document.getElementById('authError').classList.remove('hidden');
        document.getElementById('btnLogin').innerText = "Initialize";
    });
});

document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

// 3. LIVE PIPELINE TELEMETRY STREAM
function initPipelineStream() {
    const q = query(collection(db, "surveys"), orderBy("timestamps.updatedAt", "desc"));
    
    // onSnapshot gives you REAL-TIME updates. If a customer opens their vault, 
    // the dashboard updates before your eyes without refreshing.
    onSnapshot(q, (snapshot) => {
        pipelineGrid.innerHTML = '';
        if (snapshot.empty) {
            pipelineGrid.innerHTML = '<div class="text-gray-500 col-span-3 text-center py-10">No active projects. Deploy a Tactical Survey.</div>';
            return;
        }

        snapshot.forEach((documentSnapshot) => {
            const data = documentSnapshot.data();
            const id = documentSnapshot.id;
            
            // Extract core data based on our new JSON schema
            const clientName = data.customerProfile?.leadName || data.clientName || 'Unknown Client';
            const postCode = data.customerProfile?.postcode || data.data?.inputs?.postCode || 'No Postcode';
            const build = data.technicalSurvey?.buildCategory || data.data?.inputs?.buildType || 'Extension';
            const vaultData = data.vaultTelemetry || {};
            
            // Calculate Engine Telemetry (RAG Status)
            let ragClass = "rag-amber";
            let statusText = "Reviewing";
            const opens = vaultData.totalOpens || 0;
            const lastContact = data.timestamps?.updatedAt?.toDate() || new Date();
            const hoursSince = Math.abs(new Date() - lastContact) / 36e5;
            
            if (opens >= 5 && hoursSince < 48) { ragClass = "rag-green"; statusText = "HOT LEAD"; }
            else if (hoursSince > 168) { ragClass = "rag-red"; statusText = "AT RISK"; }

            // Build Tactical UI Card
            const card = document.createElement('div');
            card.className = `glass-card p-6 flex flex-col justify-between ${ragClass}`;
            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-start mb-3">
                        <h4 class="text-2xl font-black text-white">${clientName}</h4>
                        <span class="text-xs font-bold text-gray-400 bg-black/50 px-3 py-1 rounded-full border border-gray-700">${statusText}</span>
                    </div>
                    <p class="text-sm text-[#0dcaf0] mb-4 font-mono">📍 ${postCode} | 🏠 ${build}</p>
                    
                    <div class="bg-black/30 rounded-lg p-4 mb-4 grid grid-cols-2 gap-2 text-sm border border-gray-800">
                        <div class="text-gray-400">Vault Opens: <span class="text-white font-bold ml-1">${opens}</span></div>
                        <div class="text-gray-400">Time Viewed: <span class="text-white font-bold ml-1">${vaultData.timeSpentMinutes || 0}m</span></div>
                        <div class="col-span-2 text-gray-400 mt-1">Focus Area: <span class="text-emerald-400 font-bold ml-1">${vaultData.lastHovered || 'N/A'}</span></div>
                    </div>
                </div>
                <div class="pt-4 border-t border-gray-800 flex justify-between items-center">
                    <span class="text-xs text-gray-500 font-mono">ID: ${id.substring(0,6)}</span>
                    <button class="btn-bridge bg-slate-800 hover:bg-[#0dcaf0] hover:text-black text-white px-4 py-2 rounded font-bold transition-all text-sm" data-id="${id}" data-name="${clientName}">
                        UDesign Bridge ↗
                    </button>
                </div>
            `;
            pipelineGrid.appendChild(card);
        });

        // Attach listeners to the new buttons
        document.querySelectorAll('.btn-bridge').forEach(btn => {
            btn.addEventListener('click', (e) => openBridgeModal(e.target.dataset.id, e.target.dataset.name));
        });
    });
}

// 4. THE UDESIGN BRIDGE LOGIC
async function openBridgeModal(projectId, clientName) {
    activeProjectId = projectId;
    document.getElementById('modalClientName').innerText = clientName;
    
    // Reset Modal Inputs
    document.getElementById('fileRender').value = '';
    document.getElementById('filePdf').value = '';
    document.getElementById('renderStatus').innerText = "Awaiting File";
    document.getElementById('btnSaveBridge').innerText = "Save & Deploy to Vault";

    // Pre-load existing data if available
    const docSnap = await getDoc(doc(db, "surveys", projectId)).catch(()=>null);
    if(docSnap && docSnap.exists()) {
        const d = docSnap.data().uDesignBridge || {};
        document.getElementById('inputTotalValue').value = d.totalQuoteValue || '';
        document.getElementById('inputDeposit').value = d.depositRequired || '';
        document.getElementById('togglePadlock').checked = docSnap.data().vaultTelemetry?.isUnlocked || false;
        if(d.render3DUrl) document.getElementById('renderStatus').innerText = "✓ Active Render in Vault";
    }

    bridgeModal.classList.remove('hidden');
}

document.getElementById('closeModal').addEventListener('click', () => bridgeModal.classList.add('hidden'));

// Cloudinary Uploader (Built for heavy 3D files)
async function uploadAsset(file, resourceType = 'auto') {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', cloudinaryPreset);
    try {
        const res = await fetch(cloudinaryUrl.replace('upload', `${resourceType}/upload`), { method: 'POST', body: fd });
        const data = await res.json();
        return data.secure_url;
    } catch(err) { console.error("Upload Error:", err); return null; }
}

// Save & Deploy
document.getElementById('btnSaveBridge').addEventListener('click', async () => {
    if(!activeProjectId) return;
    const btn = document.getElementById('btnSaveBridge');
    btn.innerText = "Deploying to Vault...";
    btn.disabled = true;

    try {
        const updates = { "timestamps.updatedAt": serverTimestamp() };
        
        // Grab numbers
        const total = parseFloat(document.getElementById('inputTotalValue').value);
        const dep = parseFloat(document.getElementById('inputDeposit').value);
        if(!isNaN(total)) updates["uDesignBridge.totalQuoteValue"] = total;
        if(!isNaN(dep)) updates["uDesignBridge.depositRequired"] = dep;

        // Vault Padlock Status
        updates["vaultTelemetry.isUnlocked"] = document.getElementById('togglePadlock').checked;
        updates["uDesignBridge.isUploaded"] = true;

        // Process Heavy Files
        const fileRender = document.getElementById('fileRender').files[0];
        const filePdf = document.getElementById('filePdf').files[0];

        if(fileRender) {
            btn.innerText = "Uploading 3D Render...";
            // .dae files process best as 'raw' in cloudinary
            const url = await uploadAsset(fileRender, 'raw'); 
            if(url) updates["uDesignBridge.render3DUrl"] = url;
        }

        if(filePdf) {
            btn.innerText = "Uploading PDF Quote...";
            const url = await uploadAsset(filePdf, 'image'); // PDFs act as images/documents
            if(url) updates["uDesignBridge.quotePdfUrl"] = url;
        }

        btn.innerText = "Securing Payload...";
        await updateDoc(doc(db, "surveys", activeProjectId), updates);
        
        btn.innerText = "Deployment Successful!";
        setTimeout(() => { bridgeModal.classList.add('hidden'); }, 1000);
    } catch (e) {
        console.error("Bridge Error:", e);
        btn.innerText = "Error! Check Console.";
    } finally {
        setTimeout(() => { btn.disabled = false; btn.innerText = "Save & Deploy to Vault"; }, 2000);
    }
});
