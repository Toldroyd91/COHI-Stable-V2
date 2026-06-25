import { db, doc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp } from './firebase-core.js';

let projectId = new URLSearchParams(window.location.search).get('id');

window.unlockVault = async () => {
    const pin = document.getElementById('vaultPinInput')?.value;
    if(!projectId) projectId = prompt("Please enter your Project ID:");
    
    const docRef = doc(db, "surveys", projectId.trim());
    const snap = await getDoc(docRef);
    
    if(!snap.exists() || String(snap.data().customerProfile?.vaultPIN) !== String(pin).trim()) {
        return alert("Invalid PIN or Project ID.");
    }

    // Ping telemetry for the Dashboard RAG system
    await updateDoc(docRef, { "vaultTelemetry.lastActive": Date.now() });

    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('vaultContent').style.display = 'block';

    // 1. UI DATA BINDING
    onSnapshot(docRef, (docSnap) => {
        const data = docSnap.data();
        document.getElementById('customerGreeting').innerText = `Welcome, ${data.customerProfile?.leadName || 'Customer'}`;
        document.getElementById('vBuild').innerText = data.technicalSurvey?.buildCategory || 'TBC';
        document.getElementById('vRoof').innerText = data.technicalSurvey?.roofSystem || 'TBC';
        
        const qc = document.getElementById('quoteContainer');
        if(qc && data.uDesignBridge?.quotePdfUrl) {
            qc.innerHTML = `<a href="${data.uDesignBridge.quotePdfUrl}" download class="bg-[#10b981] text-white p-4 rounded block text-center font-bold">⬇️ Download Official Quote</a>`;
        }
    });

    // 2. CHAT ENGINE
    const chatRef = collection(db, `surveys/${projectId}/messages`);
    onSnapshot(query(chatRef, orderBy("timestamp", "asc")), (msgSnap) => {
        const win = document.getElementById('chat-window');
        if(!win) return;
        win.innerHTML = '<div class="text-center text-xs text-gray-500 my-4">Secure Connection Established</div>';
        
        msgSnap.forEach(m => {
            const d = m.data();
            const isMe = d.sender === 'Customer';
            win.innerHTML += `
                <div class="mb-3 ${isMe ? 'text-right' : 'text-left'}">
                    <span class="text-xs text-gray-400">${isMe ? 'You' : 'Designer'}</span>
                    <div class="inline-block p-3 rounded-lg text-sm ${isMe ? 'bg-[#0dcaf0] text-black' : 'bg-slate-700 text-white'}">
                        ${d.text}
                    </div>
                </div>
            `;
        });
        win.scrollTop = win.scrollHeight;
    });

    document.getElementById('chat-input')?.addEventListener('keypress', async (e) => {
        if(e.key === 'Enter' && e.target.value.trim()) {
            await addDoc(chatRef, { sender: 'Customer', text: e.target.value.trim(), timestamp: serverTimestamp() });
            await updateDoc(docRef, { "vaultTelemetry.lastActive": Date.now() }); // Keeps RAG Green
            e.target.value = '';
        }
    });
};
