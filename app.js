import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine"
};
const app = initializeApp(appConfig);
export const db = getFirestore(app);
const functions = getFunctions(app);

// --- TOAST NOTIFICATION UI & SPLASH SCREEN ---
window.showToast = function(msg, isSuccess = true) {
    let toast = document.getElementById('engineToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'engineToast';
        toast.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); padding: 12px 24px; color: #fff; border-radius: 8px; z-index: 99999; display: none; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.4); transition: opacity 0.3s; pointer-events: none;';
        document.body.appendChild(toast);
    }
    toast.style.background = isSuccess ? '#28a745' : '#ff9800';
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.style.display = 'none', 300); }, 3000);
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("[Diagnostics] Blueprint Enterprise Engine Initialized (V2 Hybrid).");
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        splash.style.opacity = '0';
        setTimeout(() => { splash.style.display = 'none'; document.getElementById('mainApp').style.display = 'block'; }, 600);
    }, 1200);
});

// --- ADMIN CSV LOGIC ---
document.getElementById('adminExportBtn')?.addEventListener('click', async () => {
    if(window.showToast) window.showToast("Compiling Report...", false);
    try {
        const snapshot = await getDocs(collection(db, "surveys"));
        let csv = "Date Saved,Designer ID,Client Name,Postcode,Build Type,Proposed Size\n";
        snapshot.forEach(doc => {
            const data = doc.data(), inputs = data.data?.inputs || {};
            const date = data.updatedAt ? new Date(data.updatedAt.toDate()).toLocaleDateString() : 'N/A';
            csv += `"${date}","${data.userId || ''}","${data.clientName || ''}","${inputs.postCode || ''}","${inputs.buildType || ''}","${inputs.proposedSize || ''}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Survey_Leads_Report.csv`; a.click();
        if(window.showToast) window.showToast("CSV Downloaded!", true);
    } catch (err) { console.error(err); if(window.showToast) window.showToast("Export Failed", false); }
});

// --- THE NEW PRECISION CANVAS ENGINE ---
const stage = document.getElementById('drafting-stage');
const imageLayer = document.getElementById('survey-image-layer');
const vectorCanvas = document.getElementById('vector-drawing-layer');
const ctx = vectorCanvas.getContext('2d');
const photo = document.getElementById('active-survey-photo');
const hudDrawer = document.getElementById('hud-drawer');

export const SurveyState = {
    imageIntrinsicWidth: 0, imageIntrinsicHeight: 0,
    vectors: [], activeAnchor: null, 
    scale: 1, offsetX: 0, offsetY: 0, isDragging: false, startX: 0, startY: 0
};

document.getElementById('btn-upload-photo').addEventListener('click', () => document.getElementById('hidden-file-input').click());

document.getElementById('hidden-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        photo.onload = () => {
            SurveyState.imageIntrinsicWidth = photo.naturalWidth;
            SurveyState.imageIntrinsicHeight = photo.naturalHeight;
            vectorCanvas.width = photo.naturalWidth;
            vectorCanvas.height = photo.naturalHeight;
            
            SurveyState.scale = Math.min(stage.clientWidth / photo.naturalWidth, stage.clientHeight / photo.naturalHeight);
            SurveyState.offsetX = (stage.clientWidth - photo.naturalWidth * SurveyState.scale) / 2;
            SurveyState.offsetY = (stage.clientHeight - photo.naturalHeight * SurveyState.scale) / 2;
            
            photo.style.display = 'block';
            updateViewport();
            window.showToast("Blueprint Loaded into Canvas", true);
        };
        photo.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Pan Engine
stage.addEventListener('pointerdown', e => {
    if(e.target.tagName === 'BUTTON' || e.target.closest('#hud-drawer')) return;
    SurveyState.isDragging = true;
    SurveyState.startX = e.clientX - SurveyState.offsetX;
    SurveyState.startY = e.clientY - SurveyState.offsetY;
});
stage.addEventListener('pointermove', e => {
    if (!SurveyState.isDragging) return;
    SurveyState.offsetX = e.clientX - SurveyState.startX;
    SurveyState.offsetY = e.clientY - SurveyState.startY;
    updateViewport();
});
stage.addEventListener('pointerup', () => SurveyState.isDragging = false);

// Zoom Engine
function changeZoom(delta) {
    if (!photo.src) return;
    const oldScale = SurveyState.scale;
    let newScale = oldScale * delta;
    if(newScale < 0.1) newScale = 0.1; 
    if(newScale > 10) newScale = 10;

    const centerX = stage.clientWidth / 2;
    const centerY = stage.clientHeight / 2;
    const imgX = (centerX - SurveyState.offsetX) / oldScale;
    const imgY = (centerY - SurveyState.offsetY) / oldScale;

    SurveyState.scale = newScale;
    SurveyState.offsetX = centerX - (imgX * SurveyState.scale);
    SurveyState.offsetY = centerY - (imgY * SurveyState.scale);
    updateViewport();
}
document.getElementById('btn-zoom-in').addEventListener('click', () => changeZoom(1.3));
document.getElementById('btn-zoom-out').addEventListener('click', () => changeZoom(0.7));

function updateViewport() {
    imageLayer.style.transform = `translate(${SurveyState.offsetX}px, ${SurveyState.offsetY}px) scale(${SurveyState.scale})`;
    renderVectors();
}

function getCrosshairRelativeCoordinate() {
    const centerX = stage.clientWidth / 2; const centerY = stage.clientHeight / 2;
    const imgX = (centerX - SurveyState.offsetX) / SurveyState.scale;
    const imgY = (centerY - SurveyState.offsetY) / SurveyState.scale;
    return { pctX: imgX / SurveyState.imageIntrinsicWidth, pctY: imgY / SurveyState.imageIntrinsicHeight };
}
// HUD Controls
document.getElementById('btn-anchor-point').addEventListener('click', () => {
    if (!SurveyState.imageIntrinsicWidth) { window.showToast("Load a blueprint first.", false); return; }
    const coords = getCrosshairRelativeCoordinate();
    const btn = document.getElementById('btn-anchor-point');

    if (!SurveyState.activeAnchor) {
        SurveyState.activeAnchor = coords;
        btn.innerHTML = "📏 Lock Endpoint";
        btn.classList.replace('bg-[#0dcaf0]', 'bg-[#10b981]');
    } else {
        SurveyState.tempEndpoint = coords;
        hudDrawer.classList.add('active');
        document.getElementById('input-measurement').focus();
    }
});

document.getElementById('btn-save-measurement').addEventListener('click', () => {
    const val = document.getElementById('input-measurement').value;
    if(!val) return;
    SurveyState.vectors.push({ id: Date.now(), value: val, type: document.getElementById('input-line-type').value, start: SurveyState.activeAnchor, end: SurveyState.tempEndpoint });
    SurveyState.activeAnchor = null; SurveyState.tempEndpoint = null;
    document.getElementById('input-measurement').value = '';
    hudDrawer.classList.remove('active');
    
    const btn = document.getElementById('btn-anchor-point');
    btn.innerHTML = "🎯 Anchor Start";
    btn.classList.replace('bg-[#10b981]', 'bg-[#0dcaf0]');
    renderVectors();
});

export function renderVectors() {
    ctx.clearRect(0, 0, vectorCanvas.width, vectorCanvas.height);
    SurveyState.vectors.forEach(v => {
        const startX = v.start.pctX * SurveyState.imageIntrinsicWidth; const startY = v.start.pctY * SurveyState.imageIntrinsicHeight;
        const endX = v.end.pctX * SurveyState.imageIntrinsicWidth; const endY = v.end.pctY * SurveyState.imageIntrinsicHeight;

        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
        ctx.strokeStyle = v.type === 'window' ? '#0dcaf0' : (v.type === 'wall' ? '#f59e0b' : '#10b981');
        ctx.lineWidth = Math.max(8, SurveyState.imageIntrinsicWidth * 0.005); ctx.stroke();

        ctx.fillStyle = 'rgba(15,23,42,0.85)';
        const midX = (startX + endX) / 2; const midY = (startY + endY) / 2;
        const pad = 20; const fontSize = Math.max(24, SurveyState.imageIntrinsicWidth * 0.015);
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        const textWidth = ctx.measureText(v.value).width;
        
        ctx.beginPath(); ctx.roundRect(midX - (textWidth/2) - pad, midY - (fontSize/2) - pad, textWidth + (pad*2), fontSize + (pad*2), 12); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v.value, midX, midY);
    });
}

// --- SYNC ENGINE: CRM CLIPBOARD & V3 VAULT ---
document.getElementById('btn-legacy-sync').addEventListener('click', () => {
    const clientName = document.getElementById('input-client-name').value || "Client"; 
    const postCode = document.getElementById('input-postcode').value || "N/A";
    const roofType = document.getElementById('input-roof-type').value || "Edwardian roof";
    const buildType = document.getElementById('input-build-type').value || "N/A";
    const size = document.getElementById('input-proposed-size').value || "N/A";
    const rawNotes = document.getElementById('input-notes').value || "None";
    
    const vectorList = SurveyState.vectors.map(v => `• ${v.type.toUpperCase()}: ${v.value}`).join('\n');
    
    const clipboardText = `
=== COHI CRM SURVEY EXPORT ===
DATE: ${new Date().toLocaleDateString()}
CLIENT: ${clientName}
POSTCODE: ${postCode}
BUILD: ${buildType} | ROOF: ${roofType} | SIZE: ${size}

--- STRUCTURAL VECTORS ---
${vectorList || 'No vectors drawn.'}

--- SITE NOTES ---
${rawNotes}
===============================`.trim();

    navigator.clipboard.writeText(clipboardText)
        .then(() => window.showToast("Text Exported to Clipboard!", true))
        .catch(() => window.showToast("Clipboard Access Denied.", false));
});

document.getElementById('btn-export-v3').addEventListener('click', async () => {
    const modal = document.getElementById('crm-bridge-modal');
    modal.classList.remove('hidden'); modal.classList.add('flex');
    
    const clientName = document.getElementById('input-client-name').value || "Client"; 
    const postCode = document.getElementById('input-postcode').value || "N/A";
    const designer = document.getElementById('input-designer').value;
    const roofType = document.getElementById('input-roof-type').value || "Edwardian roof";
    const buildType = document.getElementById('input-build-type').value;
    const size = document.getElementById('input-proposed-size').value;
    const rawNotes = document.getElementById('input-notes').value;
    
    let finalNotes = rawNotes;

    if (rawNotes.trim().length > 5) {
        document.getElementById('sync-status-text').innerText = "AI Polishing Site Notes...";
        try {
            const rewriteNotes = httpsCallable(functions, 'rewriteNotes');
            const result = await rewriteNotes({ rawText: rawNotes });
            finalNotes = result.data.polishedText;
        } catch (error) { console.warn("AI Polish offline."); }
    }

    document.getElementById('sync-status-text').innerText = "Creating V3 Customer Vault...";
    try {
        const newSurveyRef = await addDoc(collection(db, "surveys"), {
            clientName: clientName,
            userId: designer,
            updatedAt: serverTimestamp(),
            data: {
                inputs: {
                    postCode: postCode,
                    clientNum: document.getElementById('input-customer-num').value || "survey123",
                    _brand: document.getElementById('input-brand').value || "COHI",
                    _pipelineStatus: "1. Consultation & Survey",
                    roofType: roofType,
                    buildType: buildType,
                    proposedSize: size
                }
            },
            analytics: { loginCount: 0, totalTimeMinutes: 0 }
        });
        
        if(finalNotes) {
            await addDoc(collection(db, `surveys/${newSurveyRef.id}/internalNotes`), {
                content: finalNotes, visibility: 'external', timestamp: serverTimestamp()
            });
        }

        window.activeVaultSurveyId = newSurveyRef.id;
        window.showToast("Successfully Auto-Exported to V3!", true);

    } catch (err) {
        console.error(err);
        window.showToast("V3 Sync Failed", false);
    }
    
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 1000);
});

// Hook PDF Generation to the button
document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', () => {
    const roofType = document.getElementById('input-roof-type').value;
    window.PDFEngine.generate(SurveyState, roofType);
});
