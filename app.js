import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const appConfig = { apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0", authDomain: "cohi-survey-engine.firebaseapp.com", projectId: "cohi-survey-engine", storageBucket: "cohi-survey-engine.firebasestorage.app", messagingSenderId: "208212115382", appId: "1:208212115382:web:db7d4276b194f89a274b17" };
const app = !getApps().length ? initializeApp(appConfig) : getApp();
const auth = getAuth(app); 
const db = getFirestore(app);
window.db = db;

// Master helper
const getValSafe = (id1, id2) => document.getElementById(id1)?.value || document.getElementById(id2)?.value || '';

// Track the active survey so we UPDATE instead of DUPLICATE
let currentSurveyId = null;

// Auth & Routing
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            window.currentUserProfile = userDoc.data();
            setTimeout(() => {
                const splash = document.getElementById('splashScreen');
                if(splash) { splash.style.opacity = '0'; setTimeout(() => splash.style.display = 'none', 800); }
                if(document.getElementById('authOverlay')) document.getElementById('authOverlay').style.display = 'none';
                if(document.getElementById('designerApp')) document.getElementById('designerApp').style.display = 'block';
                fetchCloudDrafts(user.uid);
            }, 1000);
        }
    } else { 
        if(document.getElementById('authOverlay')) document.getElementById('authOverlay').style.display = 'flex'; 
        if(document.getElementById('designerApp')) document.getElementById('designerApp').style.display = 'none'; 
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));

// Form State Scraper (Allows reloading the form exactly as it was)
const getFormState = () => {
    const data = {}; document.querySelectorAll('.form-group__input').forEach(el => { if (el.id && el.type !== 'file') data[el.id] = el.value; });
    const canvases = {}; if (window.appCanvases) { for (let key in window.appCanvases) canvases[key] = window.appCanvases[key].toJSON(); }
    return { inputs: data, canvases };
};

const loadFormState = (payload) => {
    if (payload.inputs) { for (let key in payload.inputs) { const el = document.getElementById(key); if (el) el.value = payload.inputs[key]; } }
    if (payload.canvases && window.appCanvases) { for (let key in payload.canvases) if (window.appCanvases[key]) window.appCanvases[key].loadFromJSON(payload.canvases[key], window.appCanvases[key].renderAll.bind(window.appCanvases[key])); }
    if(typeof window.updatePhotoCount === 'function') ['misc', 'survey', 'access'].forEach(k => window.updatePhotoCount(k));
    if(window.showToast) window.showToast("Survey Loaded & Ready to Edit");
};

// Fetch & Load Drafts
let currentDrafts = {};
async function fetchCloudDrafts(uid) {
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

document.getElementById('loadCloudBtn')?.addEventListener('click', () => { 
    const id = document.getElementById('cloudDrafts').value; 
    if(id && currentDrafts[id]) {
        currentSurveyId = id; // Lock to this ID to update it
        const payload = currentDrafts[id].rawFormData || currentDrafts[id].data;
        if(payload) loadFormState(payload);
    }
});

// Command Center Sync
document.getElementById('btn-sync-v3')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-v3');
    btn.innerText = "Syncing..."; btn.disabled = true;

    try {
        const frontCanvas = document.getElementById('canvas-frontelevation') || document.getElementById('canvasFront');
        const fImg = frontCanvas && frontCanvas.hasAttribute('data-sniper') ? frontCanvas.getAttribute('data-sniper') : null;
        
        // Generate PIN only if new
        const existingPin = currentSurveyId && currentDrafts[currentSurveyId] ? currentDrafts[currentSurveyId].customerProfile?.vaultPIN : Math.floor(1000 + Math.random() * 9000).toString();
        
        // Target existing doc OR create a new one
        const docRef = currentSurveyId ? doc(db, "surveys", currentSurveyId) : doc(collection(db, "surveys"));
        
        await setDoc(docRef, {
            userId: auth.currentUser.uid,
            clientName: getValSafe('clientName', 'customerName') || 'Unnamed Lead',
            pipelineStatus: "1. Pre-Quote",
            rawFormData: getFormState(), // CRITICAL for reloading!
            customerProfile: {
                leadName: getValSafe('clientName', 'customerName'),
                postcode: getValSafe('postCode', 'input-postcode'),
                vaultPIN: existingPin,
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
            timestamps: { updatedAt: serverTimestamp() }
        }, { merge: true }); 
        
        currentSurveyId = docRef.id; // Lock to this new ID
        
        btn.innerText = "✅ Deployed to Dashboard";
        if(window.showToast) window.showToast("Successfully Saved!", true);
        setTimeout(() => { btn.innerText = "☁️ Sync to Command Center"; btn.disabled = false; }, 2000);
    } catch(err) { 
        console.error(err); 
        btn.innerText = "Sync Failed"; btn.disabled = false;
    }
});

// ==========================================
// 5. RESTORED PDF ENGINE (Extracted from Original Files)
// ==========================================

document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async () => {
    // 1. Initialize the correct JS constructor
    const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDF) return alert("PDF Engine is still loading. Please try again in a moment.");
    
    const btn = document.getElementById('generateCustomerPdfBtn');
    const originalText = btn.innerText;
    btn.innerText = "Compiling PDF... (Please Wait)"; 
    btn.disabled = true;

    try {
        // 2. Transfer Text Data to the PDF Template
        document.querySelectorAll('.bind-name').forEach(el => el.innerText = getValSafe('clientName', 'customerName') || 'Valued Customer');
        document.querySelectorAll('.bind-address').forEach(el => el.innerText = getValSafe('postCode', 'input-postcode') || 'Address TBC');
        
        const pdprint = document.getElementById('pdfPrintDesigner');
        if (pdprint) pdprint.innerText = window.currentUserProfile?.name || 'Lead Designer';

        const fields = [
            { source: ['buildType', 'input-build-type'], target: 'pdfBuildType' },
            { source: ['proposedSize', 'input-proposed-size'], target: 'pdfProposedSize' },
            { source: ['roofType', 'input-roof-type'], target: 'pdfRoofType' },
            { source: ['designerNotes', 'customerNotes'], target: 'pdfDesignerNotes' }
        ];

        fields.forEach(f => {
            const el = document.getElementById(f.target);
            if (el) el.innerText = getValSafe(f.source[0], f.source[1]) || '-';
        });

        // 3. CRITICAL RESTORATION: Transfer Drawing/Sniper Canvases to the PDF Template
        const syncCanvasToPdf = (canvasId, imgId) => {
            const canvas = document.getElementById(canvasId);
            const pdfImg = document.getElementById(imgId);
            if (canvas && pdfImg) {
                // Use Sniper high-res if available, else standard canvas capture
                if (canvas.hasAttribute('data-sniper')) {
                    pdfImg.src = canvas.getAttribute('data-sniper');
                } else {
                    pdfImg.src = canvas.toDataURL('image/jpeg', 0.8);
                }
            }
        };

        // Sync all possible views so the PDF displays the actual drawings
        syncCanvasToPdf('canvas-frontelevation', 'pdfImgFront');
        syncCanvasToPdf('canvas-rearelevation', 'pdfImgRear');
        syncCanvasToPdf('canvas-side1', 'pdfImgSide1');
        syncCanvasToPdf('canvas-side2', 'pdfImgSide2');
        syncCanvasToPdf('canvas-roof', 'pdfImgRoof');

        // 4. Reveal Template Safely to the Renderer
        const template = document.getElementById('pdfTemplateInternal');
        if (!template) throw new Error("PDF Template not found in HTML");
        
        template.style.display = 'block';
        template.style.position = 'fixed'; // Keeps it in the active viewport
        template.style.top = '0px';
        template.style.left = '0px';
        template.style.zIndex = '-9999';   // Hides it behind the app interface
        template.style.opacity = '1';

        // Brief pause to allow the DOM to render the injected images
        await new Promise(resolve => setTimeout(resolve, 500));

        // 5. Generate the Document
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pages = template.querySelectorAll('.pdf-page');

        for (let i = 0; i < pages.length; i++) {
            const canvas = await html2canvas(pages[i], { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                backgroundColor: "#ffffff"
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage();
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }

        // 6. Save File and Cleanup
        const client = getValSafe('clientName', 'customerName') || 'Customer';
        pdf.save(`${client}_Survey_Pack.pdf`);
        
        template.style.display = 'none';
        btn.innerText = "✅ PDF Downloaded!";

    } catch (err) {
        console.error("PDF Extraction Error:", err);
        alert("Failed to generate PDF. Make sure all files and libraries are fully loaded.");
    } finally {
        setTimeout(() => {
            btn.innerText = originalText; 
            btn.disabled = false;
        }, 3000);
    }
});
