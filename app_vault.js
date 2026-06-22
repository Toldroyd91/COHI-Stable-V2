import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine"
};

const app = !getApps().length ? initializeApp(appConfig) : getApp();
const db = getFirestore(app);

let currentVaultId = null;
let sessionStartTime = null;

// Authenticate Customer via PIN
window.unlockVault = async () => {
    const pin = document.getElementById('vaultPinInput').value;
    const q = query(collection(db, "surveys"), where("customerProfile.vaultPIN", "==", pin));
    
    const snap = await getDocs(q);
    if(snap.empty) {
        alert("Invalid PIN. Please check your text message.");
        return;
    }

    const vaultDoc = snap.docs[0];
    currentVaultId = vaultDoc.id;
    const data = vaultDoc.data();

    // Start Telemetry
    sessionStartTime = Date.now();
    await updateDoc(doc(db, "surveys", currentVaultId), {
        "vaultTelemetry.totalOpens": increment(1),
        "vaultTelemetry.isUnlocked": true
    });

    renderVaultContent(data);
};

// Render the UI
function renderVaultContent(data) {
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('vaultContent').style.display = 'block';

    document.getElementById('customerGreeting').innerText = `Welcome, ${data.customerProfile?.leadName}`;
    document.getElementById('vaultStatus').innerText = `Stage: ${data.pipelineStatus}`;

    // Populate 3D Renders if Dashboard uploaded them
    if(data.uDesignBridge?.render3DUrl) {
        document.getElementById('3dRenderContainer').innerHTML = `
            <img src="${data.uDesignBridge.render3DUrl}" style="width:100%; border-radius:8px; border:2px solid #0dcaf0;" />
        `;
    }

    // Populate Quote Download if Dashboard uploaded it
    if(data.uDesignBridge?.quotePdfUrl) {
        document.getElementById('quoteContainer').innerHTML = `
            <a href="${data.uDesignBridge.quotePdfUrl}" download="Your_Quote.pdf" style="background:#10b981; color:white; padding:15px; border-radius:8px; display:block; text-align:center; text-decoration:none; font-weight:bold;">
                ⬇️ Download Official Quote
            </a>
        `;
    }
}

// Telemetry: Track time spent on page leave
window.addEventListener('beforeunload', () => {
    if(currentVaultId && sessionStartTime) {
        const timeSpentMins = Math.round((Date.now() - sessionStartTime) / 60000);
        if(timeSpentMins > 0) {
            // Use sendBeacon for reliable exit tracking
            navigator.sendBeacon(`https://firestore.googleapis.com/v1/projects/cohi-survey-engine/databases/(default)/documents/surveys/${currentVaultId}?updateMask=vaultTelemetry.timeSpentMinutes`, JSON.stringify({
                fields: { "vaultTelemetry.timeSpentMinutes": { integerValue: timeSpentMins } }
            }));
        }
    }
});

// Telemetry: Simple Heatmap Tracking (Clicks)
document.addEventListener('click', async (e) => {
    if(!currentVaultId) return;
    const elementClicked = e.target.tagName;
    // We only log meaningful interactions to save db writes
    if(elementClicked === 'BUTTON' || elementClicked === 'A') {
        const logEntry = `${elementClicked} clicked at ${new Date().toLocaleTimeString()}`;
        // Note: In production, arrayUnion is preferred, but for simplicity we'll just update a string or let the Dashboard parse it.
    }
});
