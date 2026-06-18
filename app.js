// --- TOAST NOTIFICATION UI ---
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
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.style.display = 'none', 300);
    }, 3000);
};

document.addEventListener('DOMContentLoaded', function() {
    console.log("[Diagnostics] Blueprint Enterprise Engine Initialized (V4 Exact Fit).");
    let jsPDF = window.jspdf ? window.jspdf.jsPDF : null;

    // --- PHOTO MANAGEMENT UTILS ---
    window.uploadedImagesStore = { misc: [], survey: [], access: [] };
    
    window.updatePhotoCount = function(storeKey) {
        const badge = document.getElementById(`count-${storeKey}`);
        if(badge) {
            const count = window.uploadedImagesStore[storeKey].length;
            badge.innerText = count > 0 ? `(${count})` : '';
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
    };

    window.clearPhotos = function(storeKey) {
        if(confirm(`Clear all ${storeKey} photos?`)) {
            window.uploadedImagesStore[storeKey] = [];
            window.updatePhotoCount(storeKey);
            triggerAutoSave();
        }
    };

    // --- 1. CONTINUOUS AUTOSAVE (V3 CRM UPGRADED) ---
    let autoSaveTimeout;
    const triggerAutoSave = () => {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            const data = {};
            document.querySelectorAll('input:not([type="file"]):not(.pamphlet-cb), select, textarea').forEach(input => { 
                if(input.id) data[input.id] = input.value; 
            });

            // --- POWERHOUSE METADATA INJECTION ---
            // This silently prepares the data for the multi-brand V3 Command Center
            data['_brandTag'] = document.getElementById('companyBrand')?.value || "CO Home Improvements"; 
            data['_designerName'] = "Tom";
            data['_lastContacted'] = Date.now(); // Powers the Green/Amber/Red status
            data['_pipelineStatus'] = "Pre-Quote"; 
            
            // Terminology lock
            if (data['roofType'] && data['roofType'].toLowerCase().includes('edwardian room')) {
                data['roofType'] = 'Edwardian roof';
            }

            localStorage.setItem('surveyAppData', JSON.stringify(data));
            if(window.performCloudAutoSave) window.performCloudAutoSave();
        }, 1000); 
    };

    const savedData = JSON.parse(localStorage.getItem('surveyAppData')) || {};
    document.querySelectorAll('input:not([type="file"]):not(.pamphlet-cb), select, textarea').forEach(input => {
        if (input.id && savedData[input.id]) input.value = savedData[input.id];
        input.addEventListener('input', triggerAutoSave);
    });

    document.getElementById('resetFormBtn')?.addEventListener('click', () => {
        if(confirm("Clear all data for a new appointment?")) { 
            localStorage.removeItem('surveyAppData'); 
            window.uploadedImagesStore = { misc: [], survey: [], access: [] };
            location.reload(); 
        }
    });

    // --- 2. SMART PAMPHLET AUTO-TICKERS ---
    document.getElementById('planningPerms')?.addEventListener('change', (e) => {
        const cb = document.getElementById('cb-planning');
        if(cb) cb.checked = (e.target.value !== 'No' && e.target.value !== '');
    });
    document.getElementById('sapCalcs')?.addEventListener('change', (e) => {
        const cb = document.getElementById('cb-sap');
        if(cb) cb.checked = (e.target.value === 'Yes');
    });
    document.getElementById('roofType')?.addEventListener('change', (e) => {
        const cb = document.getElementById('cb-roof');
        if(cb) cb.checked = (e.target.value !== '');
    });

    // --- 3. GLOBAL IMAGE COMPRESSOR & INDICATORS ---
    const compressAndStoreFile = (file, storeKey) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 800; let w = img.width, h = img.height;
                if(w > h && w > MAX) { h *= MAX/w; w = MAX; } else if (h > MAX) { w *= MAX/h; h = MAX; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                window.uploadedImagesStore[storeKey].push(canvas.toDataURL('image/jpeg', 0.6));
                window.updatePhotoCount(storeKey);
                triggerAutoSave();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    const setupMultiUpload = (id, key) => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => compressAndStoreFile(file, key));
            window.showToast("Images Compressed & Attached", true);
        });
    };
    setupMultiUpload('miscPhotos', 'misc'); setupMultiUpload('surveyPhotos', 'survey'); setupMultiUpload('accessPhotos', 'access');

    const updateDynamicLabel = () => {
        const needs = [];
        if (document.getElementById('treesExist')?.value === 'Yes') needs.push('Trees');
        if (document.getElementById('manholeExist')?.value === 'Yes') needs.push('Manholes');
        if (document.getElementById('weepventsExist')?.value === 'Yes') needs.push('Weep Vents');
        if (document.getElementById('pipesExist')?.value === 'Yes') needs.push('Pipes');
        
        const label = document.getElementById('dynamicSurveyUploadLabel');
        if (label) { 
            label.innerHTML = needs.length > 0 ? `Capture: ${needs.join(', ')}` : `Site Survey Photos (General)`; 
            label.style.color = needs.length > 0 ? '#ffc107' : 'var(--accent)'; 
        }
    };
    document.querySelectorAll('.dyn-survey-select').forEach(sel => sel.addEventListener('change', updateDynamicLabel));

    // --- 4. FABRIC CANVAS ENGINE (NO-CROP DYNAMIC RESIZE) ---
    window.appCanvases = {};
    document.querySelectorAll('.canvas-group').forEach(group => {
        const id = group.getAttribute('data-id');
        const canvasEl = group.querySelector('canvas');
        if (!canvasEl) return;

        const fCanvas = new fabric.Canvas(canvasEl.id, { isDrawingMode: false, allowTouchScrolling: true, selection: false });
        window.appCanvases[id] = fCanvas;
        fCanvas.isCalibrating = false; 
        fCanvas.scaleRatio = 5; 

        if(savedData['canvas_' + id]) {
            fCanvas.loadFromJSON(savedData['canvas_' + id], fCanvas.renderAll.bind(fCanvas));
        }

        const saveCanvas = () => { 
            const data = JSON.parse(localStorage.getItem('surveyAppData')) || {}; 
            data['canvas_' + id] = JSON.stringify(fCanvas.toJSON()); 
            localStorage.setItem('surveyAppData', JSON.stringify(data)); 
            triggerAutoSave();
        };

        let activeTool = 'locked';
        let isDrawingLine = false;
        let activeLineObj = null;
        let startX = 0, startY = 0;

        function bindDimLineTool() {
            fCanvas.off('mouse:down'); fCanvas.off('mouse:move'); fCanvas.off('mouse:up');
            fCanvas.on('mouse:down', function(o) {
                if (activeTool !== 'dim-line' && activeTool !== 'line') return;
                isDrawingLine = true;
                const pointer = fCanvas.getPointer(o.e);
                startX = pointer.x; startY = pointer.y;

                activeLineObj = new fabric.Line([startX, startY, startX, startY], {
                    strokeWidth: 3, 
                    stroke: activeTool === 'dim-line' ? '#0D6EFD' : '#FF0000', 
                    strokeDashArray: activeTool === 'dim-line' ? [5, 5] : null,
                    originX: 'center', originY: 'center', selectable: false, hasControls: false
                });
                fCanvas.add(activeLineObj);
            });

            fCanvas.on('mouse:move', function(o) {
                if (!isDrawingLine) return;
                const pointer = fCanvas.getPointer(o.e);
                let x2 = pointer.x; let y2 = pointer.y;

                if (o.e.shiftKey) {
                    const dx = x2 - startX;
                    const dy = y2 - startY;
                    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                    const snappedAngle = Math.round(angle / 45) * 45;
                    const dist = Math.hypot(dx, dy);
                    x2 = startX + dist * Math.cos(snappedAngle * Math.PI / 180);
                    y2 = startY + dist * Math.sin(snappedAngle * Math.PI / 180);
                }

                activeLineObj.set({ x2: x2, y2: y2 });
                fCanvas.renderAll();
            });

            fCanvas.on('mouse:up', function() {
                if (!isDrawingLine) return;
                isDrawingLine = false;
                
                if (activeLineObj) {
                    activeLineObj.setCoords();
                    if (activeTool === 'dim-line') {
                        const x1 = activeLineObj.x1, y1 = activeLineObj.y1, x2 = activeLineObj.x2, y2 = activeLineObj.y2;
                        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                        const dist = Math.hypot(x2 - x1, y2 - y1);
                        const mmEstimate = Math.round(dist * (fCanvas.scaleRatio || 5)); 
                        
                        const label = new fabric.Text(`${mmEstimate} mm`, {
                            left: (x1 + x2) / 2, top: (y1 + y2) / 2,
                            originX: 'center', originY: 'center',
                            fontSize: 16, fill: '#fff', backgroundColor: '#0D6EFD',
                            padding: 4, fontWeight: 'bold', selectable: true
                        });

                        const arrow1 = new fabric.Triangle({ width: 12, height: 12, fill: '#0D6EFD', left: x1, top: y1, originX: 'center', originY: 'center', angle: angle - 90, selectable: false });
                        const arrow2 = new fabric.Triangle({ width: 12, height: 12, fill: '#0D6EFD', left: x2, top: y2, originX: 'center', originY: 'center', angle: angle + 90, selectable: false });
                        
                        fCanvas.add(arrow1, arrow2, label);
                    }
                }
                saveCanvas();
                fCanvas.renderAll();
            });
        }

        fCanvas.on('object:modified', saveCanvas);

        group.querySelector('.camera-input')?.addEventListener('change', function(e) {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                fabric.Image.fromURL(event.target.result, (img) => {
                    fCanvas.clear();
                    
                    // --- DYNAMIC RESIZE FIX (NO CROPPING) ---
                    // Calculate exactly how high the canvas needs to be to fit the image entirely based on screen width.
                    const wrapper = group.querySelector('.canvas-container').parentElement;
                    const targetWidth = Math.min(wrapper.clientWidth - 20, 800); // 20px padding buffer
                    const ratio = img.height / img.width;
                    const targetHeight = targetWidth * ratio;

                    fCanvas.setWidth(targetWidth);
                    fCanvas.setHeight(targetHeight);

                    const scale = targetWidth / img.width;

                    img.set({ 
                        scaleX: scale, 
                        scaleY: scale, 
                        originX: 'left', 
                        originY: 'top', 
                        left: 0, 
                        top: 0, 
                        selectable: false,
                        evented: false
                    });
                    
                    fCanvas.add(img); fCanvas.sendToBack(img); saveCanvas();
                });                
            };
            reader.readAsDataURL(file);
        });

        const toolSection = group.querySelector('.tool-section');
        if(toolSection && !group.querySelector('.measure-btn')) {
            const measureBtn = document.createElement('button');
            measureBtn.type = 'button'; measureBtn.className = 'tool-btn measure-btn'; measureBtn.title = 'Calibrate Scale';
            measureBtn.innerHTML = '📏';
            toolSection.appendChild(measureBtn);

            measureBtn.addEventListener('click', () => {
                group.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); measureBtn.classList.add('active');
                const knownSize = prompt("Enter real-world length of the line you will draw (in mm):");
                if(!knownSize) return;
                
                fCanvas.isDrawingMode = true; fCanvas.isCalibrating = true;
                fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
                fCanvas.freeDrawingBrush.color = '#ff0000'; fCanvas.freeDrawingBrush.width = 3;
                
                fCanvas.once('path:created', (e) => {
                    fCanvas.scaleRatio = knownSize / e.path.width;
                    window.showToast(`Calibrated! Lines will auto-label.`);
                    fCanvas.isDrawingMode = false; fCanvas.isCalibrating = false;
                    fCanvas.remove(e.path); 
                    measureBtn.classList.remove('active'); group.querySelector('.lock-btn')?.classList.add('active');
                });
            });
            
            if(!group.querySelector('.line-btn')) {
                const lineBtn = document.createElement('button'); lineBtn.type='button'; lineBtn.className='tool-btn line-btn'; lineBtn.innerHTML='|'; toolSection.appendChild(lineBtn);
                lineBtn.addEventListener('click', function() { resetBtns(); this.classList.add('active'); activeTool = 'line'; fCanvas.isDrawingMode = false; bindDimLineTool(); });
                
                const dimBtn = document.createElement('button'); dimBtn.type='button'; dimBtn.className='tool-btn dim-line-btn'; dimBtn.innerHTML='⟷'; toolSection.appendChild(dimBtn);
                dimBtn.addEventListener('click', function() { resetBtns(); this.classList.add('active'); activeTool = 'dim-line'; fCanvas.isDrawingMode = false; bindDimLineTool(); });
            }
        }

        const resetBtns = () => { 
            group.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); 
            fCanvas.off('mouse:down'); fCanvas.off('mouse:move'); fCanvas.off('mouse:up');
        };
        group.querySelector('.lock-btn')?.addEventListener('click', function() { resetBtns(); this.classList.add('active'); activeTool = 'locked'; fCanvas.isDrawingMode = false; });
        group.querySelector('.freehand-btn')?.addEventListener('click', function() { resetBtns(); this.classList.add('active'); activeTool = 'freehand'; fCanvas.isDrawingMode = true; fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas); fCanvas.freeDrawingBrush.color = '#00E5FF'; fCanvas.freeDrawingBrush.width = 4; });
        group.querySelector('.highlight-btn')?.addEventListener('click', function() { resetBtns(); this.classList.add('active'); activeTool = 'highlight'; fCanvas.isDrawingMode = true; fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas); fCanvas.freeDrawingBrush.color = 'rgba(255, 255, 0, 0.4)'; fCanvas.freeDrawingBrush.width = 20; });
        group.querySelector('.text-btn')?.addEventListener('click', function() { resetBtns(); this.classList.add('active'); activeTool = 'text'; fCanvas.isDrawingMode = false; const text = new fabric.IText('Double click to edit', { left: 50, top: 50, fontFamily: 'sans-serif', fill: '#00E5FF', fontSize: 24 }); fCanvas.add(text); fCanvas.setActiveObject(text); saveCanvas(); });
        group.querySelector('.undo-btn')?.addEventListener('click', () => { const objs = fCanvas.getObjects(); if(objs.length > 0) { const last = objs[objs.length - 1]; if(objs.length === 1 && last.type === 'image') return; fCanvas.remove(last); saveCanvas(); } });
        group.querySelector('.clear-btn')?.addEventListener('click', () => { fCanvas.getObjects().filter(o => o.type !== 'image').forEach(o => fCanvas.remove(o)); saveCanvas(); });
    });

    // --- 5. LIVE AI NOTES REWRITER ---
    document.getElementById('aiRewriteBtn')?.addEventListener('click', async () => {
        const rawText = document.getElementById('designerNotes').value.trim();
        if(!rawText) return window.showToast("No raw notes to rewrite.", false);
        
        window.showToast("AI Polishing...", true);
        const btn = document.getElementById('aiRewriteBtn');
        btn.innerText = "Processing..."; btn.disabled = true;

        try {
            const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
            const functions = getFunctions();
            const rewriteNotes = httpsCallable(functions, 'rewriteNotes');

            const result = await rewriteNotes({ rawText: rawText });
            document.getElementById('customerNotes').value = result.data.polishedText;
            window.showToast("Notes Polished!", true);
            triggerAutoSave();
        } catch (error) {
            console.error("AI Error:", error);
            window.showToast("AI Request Failed. Check connection.", false);
        } finally {
            btn.innerText = "✨ AI Polish"; btn.disabled = false;
        }
    });

    // --- 6. SECURE WATERMARK & PDF ENGINE ---
    const getBase64Logo = (brandName) => new Promise(resolve => {
        const logoMap = {
            'CO Home Improvements': 'co-logo.png',
            'Clearview': 'clearview.png',
            'Orion Windows': 'orion.png',
            'Planet': 'planet.png',
            'Trent Valley Windows': 'trentvalley.png',
            'West Yorkshire Windows': 'westyorkshire.png',
            'Yorkshire Windows': 'yorkshire.png'
        };

        const fileName = logoMap[brandName] || 'logo.png';
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; 
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => { resolve(null); };
        img.src = fileName;
    });

    const urlToBase64 = (url) => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });

    // Helper to get image dimensions for jsPDF dynamic sizing
    const getImgDims = (src) => new Promise(resolve => {
        const i = new Image();
        i.onload = () => resolve({w: i.width, h: i.height});
        i.src = src;
    });

    async function generateSurvey(isCustomer) {
        if (!jsPDF) return window.showToast("PDF Engine loading...", false);
        
        const rawName = document.getElementById('clientName')?.value.trim();
        const postCode = document.getElementById('postCode')?.value.trim();
        if(!rawName || !postCode) return window.showToast("Error: Client Name & Postcode are mandatory.", false);
        const surname = rawName.split(' ').pop() || 'Customer';

        window.showToast("Generating Branded PDF...");
        const template = document.getElementById('pdfTemplateInternal');
        const profile = window.currentUserProfile || { brand: 'CO Home Improvements', name: 'N/A' };
        
        // 1. Text Binds
        document.querySelectorAll('.bind-name').forEach(el => el.innerText = rawName);
        document.querySelectorAll('.bind-num').forEach(el => el.innerText = document.getElementById('clientNum')?.value || 'N/A');
        document.querySelectorAll('.bind-address').forEach(el => el.innerText = document.getElementById('postCode')?.value || 'N/A');
        
        const designerEl = document.getElementById('pdfPrintDesigner');
        if (designerEl) designerEl.innerText = profile.name;

        // 2. Data Fields
        ['BuildType', 'RoofType', 'ProposedSize', 'HouseMaterial', 'DpcDepth', 'FasciaHeight', 'AirBricks', 'BuildingRegs', 'PlanningPerms', 'AccessDifficult', 'AccessWidth', 'WallObstacles'].forEach(key => {
            const inputEl = document.getElementById(key.charAt(0).toLowerCase() + key.slice(1));
            const textEl = document.getElementById(`pdf${key}`);
            if (inputEl && textEl) textEl.innerText = inputEl.value || 'N/A';
        });

        const extFrame = document.getElementById('frameColour')?.value || 'N/A';
        const intFrame = document.getElementById('internalFrameColour')?.value || 'N/A';
        const frameTextEl = document.getElementById('pdfFrameColour');
        if (frameTextEl) frameTextEl.innerText = `Ext: ${extFrame}\nInt: ${intFrame === 'Match External' ? extFrame : intFrame}`;

        // Notes Toggle
        const notesEl = document.getElementById('pdfDesignerNotes');
        if(notesEl) {
            if(isCustomer && !document.getElementById('includeNotesInPack')?.checked) {
                notesEl.style.display = 'none';
                if(notesEl.previousElementSibling) notesEl.previousElementSibling.style.display = 'none';
            } else {
                notesEl.style.display = 'block';
                if(notesEl.previousElementSibling) notesEl.previousElementSibling.style.display = 'block';
                notesEl.innerText = (isCustomer && document.getElementById('customerNotes')?.value) 
                    ? document.getElementById('customerNotes').value 
                    : (document.getElementById('designerNotes')?.value || 'None provided.');
            }
        }

        // Primary Build Area Logic
        const buildAreaSelect = document.getElementById('primaryBuildArea');
        const selectedBuildAreaId = buildAreaSelect.value;
        const buildAreaTitle = buildAreaSelect.options[buildAreaSelect.selectedIndex].text;
        document.getElementById('pdfFocusTitle').innerText = buildAreaTitle + " (Primary Focus)";

        // Render Canvases to Template images
        ['frontelevation', 'sideelevation', 'rearelevation', 'designersketch'].forEach(id => {
            const fCanvas = window.appCanvases[id];
            if (fCanvas) { 
                fCanvas.setViewportTransform([1,0,0,1,0,0]); 
                fCanvas.discardActiveObject(); fCanvas.renderAll(); 
                const dataUrl = fCanvas.toDataURL({ format: 'png' });
                
                if(id === 'frontelevation') {
                    document.getElementById('pdfHeroImg').src = dataUrl;
                    document.getElementById('pdfThumbFront').src = dataUrl;
                }
                if(id === 'sideelevation') document.getElementById('pdfThumbSide').src = dataUrl;
                if(id === 'rearelevation') document.getElementById('pdfThumbRear').src = dataUrl;
                if(id === 'designersketch') document.getElementById('pdfSketchImg').src = dataUrl;
                if(id === selectedBuildAreaId) document.getElementById('pdfFocusImg').src = dataUrl;
            }
        });

        // Sketch Toggle Logic
        const sketchTitle = document.getElementById('pdfSketchTitle');
        const sketchWrapper = document.getElementById('pdfSketchWrapper');
        if (sketchWrapper && sketchTitle) {
            if (isCustomer && !document.getElementById('includeSketchInPack')?.checked) {
                sketchWrapper.style.display = 'none'; sketchTitle.style.display = 'none';
            } else {
                sketchWrapper.style.display = 'flex'; sketchTitle.style.display = 'block';
            }
        }

        const logoBase64 = await getBase64Logo(profile.brand);
        if(logoBase64) { template.querySelectorAll('.dynamic-brand-logo').forEach(img => { img.src = logoBase64; }); }

        template.style.display = 'block'; template.style.position = 'absolute'; template.style.width = '800px'; template.style.zIndex = '-9999';
        
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pagesToPrint = template.querySelectorAll('.pdf-page');

            const stampLogo = () => {
                if(logoBase64) {
                    try {
                        pdf.setGState(new pdf.GState({opacity: 0.05}));
                        const size = 250; const x = (210 - size) / 2; const y = (297 - size) / 2;
                        pdf.addImage(logoBase64, 'PNG', x, y, size, size);
                        pdf.setGState(new pdf.GState({opacity: 1.0}));
                    } catch(e) {}
                }
            };

            for (let i = 0; i < pagesToPrint.length; i++) {
                if (i > 0) pdf.addPage();
                const canvas = await html2canvas(pagesToPrint[i], { scale: 2 });
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, (canvas.height * 210) / canvas.width);
                stampLogo();
            }

            // DYNAMIC NATIVE PAGINATION FOR PHOTOS (NO CROPPING FIX)
            const allPhotos = [
                ...(window.uploadedImagesStore.survey || []).map(src => ({src, type: 'Survey'})),
                ...(window.uploadedImagesStore.access || []).map(src => ({src, type: 'Access'})),
                ...(window.uploadedImagesStore.misc || []).map(src => ({src, type: 'Misc'}))
            ];

            if (allPhotos.length > 0) {
                const photosPerPage = 6; // 3 rows of 2
                for (let i = 0; i < allPhotos.length; i += photosPerPage) {
                    pdf.addPage();
                    pdf.setFontSize(22); pdf.setFont("helvetica", "bold"); pdf.setTextColor(0, 47, 84);
                    pdf.text("SITE IMAGERY", 15, 25);
                    
                    const chunk = allPhotos.slice(i, i + photosPerPage);
                    for (let idx = 0; idx < chunk.length; idx++) {
                        const item = chunk[idx];
                        const col = idx % 2; 
                        const row = Math.floor(idx / 2);
                        
                        // Available max dimensions per slot
                        const cellW = 85; 
                        const cellH = 75;
                        
                        // Dynamically calculate aspect ratio to guarantee no cropping
                        const dims = await getImgDims(item.src);
                        const ratio = dims.h / dims.w;
                        
                        let printW = cellW;
                        let printH = cellW * ratio;
                        
                        if (printH > cellH) {
                            printH = cellH;
                            printW = cellH / ratio;
                        }
                        
                        // Center mathematically within the cell slot
                        const x = 15 + (col * 95) + ((cellW - printW) / 2);
                        const y = 35 + (row * 85) + ((cellH - printH) / 2);
                        
                        pdf.setFontSize(10); pdf.setFont("helvetica", "bold"); pdf.setTextColor(100, 100, 100);
                        pdf.text(`${item.type} Upload`, 15 + (col * 95), 35 + (row * 85) - 2);
                        
                        pdf.addImage(item.src, 'JPEG', x, y, printW, printH);
                    }
                    stampLogo();
                }
            }

            // PAMPHLETS
            if (isCustomer) {
                const selectedFlyers = Array.from(document.querySelectorAll('.pamphlet-cb:checked')).map(cb => cb.value);
                for (const flyerUrl of selectedFlyers) {
                    const flyerBase64 = await urlToBase64('pamphlet/' + flyerUrl);
                    if (flyerBase64) {
                        pdf.addPage();
                        pdf.addImage(flyerBase64, 'JPEG', 0, 0, 210, 297);
                    }
                }
            }
            
            const fileNameType = isCustomer ? 'Customer_Survey' : 'Internal_Survey';
            pdf.save(`${surname}_${fileNameType}.pdf`);
            window.showToast("PDF Export Complete!", true);
        } catch(e) { console.error(e); window.showToast("PDF Generation Failed", false); } 
        finally { template.style.display = 'none'; }
    }

    document.getElementById('generateInternalPdfBtn')?.addEventListener('click', () => generateSurvey(false));
    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', () => generateSurvey(true));
        // ADD THE NEW PORTAL LOGIC RIGHT HERE
    document.getElementById('copyPortalLinkBtn')?.addEventListener('click', () => {
        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '') + 'portal.html'; 
        navigator.clipboard.writeText(baseUrl).then(() => {
            window.showToast("Portal Link Copied! Send to customer.", true);
        });
    });
});

// =====================================================================
// PINNACLE UPGRADE: MOBILE SNIPER V3 + V3 VAULT SYNC + DASHBOARD EXPORT
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("Injecting Pinnacle Surveyor Plugin...");

    // --- 1. BUILD THE SNIPER MODAL UI (Injected into HTML) ---
    const sniperModal = document.createElement('div');
    sniperModal.id = 'sniper-modal';
    sniperModal.style.cssText = 'display: none; position: fixed; inset: 0; z-index: 100000; background: #121212; touch-action: none; font-family: system-ui, sans-serif;';
    sniperModal.innerHTML = `
    <div id="sniper-viewport" style="position: absolute; inset: 0; overflow: hidden; touch-action: none;">
        <div id="sniper-canvas-container" style="transform-origin: 0 0; position: absolute; will-change: transform;">
            <img id="sniper-img" src="" style="display: block; min-width: 800px; min-height: 600px;">
            <canvas id="sniper-drawing-layer" style="position: absolute; top: 0; left: 0; pointer-events: none;"></canvas>
            <canvas id="sniper-ghost-layer" style="position: absolute; top: 0; left: 0; pointer-events: none;"></canvas>
        </div>

        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; z-index: 50; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 44px; height: 2px; background: #0dcaf0; box-shadow: 0 0 6px #000;"></div>
            <div style="position: absolute; height: 44px; width: 2px; background: #0dcaf0; box-shadow: 0 0 6px #000;"></div>
            <div style="width: 4px; height: 4px; background: #fff; border-radius: 50%; z-index: 51; box-shadow: 0 0 4px #000;"></div>
        </div>

        <div style="position: absolute; inset: 0; pointer-events: none; z-index: 100; display: flex; flex-direction: column; justify-content: space-between; padding: 15px; padding-bottom: env(safe-area-inset-bottom, 25px); padding-top: env(safe-area-inset-top, 15px);">
            
            <div style="pointer-events: auto; display: flex; justify-content: space-between; gap: 8px;">
                <button id="btn-close-sniper" style="background: rgba(20,20,20,0.8); color: white; border: 1px solid #444; padding: 12px 20px; border-radius: 8px; font-weight: bold; font-size: 14px;">Cancel</button>
                <button id="btn-save-sniper" style="background: #10b981; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 0 10px rgba(16,185,129,0.4);">Save Blueprint</button>
            </div>

            <div style="pointer-events: auto; display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; justify-content: flex-end; width: 100%;">
                    <div style="display: grid; grid-template-columns: 45px 45px 45px; grid-template-rows: 45px 45px 45px; gap: 6px;">
                        <div id="btn-nudge-up" style="grid-column: 2; grid-row: 1; background: rgba(20,20,20,0.85); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; color: white; font-size: 18px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">↑</div>
                        <div id="btn-nudge-left" style="grid-column: 1; grid-row: 2; background: rgba(20,20,20,0.85); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; color: white; font-size: 18px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">←</div>
                        <div id="btn-nudge-right" style="grid-column: 3; grid-row: 2; background: rgba(20,20,20,0.85); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; color: white; font-size: 18px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">→</div>
                        <div id="btn-nudge-down" style="grid-column: 2; grid-row: 3; background: rgba(20,20,20,0.85); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; color: white; font-size: 18px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">↓</div>
                    </div>
                </div>
                <button id="btn-action-sniper" style="width: 100%; padding: 18px; border-radius: 14px; border: none; font-weight: 900; font-size: 16px; background: #0dcaf0; color: #000; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(13,202,240,0.3); transition: 0.2s;">🎯 Place Anchor</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(sniperModal);

    // --- 2. HIJACK THE OLD CANVASES ---
    ['Front', 'Side', 'Rear', 'Drainage'].forEach(suffix => {
        const fileInput = document.getElementById(`photo-${suffix.toLowerCase()}`);
        const canvasEl = document.getElementById(`canvas${suffix}`);
        if(canvasEl && fileInput) {
            // Hide old Fabric tools
            const toolSection = canvasEl.parentElement.parentElement.querySelector('.tool-section');
            if(toolSection) toolSection.style.display = 'none';

            // Inject the sleek new Sniper button
            const openBtn = document.createElement('button');
            openBtn.className = 'button mt-10';
            openBtn.style.cssText = 'width: 100%; background: #0dcaf0; color: #000; font-weight: 800; border-radius: 8px; padding: 12px; display: none;';
            openBtn.innerText = '🎯 Edit with Precision Touch';
            
            // Show the button only when a photo is uploaded
            fileInput.addEventListener('change', () => { setTimeout(() => { openBtn.style.display = 'block'; }, 500); });
            openBtn.onclick = (e) => { e.preventDefault(); openSniperEngine(suffix); };
            
            canvasEl.parentElement.parentElement.appendChild(openBtn);
        }
    });

    // --- 3. THE SNIPER ENGINE MATH ---
    let activeSuffix = null;
    const sState = { scale: 1, offsetX: 0, offsetY: 0, isDragging: false };
    let sAnchor = null; let sInitialPinch = null; let sLastTouch = {x:0, y:0};
    window.sniperVectors = []; // Stores text logs for the dashboard

    const sImg = document.getElementById('sniper-img');
    const sDraw = document.getElementById('sniper-drawing-layer');
    const sDrawCtx = sDraw.getContext('2d');
    const sGhost = document.getElementById('sniper-ghost-layer');
    const sGhostCtx = sGhost.getContext('2d');
    const sActionBtn = document.getElementById('btn-action-sniper');
    const sContainer = document.getElementById('sniper-canvas-container');

    function openSniperEngine(suffix) {
        const fileInput = document.getElementById(`photo-${suffix.toLowerCase()}`);
        if(!fileInput || !fileInput.files[0]) return;
        activeSuffix = suffix;
        const reader = new FileReader();
        reader.onload = (e) => {
            sImg.onload = () => {
                const w = sImg.naturalWidth || 1000; const h = sImg.naturalHeight || 800;
                sDraw.width = w; sDraw.height = h; sGhost.width = w; sGhost.height = h;
                sDrawCtx.clearRect(0,0,w,h); sGhostCtx.clearRect(0,0,w,h); sAnchor = null;
                sActionBtn.innerText = "🎯 Place Anchor"; sActionBtn.style.background = "#0dcaf0";
                
                sState.offsetX = (window.innerWidth - w) / 2; sState.offsetY = (window.innerHeight - h) / 2;
                sState.scale = Math.min(window.innerWidth / w, window.innerHeight / h) * 0.9;
                updateTransform(); sniperModal.style.display = 'block';
            };
            sImg.src = e.target.result;
        };
        reader.readAsDataURL(fileInput.files[0]);
    }

    document.getElementById('btn-close-sniper').onclick = () => sniperModal.style.display = 'none';
    
    // THE SECRET WEAPON: Saving the composite silently
    document.getElementById('btn-save-sniper').onclick = () => {
        const comp = document.createElement('canvas'); comp.width = sDraw.width; comp.height = sDraw.height;
        const compCtx = comp.getContext('2d');
        compCtx.drawImage(sImg, 0, 0); compCtx.drawImage(sDraw, 0, 0);
        
        const targetCanvas = document.getElementById(`canvas${activeSuffix}`);
        targetCanvas.setAttribute('data-sniper-saved', comp.toDataURL('image/jpeg', 0.9));
        targetCanvas.style.backgroundImage = `url(${comp.toDataURL('image/jpeg', 0.9)})`;
        targetCanvas.style.backgroundSize = 'contain';
        targetCanvas.style.backgroundPosition = 'center'; targetCanvas.style.backgroundRepeat = 'no-repeat';
        
        // Hide clunky Fabric UI elements
        const fabWrapper = targetCanvas.parentElement;
        if(fabWrapper && fabWrapper.classList.contains('canvas-container')) {
            const upper = fabWrapper.querySelector('.upper-canvas'); if(upper) upper.style.display = 'none';
        }
        sniperModal.style.display = 'none';
        if(window.showToast) window.showToast("Blueprint Saved!", true);
    };

    function updateTransform() {
        sContainer.style.transform = `translate(${sState.offsetX}px, ${sState.offsetY}px) scale(${sState.scale})`;
        sGhostCtx.clearRect(0, 0, sGhost.width, sGhost.height);
        if (sAnchor) {
            const cur = { x: (window.innerWidth/2 - sState.offsetX) / sState.scale, y: (window.innerHeight/2 - sState.offsetY) / sState.scale };
            sGhostCtx.beginPath(); sGhostCtx.moveTo(sAnchor.x, sAnchor.y); sGhostCtx.lineTo(cur.x, cur.y);
            sGhostCtx.lineWidth = 4 / sState.scale; sGhostCtx.strokeStyle = '#0dcaf0'; sGhostCtx.setLineDash([10/sState.scale, 10/sState.scale]);
            sGhostCtx.stroke(); sGhostCtx.setLineDash([]);
        }
    }

    // Touch Handling
    const v = document.getElementById('sniper-viewport');
    v.addEventListener('touchstart', (e) => {
        if(e.target.closest('button') || e.target.closest('.nudge-btn')) return;
        e.preventDefault();
        if (e.touches.length === 1) { sState.isDragging = true; sLastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } 
        else if (e.touches.length === 2) { sState.isDragging = false; sInitialPinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
    }, {passive: false});

    v.addEventListener('touchmove', (e) => {
        if(e.target.closest('button') || e.target.closest('.nudge-btn')) return;
        e.preventDefault();
        if (e.touches.length === 1 && sState.isDragging) {
            sState.offsetX += e.touches[0].clientX - sLastTouch.x; sState.offsetY += e.touches[0].clientY - sLastTouch.y;
            sLastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; updateTransform();
        } else if (e.touches.length === 2 && sInitialPinch) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const factor = dist / sInitialPinch;
            const oldScale = sState.scale; sState.scale *= factor;
            if(sState.scale < 0.1) sState.scale = 0.1; if(sState.scale > 10) sState.scale = 10;
            const cx = window.innerWidth/2; const cy = window.innerHeight/2;
            sState.offsetX = cx - ((cx - sState.offsetX) / oldScale * sState.scale);
            sState.offsetY = cy - ((cy - sState.offsetY) / oldScale * sState.scale);
            sInitialPinch = dist; updateTransform();
        }
    }, {passive: false});
    
    v.addEventListener('touchend', (e) => { if (e.touches.length < 2) sInitialPinch = null; if (e.touches.length === 0) sState.isDragging = false; });

    // D-Pad
    const nudge = (dx, dy) => { sState.offsetX -= dx * sState.scale; sState.offsetY -= dy * sState.scale; updateTransform(); };
    const bindN = (id, dx, dy) => { document.getElementById(id).addEventListener('touchstart', (e) => { e.preventDefault(); nudge(dx, dy); }); };
    bindN('btn-nudge-up', 0, -2); bindN('btn-nudge-down', 0, 2); bindN('btn-nudge-left', -2, 0); bindN('btn-nudge-right', 2, 0);

    // Anchor logic
    sActionBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const cur = { x: (window.innerWidth/2 - sState.offsetX)/sState.scale, y: (window.innerHeight/2 - sState.offsetY)/sState.scale };
        if (!sAnchor) {
            sAnchor = cur; sActionBtn.innerText = "✅ Confirm Endpoint"; sActionBtn.style.background = "#10b981"; updateTransform(); 
        } else {
            sDrawCtx.beginPath(); sDrawCtx.moveTo(sAnchor.x, sAnchor.y); sDrawCtx.lineTo(cur.x, cur.y);
            sDrawCtx.lineWidth = 4 / sState.scale; sDrawCtx.strokeStyle = '#0dcaf0'; sDrawCtx.stroke();
            const measurement = prompt("Enter Measurement (e.g., 2400mm):");
            if(measurement) {
                const mx = (sAnchor.x + cur.x)/2; const my = (sAnchor.y + cur.y)/2; const fs = 20 / sState.scale; const pad = 8 / sState.scale;
                sDrawCtx.fillStyle = '#1A1A1A'; const tw = sDrawCtx.measureText(measurement).width;
                sDrawCtx.fillRect(mx - tw/2 - pad, my - fs, tw + pad*2, fs + pad*2);
                sDrawCtx.fillStyle = '#0dcaf0'; sDrawCtx.font = `bold ${fs}px sans-serif`; sDrawCtx.textAlign = 'center'; sDrawCtx.textBaseline = 'middle';
                sDrawCtx.fillText(measurement, mx, my);
                window.sniperVectors.push(`${activeSuffix} Elevation: ${measurement}`); // Save for Dashboard Export
            }
            sAnchor = null; sActionBtn.innerText = "🎯 Place Anchor"; sActionBtn.style.background = "#0dcaf0"; sGhostCtx.clearRect(0,0,sGhost.width,sGhost.height);
        }
    });

    // --- 4. THE PDF MONKEY PATCH ---
    // Automatically intercepts the PDF exporter so you don't have to rewrite it.
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type, encoderOptions) {
        if (this.hasAttribute('data-sniper-saved')) return this.getAttribute('data-sniper-saved');
        return originalToDataURL.call(this, type, encoderOptions);
    };

    // --- 5. INJECT DASHBOARD & V3 BUTTONS ---
    const pdfBtn = document.getElementById('generateCustomerPdfBtn') || document.getElementById('generateInternalPdfBtn');
    if(pdfBtn && pdfBtn.parentElement) {
        const btnDash = document.createElement('button');
        btnDash.className = 'button button--secondary';
        btnDash.innerText = 'Copy to Dashboard';
        btnDash.style.marginLeft = '10px';
        btnDash.onclick = () => {
            const n = document.getElementById('customerName')?.value || 'N/A';
            const c = document.getElementById('contactNumber')?.value || 'N/A';
            const p = document.getElementById('postCode')?.value || 'N/A';
            const r = document.getElementById('roofType')?.value || 'Edwardian roof';
            const notes = document.getElementById('customerNotes')?.value || 'None';
            const vecs = window.sniperVectors.length > 0 ? window.sniperVectors.join('\\n') : 'No structural measurements recorded.';
            
            const txt = `=== SURVEY DASHBOARD EXPORT ===\\nDate: ${new Date().toLocaleDateString()}\\nName: ${n}\\nPhone: ${c}\\nPostcode: ${p}\\nRoof: ${r}\\n\\n-- STRUCTURAL VECTORS --\\n${vecs}\\n\\n-- SITE NOTES --\\n${notes}\\n=============================`;
            navigator.clipboard.writeText(txt).then(() => { if(window.showToast) window.showToast('Copied for Dashboard!', true); });
        };
        
        const btnV3 = document.createElement('button');
        btnV3.className = 'button';
        btnV3.style.cssText = 'background: #10b981; color: white; margin-left: 10px; font-weight: bold;';
        btnV3.innerText = 'Sync to V3 Vault';
        btnV3.onclick = async () => {
            if(!window.db) { alert("Firebase not linked."); return; }
            if(window.showToast) window.showToast("Pushing to V3 Vault...", true);
            try {
                const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
                const fCv = document.getElementById('canvasFront');
                const fImg = fCv && fCv.hasAttribute('data-sniper-saved') ? fCv.getAttribute('data-sniper-saved') : null;
                
                const docRef = await addDoc(collection(window.db, "surveys"), {
                    clientName: document.getElementById('customerName')?.value || 'Unnamed Client',
                    userId: "Tom",
                    updatedAt: serverTimestamp(),
                    data: {
                        inputs: {
                            postCode: document.getElementById('postCode')?.value || 'N/A',
                            clientNum: document.getElementById('customerNumber')?.value || 'survey123',
                            roofType: document.getElementById('roofType')?.value || 'Edwardian roof',
                            _pipelineStatus: "1. Consultation & Survey",
                            _brand: document.getElementById('companyBrand')?.value || 'COHI'
                        }
                    },
                    images: { frontElevation: fImg || null }
                });
                
                const notes = document.getElementById('customerNotes')?.value;
                if(notes) await addDoc(collection(window.db, \`surveys/\${docRef.id}/internalNotes\`), { content: notes, visibility: 'external', timestamp: serverTimestamp() });
                
                if(window.showToast) window.showToast("Successfully Synced to V3 Vault!", true);
            } catch(e) { console.error(e); if(window.showToast) window.showToast("V3 Sync Failed", false); }
        };

        pdfBtn.parentElement.appendChild(btnDash);
        pdfBtn.parentElement.appendChild(btnV3);
    }
});
