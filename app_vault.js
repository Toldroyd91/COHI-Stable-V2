import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const appConfig = { apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0", authDomain: "cohi-survey-engine.firebaseapp.com", projectId: "cohi-survey-engine" };
const app = !getApps().length ? initializeApp(appConfig) : getApp();
const db = getFirestore(app);

let currentVaultId = null;
let sessionStartTime = null;

const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

window.unlockVault = async () => {
    const pinInput = document.getElementById('vaultPinInput').value;
    if(!projectId) return alert("Invalid Secure Link. Please access via the dashboard link.");
    
    try {
        const docRef = doc(db, "surveys", projectId);
        const vaultDoc = await getDoc(docRef);
        
        if(!vaultDoc.exists()) {
            console.error("No document found for ID:", projectId);
            return alert("Secure document not found. The project may have been deleted.");
        }
        const data = vaultDoc.data();
        
        // BUG FIX: Forces both values into clean Strings to prevent Number mismatch
        const storedPin = String(data.customerProfile?.vaultPIN || "").trim();
        const enteredPin = String(pinInput).trim();

        if(storedPin !== enteredPin) {
            console.warn(`PIN Mismatch. Stored: ${storedPin}, Entered: ${enteredPin}`);
            return alert("Invalid PIN. Please check your text message.");
        }

        currentVaultId = projectId;
        sessionStartTime = Date.now();
        
        await updateDoc(docRef, { "vaultTelemetry.totalOpens": increment(1), "vaultTelemetry.isUnlocked": true });
        renderVaultContent(data);
    } catch(e) {
        console.error("Vault Connection Error:", e);
        alert("Connection error securing the vault. Please check your internet connection.");
    }
};

function renderVaultContent(data) {
    if(document.getElementById('loginGate')) document.getElementById('loginGate').style.display = 'none';
    if(document.getElementById('vaultContent')) document.getElementById('vaultContent').style.display = 'block';

    if(document.getElementById('customerGreeting')) document.getElementById('customerGreeting').innerText = `Welcome, ${data.customerProfile?.leadName || 'Customer'}`;
    if(document.getElementById('vaultStatus')) document.getElementById('vaultStatus').innerText = `Stage: ${data.pipelineStatus || 'Reviewing Options'}`;

    if(document.getElementById('vBuild')) document.getElementById('vBuild').innerText = data.technicalSurvey?.buildCategory || 'TBC';
    if(document.getElementById('vRoof')) document.getElementById('vRoof').innerText = data.technicalSurvey?.roofSystem || 'TBC';
    if(document.getElementById('vSize')) document.getElementById('vSize').innerText = data.technicalSurvey?.proposedSizeSQM || 'TBC';

    const renderContainer = document.getElementById('3dRenderContainer');
    if(renderContainer && data.uDesignBridge?.render3DUrl) {
        renderContainer.innerHTML = `<img src="${data.uDesignBridge.render3DUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;" />`;
    }

    const quoteContainer = document.getElementById('quoteContainer');
    if(quoteContainer && data.uDesignBridge?.quotePdfUrl) {
        quoteContainer.innerHTML = `<a href="${data.uDesignBridge.quotePdfUrl}" download="Project_Quote.pdf" class="luxury-btn w-full block p-4 text-center" style="background:#10b981; color:white; font-weight:bold; padding:15px; border-radius:8px; text-decoration:none;">⬇️ Download Official Quote</a>`;
    }
}

window.addEventListener('beforeunload', () => {
    if(currentVaultId && sessionStartTime) {
        const timeSpentMins = Math.round((Date.now() - sessionStartTime) / 60000);
        if(timeSpentMins > 0) {
            navigator.sendBeacon(`https://firestore.googleapis.com/v1/projects/cohi-survey-engine/databases/(default)/documents/surveys/${currentVaultId}?updateMask=vaultTelemetry.timeSpentMinutes`, JSON.stringify({
                fields: { "vaultTelemetry.timeSpentMinutes": { integerValue: timeSpentMins } }
            }));
        }
    }
});
