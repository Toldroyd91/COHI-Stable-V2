import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 1. INITIALIZATION ---
const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine",
    storageBucket: "cohi-survey-engine.firebasestorage.app",
    messagingSenderId: "208212115382",
    appId: "1:208212115382:web:db7d4276b194f89a274b17"
};

const app = !getApps().length ? initializeApp(appConfig) : getApp();
const auth = getAuth(app); 
const db = getFirestore(app);
window.db = db;

// Helper
const getValSafe = (id1, id2) => document.getElementById(id1)?.value || document.getElementById(id2)?.value || '';

// --- 2. AUTHENTICATION & ROUTING ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data(); window.currentUserProfile = userData;
            
            setTimeout(() => {
                const splash = document.getElementById('splashScreen');
                if(splash) { splash.style.opacity = '0'; setTimeout(() => splash.style.display = 'none', 800); }
                if(document.getElementById('authOverlay')) document.getElementById('authOverlay').style.display = 'none';

                if (userData.role === 'admin') {
                    if(document.getElementById('designerApp')) document.getElementById('designerApp').style.display = 'none'; 
                    if(document.getElementById('adminDashboard')) document.getElementById('adminDashboard').style.display = 'block';
                } else {
                    if(document.getElementById('adminDashboard')) document.getElementById('adminDashboard').style.display = 'none'; 
                    if(document.getElementById('designerApp')) document.getElementById('designerApp').style.display = 'block';
                    fetchCloudDrafts(user.uid); // ONLY fetch this user's drafts
                }
            }, 1000);
        }
    } else { 
        if(document.getElementById('authOverlay')) document.getElementById('authOverlay').style.display = 'flex'; 
        if(document.getElementById('designerApp')) document.getElementById('designerApp').style.display = 'none'; 
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => { signOut(auth).then(() => { location.reload(); }); });

// --- 3. DATA FETCHING (SECURED) ---
let currentDrafts = {};
async function fetchCloudDrafts(uid) {
    // SECURITY FIX: Only pull surveys where userId matches the logged-in user
    const q = query(collection(db, "surveys"), where("userId", "==", uid));
    try {
        const snap = await getDocs(q);
        const select = document.getElementById('cloudDrafts'); 
        if(select) {
            select.innerHTML = '<option value="">Load Previous Survey...</option>';
            snap.forEach((doc) => { 
                currentDrafts[doc.id] = doc.data(); 
                select.innerHTML += `<option value="${doc.id}">${doc.data().clientName || 'Unnamed Lead'}</option>`; 
            });
        }
    } catch (e) { console.error("Draft Fetch Error:", e); }
}

// --- 4. COMMAND CENTER SYNC ---
document.getElementById('btn-sync-v3')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-v3');
    btn.innerText = "Syncing..."; btn.disabled = true;

    try {
        const frontCanvas = document.getElementById('canvas-frontelevation') || document.getElementById('canvasFront');
        const fImg = frontCanvas && frontCanvas.hasAttribute('data-sniper') ? frontCanvas.getAttribute('data-sniper') : null;
        
        await addDoc(collection(db, "surveys"), {
            userId: auth.currentUser.uid, // Locks ownership to current user
            clientName: getValSafe('clientName', 'customerName') || 'Unnamed Lead',
            pipelineStatus: "1. Pre-Quote", // Sets initial stage
            customerProfile: {
                leadName: getValSafe('clientName', 'customerName'),
                postcode: getValSafe('postCode', 'input-postcode'),
                vaultPIN: Math.floor(1000 + Math.random() * 9000).toString(), // Generates Vault PIN
                designerId: window.currentUserProfile?.name || 'Designer'
            },
            technicalSurvey: {
                buildCategory: getValSafe('buildType', 'input-build-type'),
                roofSystem: getValSafe('roofType', 'input-roof-type'),
                proposedSizeSQM: getValSafe('proposedSize', 'input-proposed-size'),
                designerNotes: getValSafe('designerNotes', 'customerNotes')
            },
            rawAssets: {
                frontElevationImage: fImg,
                structuralVectors: window.sniperLogs || []
            },
            // Empty structure for dashboard to fill later
            uDesignBridge: { isUploaded: false, totalQuoteValue: null, quotePdfUrl: null, render3DUrl: null },
            vaultTelemetry: { isUnlocked: false, totalOpens: 0, timeSpentMinutes: 0, heatmap: [] },
            timestamps: { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
        });
        
        btn.innerText = "✅ Deployed to Dashboard";
        setTimeout(() => location.reload(), 2000);
    } catch(err) { 
        console.error(err); 
        btn.innerText = "Sync Failed"; btn.disabled = false;
    }
});

// --- 5. PDF GENERATOR ---
document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) return alert("PDF Engine loading...");
    
    const btn = document.getElementById('generateCustomerPdfBtn');
    btn.innerText = "Generating PDF..."; btn.disabled = true;

    try {
        // Bind data to hidden template
        document.querySelectorAll('.bind-name').forEach(el => el.innerText = getValSafe('clientName') || 'Customer');
        document.querySelectorAll('.bind-address').forEach(el => el.innerText = getValSafe('postCode'));
        const pdprint = document.getElementById('pdfPrintDesigner');
        if (pdprint) pdprint.innerText = window.currentUserProfile?.name || 'Lead Designer';

        document.getElementById('pdfBuildType').innerText = getValSafe('buildType');
        document.getElementById('pdfProposedSize').innerText = getValSafe('proposedSize');
        document.getElementById('pdfRoofType').innerText = getValSafe('roofType');
        
        const template = document.getElementById('pdfTemplateInternal');
        template.style.display = 'block';
        template.style.position = 'absolute';
        template.style.top = '-9999px';

        const pdf = new jsPDF('p', 'pt', 'a4');
        const pages = template.querySelectorAll('.pdf-page');

        for (let i = 0; i < pages.length; i++) {
            const canvas = await html2canvas(pages[i], { scale: 2 });
            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            if (i > 0) pdf.addPage();
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }

        pdf.save(`${getValSafe('clientName')}_Survey.pdf`);
        template.style.display = 'none';

        btn.innerText = "Designer Survey (Customer)"; btn.disabled = false;
    } catch (err) {
        console.error(err);
        btn.innerText = "Designer Survey (Customer)"; btn.disabled = false;
    }
});
