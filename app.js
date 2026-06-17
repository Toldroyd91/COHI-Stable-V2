import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// COHI Firebase Init
const appConfig = {
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0",
    authDomain: "cohi-survey-engine.firebaseapp.com",
    projectId: "cohi-survey-engine"
};
const app = initializeApp(appConfig);
const functions = getFunctions(app);

// Service Worker Registration (From your sw.js)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
    .then((reg) => console.log('COHI SW Registered', reg.scope))
    .catch((err) => console.log('SW Registration failed', err));
}

// Drafting State Architecture
const stage = document.getElementById('drafting-stage');
const imageLayer = document.getElementById('survey-image-layer');
const vectorCanvas = document.getElementById('vector-drawing-layer');
const ctx = vectorCanvas.getContext('2d');
const photo = document.getElementById('active-survey-photo');
const hudDrawer = document.getElementById('hud-drawer');

export const SurveyState = {
    imageIntrinsicWidth: 0,
    imageIntrinsicHeight: 0,
    vectors: [], 
    activeAnchor: null, 
    scale: 1, offsetX: 0, offsetY: 0, isDragging: false, startX: 0, startY: 0
};

// --- 1. SMART IMAGE UPLOAD (w/ Cloudinary scaling prep) ---
document.getElementById('btn-upload-photo').addEventListener('click', () => {
    document.getElementById('hidden-file-input').click();
});

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
            
            // Auto-fit viewport
            SurveyState.scale = Math.min(window.innerWidth / photo.naturalWidth, window.innerHeight / photo.naturalHeight);
            SurveyState.offsetX = (window.innerWidth - photo.naturalWidth * SurveyState.scale) / 2;
            SurveyState.offsetY = (window.innerHeight - photo.naturalHeight * SurveyState.scale) / 2;
            
            photo.style.display = 'block';
            updateViewport();
        };
        photo.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// --- 2. THE PAN-TO-ANCHOR ENGINE (No Finger Offset) ---
stage.addEventListener('pointerdown', e => {
    // Prevent dragging when clicking UI elements
    if(e.target.tagName === 'BUTTON' || e.target.closest('#hud-drawer') || e.target.closest('header')) return;
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

function updateViewport() {
    imageLayer.style.transform = `translate(${SurveyState.offsetX}px, ${SurveyState.offsetY}px) scale(${SurveyState.scale})`;
    renderVectors();
}

function getCrosshairRelativeCoordinate() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const imgX = (centerX - SurveyState.offsetX) / SurveyState.scale;
    const imgY = (centerY - SurveyState.offsetY) / SurveyState.scale;
    return { pctX: imgX / SurveyState.imageIntrinsicWidth, pctY: imgY / SurveyState.imageIntrinsicHeight };
}

// --- 3. HUD DRAWER LOGIC ---
document.getElementById('btn-anchor-point').addEventListener('click', () => {
    if (!SurveyState.imageIntrinsicWidth) { alert("Please load an image first."); return; }
    
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

    SurveyState.vectors.push({
        id: Date.now(), value: val, type: document.getElementById('input-line-type').value,
        start: SurveyState.activeAnchor, end: SurveyState.tempEndpoint
    });

    SurveyState.activeAnchor = null; SurveyState.tempEndpoint = null;
    document.getElementById('input-measurement').value = '';
    hudDrawer.classList.remove('active');
    
    const btn = document.getElementById('btn-anchor-point');
    btn.innerHTML = "🎯 Anchor Start";
    btn.classList.replace('bg-[#10b981]', 'bg-[#0dcaf0]');
    
    renderVectors();
});

// Render mathematics (100% intrinsic scale)
export function renderVectors() {
    ctx.clearRect(0, 0, vectorCanvas.width, vectorCanvas.height);
    SurveyState.vectors.forEach(v => {
        const startX = v.start.pctX * SurveyState.imageIntrinsicWidth; const startY = v.start.pctY * SurveyState.imageIntrinsicHeight;
        const endX = v.end.pctX * SurveyState.imageIntrinsicWidth; const endY = v.end.pctY * SurveyState.imageIntrinsicHeight;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = v.type === 'window' ? '#0dcaf0' : (v.type === 'wall' ? '#f59e0b' : '#10b981');
        ctx.lineWidth = Math.max(8, SurveyState.imageIntrinsicWidth * 0.005); 
        ctx.stroke();

        ctx.fillStyle = 'rgba(15,23,42,0.85)';
        const midX = (startX + endX) / 2; const midY = (startY + endY) / 2;
        const pad = 20; const fontSize = Math.max(24, SurveyState.imageIntrinsicWidth * 0.015);
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        const textWidth = ctx.measureText(v.value).width;
        
        ctx.beginPath();
        ctx.roundRect(midX - (textWidth/2) - pad, midY - (fontSize/2) - pad, textWidth + (pad*2), fontSize + (pad*2), 12);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(v.value, midX, midY);
    });
}

// --- 4. LEGACY CRM BRIDGE & GEMINI AI SYNC ---
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
    const originalText = btn.innerText;
    btn.innerText = "Analyzing & Syncing...";
    
    // Explicit Default Fallbacks for specific user parameters
    const clientName = document.getElementById('crm-client-name').value || "Mr. Dall"; 
    const postCode = document.getElementById('crm-postcode').value || "Not Specified";
    const roughNotes = document.getElementById('crm-rough-notes').value;
    const roofType = document.getElementById('survey-roof-type').value;
    
    let finalNotes = roughNotes;

    // Trigger your index.js cloud function
    if (roughNotes.trim().length > 5) {
        try {
            const rewriteNotes = httpsCallable(functions, 'rewriteNotes');
            const result = await rewriteNotes({ rawText: roughNotes });
            finalNotes = result.data.polishedText;
        } catch (error) {
            console.warn("AI Polish offline. Using raw input.");
        }
    }

    const vectorList = SurveyState.vectors.map(v => `• ${v.type.toUpperCase()}: ${v.value}`).join('\n');
    
    const clipboardText = `
=== CO HOME IMPROVEMENTS SURVEY ===
DATE: ${new Date().toLocaleDateString()}
CLIENT: ${clientName}
POSTCODE: ${postCode}
ROOF TYPE: ${roofType}
SURVEYOR: Tom

--- STRUCTURAL VECTORS ---
${vectorList || 'No structural vectors recorded.'}

--- ARCHITECTURAL OBSERVATIONS ---
${finalNotes || 'No specific observations recorded.'}
===================================
    `.trim();

    try {
        await navigator.clipboard.writeText(clipboardText);
        btn.innerText = "Synced to Clipboard!";
        btn.classList.replace('bg-[#10b981]', 'bg-[#0dcaf0]');
    } catch (err) {
        btn.innerText = "Clipboard Error";
    }
    
    setTimeout(() => { 
        btn.innerText = originalText; 
        btn.classList.replace('bg-[#0dcaf0]', 'bg-[#10b981]');
        document.getElementById('crm-bridge-modal').classList.add('hidden');
        document.getElementById('crm-bridge-modal').classList.remove('flex');
    }, 2500);
});

// Hook PDF Generation
document.getElementById('btn-generate-pdf').addEventListener('click', () => {
    const roofType = document.getElementById('survey-roof-type').value;
    window.PDFEngine.generate(SurveyState, roofType);
});
