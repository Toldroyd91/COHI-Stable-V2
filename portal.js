import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp({
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    projectId: "cohi-survey-engine"
});
const db = getFirestore(app);

const PIPELINE_STAGES = [ "Contract Signed", "Test Dig", "Planning", "SAP Calcs", "Installation Start", "Installation End" ];
let activeSurveyId = null;

// --- 1. VAULT LOGIN LOGIC ---
document.getElementById('unlockBtn').addEventListener('click', async () => {
    const btn = document.getElementById('unlockBtn');
    const err = document.getElementById('loginError');
    const pc = document.getElementById('vPostcode').value.trim().toUpperCase();
    const cn = document.getElementById('vCustNum').value.trim();
    
    if(!pc || !cn) { err.innerText = "Please enter both Postcode and Customer Number."; err.classList.remove('hidden'); return; }

    btn.innerText = "VERIFYING..."; btn.disabled = true;
    
    try {
        const q = query(collection(db, "surveys"), where("data.inputs.postCode", "==", pc), where("data.inputs.clientNum", "==", cn));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const surveyDoc = snap.docs[0];
            activeSurveyId = surveyDoc.id;
            initDashboard(surveyDoc.data());
            initChat(activeSurveyId);
        } else {
            err.innerText = "No project found with those details.";
            err.classList.remove('hidden');
            btn.innerText = "UNLOCK VAULT"; btn.disabled = false;
        }
    } catch (error) {
        console.error(error);
        err.innerText = "Connection error. Please try again.";
        err.classList.remove('hidden');
        btn.innerText = "UNLOCK VAULT"; btn.disabled = false;
    }
});

// --- 2. RENDER DASHBOARD ---
function initDashboard(docData) {
    document.getElementById('vaultLogin').classList.add('hidden');
    document.getElementById('vaultDashboard').classList.remove('hidden');

    const inputs = docData.data.inputs || {};

    // Populate Text Data
    document.getElementById('portalClientName').innerText = docData.clientName || "Valued Client";
    document.getElementById('portalBuildType').innerText = inputs.buildType || "Project Details";
    document.getElementById('portalNotes').innerText = inputs.customerNotes || "Design notes are currently being prepared by your designer.";
    document.getElementById('portalRoof').innerText = inputs.roofType || "TBC";
    document.getElementById('portalSize').innerText = inputs.proposedSize || "TBC";
    document.getElementById('portalFrame').innerText = inputs.frameColour || "TBC";
    document.getElementById('portalPlanning').innerText = inputs.planningPerms || "TBC";

    // Render Roadmap
    const container = document.getElementById('roadmapContainer');
    const currentStageIdx = PIPELINE_STAGES.indexOf(docData.status || "Contract Signed");

    // Add connecting line behind dots
    container.innerHTML = `<div class="absolute top-2 left-0 w-full h-0.5 bg-slate-700 z-0"></div>`;

    PIPELINE_STAGES.forEach((stage, idx) => {
        const active = idx <= currentStageIdx;
        container.innerHTML += `
            <div class="flex-1 text-center relative z-10">
                <div class="w-4 h-4 mx-auto rounded-full ${active ? 'bg-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.8)]' : 'bg-slate-800 border border-slate-600'} mb-2 transition-all duration-500"></div>
                <p class="text-[10px] md:text-xs font-bold uppercase ${active ? 'text-white' : 'text-slate-500'}">${stage}</p>
            </div>
        `;
    });
}

// --- 3. LIVE CHAT LOGIC ---
const chatBubble = document.getElementById('chatBubble');
const chatWindow = document.getElementById('chatWindow');
const closeChatBtn = document.getElementById('closeChatBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

chatBubble.addEventListener('click', () => {
    chatWindow.classList.remove('hidden');
    chatBubble.classList.add('hidden');
    chatMessages.scrollTop = chatMessages.scrollHeight; // auto-scroll to bottom
});

closeChatBtn.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
    chatBubble.classList.remove('hidden');
});

function initChat(surveyId) {
    const chatRef = collection(db, `surveys/${surveyId}/messages`);
    
    // Listen for incoming messages
    onSnapshot(query(chatRef, orderBy("timestamp", "asc")), (snapshot) => {
        chatMessages.innerHTML = '<div class="text-center text-xs text-slate-500 my-2">Secure Chat Initialized</div>';
        
        snapshot.forEach((doc) => {
            const msg = doc.data();
            const isCustomer = msg.sender === 'customer';
            
            chatMessages.innerHTML += `
                <div class="max-w-[80%] p-3 rounded-xl text-sm ${isCustomer ? 'bg-orange-600 text-white self-end rounded-br-none' : 'bg-slate-700 text-white self-start rounded-bl-none'}">
                    ${msg.text}
                </div>
            `;
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Send Message
    const sendMessage = async () => {
        const text = chatInput.value.trim();
        if (!text) return;
        
        chatInput.value = '';
        await addDoc(chatRef, {
            text: text,
            sender: 'customer',
            timestamp: serverTimestamp()
        });
    };

    sendChatBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}
