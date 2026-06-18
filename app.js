import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// COHI Firebase Init
const appConfig = { apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0", authDomain: "cohi-survey-engine.firebaseapp.com", projectId: "cohi-survey-engine" };
const app = initializeApp(appConfig);
export const db = getFirestore(app);
const functions = getFunctions(app);

// Tab Switching Logic
const tabForm = document.getElementById('tab-form');
const tabCanvas = document.getElementById('tab-canvas');
const viewForm = document.getElementById('view-form');
const viewCanvas = document.getElementById('view-canvas');

function switchTab(target) {
    viewForm.classList.remove('active'); viewCanvas.classList.remove('active');
    tabForm.classList.replace('bg-slate-700', 'bg-transparent'); tabForm.classList.replace('text-white', 'text-slate-400'); tabForm.classList.remove('shadow');
    tabCanvas.classList.replace('bg-slate-700', 'bg-transparent'); tabCanvas.classList.replace('text-white', 'text-slate-400'); tabCanvas.classList.remove('shadow');

    if(target === 'form') {
        viewForm.classList.add('active');
        tabForm.classList.add('bg-slate-700', 'text-white', 'shadow'); tabForm.classList.remove('text-slate-400');
    } else {
        viewCanvas.classList.add('active');
        tabCanvas.classList.add('bg-slate-700', 'text-white', 'shadow'); tabCanvas.classList.remove('text-slate-400');
        if(photo.src) updateViewport(); // Refresh canvas render on load
    }
}
tabForm.addEventListener('click', () => switchTab('form'));
tabCanvas.addEventListener('click', () => switchTab('canvas'));

// --- MULTI-IMAGE GALLERY LOGIC ---
export const SurveyState = {
    images: [], // Stores multiple base64 images
    activeImageIndex: -1,
    imageIntrinsicWidth: 0, imageIntrinsicHeight: 0,
    vectors: {}, // Maps image index to an array of vectors
    activeAnchor: null, 
    scale: 1, offsetX: 0, offsetY: 0, isDragging: false, startX: 0, startY: 0
};

const photoGallery = document.getElementById('photo-gallery');

document.getElementById('btn-add-photos').addEventListener('click', () => document.getElementById('hidden-multi-upload').click());

document.getElementById('hidden-multi-upload').addEventListener('change', e => {
    const files = Array.from(e.target.files);
    if(files.length > 0 && SurveyState.images.length === 0) photoGallery.innerHTML = ''; // clear placeholder

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const b64 = event.target.result;
            const newIndex = SurveyState.images.length;
            SurveyState.images.push(b64);
            SurveyState.vectors[newIndex] = []; // initialize vector array for this photo
            
            // Add thumbnail to gallery
            const thumb = document.createElement('div');
            thumb.className = "aspect-square rounded-xl bg-cover bg-center cursor-pointer border-2 border-transparent hover:border-[#0dcaf0] transition overflow-hidden relative";
            thumb.style.backgroundImage = `url(${b64})`;
            thumb.innerHTML = `<div class="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-center py-1">Draft</div>`;
            
            thumb.onclick = () => loadPhotoToCanvas(newIndex);
            photoGallery.appendChild(thumb);
        };
        reader.readAsDataURL(file);
    });
});

// --- CANVAS ENGINE (WITH ZOOM FIX) ---
const stage = document.getElementById('drafting-stage');
const imageLayer = document.getElementById('survey-image-layer');
const vectorCanvas = document.getElementById('vector-drawing-layer');
const ctx = vectorCanvas.getContext('2d');
const photo = document.getElementById('active-survey-photo');
const hudDrawer = document.getElementById('hud-drawer');

function loadPhotoToCanvas(index) {
    SurveyState.activeImageIndex = index;
    photo.onload = () => {
        SurveyState.imageIntrinsicWidth = photo.naturalWidth;
        SurveyState.imageIntrinsicHeight = photo.naturalHeight;
        vectorCanvas.width = photo.naturalWidth;
        vectorCanvas.height = photo.naturalHeight;
        
        // Initial fit-to-screen scale
        SurveyState.scale = Math.min(window.innerWidth / photo.naturalWidth, window.innerHeight / photo.naturalHeight);
        SurveyState.offsetX = (window.innerWidth - photo.naturalWidth * SurveyState.scale) / 2;
        SurveyState.offsetY = (window.innerHeight - photo.naturalHeight * SurveyState.scale) / 2;
        
        photo.style.display = 'block';
        updateViewport();
        switchTab('canvas');
    };
    photo.src = SurveyState.images[index];
}

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

// --- THE ZOOM ENGINE ---
function changeZoom(delta) {
    if (!photo.src || SurveyState.activeImageIndex === -1) return;
    
    const oldScale = SurveyState.scale;
    let newScale = oldScale * delta;
    
    // Limits
    if(newScale < 0.05) newScale = 0.05; 
    if(newScale > 5) newScale = 5;

    // Mathematical center zoom calculation
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

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
    const centerX = window.innerWidth / 2; const centerY = window.innerHeight / 2;
    const imgX = (centerX - SurveyState.offsetX) / SurveyState.scale;
    const imgY = (centerY - SurveyState.offsetY) / SurveyState.scale;
    return { pctX: imgX / SurveyState.imageIntrinsicWidth, pctY: imgY / SurveyState.imageIntrinsicHeight };
}

// HUD & Anchors
document.getElementById('btn-anchor-point').addEventListener('click', () => {
    if (SurveyState.activeImageIndex === -1) { alert("Select a photo from the Form Data gallery first."); return; }
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

    SurveyState.vectors[SurveyState.activeImageIndex].push({ id: Date.now(), value: val, type: document.getElementById('input-line-type').value, start: SurveyState.activeAnchor, end: SurveyState.tempEndpoint });
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
    if(SurveyState.activeImageIndex === -1) return;

    const currentVectors = SurveyState.vectors[SurveyState.activeImageIndex] || [];
    
    currentVectors.forEach(v => {
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

// --- FULL FORM DATA AGGREGATION & EXPORT ---
document.getElementById('btn-legacy-sync').addEventListener('click', () => {
    document.getElementById('crm-bridge-modal').classList.remove('hidden');
    document.getElementById('crm-bridge-modal').classList.add('flex');
});
document.getElementById('btn-cancel-sync').addEventListener('click', () => {
    document.getElementById('crm-bridge-modal').classList.add('hidden');
    document.getElementById('crm-bridge-modal').classList.remove('flex');
});

document.getElementById('btn-execute-sync').addEventListener('click', async () => {
    const btn = document.getElementById('btn-execute-sync');
    btn.innerText = "Syncing...";
    
    // Gather ALL Form Data
    const clientName = document.getElementById('input-client-name').value || "Mr. Dall"; 
    const postCode = document.getElementById('input-postcode').value || "N/A";
    const roofType = document.getElementById('input-roof-type').value;
    const uValue = document.getElementById('input-uvalue').value || "N/A";
    const roughNotes = document.getElementById('input-notes').value;
    
    let finalNotes = roughNotes;
    if (roughNotes.trim().length > 5) {
        try {
            const rewriteNotes = httpsCallable(functions, 'rewriteNotes');
            const result = await rewriteNotes({ rawText: roughNotes });
            finalNotes = result.data.polishedText;
        } catch (error) { console.warn("AI Polish offline."); }
    }

    // Aggregate ALL Vectors from ALL Photos
    let allVectorsText = [];
    Object.keys(SurveyState.vectors).forEach(imgIdx => {
        SurveyState.vectors[imgIdx].forEach(v => allVectorsText.push(`• ${v.type.toUpperCase()}: ${v.value}`));
    });

    try {
        const newSurveyRef = await addDoc(collection(db, "surveys"), {
            clientName: clientName,
            data: {
                inputs: {
                    postCode: postCode, clientNum: "survey123", _brand: "COHI", 
                    _pipelineStatus: "1. Consultation & Survey", roofType: roofType, uValue: uValue
                }
            },
            analytics: { loginCount: 0, totalTimeMinutes: 0 }
        });
        
        if(finalNotes) { await addDoc(collection(db, `surveys/${newSurveyRef.id}/internalNotes`), { content: finalNotes, visibility: 'external', timestamp: serverTimestamp() }); }
        window.activeVaultSurveyId = newSurveyRef.id;
    } catch (err) { console.error(err); }

    const clipboardText = `
=== COHI SURVEY DATA ===
CLIENT: ${clientName} | POST: ${postCode}
ROOF: ${roofType} | U-VAL: ${uValue}
PHOTOS ATTACHED: ${SurveyState.images.length}

--- MEASUREMENTS ---
${allVectorsText.join('\\n') || 'None recorded.'}

--- OBSERVATIONS ---
${finalNotes || 'None recorded.'}
========================`.trim();

    try { await navigator.clipboard.writeText(clipboardText); } catch (err) {}
    
    btn.innerText = "Vault Synced & Copied!";
    btn.classList.replace('bg-[#10b981]', 'bg-[#0dcaf0]');
    setTimeout(() => { 
        document.getElementById('crm-bridge-modal').classList.add('hidden'); document.getElementById('crm-bridge-modal').classList.remove('flex');
        btn.innerText = "Sync to V3 & CRM"; btn.classList.replace('bg-[#0dcaf0]', 'bg-[#10b981]');
    }, 2000);
});

// PDF Gen Hook
document.getElementById('btn-generate-pdf').addEventListener('click', () => {
    const roofType = document.getElementById('input-roof-type').value;
    window.PDFEngine.generate(SurveyState, roofType);
});
