import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp({
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    projectId: "cohi-survey-engine"
});
const db = getFirestore(app);

// 1. Default Pipeline Stages
const PIPELINE_STAGES = [
    "Contract Signed", "Test Dig", "Planning", 
    "SAP Calcs", "Installation Start", "Installation End"
];

// 2. Vault Unlock Logic
document.getElementById('unlockBtn').addEventListener('click', async () => {
    const pc = document.getElementById('vPostcode').value.trim().toUpperCase();
    const cn = document.getElementById('vCustNum').value.trim();
    
    // Query surveys for match
    const q = query(collection(db, "surveys"), where("data.inputs.postCode", "==", pc), where("data.inputs.clientNum", "==", cn));
    const snap = await getDocs(q);

    if (!snap.empty) {
        const survey = snap.docs[0];
        const data = survey.data();
        initDashboard(data, survey.id);
    } else {
        alert("Vault access denied. Please check your details.");
    }
});

// 3. Render Dashboard
function initDashboard(data, surveyId) {
    document.getElementById('vaultLogin').classList.add('hidden');
    document.getElementById('vaultDashboard').classList.remove('hidden');

    // Render Roadmap
    const container = document.getElementById('roadmapContainer');
    const currentStageIdx = PIPELINE_STAGES.indexOf(data.status || "Contract Signed");

    PIPELINE_STAGES.forEach((stage, idx) => {
        const active = idx <= currentStageIdx;
        container.innerHTML += `
            <div class="flex-1 text-center">
                <div class="w-4 h-4 mx-auto rounded-full ${active ? 'bg-green-500' : 'bg-slate-700'} mb-2"></div>
                <p class="text-[10px] uppercase ${active ? 'text-white' : 'text-slate-500'}">${stage}</p>
            </div>
        `;
    });
}

// 4. WhatsApp Style Chat Foundation (Hooked to this surveyId)
function initChat(surveyId) {
    const chatRef = collection(db, `surveys/${surveyId}/messages`);
    
    // Listen for new messages
    onSnapshot(query(chatRef, orderBy("timestamp", "asc")), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                // Trigger your UI toast or chat append here
                console.log("New Message:", change.doc.data());
            }
        });
    });
}
