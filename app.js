// Remove splash screen immediately to ensure user is never stuck
setTimeout(() => { 
    const splash = document.getElementById('splashScreen'); 
    if(splash) { 
        splash.style.opacity = '0'; 
        setTimeout(() => splash.style.display = 'none', 600); 
    } 
}, 1200);

document.addEventListener('DOMContentLoaded', function() {
    console.log("[Diagnostics] Blueprint Enterprise Engine Loaded (Offline/Stable).");

    // --- 1. SAFEGUARD PDF ENGINE ---
    let jsPDF;
    if (window.jspdf) {
        jsPDF = window.jspdf.jsPDF;
    } else {
        console.warn("PDF library delayed or offline.");
    }

    // --- 2. AUTOSAVE FUNCTIONALITY ---
    // Safely saves every text/number/select field to localStorage
    const saveForms = () => {
        const data = {};
        document.querySelectorAll('input:not([type="file"]), select, textarea').forEach(input => {
            if(input.id) data[input.id] = input.value;
        });
        localStorage.setItem('surveyAppData', JSON.stringify(data));
    };

    const savedData = JSON.parse(localStorage.getItem('surveyAppData')) || {};
    document.querySelectorAll('input:not([type="file"]), select, textarea').forEach(input => {
        if (input.id && savedData[input.id]) {
            input.value = savedData[input.id];
        }
        input.addEventListener('input', saveForms);
    });

    document.getElementById('resetFormBtn')?.addEventListener('click', () => {
        if(confirm("Are you sure you want to clear the entire form for a new appointment?")) {
            localStorage.removeItem('surveyAppData');
            // Retain designer profiles, just clear the form
            location.reload();
        }
    });

    // --- 3. DYNAMIC SURVEY UPLOAD LABEL ---
    const updateDynamicLabel = () => {
        const trees = document.getElementById('treesExist')?.value;
        const manhole = document.getElementById('manholeExist')?.value;
        const weep = document.getElementById('weepventsExist')?.value;
        const pipes = document.getElementById('pipesExist')?.value;

        let needed = [];
        if (trees === 'Yes') needed.push('Trees');
        if (manhole === 'Yes') needed.push('Manholes');
        if (weep === 'Yes') needed.push('Weep Vents');
        if (pipes === 'Yes') needed.push('Pipes (RWP/SVP)');

        const label = document.getElementById('dynamicSurveyUploadLabel');
        if (label) {
            if (needed.length > 0) {
                label.innerText = `Site Survey Photos (Please capture: ${needed.join(', ')})`;
                label.style.color = '#ffc107'; 
            } else {
                label.innerText = `Site Survey Photos (General)`;
                label.style.color = 'var(--accent)';
            }
        }
    };

    document.querySelectorAll('.dyn-survey-select').forEach(sel => {
        sel.addEventListener('change', updateDynamicLabel);
    });
    updateDynamicLabel(); // Run once on load

    // --- 4. PROFILE MANAGER ---
    window.designerProfiles = JSON.parse(localStorage.getItem('savedDesignerProfiles')) || {};
    const refreshDropdown = () => {
        const list = document.getElementById('designerList');
        if (list) list.innerHTML = Object.keys(window.designerProfiles).map(n => `<option value="${n}">`).join('');
    };
    refreshDropdown();

    document.getElementById('openProfileManagerBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        const cur = document.getElementById('designerSelect').value;
        if (window.designerProfiles[cur]) {
            document.getElementById('profName').value = cur;
            document.getElementById('profEmail').value = window.designerProfiles[cur].email;
            document.getElementById('profPhone').value = window.designerProfiles[cur].phone;
        }
        document.getElementById('profileModal').style.display = 'flex';
    });

    document.getElementById('closeProfileBtn')?.addEventListener('click', () => document.getElementById('profileModal').style.display = 'none');
    
    document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
        const name = document.getElementById('profName').value.trim();
        if (!name) return alert("Enter designer name");
        window.designerProfiles[name] = { email: document.getElementById('profEmail').value, phone: document.getElementById('profPhone').value };
        localStorage.setItem('savedDesignerProfiles', JSON.stringify(window.designerProfiles));
        document.getElementById('designerSelect').value = name;
        refreshDropdown();
        document.getElementById('profileModal').style.display = 'none';
        saveForms();
    });

    // --- 5. FABRIC CANVAS V2 ---
    window.appCanvases = {};
    document.querySelectorAll('.canvas-group').forEach(group => {
        const id = group.getAttribute('data-id');
        const canvasEl = group.querySelector('canvas');
        if (!canvasEl) return;

        const fCanvas = new fabric.Canvas(canvasEl.id, { 
            isDrawingMode: false, allowTouchScrolling: true, selection: true
        });
        window.appCanvases[id] = fCanvas;

        // Load existing canvas data if any
        if(savedData['canvas_' + id]) {
            fCanvas.loadFromJSON(savedData['canvas_' + id], fCanvas.renderAll.bind(fCanvas));
        }

        const saveCanvasState = () => { 
            const data = JSON.parse(localStorage.getItem('surveyAppData')) || {}; 
            data['canvas_' + id] = JSON.stringify(fCanvas.toJSON()); 
            localStorage.setItem('surveyAppData', JSON.stringify(data)); 
        }; 
        fCanvas.on('object:added', saveCanvasState); 
        fCanvas.on('object:modified', saveCanvasState); 

        const fileInput = group.querySelector('.camera-input');
        if(fileInput) {
            fileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(f) {
                    fabric.Image.fromURL(f.target.result, function(img) {
                        fCanvas.clear();
                        const scale = Math.min(fCanvas.width / img.width, fCanvas.height / img.height);
                        img.set({ scaleX: scale, scaleY: scale, originX: 'center', originY: 'center', left: fCanvas.width/2, top: fCanvas.height/2, selectable: false });
                        fCanvas.add(img); fCanvas.sendToBack(img); saveCanvasState();
                    });
                };
                reader.readAsDataURL(file);
            });
        }

        const resetButtons = () => group.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        
        group.querySelector('.lock-btn')?.addEventListener('click', function() {
            resetButtons(); this.classList.add('active');
            fCanvas.isDrawingMode = false;
        });

        group.querySelector('.freehand-btn')?.addEventListener('click', function() {
            resetButtons(); this.classList.add('active');
            fCanvas.isDrawingMode = true;
            fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
            fCanvas.freeDrawingBrush.color = '#00E5FF';
            fCanvas.freeDrawingBrush.width = 4;
        });

        group.querySelector('.highlight-btn')?.addEventListener('click', function() {
            resetButtons(); this.classList.add('active');
            fCanvas.isDrawingMode = true;
            fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
            fCanvas.freeDrawingBrush.color = 'rgba(255, 255, 0, 0.4)';
            fCanvas.freeDrawingBrush.width = 20;
        });

        group.querySelector('.text-btn')?.addEventListener('click', function() {
            resetButtons(); this.classList.add('active');
            fCanvas.isDrawingMode = false;
            const text = new fabric.IText('Double click to edit', { 
                left: 50, top: 50, fontFamily: 'sans-serif', fill: '#00E5FF', fontSize: 24 
            });
            fCanvas.add(text);
            fCanvas.setActiveObject(text);
            saveCanvasState();
        });

        group.querySelector('.undo-btn')?.addEventListener('click', function() {
            const objects = fCanvas.getObjects();
            if(objects.length > 0) {
                const lastObj = objects[objects.length - 1];
                if(objects.length === 1 && lastObj.type === 'image') return; 
                fCanvas.remove(lastObj);
                saveCanvasState();
            }
        });

        group.querySelector('.clear-btn')?.addEventListener('click', function() {
            if(confirm("Clear drawings on this canvas?")) {
                const objects = fCanvas.getObjects();
                const toRemove = objects.filter(o => o.type !== 'image');
                toRemove.forEach(o => fCanvas.remove(o));
                saveCanvasState();
            }
        });
    });

    // --- 6. IMAGE UPLOAD HANDLERS ---
    const uploadedImagesStore = { misc: [], survey: [], access: [] };

    const handleMultiUpload = (inputId, storeKey) => {
        const el = document.getElementById(inputId);
        if(!el) return;
        el.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => uploadedImagesStore[storeKey].push(event.target.result);
                reader.readAsDataURL(file);
            });
        });
    };
    handleMultiUpload('miscPhotos', 'misc');
    handleMultiUpload('surveyPhotos', 'survey');
    handleMultiUpload('accessPhotos', 'access');

    // --- 7. MULTI-PAGE PDF ENGINE (Forced Full-Render) ---
    async function generateMultiPagePDF(templateId, filename) {
        if (!jsPDF) return alert("PDF Engine loading, please try again in a few seconds.");
        
        const template = document.getElementById(templateId);
        if(!template) return alert("Error: Template missing");

        // Prepare Template: Reveal without affecting scroll flow
        template.style.display = 'block';
        template.style.position = 'absolute';
        template.style.top = '0px';
        template.style.left = '0px';
        template.style.zIndex = '-9999';
        template.style.width = '800px';

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // Render the FULL template in one go using scrollHeight
            const canvas = await html2canvas(template, { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                windowWidth: 800,
                windowHeight: template.scrollHeight 
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            
            // Calculate total image height in PDF millimeters
            const canvasHeightInMM = (canvas.height * pdfWidth) / canvas.width;
            
            let heightLeft = canvasHeightInMM;
            let position = 0;
            
            // Print first page slice
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, canvasHeightInMM);
            heightLeft -= pdfHeight;
            
            // Loop for additional pages if document is longer than A4
            while (heightLeft > 0) {
                position = position - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, canvasHeightInMM);
                heightLeft -= pdfHeight;
            }
            
            pdf.save(filename);
        } catch(e) {
            console.error(e);
            alert("PDF Generation failed. Please try again.");
        } finally {
            template.style.display = 'none';
        }
    }

    // Customer PDF Button
    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async () => {
        const nameInput = document.getElementById('clientName');
        const rawName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : 'Valued Customer';
        const surname = rawName.split(' ').pop() || 'Customer';
        
        const size = document.getElementById('proposedSize')?.value || "TBC";
        const roof = document.getElementById('roofType')?.value || "TBC";
        const frame = document.getElementById('frameColour')?.value || "TBC";
        const designerName = document.getElementById('designerSelect')?.value || "Your Designer";
        const bRegs = document.getElementById('buildingRegs')?.value || "No";
        const pPerms = document.getElementById('planningPerms')?.value || "No";
        const rDate = document.getElementById('revisitDate')?.value;
        const rLoc = document.getElementById('revisitLocation')?.value;
        
        // Populate text fields
        document.getElementById('lp-greeting').innerText = `Dear ${rawName}, thank you for your time today to discuss your exciting new project.`;
        document.getElementById('lp-size').innerText = `Based on our measurements, we are looking at a proposed size of approximately ${size}.`;
        document.getElementById('lp-roof').innerText = `We discussed utilizing the ${roof} system to ensure the space is perfect year-round.`;
        document.getElementById('lp-frame').innerText = `For the aesthetics, we have noted your preference for ${frame} frames.`;
        
        let compText = "";
        if (bRegs === "Yes" || (pPerms !== "No" && pPerms !== "")) {
            compText = `Your project will require some compliance oversight (Building Regs: ${bRegs}, Planning: ${pPerms}). Our team handles all of this for you.`;
        } else {
            compText = "Your project currently looks to be exempt from additional planning compliance, streamlining our timeline.";
        }
        document.getElementById('lp-compliance').innerText = compText;

        const revisitEl = document.getElementById('lp-revisit');
        if (revisitEl) {
            if (rDate) {
                revisitEl.innerText = `I look forward to our next catch-up scheduled for ${rDate}${rLoc ? ` at ${rLoc}` : ''}. We will go through your custom 3D designs together then. If you need anything before I next get in touch, please contact me on the details below.`;
            } else {
                revisitEl.innerText = `We haven't booked in a date for our next catch-up just yet, but as soon as we work out a time, we will get you scheduled in. If you need anything before I next get in touch, please contact me on the details below.`;
            }
        }

        document.getElementById('lp-designer-name').innerText = designerName;
        
        let designerPhone = "07700 900000";
        let designerEmail = "designer@cohi.co.uk";
        if (window.designerProfiles && window.designerProfiles[designerName]) {
            designerPhone = window.designerProfiles[designerName].phone || designerPhone;
            designerEmail = window.designerProfiles[designerName].email || designerEmail;
        }
        document.getElementById('lp-designer-contact').innerText = `${designerPhone} | ${designerEmail}`;

        // Populate inline-block images
        const allCustImages = [...uploadedImagesStore.misc, ...uploadedImagesStore.survey];
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

        await generateMultiPagePDF('pdfTemplateCustomer', `${surname}_Design_Consultation.pdf`);
    });

    // Internal PDF Button
    document.getElementById('generateInternalPdfBtn')?.addEventListener('click', async () => {
        const nameInput = document.getElementById('clientName');
        const rawName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : 'Valued Customer';
        const surname = rawName.split(' ').pop() || 'Customer';

        document.getElementById('intPdfName').innerText = rawName;
        document.getElementById('intPdfDate').innerText = document.getElementById('apptDate')?.value || "N/A";
        document.getElementById('intPdfDesigner').innerText = document.getElementById('designerSelect')?.value || "N/A";
        document.getElementById('intPdfBuild').innerText = document.getElementById('buildType')?.value || "N/A";
        document.getElementById('intPdfRoof').innerText = document.getElementById('roofType')?.value || "N/A";
        document.getElementById('intPdfNotes').innerText = document.getElementById('designerNotes')?.value || "None";

        await generateMultiPagePDF('pdfTemplateInternal', `${surname}_Internal_Survey.pdf`);
    });
});
