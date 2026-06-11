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
    console.log("[Diagnostics] Blueprint Enterprise Engine Initialized (V2 Final).");
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

    // --- 1. CONTINUOUS AUTOSAVE ---
    let autoSaveTimeout;
    const triggerAutoSave = () => {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            const data = {};
            document.querySelectorAll('input:not([type="file"]):not(.pamphlet-cb), select, textarea').forEach(input => { if(input.id) data[input.id] = input.value; });
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

    // --- 4. FABRIC CANVAS ENGINE (FIXED ZOOM & SCROLL INTERCEPTION) ---
    window.appCanvases = {};
    document.querySelectorAll('.canvas-group').forEach(group => {
        const id = group.getAttribute('data-id');
        const canvasEl = group.querySelector('canvas');
        if (!canvasEl) return;

        const fCanvas = new fabric.Canvas(canvasEl.id, { isDrawingMode: false, allowTouchScrolling: true, selection: false });
        window.appCanvases[id] = fCanvas;
        fCanvas.isCalibrating = false; 
        fCanvas.scaleRatio = 5; 

        if(savedData['canvas_' + id]) fCanvas.loadFromJSON(savedData['canvas_' + id], fCanvas.renderAll.bind(fCanvas));

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
                const imgObj = new Image();
                imgObj.onload = () => {
                    const c = document.createElement('canvas'); c.width = 800; c.height = 800 * (imgObj.height/imgObj.width);
                    c.getContext('2d').drawImage(imgObj, 0, 0, c.width, c.height);
                    fabric.Image.fromURL(c.toDataURL('image/jpeg', 0.6), (img) => {
                        fCanvas.clear();
                        // Scale slightly down to ensure it perfectly fits inside boundaries
                        const scale = Math.min(fCanvas.width / img.width, fCanvas.height / img.height) * 0.98;
                        img.set({ 
                            scaleX: scale, 
                            scaleY: scale, 
                            originX: 'center', 
                            originY: 'center', 
                            left: fCanvas.width / 2, 
                            top: fCanvas.height / 2, 
                            selectable: false,   // Prevent selection ring
                            evented: false       // Ignore touches (allows scrolling over image)
                        });
                        fCanvas.add(img); fCanvas.sendToBack(img); saveCanvas();
                    });                
                };
                imgObj.src = event.target.result;
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
        img.onerror = () => {
            console.error("PDF Engine: Failed to load logo:", fileName);
            resolve(null);
        };
        img.src = fileName;
    });

    // Helper: Convert Pamphlet Image URL to Base64 to append as dedicated JS PDF Pages
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

    async function generateMultiPagePDF(templateId, filename, isCustomer) {
        if (!jsPDF) return window.showToast("PDF Engine loading...", false);
        
        const clientName = document.getElementById('clientName')?.value.trim();
        const postCode = document.getElementById('postCode')?.value.trim();
        if(!clientName || !postCode) return window.showToast("Error: Client Name & Postcode are mandatory.", false);

        window.showToast("Generating Branded PDF...");
        const template = document.getElementById(templateId);
        if(!template) return;

        const profile = window.currentUserProfile || { brand: 'CO Home Improvements' };
        const brandColor = '#002f54';

        template.querySelectorAll('*').forEach(el => {
            if (el.classList.contains('brand-text')) el.style.color = brandColor;
            if (el.classList.contains('brand-bg')) el.style.backgroundColor = brandColor;
            if (el.classList.contains('brand-border-bottom')) el.style.borderBottomColor = brandColor;
            if (el.classList.contains('brand-border-left')) el.style.borderLeftColor = brandColor;
        });

        const logoBase64 = await getBase64Logo(profile.brand);
        if(logoBase64) {
            template.querySelectorAll('.dynamic-brand-logo').forEach(img => { img.src = logoBase64; });
        }

        template.style.display = 'block'; 
        template.style.position = 'absolute'; 
        template.style.width = '800px'; 
        template.style.zIndex = '-9999';
        
        try {
            const canvas = await html2canvas(template, { scale: 2, windowWidth: 800, windowHeight: template.scrollHeight });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgHeight = (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width;
            
            let heightLeft = imgHeight; let position = 0; const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const stampLogo = () => {
                if(logoBase64) {
                    try {
                        pdf.setGState(new pdf.GState({opacity: 0.06})); // slightly softer
                        const size = 250; // ENLARGED WATERMARK
                        const x = (pdf.internal.pageSize.getWidth() - size) / 2;
                        const y = (pdfHeight - size) / 2;
                        pdf.addImage(logoBase64, 'PNG', x, y, size, size);
                        pdf.setGState(new pdf.GState({opacity: 1.0}));
                    } catch(e) { console.warn("Watermark error", e); }
                }
            };

            pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, position, pdf.internal.pageSize.getWidth(), imgHeight);
            stampLogo();
            heightLeft -= pdfHeight;
            
            while (heightLeft > 0) { 
                position = position - pdfHeight; 
                pdf.addPage(); 
                pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, position, pdf.internal.pageSize.getWidth(), imgHeight); 
                stampLogo();
                heightLeft -= pdfHeight; 
            }

            // --- INJECT PERFECT A4 PAMPHLETS (CUSTOMER ONLY) ---
            if (isCustomer) {
                const selectedFlyers = Array.from(document.querySelectorAll('.pamphlet-cb:checked')).map(cb => cb.value);
                for (const flyerUrl of selectedFlyers) {
                    const flyerBase64 = await urlToBase64('pamphlet/' + flyerUrl);
                    if (flyerBase64) {
                        pdf.addPage();
                        // 210x297mm is perfect A4
                        pdf.addImage(flyerBase64, 'JPEG', 0, 0, 210, 297);
                    }
                }
            }
            
            pdf.save(filename);
            window.showToast("PDF Export Complete!", true);
        } catch(e) { console.error(e); window.showToast("PDF Generation Failed", false); } 
        finally { template.style.display = 'none'; }
    }

    // --- CONSOLIDATED PDF GENERATOR LOGIC ---
    async function generateSurvey(isCustomer) {
        const templateId = 'pdfTemplateInternal'; 
        const rawName = document.getElementById('clientName')?.value.trim() || 'Valued Customer';
        const surname = rawName.split(' ').pop() || 'Customer';
        const profile = window.currentUserProfile || { name: 'N/A' };

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

        // Frame Colours custom merge
        const extFrame = document.getElementById('frameColour')?.value || 'N/A';
        const intFrame = document.getElementById('internalFrameColour')?.value || 'N/A';
        const frameTextEl = document.getElementById('pdfFrameColour');
        if (frameTextEl) frameTextEl.innerText = `Ext: ${extFrame}\nInt: ${intFrame === 'Match External' ? extFrame : intFrame}`;

        // 3. Notes Toggle Logic
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

        // 4. Sketch Toggle Logic
        const sketchWrapper = document.getElementById('pdfImgInternal-designersketch')?.parentElement?.parentElement;
        if (sketchWrapper) {
            if (isCustomer && !document.getElementById('includeSketchInPack')?.checked) {
                sketchWrapper.style.display = 'none';
                if(sketchWrapper.previousElementSibling) sketchWrapper.previousElementSibling.style.display = 'none';
            } else {
                sketchWrapper.style.display = 'block';
                if(sketchWrapper.previousElementSibling) sketchWrapper.previousElementSibling.style.display = 'block';
            }
        }

        // 5. Populate Uploaded Photos Grids
        const populateGrid = (storeKey, gridId) => {
            const grid = document.getElementById(gridId);
            if(grid) {
                const photos = window.uploadedImagesStore[storeKey] || [];
                if (photos.length === 0) {
                    grid.innerHTML = `<p style="color:#999; font-style:italic; font-size:12px; margin:0;">No ${storeKey} photos attached.</p>`;
                } else {
                    grid.innerHTML = photos.map(imgSrc => 
                        `<div style="position: relative; width: 48%; height: 220px; background: #fff; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.05); overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                            <img class="dynamic-brand-logo" src="" style="position: absolute; width: 60%; opacity: 0.08; pointer-events: none; mix-blend-mode: multiply;">
                            <img src="${imgSrc}" style="max-width: 100%; max-height: 100%; object-fit: contain; position: relative; z-index: 2;">
                        </div>`
                    ).join('');
                }
            }
        };
        populateGrid('survey', 'pdfSurveyPhotosGrid');
        populateGrid('access', 'pdfAccessPhotosGrid');
        populateGrid('misc', 'pdfMiscPhotosGrid');

        // 6. Render Canvases
        ['frontelevation', 'sideelevation', 'rearelevation', 'designersketch'].forEach(id => {
            const fCanvas = window.appCanvases[id];
            const imgTag = document.getElementById(`pdfImgInternal-${id}`);
            if (fCanvas && imgTag) { 
                fCanvas.setViewportTransform([1,0,0,1,0,0]); 
                fCanvas.discardActiveObject(); 
                fCanvas.renderAll(); 
                imgTag.src = fCanvas.toDataURL({ format: 'png' });
            }
        });

        const fileNameType = isCustomer ? 'Customer_Survey' : 'Internal_Survey';
        await generateMultiPagePDF(templateId, `${surname}_${fileNameType}.pdf`, isCustomer);
    }

    // Bind Buttons
    document.getElementById('generateInternalPdfBtn')?.addEventListener('click', () => generateSurvey(false));
    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', () => generateSurvey(true));
});