import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- AUTO-INJECT PDF ENGINES ---
window.addEventListener('DOMContentLoaded', () => {
    if (!window.jspdf) { const s = document.createElement('script'); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; document.head.appendChild(s); }
    if (!window.html2canvas) { const s = document.createElement('script'); s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"; document.head.appendChild(s); }
});

const appConfig = { apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0", authDomain: "cohi-survey-engine.firebaseapp.com", projectId: "cohi-survey-engine" };
const app = !getApps().length ? initializeApp(appConfig) : getApp();
const auth = getAuth(app); 
const db = getFirestore(app);
window.db = db;

const getValSafe = (id1, id2) => {
    const el1 = document.getElementById(id1); const el2 = document.getElementById(id2);
    if(el1 && el1.value) return el1.value; if(el2 && el2.value) return el2.value; return '';
};

let currentSurveyId = null;
let currentDrafts = {};

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

// --- FIXED AGGRESSIVE DATA SCRAPER ---
const getFormState = () => {
    const data = {}; 
    // Grabs ALL inputs, selects, and textareas regardless of CSS class
    document.querySelectorAll('input:not([type="file"]):not([type="button"]), select, textarea').forEach(el => { 
        if (el.id) data[el.id] = el.value; 
    });
    const canvases = {}; 
    if (window.appCanvases) { for (let key in window.appCanvases) canvases[key] = window.appCanvases[key].toJSON(); }
    return { inputs: data, canvases };
};

async function fetchCloudDrafts(uid) {
    const q = query(collection(db, "surveys"), where("userId", "==", uid));
    try {
        const snap = await getDocs(q);
        const select = document.getElementById('cloudDrafts'); 
        if(select) {
            select.innerHTML = '<option value="">Load Previous Survey...</option>';
            snap.forEach((doc) => { 
                currentDrafts[doc.id] = doc.data(); 
                select.innerHTML += `<option value="${doc.id}">${doc.data().clientName || doc.data().customerProfile?.leadName || 'Unnamed Lead'}</option>`; 
            });
        }
    } catch (e) { console.error("Draft Fetch Error:", e); }
}

document.getElementById('loadCloudBtn')?.addEventListener('click', () => { 
    const id = document.getElementById('cloudDrafts').value; 
    if(!id || !currentDrafts[id]) return;
    
    currentSurveyId = id; 
    const draft = currentDrafts[id];
    
    // Aggressively target the payload wherever it is stored
    const payload = draft.rawFormData?.inputs || draft.data?.inputs || draft;

    for (let key in payload) { 
        const el = document.getElementById(key); 
        if (el && el.type !== 'file') el.value = payload[key]; 
    }

    if (draft.rawFormData?.canvases && window.appCanvases) { 
        for (let key in draft.rawFormData.canvases) {
            if (window.appCanvases[key]) window.appCanvases[key].loadFromJSON(draft.rawFormData.canvases[key], window.appCanvases[key].renderAll.bind(window.appCanvases[key])); 
        }
    }
    
    if(typeof window.updatePhotoCount === 'function') ['misc', 'survey', 'access'].forEach(k => window.updatePhotoCount(k));
    if(window.showToast) window.showToast("Survey Restored", true);
});

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
            rawFormData: getFormState(), // Uses the fixed aggressive scraper
            customerProfile: {
                leadName: getValSafe('clientName', 'customerName'),
                postcode: getValSafe('postCode', 'input-postcode'),
                vaultPIN: existingPin.toString(), // FORCES STRING TYPE
                designerId: window.currentUserProfile?.name || 'Designer'
            },
            technicalSurvey: {
                buildCategory: getValSafe('buildType', 'input-build-type'),
                roofSystem: getValSafe('roofType', 'input-roof-type'),
                proposedSizeSQM: getValSafe('proposedSize', 'input-proposed-size'),
                designerNotes: getValSafe('designerNotes', 'customerNotes')
            },
            rawAssets: { frontElevationImage: fImg, structuralVectors: window.sniperLogs || [] },
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

// --- PDF ENGINE ---
document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async () => {
    const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDF || !window.html2canvas) return alert("PDF Engine is initializing. Please wait 3 seconds and click again.");
    
    const btn = document.getElementById('generateCustomerPdfBtn');
    const originalText = btn.innerText;
    btn.innerText = "Compiling PDF..."; btn.disabled = true;

    const template = document.getElementById('pdfTemplateInternal');
    try {
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

        const copyCanvas = (sourceId, targetImgId) => {
            const canvas = document.getElementById(sourceId);
            const img = document.getElementById(targetImgId);
            if(canvas && img) {
                try { img.src = canvas.hasAttribute('data-sniper') ? canvas.getAttribute('data-sniper') : canvas.toDataURL('image/jpeg', 0.8); } 
                catch(e) { console.warn("Canvas block.", e); }
            }
        };
        copyCanvas('canvas-frontelevation', 'pdfImgFront');
        copyCanvas('canvas-rearelevation', 'pdfImgRear');
        copyCanvas('canvas-side1', 'pdfImgSide1');
        copyCanvas('canvas-side2', 'pdfImgSide2');

        if (!template) throw new Error("PDF Template missing!");
        
        template.style.display = 'block';
        template.style.position = 'fixed'; 
        template.style.top = '0px';
        template.style.left = '0px';
        template.style.width = '794px'; 
        template.style.zIndex = '-9999'; 
        template.style.background = '#ffffff';

        await new Promise(r => setTimeout(r, 800));

        const pdf = new jsPDF('p', 'pt', 'a4');
        const pages = template.querySelectorAll('.pdf-page');

        for (let i = 0; i < pages.length; i++) {
            const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", windowWidth: 794 });
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
        alert("Failed to generate PDF. Check console logs.");
        if(template) template.style.display = 'none';
    } finally {
        setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 3000);
    }
});
