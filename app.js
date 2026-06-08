document.addEventListener('DOMContentLoaded', function() {
    console.log("[Diagnostics] Blueprint Enterprise Engine Loaded (Offline/Stable).");
    const { jsPDF } = window.jspdf;

    // --- 0. HIDE SPLASH SCREEN ---
    setTimeout(() => { 
        const splash = document.getElementById('splashScreen'); 
        if(splash) { 
            splash.style.opacity = '0'; 
            setTimeout(() => splash.style.display = 'none', 600); 
        } 
    }, 1000);

    // --- 1. DYNAMIC SURVEY UPLOAD LABEL ---
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

    // --- 2. PROFILE MANAGER ---
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
    });

    // --- 3. FABRIC CANVAS V2 ---
    window.appCanvases = {};
    document.querySelectorAll('.canvas-group').forEach(group => {
        const id = group.getAttribute('data-id');
        const canvasEl = group.querySelector('canvas');
        if (!canvasEl) return;

        const fCanvas = new fabric.Canvas(canvasEl.id, { 
            isDrawingMode: false, allowTouchScrolling: true, selection: true
        });
        window.appCanvases[id] = fCanvas;

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

    // --- 4. IMAGE UPLOAD HANDLERS ---
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

    // --- 5. MULTI-PAGE PDF ENGINE (Truncation Fix) ---
    
    async function generateMultiPagePDF(templateId, filename) {
        const template = document.getElementById(templateId);
        if(!template) return alert("Error: Template missing");

        // FIX: Store current scroll position and instantly jump to top to prevent HTML2Canvas viewport clipping
        const originalScroll = window.scrollY;
        window.scrollTo(0, 0);

        // Bring template into the document flow but hide it visually behind the UI
        template.style.display = 'block';
        template.style.position = 'absolute';
        template.style.top = '0px';
        template.style.left = '0px';
        template.style.zIndex = '-9999';

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            
            const pages = Array.from(template.querySelectorAll('.pdf-page')).filter(p => p.style.display !== 'none');
            
            for (let i = 0; i < pages.length; i++) {
                const pageEl = pages[i];
                pageEl.style.backgroundColor = '#ffffff';

                // FIX: Force scrollY to 0 so HTML2Canvas captures the full element height
                const canvas = await html2canvas(pageEl, { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    scrollY: 0, 
                    windowWidth: 800,
                    windowHeight: pageEl.scrollHeight
                });
                
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
                
                if (i < pages.length - 1) {
                    pdf.addPage();
                }
            }
            
            pdf.save(filename);
        } catch(e) {
            console.error(e);
            alert("PDF Generation failed. Please try again.");
        } finally {
            // Restore original UI state and scroll position
            template.style.display = 'none';
            window.scrollTo(0, originalScroll);
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
        
        document.getElementById('lp-greeting').innerText = `Dear ${rawName}, thank you for your time today to discuss your exciting new project.`;
        document.getElementById('lp-size').innerText = `Based on our measurements, we are looking at a proposed size of approximately ${size}.`;
        document.getElementById('lp-roof').innerText = `We discussed utilizing the ${roof} system to ensure the space is perfect year-round.`;
        document.getElementById('lp-frame').innerText = `For the aesthetics, we have noted your preference for ${frame} frames.`;
        document.getElementById('lp-designer-name').innerText = designerName;

        const allCustImages = [...uploadedImagesStore.misc, ...uploadedImagesStore.survey];
        const imagePage = document.getElementById('customerPdfImagePage');
        const imageGrid = document.getElementById('pdfCustomerImagesGrid');
        
        if (allCustImages.length > 0 && imagePage && imageGrid) {
            imagePage.style.display = 'block';
            imageGrid.innerHTML = allCustImages.map(imgSrc => 
                `<img src="${imgSrc}" style="width: 100%; height: 200px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px;">`
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
