import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine"
};

const app = !getApps().length ? initializeApp(appConfig) : getApp();
const db = getFirestore(app);

// Fetch all active pipeline items
async function renderDashboard() {
    const container = document.getElementById('pipelineContainer');
    if(!container) return;
    
    // Admins see all, Designers see theirs (Security rules enforce this on backend too)
    const snap = await getDocs(collection(db, "surveys"));
    container.innerHTML = '';

    snap.forEach(documentSnapshot => {
        const data = documentSnapshot.data();
        const id = documentSnapshot.id;
        
        container.innerHTML += `
            <div class="pipeline-card" style="background:#1E1E1E; padding:20px; border-radius:8px; margin-bottom:15px; border-left: 5px solid #0dcaf0;">
                <div style="display:flex; justify-content:space-between;">
                    <h3>${data.clientName} <span style="font-size:12px; color:#aaa;">PIN: ${data.customerProfile?.vaultPIN}</span></h3>
                    <span style="background:#2a2a2a; padding:5px 10px; border-radius:5px; color:#10b981;">Stage: ${data.pipelineStatus}</span>
                </div>
                
                <div style="margin-top:15px; display:flex; gap:10px;">
                    <input type="file" id="pdfUpload_${id}" accept=".pdf" style="display:none;" onchange="handleUDesignUpload('${id}', this)">
                    <button onclick="document.getElementById('pdfUpload_${id}').click()" style="background:#333; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">📄 Upload UDesign Quote</button>
                    
                    <input type="file" id="3dUpload_${id}" accept="image/*" style="display:none;" onchange="handle3DUpload('${id}', this)">
                    <button onclick="document.getElementById('3dUpload_${id}').click()" style="background:#333; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">🖼️ Upload 3D Render</button>
                </div>
                
                <div style="margin-top:15px; font-size:12px; color:#888;">
                    Vault Views: ${data.vaultTelemetry?.totalOpens || 0} | Time Spent: ${data.vaultTelemetry?.timeSpentMinutes || 0} mins
                </div>
            </div>
        `;
    });
}

// Handle UDesign PDF Upload (Converts to Base64 and pushes to DB)
window.handleUDesignUpload = (docId, inputEl) => {
    const file = inputEl.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = async () => {
        const base64 = reader.result;
        await updateDoc(doc(db, "surveys", docId), {
            "uDesignBridge.quotePdfUrl": base64,
            "uDesignBridge.isUploaded": true,
            pipelineStatus: "2. Quote Sent" // Advances pipeline
        });
        alert("UDesign Quote Uploaded & Pipeline Updated!");
        renderDashboard();
    };
    reader.readAsDataURL(file);
};

// Handle 3D Render Upload
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

// Initialize
document.addEventListener('DOMContentLoaded', renderDashboard);
