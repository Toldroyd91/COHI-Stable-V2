import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// Backwards-Compatible Load Engine
const loadFormState = (payload) => {
    if (!payload) return;
    const dataToLoad = payload.inputs || payload;
    for (let key in dataToLoad) { 
        const el = document.getElementById(key); 
        if (el && el.type !== 'file') el.value = dataToLoad[key]; 
    }
    if (payload.canvases && window.appCanvases) { 
        for (let key in payload.canvases) {
            if (window.appCanvases[key]) window.appCanvases[key].loadFromJSON(payload.canvases[key], window.appCanvases[key].renderAll.bind(window.appCanvases[key])); 
        }
    }
    if(typeof window.updatePhotoCount === 'function') ['misc', 'survey', 'access'].forEach(k => window.updatePhotoCount(k));
    if(window.showToast) window.showToast("Survey Restored", true);
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
        currentSurveyId = id; 
        const draft = currentDrafts[id];
        const payload = draft.rawFormData || draft.data || draft;
        loadFormState(payload);
    }
});

// Command Center Sync
document.getElementById('btn-sync-v3')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-v3');
    btn.innerText = "Syncing..."; btn.disabled = true;

    try {
        const frontCanvas = document.getElementById('canvas-frontelevation') || document.getElementById('canvasFront');
        const fImg = frontCanvas && frontCanvas.hasAttribute('data-sniper') ? frontCanvas.getAttribute('data-sniper') : null;
        
        const existingPin = currentSurveyId && currentDrafts[currentSurveyId] ? currentDrafts[currentSurveyId].customerProfile?.vaultPIN : Math.floor(1000 + Math.random() * 9000).toString();
        const docRef = currentSurveyId ? doc(db, "surveys", currentSurveyId) : doc(collection(db, "surveys"));
        
        await setDoc(docRef, {
            userId: auth.currentUser.uid,
            clientName: getValSafe('clientName', 'customerName') || 'Unnamed Lead',
            pipelineStatus: "1. Pre-Quote",
            rawFormData: getFormState(), 
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
        
        currentSurveyId = docRef.id; 
        btn.innerText = "✅ Deployed to Dashboard";
        if(window.showToast) window.showToast("Successfully Saved!", true);
        setTimeout(() => { btn.innerText = "☁️ Sync to Command Center"; btn.disabled = false; }, 2000);
    } catch(err) { 
        console.error(err); 
        btn.innerText = "Sync Failed"; btn.disabled = false;
    }
});

// Bulletproof PDF Engine
document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async () => {
    const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDF) return alert("PDF Engine loading...");
    
    const btn = document.getElementById('generateCustomerPdfBtn');
    const originalText = btn.innerText;
    btn.innerText = "Compiling PDF..."; btn.disabled = true;

    try {
        // Text Mapping
        document.querySelectorAll('.bind-name').forEach(el => el.innerText = getValSafe('clientName', 'customerName') || 'Customer');
        document.querySelectorAll('.bind-address').forEach(el => el.innerText = getValSafe('postCode', 'input-postcode') || 'TBC');
        
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

        // Image Mapping
        const copyCanvas = (sourceId, targetImgId) => {
            const canvas = document.getElementById(sourceId);
            const img = document.getElementById(targetImgId);
            if(canvas && img) {
                img.src = canvas.hasAttribute('data-sniper') ? canvas.getAttribute('data-sniper') : canvas.toDataURL('image/jpeg', 0.8);
            }
        };
        copyCanvas('canvas-frontelevation', 'pdfImgFront');
        copyCanvas('canvas-rearelevation', 'pdfImgRear');
        copyCanvas('canvas-side1', 'pdfImgSide1');
        copyCanvas('canvas-side2', 'pdfImgSide2');

        // Forced Viewport Rendering
        const template = document.getElementById('pdfTemplateInternal');
        template.style.display = 'block';
        template.style.position = 'absolute';
        template.style.top = '0px';
        template.style.left = '0px';
        template.style.width = '794px'; 
        template.style.zIndex = '-9999'; 
        template.style.background = '#ffffff';

        await new Promise(r => setTimeout(r, 600));

        // Capture & Save
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pages = template.querySelectorAll('.pdf-page');

        for (let i = 0; i < pages.length; i++) {
            const canvas = await html2canvas(pages[i], { 
                scale: 2, 
                useCORS: true, 
                allowTaint: true,
                backgroundColor: "#ffffff",
                windowWidth: 794
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage();
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }

        pdf.save(`${getValSafe('clientName', 'customerName') || 'Customer'}_Pack.pdf`);
        template.style.display = 'none';
        btn.innerText = "✅ Downloaded!";

    } catch (err) {
        console.error("PDF Error:", err);
        alert("Failed to generate PDF. Make sure all images are loaded.");
    } finally {
        setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 3000);
    }
});
