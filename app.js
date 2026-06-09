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

        group.querySelector('.freehand-btn')?.addEventListener('click', () => { fCanvas.isDrawingMode = true; fCanvas.freeDrawingBrush.color = '#00E5FF'; });
        group.querySelector('.lock-btn')?.addEventListener('click', () => { fCanvas.isDrawingMode = false; });
        group.querySelector('.clear-btn')?.addEventListener('click', () => { fCanvas.getObjects().filter(o => o.type !== 'image').forEach(o => fCanvas.remove(o)); saveCanvas(); });
    });

    // --- 5. PDF ENGINE WITH BRANDING INJECTION ---
    async function generateMultiPagePDF(templateId, filename) {
        if (!jsPDF) return window.showToast("PDF Engine loading, try again in a moment.", false);
        window.showToast("Generating Branded PDF...");

        const template = document.getElementById(templateId);
        if(!template) return;

        // Apply Dynamic Brand Colors
        const brand = document.getElementById('brandSelect')?.value;
        const brandStyles = {
            'Yorkshire Windows': '#005a9c',
            'CO Home Improvements': '#2C3E50',
            'Clearview': '#27ae60',
            'Orion Windows': '#d35400',
            'Planet': '#8e44ad',
            'Trent Valley Windows': '#c0392b',
            'West Yorkshire Windows': '#16a085'
        };
        const brandColor = brandStyles[brand] || '#0F3759'; // Default Navy

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

    // --- 6. PDF POPULATION LISTENERS ---
    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', () => {
        const rawName = document.getElementById('clientName')?.value.trim() || 'Valued Customer';
        const surname = rawName.split(' ').pop() || 'Customer';
        const brand = document.getElementById('brandSelect')?.value || "CO Home Improvements";
        
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

        const dName = document.getElementById('designerSelect')?.value || "Your Designer";
        document.getElementById('lp-designer-name').innerText = dName;
        
        let dPhone = "07700 900000", dEmail = "designer@cohi.co.uk";
        if (window.designerProfiles && window.designerProfiles[dName]) {
            dPhone = window.designerProfiles[dName].phone || dPhone;
            dEmail = window.designerProfiles[dName].email || dEmail;
        }
        document.getElementById('lp-designer-contact').innerText = `${dPhone} | ${dEmail}`;

        generateMultiPagePDF('pdfTemplateCustomer', `${surname}_${brand.replace(/\s+/g, '_')}_Consultation.pdf`);
    });

    document.getElementById('generateInternalPdfBtn')?.addEventListener('click', () => {
        const rawName = document.getElementById('clientName')?.value.trim() || 'Valued Customer';
        const surname = rawName.split(' ').pop() || 'Customer';

        document.getElementById('intPdfName').innerText = rawName;
        document.getElementById('intPdfDate').innerText = document.getElementById('apptDate')?.value || "N/A";
        document.getElementById('intPdfDesigner').innerText = document.getElementById('designerSelect')?.value || "N/A";
        document.getElementById('intPdfBuild').innerText = document.getElementById('buildType')?.value || "N/A";
        document.getElementById('intPdfRoof').innerText = document.getElementById('roofType')?.value || "N/A";
        document.getElementById('intPdfNotes').innerText = document.getElementById('designerNotes')?.value || "None";

        generateMultiPagePDF('pdfTemplateInternal', `${surname}_Internal_Survey.pdf`);
    });
});
