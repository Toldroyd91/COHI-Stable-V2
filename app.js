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

    // --- 2. AUTOSAVE (Local Fallback) ---
    const saveForms = () => {
        const data = {};
        document.querySelectorAll('input:not([type="file"]), select, textarea').forEach(input => {
            if(input.id) data[input.id] = input.value;
        });
        localStorage.setItem('surveyAppData', JSON.stringify(data));
    };

    const savedData = JSON.parse(localStorage.getItem('surveyAppData')) || {};
    document.querySelectorAll('input:not([type="file"]), select, textarea').forEach(input => {
        if (input.id && savedData[input.id]) input.value = savedData[input.id];
        input.addEventListener('input', saveForms);
    });

    document.getElementById('resetFormBtn')?.addEventListener('click', () => {
        if(confirm("Clear all data for a new appointment?")) {
            localStorage.removeItem('surveyAppData');
            location.reload();
        }
    });

    // --- 3. DYNAMIC SURVEY LABEL ---
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

    // --- 4. FABRIC CANVAS ENGINE (WITH COMPRESSION) ---
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

        // Tool buttons
        group.querySelector('.freehand-btn')?.addEventListener('click', () => { fCanvas.isDrawingMode = true; fCanvas.freeDrawingBrush.color = '#00E5FF'; });
        group.querySelector('.lock-btn')?.addEventListener('click', () => { fCanvas.isDrawingMode = false; });
        group.querySelector('.clear-btn')?.addEventListener('click', () => { fCanvas.getObjects().filter(o => o.type !== 'image').forEach(o => fCanvas.remove(o)); saveCanvas(); });
    });

    // --- 5. PDF ENGINE ---
    async function generateMultiPagePDF(templateId, filename) {
        const template = document.getElementById(templateId);
        template.style.display = 'block'; template.style.position = 'absolute'; template.style.width = '800px'; template.style.zIndex = '-9999';
        const canvas = await html2canvas(template, { scale: 2, windowWidth: 800, windowHeight: template.scrollHeight });
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgHeight = (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width;
        pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), imgHeight);
        pdf.save(filename);
        template.style.display = 'none';
    }

    // PDF Event Listeners
    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', () => generateMultiPagePDF('pdfTemplateCustomer', 'Design_Consultation.pdf'));
    document.getElementById('generateInternalPdfBtn')?.addEventListener('click', () => generateMultiPagePDF('pdfTemplateInternal', 'Internal_Survey.pdf'));
});
