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

// Remove splash screen
setTimeout(() => { const splash = document.getElementById('splashScreen'); if(splash) { splash.style.opacity = '0'; setTimeout(() => splash.style.display = 'none', 600); } }, 1200);

document.addEventListener('DOMContentLoaded', function() {
    console.log("[Diagnostics] Blueprint Enterprise Engine Initialized (V2 Modular Hybrid).");
    let jsPDF = window.jspdf ? window.jspdf.jsPDF : null;

    // --- 1. CONTINUOUS AUTOSAVE ---
    let autoSaveTimeout;
    const triggerAutoSave = () => {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            const data = {};
            document.querySelectorAll('input:not([type="file"]), select, textarea').forEach(input => { if(input.id) data[input.id] = input.value; });
            localStorage.setItem('surveyAppData', JSON.stringify(data));
            if(window.performCloudAutoSave) window.performCloudAutoSave();
        }, 1000); 
    };

    const savedData = JSON.parse(localStorage.getItem('surveyAppData')) || {};
    document.querySelectorAll('input:not([type="file"]), select, textarea').forEach(input => {
        if (input.id && savedData[input.id]) input.value = savedData[input.id];
        input.addEventListener('input', triggerAutoSave);
    });

    document.getElementById('resetFormBtn')?.addEventListener('click', () => {
        if(confirm("Clear all data for a new appointment?")) { localStorage.removeItem('surveyAppData'); location.reload(); }
    });

    // --- 2. GLOBAL IMAGE COMPRESSOR ---
    window.uploadedImagesStore = { misc: [], survey: [], access: [] };
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
        const label = document.getElementById('dynamicSurveyUploadLabel');
        if (label) { label.innerText = needs.length > 0 ? `Capture: ${needs.join(', ')}` : `Site Survey Photos (General)`; label.style.color = needs.length > 0 ? '#ffc107' : 'var(--accent)'; }
    };
    document.querySelectorAll('.dyn-survey-select').forEach(sel => sel.addEventListener('change', updateDynamicLabel));

    // --- 3. FABRIC CANVAS ENGINE (WITH DIMENSIONAL INTELLIGENCE) ---
    window.appCanvases = {};
    document.querySelectorAll('.canvas-group').forEach(group => {
        const id = group.getAttribute('data-id');
        const canvasEl = group.querySelector('canvas');
        if (!canvasEl) return;

        const fCanvas = new fabric.Canvas(canvasEl.id, { isDrawingMode: false, allowTouchScrolling: true, selection: false });
        window.appCanvases[id] = fCanvas;
        fCanvas.isCalibrating = false; 
        fCanvas.scaleRatio = 5; // Default: 1px = 5mm (Will be updated by measure tool)

        if(savedData['canvas_' + id]) fCanvas.loadFromJSON(savedData['canvas_' + id], fCanvas.renderAll.bind(fCanvas));

        const saveCanvas = () => { 
            const data = JSON.parse(localStorage.getItem('surveyAppData')) || {}; 
            data['canvas_' + id] = JSON.stringify(fCanvas.toJSON()); 
            localStorage.setItem('surveyAppData', JSON.stringify(data)); 
            triggerAutoSave();
        };

        // --- NEW LINE & AUTO-DIM TOOLS ---
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

                // DIMENSIONAL INTELLIGENCE: SHIFT-SNAP (45° Increments)
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
                        
                        // Apply Scale Calibration
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
                        img.set({ scaleX: 1, scaleY: 1, originX: 'center', originY: 'center', left: fCanvas.width/2, top: fCanvas.height/2, selectable: false });
                        fCanvas.add(img); fCanvas.sendToBack(img); saveCanvas();
                    });
                };
                imgObj.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Setup Calibration & Tool Buttons
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
                    fCanvas.remove(e.path); // Remove the ugly calibration scribble
                    measureBtn.classList.remove('active'); group.querySelector('.lock-btn')?.classList.add('active');
                });
            });
            
            // Add Line & Dim Line buttons dynamically if missing
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

    // --- 4. LIVE AI NOTES REWRITER (FIREBASE CONNECTED) ---
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

    // --- 5. SECURE WATERMARK & PDF ENGINE ---
    async function generateMultiPagePDF(templateId, filename) {
        if (!jsPDF) return window.showToast("PDF Engine loading...", false);
        
        const clientName = document.getElementById('clientName')?.value.trim();
        const postCode = document.getElementById('postCode')?.value.trim();
        if(!clientName || !postCode) return window.showToast("Error: Client Name & Postcode are mandatory.", false);

        window.showToast("Generating Branded PDF...");
        const template = document.getElementById(templateId);
        if(!template) return;

        const profile = window.currentUserProfile || { brand: 'CO Home Improvements' };
        const brandStyles = { 'Yorkshire Windows': '#005a9c', 'CO Home Improvements': '#2C3E50', 'Clearview': '#27ae60', 'Orion Windows': '#d35400', 'Planet': '#8e44ad', 'Trent Valley Windows': '#c0392b', 'West Yorkshire Windows': '#16a085' };
        const brandColor = brandStyles[profile.brand] || '#0F3759';

        template.querySelectorAll('*').forEach(el => {
            if (el.style.color === 'rgb(15, 55, 89)' || el.style.color === '#0F3759') el.style.color = brandColor;
            if (el.style.backgroundColor === 'rgb(15, 55, 89)' || el.style.backgroundColor === '#0F3759') el.style.backgroundColor = brandColor;
            if (el.style.borderBottomColor === 'rgb(15, 55, 89)' || el.style.borderBottomColor === '#0F3759') el.style.borderBottomColor = brandColor;
            if (el.style.borderLeftColor === 'rgb(15, 55, 89)' || el.style.borderLeftColor === '#0F3759') el.style.borderLeftColor = brandColor;
        });

        template.style.display = 'block'; template.style.position = 'absolute'; template.style.width = '800px'; template.style.zIndex = '-9999';
        
        try {
            const canvas = await html2canvas(template, { scale: 2, windowWidth: 800, windowHeight: template.scrollHeight });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgHeight = (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width;
            
            let heightLeft = imgHeight; let position = 0; const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // Render first page with Watermark Shield
            pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, position, pdf.internal.pageSize.getWidth(), imgHeight);
            pdf.setTextColor(200, 200, 200); pdf.setFontSize(40);
            pdf.text(profile.brand.toUpperCase(), pdf.internal.pageSize.getWidth() / 2, pdfHeight / 2, { angle: 45, align: 'center', opacity: 0.1 });
            heightLeft -= pdfHeight;
            
            // Loop for subsequent pages
            while (heightLeft > 0) { 
                position = position - pdfHeight; 
                pdf.addPage(); 
                pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, position, pdf.internal.pageSize.getWidth(), imgHeight); 
                pdf.text(profile.brand.toUpperCase(), pdf.internal.pageSize.getWidth() / 2, pdfHeight / 2, { angle: 45, align: 'center', opacity: 0.1 });
                heightLeft -= pdfHeight; 
            }
            
            pdf.save(filename);
            window.showToast("PDF Export Complete!", true);
        } catch(e) { console.error(e); window.showToast("PDF Generation Failed", false); } 
        finally { template.style.display = 'none'; }
    }

    // PDF POPULATION
    const populateCustomerData = (prefix) => {
        const rawName = document.getElementById('clientName')?.value.trim() || 'Valued Customer';
        document.getElementById(`${prefix}-greeting`).innerText = `Dear ${rawName}, thank you for your time today to discuss your exciting new project.`;
        document.getElementById(`${prefix}-size`).innerText = `Based on our measurements, we are looking at a proposed size of approximately ${document.getElementById('proposedSize')?.value || "TBC"}.`;
        document.getElementById(`${prefix}-roof`).innerText = `We discussed utilizing the ${document.getElementById('roofType')?.value || "TBC"} system to ensure the space is perfect year-round.`;
        document.getElementById(`${prefix}-frame`).innerText = `For the aesthetics, we have noted your preference for ${document.getElementById('frameColour')?.value || "TBC"} frames.`;
        
        const custNotes = document.getElementById('customerNotes')?.value;
        const noteBox = document.getElementById(`${prefix}-custom-notes-box`);
        if(custNotes && noteBox) {
            document.getElementById(`${prefix}-custom-notes`).innerText = custNotes;
            noteBox.style.display = 'block';
        } else if (noteBox) {
            noteBox.style.display = 'none';
        }
    };

    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', () => {
        const surname = (document.getElementById('clientName')?.value.trim() || 'Customer').split(' ').pop();
        const profile = window.currentUserProfile || { name: 'Designer', phone: '07700 900000', email: '', brand: 'COHI' };
        
        populateCustomerData('lp');
        
        const bRegs = document.getElementById('buildingRegs')?.value; const pPerms = document.getElementById('planningPerms')?.value;
        document.getElementById('lp-compliance').innerText = (bRegs === "Yes" || (pPerms !== "No" && pPerms !== "")) ? `Your project will require compliance oversight (Building Regs: ${bRegs}, Planning: ${pPerms}). Our team handles all of this for you.` : "Your project currently looks to be exempt from additional planning compliance, streamlining our timeline.";
        
        const rDate = document.getElementById('revisitDate')?.value;
        document.getElementById('lp-revisit').innerText = rDate ? `I look forward to our next catch-up scheduled for ${rDate}. We will go through your custom 3D designs together then.` : `We haven't booked in a date for our next catch-up just yet, but as soon as we work out a time, we will get you scheduled in.`;

        document.getElementById('lp-designer-name').innerText = profile.name; document.getElementById('lp-designer-contact').innerText = `${profile.phone} | ${profile.email}`;

        generateMultiPagePDF('pdfTemplateCustomer', `${surname}_Facts_Sheet.pdf`);
    });

    document.getElementById('generateHybridPdfBtn')?.addEventListener('click', () => {
        const surname = (document.getElementById('clientName')?.value.trim() || 'Customer').split(' ').pop();
        const profile = window.currentUserProfile || { name: 'Designer', brand: 'COHI' };
        
        document.getElementById('hybPdfName').innerText = document.getElementById('clientName')?.value || 'TBC';
        document.getElementById('hybPdfDate').innerText = document.getElementById('apptDate')?.value || new Date().toLocaleDateString();
        
        populateCustomerData('hyb');

        const allCustImages = [...(window.uploadedImagesStore.misc || []), ...(window.uploadedImagesStore.survey || [])];
        const imagePage = document.getElementById('hybridPdfImagePage');
        const imageGrid = document.getElementById('pdfHybridImagesGrid');
        if (allCustImages.length > 0 && imagePage && imageGrid) {
            imagePage.style.display = 'block';
            imageGrid.innerHTML = allCustImages.map(imgSrc => `<div style="display: inline-block; width: 46%; margin: 1%; box-sizing: border-box;"><img src="${imgSrc}" style="width: 100%; height: 250px; object-fit: contain; border: 1px solid #ccc; border-radius: 4px; padding: 10px; background: #fff;"></div>`).join('');
        } else if (imagePage) { imagePage.style.display = 'none'; }

        generateMultiPagePDF('pdfTemplateHybrid', `${surname}_Design_Survey.pdf`);
    });

    document.getElementById('generateInternalPdfBtn')?.addEventListener('click', () => {
        const rawName = document.getElementById('clientName')?.value.trim() || 'Valued Customer';
        const surname = rawName.split(' ').pop() || 'Customer';
        const profile = window.currentUserProfile || { name: 'N/A' };

        document.getElementById('intPdfName').innerText = rawName;
        document.getElementById('intPdfDate').innerText = document.getElementById('apptDate')?.value || "N/A";
        document.getElementById('intPdfDesigner').innerText = profile.name;
        document.getElementById('intPdfBuild').innerText = document.getElementById('buildType')?.value || "N/A";
        document.getElementById('intPdfRoof').innerText = document.getElementById('roofType')?.value || "N/A";
        document.getElementById('intPdfNotes').innerText = document.getElementById('designerNotes')?.value || "None";

        generateMultiPagePDF('pdfTemplateInternal', `${surname}_Technical_Survey.pdf`);
    });
});
