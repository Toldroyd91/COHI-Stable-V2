import { auth, db, doc, setDoc, getDoc, collection, serverTimestamp, onAuthStateChanged, signOut } from './firebase-core.js';
import { generateSurveyPDF } from './pdf-engine.js';

let currentSurveyId = new URLSearchParams(window.location.search).get('id');

const getVal = (id1, id2) => document.getElementById(id1)?.value || document.getElementById(id2)?.value || '';
const setVal = (id1, id2, val) => {
    if(document.getElementById(id1)) document.getElementById(id1).value = val || '';
    if(document.getElementById(id2)) document.getElementById(id2).value = val || '';
};

// 1. UNIVERSAL LOAD ENGINE
async function loadSurvey() {
    if(!currentSurveyId) return;
    try {
        const snap = await getDoc(doc(db, "surveys", currentSurveyId));
        if(!snap.exists()) return;
        const data = snap.data();
        
        // Map deeply nested UI elements
        setVal('clientName', 'customerName', data.customerProfile?.leadName);
        setVal('postCode', 'input-postcode', data.customerProfile?.postcode);
        setVal('buildType', 'input-build-type', data.technicalSurvey?.buildCategory);
        setVal('roofType', 'input-roof-type', data.technicalSurvey?.roofSystem);
        setVal('proposedSize', 'input-proposed-size', data.technicalSurvey?.proposedSizeSQM);
        setVal('designerNotes', 'customerNotes', data.technicalSurvey?.designerNotes);

        // Map Canvas Assets
        if (data.rawAssets?.frontElevationImage) {
            const fImg = document.getElementById('canvas-frontelevation') || document.getElementById('canvasFront');
            if (fImg) fImg.setAttribute('data-sniper', data.rawAssets.frontElevationImage);
        }
        if(window.showToast) window.showToast("Survey Loaded", true);
    } catch(e) { console.error(e); }
}

// 2. UNIVERSAL SYNC ENGINE
document.getElementById('btn-sync-v3')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-v3');
    const ogText = btn.innerText; btn.innerText = "Syncing..."; btn.disabled = true;

    try {
        const fImg = document.getElementById('canvas-frontelevation')?.getAttribute('data-sniper') || null;
        const docRef = currentSurveyId ? doc(db, "surveys", currentSurveyId) : doc(collection(db, "surveys"));
        
        const payload = {
            customerProfile: {
                leadName: getVal('clientName', 'customerName'),
                postcode: getVal('postCode', 'input-postcode'),
                vaultPIN: Math.floor(1000 + Math.random() * 9000).toString() // Auto-generates a secure 4-digit PIN
            },
            technicalSurvey: {
                buildCategory: getVal('buildType', 'input-build-type'),
                roofSystem: getVal('roofType', 'input-roof-type'),
                proposedSizeSQM: getVal('proposedSize', 'input-proposed-size'),
                designerNotes: getVal('designerNotes', 'customerNotes')
            },
            rawAssets: { frontElevationImage: fImg, structuralVectors: window.sniperLogs || [] },
            timestamps: { updatedAt: serverTimestamp() }
        };

        if(!currentSurveyId) {
            payload.pipelineStatus = "1. Pre-Quote";
            payload.vaultTelemetry = { lastActive: Date.now(), opens: 0 };
            payload.timestamps.createdAt = serverTimestamp();
        }

        await setDoc(docRef, payload, { merge: true });
        currentSurveyId = docRef.id;
        
        if(window.showToast) window.showToast("Deployed to Command Center", true);
    } finally {
        btn.innerText = ogText; btn.disabled = false;
    }
});

// 3. PDF TRIGGER (UPDATED WITH DATA, IMAGES, & PAMPHLETS)
document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('generateCustomerPdfBtn');
    btn.innerText = "Compiling Pack..."; btn.disabled = true;
    
    // 3A. Force Text Data into the Hidden PDF Template
    const mapToPDF = (inputId, pdfId) => {
        const el = document.getElementById(pdfId);
        if (el) el.innerText = document.getElementById(inputId)?.value || '-';
    };
    
    document.querySelectorAll('.bind-name').forEach(el => el.innerText = getVal('clientName', 'customerName'));
    document.querySelectorAll('.bind-address').forEach(el => el.innerText = getVal('postCode', 'input-postcode'));
    
    mapToPDF('buildType', 'pdfBuildType');
    mapToPDF('roofType', 'pdfRoofType');
    mapToPDF('proposedSize', 'pdfProposedSize');
    mapToPDF('designerNotes', 'pdfDesignerNotes');

    // 3B. Force Canvas Drawings into the PDF Template
    const syncImageToPDF = (canvasId, pdfImgId) => {
        const canvas = document.getElementById(canvasId);
        const pdfImg = document.getElementById(pdfImgId);
        if (canvas && pdfImg) {
            pdfImg.src = canvas.hasAttribute('data-sniper') ? canvas.getAttribute('data-sniper') : canvas.toDataURL('image/jpeg', 0.8);
        }
    };
    syncImageToPDF('canvas-frontelevation', 'pdfImgFront');
    syncImageToPDF('canvas-rearelevation', 'pdfImgRear');
    syncImageToPDF('canvas-side1', 'pdfImgSide1');
    syncImageToPDF('canvas-side2', 'pdfImgSide2');

    // 3C. Pamphlet Logic (Checks if boxes are ticked, turns on hidden PDF pages)
    const togglePamphlet = (checkboxId, pdfPageClass) => {
        const isChecked = document.getElementById(checkboxId)?.checked;
        const pdfPages = document.querySelectorAll(`.${pdfPageClass}`);
        pdfPages.forEach(page => {
            page.style.display = isChecked ? 'block' : 'none';
        });
    };
    
    // Make sure these IDs match your actual HTML checkboxes!
    togglePamphlet('check-thermal', 'pdf-pamphlet-thermal');
    togglePamphlet('check-roof', 'pdf-pamphlet-roof');
    togglePamphlet('check-bifold', 'pdf-pamphlet-bifold');

    // 3D. Generate the PDF
    await generateSurveyPDF(getVal('clientName', 'customerName'));
    
    btn.innerText = "✅ Downloaded";
    setTimeout(() => { btn.innerText = "Export PDF Pack"; btn.disabled = false; }, 3000);
});

// Initialize
onAuthStateChanged(auth, user => { if(user) loadSurvey(); });
