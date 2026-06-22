import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, query, where, orderBy, limit, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const appConfig = { apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0", authDomain: "cohi-survey-engine.firebaseapp.com", projectId: "cohi-survey-engine" };
const app = !getApps().length ? initializeApp(appConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

const authGate = document.getElementById('authGate');
const dashboardApp = document.getElementById('dashboardApp');

// Handle Auth State
onAuthStateChanged(auth, (user) => {
    if (user) {
        authGate.classList.add('hidden');
        dashboardApp.classList.remove('hidden');
        const name = user.email.split('@')[0];
        document.getElementById('designerWelcome').innerText = `Welcome, ${name.charAt(0).toUpperCase() + name.slice(1)}`;
        loadPipeline();
    } else {
        authGate.classList.remove('hidden');
        dashboardApp.classList.add('hidden');
    }
});

// Login Logic
document.getElementById('btnLogin').addEventListener('click', () => {
    const email = document.getElementById('authEmail').value.trim();
    const pass = document.getElementById('authPassword').value;
    const err = document.getElementById('authError');
    if(!email || !pass) { err.classList.remove('hidden'); return; }
    signInWithEmailAndPassword(auth, email, pass).catch(() => err.classList.remove('hidden'));
});

// Logout & Refresh Logic
document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));
document.getElementById('btnRefresh').addEventListener('click', () => loadPipeline());

// Fetch Data from Firestore securely
async function loadPipeline() {
    const grid = document.getElementById('pipelineGrid');
    grid.innerHTML = '<div class="text-gray-500 text-sm animate-pulse">Syncing...</div>';

    try {
        const user = auth.currentUser;
        if (!user) return;

        // Security Check: Find out if admin or designer
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : { role: 'designer' };

        let q;
        if (userData.role === 'admin') {
            q = query(collection(db, "surveys"), orderBy("updatedAt", "desc"), limit(50));
        } else {
            // Designers only pull their own surveys (This fixes the red error!)
            q = query(collection(db, "surveys"), where("userId", "==", user.uid));
        }

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            grid.innerHTML = '<div class="text-gray-500 col-span-3">No active projects found. Click "New Survey" to start.</div>';
            return;
        }

        grid.innerHTML = '';
        querySnapshot.forEach((documentSnapshot) => {
            const data = documentSnapshot.data();
            const id = documentSnapshot.id;
            
            // Map data safely from old and new structures
            const inputs = data.data?.inputs || {};
            const clientName = data.clientName || data.customerProfile?.leadName || 'Unknown Client';
            const postCode = inputs.postCode || data.customerProfile?.postcode || 'No Postcode';
            const status = data.pipelineStatus || inputs._pipelineStatus || '1. Consultation & Survey';
            const roof = inputs.roofType || data.technicalSurvey?.roofSystem || 'Not specified';
            const dateStr = data.updatedAt ? new Date(data.updatedAt.toDate()).toLocaleDateString('en-GB') : 'Unknown Date';
            
            const vaultViews = data.vaultTelemetry?.totalOpens || 0;
            const timeSpent = data.vaultTelemetry?.timeSpentMinutes || 0;
            const pin = data.customerProfile?.vaultPIN || 'N/A';

            // Build Card UI
            const card = document.createElement('div');
            card.className = 'glass-card p-6 flex flex-col justify-between';
            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h4 class="text-xl font-black text-white">${clientName}</h4>
                            <span class="text-xs text-[#0dcaf0]">PIN: ${pin}</span>
                        </div>
                        <span class="status-badge">${status.split('.')[0]}</span>
                    </div>
                    <div class="text-sm text-gray-400 mb-1">📍 ${postCode}</div>
                    <div class="text-sm text-gray-400 mb-4">🏠 ${roof}</div>
                    
                    <div class="text-xs text-gray-500 mb-4 flex gap-4">
                        <span>👁️ Views: ${vaultViews}</span>
                        <span>⏱️ Time: ${timeSpent} mins</span>
                    </div>
                </div>
                
                <div class="pt-4 border-t border-gray-800 flex flex-col gap-2 mt-2">
                    <div class="flex gap-2">
                        <input type="file" id="pdfUpload_${id}" accept=".pdf" class="hidden" onchange="window.handleUDesignUpload('${id}', this)">
                        <button onclick="document.getElementById('pdfUpload_${id}').click()" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs py-2 rounded transition border border-slate-700">📄 Upload Quote</button>
                        
                        <input type="file" id="3dUpload_${id}" accept="image/*" class="hidden" onchange="window.handle3DUpload('${id}', this)">
                        <button onclick="document.getElementById('3dUpload_${id}').click()" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs py-2 rounded transition border border-slate-700">🖼️ Upload 3D</button>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                        <span class="text-xs text-gray-600">Updated: ${dateStr}</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error("Error fetching pipeline:", error);
        grid.innerHTML = '<div class="text-red-500 col-span-3 font-bold">Error connecting to Vault database. Please check your internet connection.</div>';
    }
}

// Global functions for the inline HTML buttons to access
window.handleUDesignUpload = (docId, inputEl) => {
    const file = inputEl.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        const base64 = reader.result;
        await updateDoc(doc(db, "surveys", docId), {
            "uDesignBridge.quotePdfUrl": base64,
            "uDesignBridge.isUploaded": true,
            pipelineStatus: "2. Quote Sent"
        });
        alert("UDesign Quote Uploaded & Pipeline Updated!");
        loadPipeline();
    };
    reader.readAsDataURL(file);
};

window.handle3DUpload = (docId, inputEl) => {
    const file = inputEl.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        const base64 = reader.result;
        await updateDoc(doc(db, "surveys", docId), {
            "uDesignBridge.render3DUrl": base64
        });
        alert("3D Render Pushed to Customer Vault!");
    };
    reader.readAsDataURL(file);
};
