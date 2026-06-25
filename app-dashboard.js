import { auth, db, collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, onAuthStateChanged, signInWithEmailAndPassword, signOut } from './firebase-core.js';

// --- 1. THE AUTHENTICATION ENGINE (Restored) ---
const authGate = document.getElementById('authGate');
const dashboardApp = document.getElementById('dashboardApp');

onAuthStateChanged(auth, (user) => {
    if (user) {
        if(authGate) authGate.classList.add('hidden');
        if(dashboardApp) dashboardApp.classList.remove('hidden');
        const name = user.email.split('@')[0];
        if(document.getElementById('designerWelcome')) document.getElementById('designerWelcome').innerText = `Welcome, ${name.charAt(0).toUpperCase() + name.slice(1)}`;
    } else {
        if(authGate) authGate.classList.remove('hidden');
        if(dashboardApp) dashboardApp.classList.add('hidden');
    }
});

document.getElementById('btnLogin')?.addEventListener('click', () => {
    const email = document.getElementById('authEmail')?.value.trim();
    const pass = document.getElementById('authPassword')?.value;
    if(!email || !pass) return alert("Please enter both email and password.");
    
    const btn = document.getElementById('btnLogin');
    const ogText = btn.innerText; 
    btn.innerText = "Authenticating...";
    
    signInWithEmailAndPassword(auth, email, pass)
        .catch(err => alert("Login Failed: " + err.message))
        .finally(() => btn.innerText = ogText);
});

document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth));

// --- 2. PIPELINE & RAG ENGINE ---
const grid = document.getElementById('pipelineGrid');
const cloudinaryUrl = "https://api.cloudinary.com/v1_1/dqk1hz0f8/upload";

function calculateRAG(lastActiveMs) {
    if (!lastActiveMs) return { color: 'text-gray-500', dot: '⚪', label: 'No Interaction' };
    const hoursSince = (Date.now() - lastActiveMs) / (1000 * 60 * 60);
    if (hoursSince < 24) return { color: 'text-emerald-400', dot: '🟢', label: 'Highly Engaged' };
    if (hoursSince < 72) return { color: 'text-amber-400', dot: '🟡', label: 'Action Required' };
    return { color: 'text-rose-500', dot: '🔴', label: 'Going Cold' };
}

onSnapshot(query(collection(db, "surveys"), orderBy("timestamps.updatedAt", "desc")), (snapshot) => {
    if(!grid) return;
    grid.innerHTML = '';
    
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        const rag = calculateRAG(data.vaultTelemetry?.lastActive);
        
        grid.innerHTML += `
            <div class="glass-card p-6 flex flex-col justify-between border-l-4 ${rag.color.replace('text-', 'border-')}">
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="text-xl font-black text-white">${data.customerProfile?.leadName || 'Unnamed'}</h4>
                        <span class="status-badge">${data.pipelineStatus || '1. Pre-Quote'}</span>
                    </div>
                    <div class="text-xs text-gray-400 mb-4">📍 ${data.customerProfile?.postcode || 'TBC'} | PIN: <span class="text-[#0dcaf0]">${data.customerProfile?.vaultPIN || 'N/A'}</span></div>
                    
                    <div class="bg-slate-800/50 p-3 rounded-lg text-xs flex justify-between items-center mb-4">
                        <span class="${rag.color} font-bold">${rag.dot} ${rag.label}</span>
                        <span class="text-gray-400">👁️ Opens: ${data.vaultTelemetry?.opens || 0}</span>
                        <button onclick="window.replyToClient('${id}')" class="text-[#0dcaf0] hover:text-white transition">💬 Fast Reply</button>
                    </div>
                </div>

                <div class="flex gap-2 mt-2">
                    <a href="survey.html?id=${id}" class="flex-1 bg-[#10b981] hover:bg-emerald-400 text-white text-xs py-2 rounded text-center font-bold transition">✏️ Survey</a>
                    <a href="vault.html?id=${id}" target="_blank" class="flex-1 bg-[#0dcaf0] hover:bg-cyan-400 text-black text-xs py-2 rounded text-center font-bold transition">🔒 Vault</a>
                </div>
                <div class="flex gap-2 mt-2">
                    <input type="file" id="up_${id}" class="hidden" accept=".pdf" onchange="window.uploadQuote('${id}', this)">
                    <button onclick="document.getElementById('up_${id}').click()" class="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs py-2 rounded transition">📄 Upload PDF Quote</button>
                </div>
            </div>
        `;
    });
});

window.uploadQuote = async (id, inputEl) => {
    const file = inputEl.files[0];
    if(!file) return;
    
    inputEl.previousElementSibling.innerText = "Uploading...";
    const fd = new FormData();
    fd.append('file', file); fd.append('upload_preset', "crm_document_uploads");
    
    try {
        const res = await fetch(cloudinaryUrl, { method: 'POST', body: fd });
        const json = await res.json();
        await updateDoc(doc(db, "surveys", id), { "uDesignBridge.quotePdfUrl": json.secure_url, pipelineStatus: "2. Quote Sent" });
        alert("Quote officially securely deployed to client Vault!");
    } catch(e) { 
        alert("Upload failed."); 
        inputEl.previousElementSibling.innerText = "📄 Upload PDF Quote";
    }
};

window.replyToClient = async (id) => {
    const msg = prompt("Fast Reply to Customer (They will see this in their Vault):");
    if(!msg) return;
    await addDoc(collection(db, `surveys/${id}/messages`), { sender: 'Designer', text: msg, timestamp: serverTimestamp() });
};
