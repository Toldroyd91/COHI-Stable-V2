document.addEventListener('DOMContentLoaded', function() {
    console.log("[Blueprint Enterprise] Full Engine Loaded (Stable PDF Mode).");
    const { jsPDF } = window.jspdf;

    // --- 1. Profile Manager ---
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
        if (!name) return alert("Enter name");
        window.designerProfiles[name] = { email: document.getElementById('profEmail').value, phone: document.getElementById('profPhone').value };
        localStorage.setItem('savedDesignerProfiles', JSON.stringify(window.designerProfiles));
        document.getElementById('designerSelect').value = name;
        refreshDropdown();
        document.getElementById('profileModal').style.display = 'none';
    });

    // --- 2. Canvas & Tools (The stable drawing logic) ---
    window.appCanvases = {};
    document.querySelectorAll('.canvas-group').forEach(group => {
        const id = group.getAttribute('data-id');
        const canvasEl = group.querySelector('canvas');
        if (!canvasEl) return;

        const fCanvas = new fabric.Canvas(canvasEl.id, { isDrawingMode: false, allowTouchScrolling: true });
        window.appCanvases[id] = fCanvas;

        const savedData = JSON.parse(localStorage.getItem('surveyAppData')) || {};
        if(savedData['canvas_' + id]) fCanvas.loadFromJSON(savedData['canvas_' + id], fCanvas.renderAll.bind(fCanvas));

        // Tool binding (Simplified to restore stability)
        group.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // This is where we will map your tool logic back precisely
                if (btn.classList.contains('freehand-btn')) fCanvas.isDrawingMode = true;
                else fCanvas.isDrawingMode = false;
            });
        });
    });

    // --- 3. PDF Generator (Memory-Safe) ---
    async function executeSecurePDFGeneration(templateId, fileName, data) {
        const template = document.getElementById(templateId);
        const mainApp = document.querySelector('main');
        
        // Hide UI to ensure Safari doesn't run out of memory during capture
        mainApp.style.display = 'none';
        template.style.display = 'block';
        window.scrollTo(0, 0);

        try {
            await new Promise(r => setTimeout(r, 800)); // Allow render
            const doc = new jsPDF('p', 'mm', 'a4');
            const margin = 10;
            const pdfPrintWidth = doc.internal.pageSize.getWidth() - (margin * 2);

            if (templateId === 'pdfTemplateInternal') {
                let pages = Array.from(template.querySelectorAll('.pdf-page'));
                for(let i = 0; i < pages.length; i++) {
                    const canvas = await html2canvas(pages[i], { scale: 1.5, useCORS: true, windowWidth: 800 });
                    const imgData = canvas.toDataURL('image/jpeg', 0.85);
                    if (i > 0) doc.addPage();
                    doc.addImage(imgData, 'JPEG', margin, margin, pdfPrintWidth, (canvas.height * pdfPrintWidth) / canvas.width);
                }
            } else {
                const canvas = await html2canvas(template.querySelector('.pdf-page'), { scale: 1.5, useCORS: true, windowWidth: 800 });
                doc.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', margin, margin, pdfPrintWidth, (canvas.height * pdfPrintWidth) / canvas.width);
            }
            doc.save(fileName);
        } catch (e) { alert("PDF Error: " + e.message); } 
        finally {
            template.style.display = 'none';
            mainApp.style.display = 'block';
        }
    }

    // --- Buttons ---
    document.getElementById('generateInternalPdfBtn')?.addEventListener('click', async function() {
        await executeSecurePDFGeneration('pdfTemplateInternal', 'Internal_Survey.pdf', {});
    });

    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async function() {
        await executeSecurePDFGeneration('pdfTemplateCustomer', 'Proposal.pdf', {});
    });
});
