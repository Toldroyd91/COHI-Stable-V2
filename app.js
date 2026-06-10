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

// Remove splash screen immediately
setTimeout(() => { 
    const splash = document.getElementById('splashScreen'); 
    if(splash) { 
        splash.style.opacity = '0'; 
        setTimeout(() => splash.style.display = 'none', 600); 
    } 
}, 1200);

document.addEventListener('DOMContentLoaded', function() {
    console.log("[Diagnostics] Blueprint Enterprise Engine Initialized.");

    // --- 1. CORE PDF ENGINE ---
    let jsPDF = window.jspdf ? window.jspdf.jsPDF : null;

    // --- 2. CONTINUOUS AUTOSAVE (Local Fallback + Cloud Override) ---
    let autoSaveTimeout;
    const triggerAutoSave = () => {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            // Local fallback
            const data = {};
            document.querySelectorAll('input:not([type="file"]), select, textarea').forEach(input => {
                if(input.id) data[input.id] = input.value;
            });
            localStorage.setItem('surveyAppData', JSON.stringify(data));
            
            // Cloud Continuous Override
            if(window.performCloudAutoSave) window.performCloudAutoSave();
        }, 1000); // Triggers 1 second after user stops typing
    };

    const savedData = JSON.parse(localStorage.getItem('surveyAppData')) || {};
    document.querySelectorAll('input:not([type="file"]), select, textarea').forEach(input => {
        if (input.id && savedData[input.id]) input.value = savedData[input.id];
        input.addEventListener('input', triggerAutoSave);
    });

    document.getElementById('resetFormBtn')?.addEventListener('click', () => {
        if(confirm("Clear all data for a new appointment?")) {
            localStorage.removeItem('surveyAppData');
            location.reload();
        }
    });

    // --- 3. GLOBAL IMAGE COMPRESSOR ---
    // This fixes the missing image logic and compresses everything to keep payloads small
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
                window.showToast("Image Compressed & Attached", true);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    const setupMultiUpload = (id, key) => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => compressAndStoreFile(file, key));
        });
    };
    setupMultiUpload('miscPhotos', 'misc');
    setupMultiUpload('surveyPhotos', 'survey');
    setupMultiUpload('accessPhotos', 'access');

    // --- 4. DYNAMIC SURVEY LABEL ---
    const updateDynamicLabel = () => {
        const needs = [];
        if (document.getElementById('treesExist')?.value === 'Yes') needs.push('Trees');
        if (document.getElementById('manholeExist')?.value === 'Yes') needs.push('Manholes');
        
        const label = document.getElementById('dynamicSurveyUploadLabel');
        if (label) {
            label.innerText = needs.length > 0 ? `Capture: ${needs.join(', ')}` : `Site Survey Photos (General)`;
            label.style.color = needs.length > 0 ? '#ffc107' : 'var(--accent)';
        }
    };
    document.querySelectorAll('.dyn-survey-select').forEach(sel => sel.addEventListener('change', updateDynamicLabel));

    // --- 5. FABRIC CANVAS ENGINE (WITH MEASUREMENT TOOL) ---
    window.appCanvases = {};
    document.querySelectorAll('.canvas-group').forEach(group => {
        const id = group.getAttribute('data-id');
        const canvasEl = group.querySelector('canvas');
        if (!canvasEl) return;

        const fCanvas = new fabric.Canvas(canvasEl.id, { isDrawingMode: false, allowTouchScrolling: true });
        window.appCanvases[id] = fCanvas;

        if(savedData['canvas_' + id]) fCanvas.loadFromJSON(savedData['canvas_' + id], fCanvas.renderAll.bind(fCanvas));

        const saveCanvas = () => { 
            const data = JSON.parse(localStorage.getItem('surveyAppData')) || {}; 
            data['canvas_' + id] = JSON.stringify(fCanvas.toJSON()); 
            localStorage.setItem('surveyAppData', JSON.stringify(data)); 
            triggerAutoSave();
        };
        fCanvas.on('object:added', saveCanvas);
        fCanvas.on('object:modified', saveCanvas);

        group.querySelector('.camera-input')?.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const imgObj = new Image();
                imgObj.onload = () => {
                    const MAX = 800;
                    let w = imgObj.width, h = imgObj.height;
                    if(w > MAX || h > MAX) {
                        const ratio = Math.min(MAX/w, MAX/h);
                        w *= ratio; h *= ratio;
                    }
                    const c = document.createElement('canvas'); c.width = w; c.height = h;
                    c.getContext('2d').drawImage(imgObj, 0, 0, w, h);
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

        // Inject Measurement Tool dynamically
        const toolSection = group.querySelector('.tool-section');
        if(toolSection && !group.querySelector('.measure-btn')) {
            const measureBtn = document.createElement('button');
            measureBtn.type = 'button'; measureBtn.className = 'tool-btn measure-btn'; measureBtn.title = 'Calibrate Scale';
            measureBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="6" x2="21" y2="18"></line><line x1="3" y1="6" x2="3" y2="18"></line></svg>';
            toolSection.appendChild(measureBtn);

            measureBtn.addEventListener('click', () => {
                group.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                measureBtn.classList.add('active');
                const knownSize = prompt("Enter real-world length of the line you will draw (in mm):");
                if(!knownSize) return;
                
                fCanvas.isDrawingMode = true;
                fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
                fCanvas.freeDrawingBrush.color = '#ff0000'; 
                fCanvas.freeDrawingBrush.width = 3;
                
                fCanvas.once('path:created', (e) => {
                    const ratio = knownSize / e.path.width;
                    fCanvas.scaleRatio = ratio;
                    window.showToast(`Calibrated: 1px = ${parseFloat(ratio).toFixed(2)}mm`);
                    fCanvas.isDrawingMode = false;
                    measureBtn.classList.remove('active');
                    group.querySelector('.lock-btn')?.classList.add('active');
                });
            });
        }

        // Repairing Tool Buttons
        const resetBtns = () => group.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));

        group.querySelector('.lock-btn')?.addEventListener('click', function() { resetBtns(); this.classList.add('active'); fCanvas.isDrawingMode = false; });
        group.querySelector('.freehand-btn')?.addEventListener('click', function() { resetBtns(); this.classList.add('active'); fCanvas.isDrawingMode = true; fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas); fCanvas.freeDrawingBrush.color = '#00E5FF'; fCanvas.freeDrawingBrush.width = 4; });
        group.querySelector('.highlight-btn')?.addEventListener('click', function() { resetBtns(); this.classList.add('active'); fCanvas.isDrawingMode = true; fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas); fCanvas.freeDrawingBrush.color = 'rgba(255, 255, 0, 0.4)'; fCanvas.freeDrawingBrush.width = 20; });
        group.querySelector('.text-btn')?.addEventListener('click', function() { resetBtns(); this.classList.add('active'); fCanvas.isDrawingMode = false; const text = new fabric.IText('Double click to edit', { left: 50, top: 50, fontFamily: 'sans-serif', fill: '#00E5FF', fontSize: 24 }); fCanvas.add(text); fCanvas.setActiveObject(text); saveCanvas(); });
        group.querySelector('.undo-btn')?.addEventListener('click', () => { const objs = fCanvas.getObjects(); if(objs.length > 0) { const last = objs[objs.length - 1]; if(objs.length === 1 && last.type === 'image') return; fCanvas.remove(last); saveCanvas(); } });
        group.querySelector('.clear-btn')?.addEventListener('click', () => { fCanvas.getObjects().filter(o => o.type !== 'image').forEach(o => fCanvas.remove(o)); saveCanvas(); });
    });

    // --- 6. PROFILE-DRIVEN PDF ENGINE WITH BRANDING INJECTION ---
    async function generateMultiPagePDF(templateId, filename) {
        if (!jsPDF) return window.showToast("PDF Engine loading, try again in a moment.", false);
        
        // Block 1 Mandatory Field Logic
        const clientName = document.getElementById('clientName')?.value.trim();
        const postCode = document.getElementById('postCode')?.value.trim();
        if(!clientName || !postCode) {
            return window.showToast("Error: Client Name & Postcode are mandatory for PDF.", false);
        }

        window.showToast("Generating Branded PDF...");

        const template = document.getElementById(templateId);
        if(!template) return;

        // Apply Dynamic Brand Colors from User Profile
        const profile = window.currentUserProfile || { brand: 'CO Home Improvements' };
        const brandStyles = {
            'Yorkshire Windows': '#005a9c',
            'CO Home Improvements': '#2C3E50',
            'Clearview': '#27ae60',
            'Orion Windows': '#d35400',
            'Planet': '#8e44ad',
            'Trent Valley Windows': '#c0392b',
            'West Yorkshire Windows': '#16a085'
        };
        const brandColor = brandStyles[profile.brand] || '#0F3759'; // Default Navy

        // Smart color swap for PDF template elements
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
            
            let heightLeft = imgHeight;
            let position = 0;
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, position, pdf.internal.pageSize.getWidth(), imgHeight);
            heightLeft -= pdfHeight;
            
            while (heightLeft > 0) {
                position = position - pdfHeight;
                pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, position, pdf.internal.pageSize.getWidth(), imgHeight);
                heightLeft -= pdfHeight;
            }
            
            pdf.save(filename);
            window.showToast("PDF Export Complete!", true);
        } catch(e) {
            console.error(e);
            window.showToast("PDF Generation Failed", false);
        } finally {
            template.style.display = 'none';
        }
    }

    // --- 7. PDF POPULATION LISTENERS ---
    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', () => {
        const rawName = document.getElementById('clientName')?.value.trim() || 'Valued Customer';
        const surname = rawName.split(' ').pop() || 'Customer';
        
        // Fetch logic from secure profile, not the dropdowns
        const profile = window.currentUserProfile || { name: 'Your Designer', phone: '07700 900000', email: 'designer@cohi.co.uk', brand: 'COHI' };
        
        document.getElementById('lp-greeting').innerText = `Dear ${rawName}, thank you for your time today to discuss your exciting new project.`;
        document.getElementById('lp-size').innerText = `Based on our measurements, we are looking at a proposed size of approximately ${document.getElementById('proposedSize')?.value || "TBC"}.`;
        document.getElementById('lp-roof').innerText = `We discussed utilizing the ${document.getElementById('roofType')?.value || "TBC"} system to ensure the space is perfect year-round.`;
        document.getElementById('lp-frame').innerText = `For the aesthetics, we have noted your preference for ${document.getElementById('frameColour')?.value || "TBC"} frames.`;
        
        const bRegs = document.getElementById('buildingRegs')?.value;
        const pPerms = document.getElementById('planningPerms')?.value;
        if (bRegs === "Yes" || (pPerms !== "No" && pPerms !== "")) {
            document.getElementById('lp-compliance').innerText = `Your project will require some compliance oversight (Building Regs: ${bRegs}, Planning: ${pPerms}). Our team handles all of this for you.`;
        } else {
            document.getElementById('lp-compliance').innerText = "Your project currently looks to be exempt from additional planning compliance, streamlining our timeline.";
        }

        const rDate = document.getElementById('revisitDate')?.value;
        if (rDate) {
            document.getElementById('lp-revisit').innerText = `I look forward to our next catch-up scheduled for ${rDate}. We will go through your custom 3D designs together then.`;
        } else {
            document.getElementById('lp-revisit').innerText = `We haven't booked in a date for our next catch-up just yet, but as soon as we work out a time, we will get you scheduled in.`;
        }

        // Profile Injection
        document.getElementById('lp-designer-name').innerText = profile.name;
        document.getElementById('lp-designer-contact').innerText = `${profile.phone} | ${profile.email}`;

        // Re-integrated Image Grid Logic
        const allCustImages = [...(window.uploadedImagesStore.misc || []), ...(window.uploadedImagesStore.survey || [])];
        const imagePage = document.getElementById('customerPdfImagePage');
        const imageGrid = document.getElementById('pdfCustomerImagesGrid');
        
        if (allCustImages.length > 0 && imagePage && imageGrid) {
            imagePage.style.display = 'block';
            imageGrid.innerHTML = allCustImages.map(imgSrc => 
                `<div style="display: inline-block; width: 46%; margin: 1%; box-sizing: border-box;">
                    <img src="${imgSrc}" style="width: 100%; height: 250px; object-fit: contain; border: 1px solid #ccc; border-radius: 4px; padding: 10px; background: #fff;">
                </div>`
            ).join('');
        } else if (imagePage) {
            imagePage.style.display = 'none';
        }

        generateMultiPagePDF('pdfTemplateCustomer', `${surname}_${profile.brand.replace(/\s+/g, '_')}_Consultation.pdf`);
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

        generateMultiPagePDF('pdfTemplateInternal', `${surname}_Internal_Survey.pdf`);
    });
});
