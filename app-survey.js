import { app, auth, db, doc, setDoc, getDoc, collection, serverTimestamp, onAuthStateChanged, signOut } from './firebase-core.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { generateSurveyPDF } from './pdf-engine.js';

let currentSurveyId = new URLSearchParams(window.location.search).get('id');

const getVal = (id1, id2) => document.getElementById(id1)?.value || document.getElementById(id2)?.value || '';
const setVal = (id1, id2, val) => {
    if(document.getElementById(id1)) document.getElementById(id1).value = val || '';
    if(document.getElementById(id2)) document.getElementById(id2).value = val || '';
};

// --- 1. UNIVERSAL LOAD ENGINE ---
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
    } catch(e) { console.error("Load Error:", e); }
}

// --- 2. UNIVERSAL SYNC ENGINE (WITH FULL PAMPHLET SUITE) ---
document.getElementById('btn-sync-v3')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-v3');
    const ogText = btn.innerText; 
    btn.innerText = "Syncing to Cloud..."; 
    btn.disabled = true;

    try {
        const fImg = document.getElementById('canvas-frontelevation')?.getAttribute('data-sniper') || null;
        const docRef = currentSurveyId ? doc(db, "surveys", currentSurveyId) : doc(collection(db, "surveys"));
        
        const payload = {
            customerProfile: {
                leadName: getVal('clientName', 'customerName'),
                postcode: getVal('postCode', 'input-postcode'),
                vaultPIN: Math.floor(1000 + Math.random() * 9000).toString() 
            },
            technicalSurvey: {
                buildCategory: getVal('buildType', 'input-build-type'),
                roofSystem: getVal('roofType', 'input-roof-type'),
                proposedSizeSQM: getVal('proposedSize', 'input-proposed-size'),
                designerNotes: getVal('designerNotes', 'customerNotes')
            },
            pamphlets: {
                piling: document.getElementById('check-piling')?.checked || false,
                sap: document.getElementById('check-sap')?.checked || false,
                journey: document.getElementById('check-journey')?.checked || false,
                journey1: document.getElementById('check-journey1')?.checked || false,
                journey2: document.getElementById('check-journey2')?.checked || false,
                planning: document.getElementById('check-planning')?.checked || false,
                protecting: document.getElementById('check-protecting')?.checked || false,
                tailored: document.getElementById('check-tailored')?.checked || false,
                whoweare: document.getElementById('check-whoweare')?.checked || false,
                whychooseus: document.getElementById('check-whychooseus')?.checked || false
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
    } catch (err) {
        console.error("Sync Error:", err);
        alert("Failed to sync to database.");
    } finally {
        btn.innerText = ogText; 
        btn.disabled = false;
    }
});

// --- 3. PDF TRIGGER (WITH FULL DATA, SNIPER & PAMPHLET CAPTURE) ---
document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('generateCustomerPdfBtn');
    btn.innerText = "Finalizing PDF Pack..."; 
    btn.disabled = true;

    // A. Map all text fields to the hidden template
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

    // B. Map Sniper Canvas Previews
    const syncSniper = (id) => {
        const preview = document.querySelector(`#${id} .sniper-preview-img`);
        const target = document.getElementById(`pdf-img-${id}`);
        if (preview && target) target.src = preview.src;
    };
    syncSniper('canvas-frontelevation');
    syncSniper('canvas-rearelevation');

    // C. Toggle Full Suite Brochure Visibility
    ['piling', 'sap', 'journey', 'journey1', 'journey2', 'planning', 'protecting', 'tailored', 'whoweare', 'whychooseus'].forEach(brochure => {
        const isChecked = document.getElementById(`check-${brochure}`)?.checked;
        const page = document.querySelector(`.pdf-pamphlet-${brochure}`);
        if(page) page.style.display = isChecked ? 'block' : 'none';
    });

    // D. Generate the PDF
    await generateSurveyPDF(getVal('clientName', 'customerName'));
    
    btn.innerText = "✅ Pack Generated";
    setTimeout(() => { btn.innerText = "Export PDF Pack"; btn.disabled = false; }, 3000);
});

// --- 4. GEMINI AI NOTES ENGINE ---
document.getElementById('btn-ai-polish')?.addEventListener('click', async () => {
    const notesInput = document.getElementById('designerNotes') || document.getElementById('customerNotes');
    const rawText = notesInput?.value.trim();
    if (!rawText) return alert("Please enter some rough notes first.");

    const btn = document.getElementById('btn-ai-polish');
    const ogText = btn.innerText;
    btn.innerText = "✨ Polishing AI..."; 
    btn.disabled = true;

    try {
        const functions = getFunctions(app);
        const rewriteNotes = httpsCallable(functions, 'rewriteNotes');
        
        const result = await rewriteNotes({ rawText: rawText });
        
        if (result.data && result.data.polishedText) {
            notesInput.value = result.data.polishedText;
            if(window.showToast) window.showToast("Notes Polished!", true);
        }
    } catch (error) {
        console.error("AI Engine Error:", error);
        alert("AI processing failed. Check console or internet connection.");
    } finally {
        btn.innerText = ogText; 
        btn.disabled = false;
    }
});

// --- INITIALIZE ---
onAuthStateChanged(auth, user => { if(user) loadSurvey(); });
