document.addEventListener('DOMContentLoaded', function() {
    console.log("[Blueprint Enterprise] Luxury OS Boot Sequence Initiated (PDF Patch).");

    // --- PWA / SERVICE WORKER REGISTRATION ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('Service Worker Error', err));
    }

    // --- PDF BINDING & GENERATION ---
    function getSurveyData() {
        const dName = document.getElementById('designerSelect')?.value || "Surveyor";
        const selectedBrand = document.getElementById('brandSelect')?.value || "CO Home Improvements";
        const profiles = window.designerProfiles || {}; 
        const profile = profiles[dName] || { phone: "", email: "" };
        
        return {
            clientName: document.getElementById('clientName')?.value || 'Customer',
            clientNum: document.getElementById('clientNum')?.value || '',
            address: document.getElementById('postCode')?.value || '',
            date: document.getElementById('apptDate')?.value || new Date().toLocaleDateString('en-GB'),
            buildType: document.getElementById('buildType')?.value || '',
            roofType: document.getElementById('roofType')?.value || '',
            proposedSize: document.getElementById('proposedSize')?.value || '',
            frameColour: document.getElementById('frameColour')?.value || '',
            sapCalcs: document.getElementById('sapCalcs')?.value || '',
            planningPerms: document.getElementById('planningPerms')?.value || '',
            weepVents: document.getElementById('weepventsExist')?.value || '',
            designerName: dName,
            designerPhone: profile.phone,
            designerEmail: profile.email
        };
    }

    // RESTORED: This maps the inputs to the PDF template fields
    async function renderPdfFields(data) {
        const fields = ['BuildType', 'RoofType', 'ProposedSize', 'FrameColour', 'HouseMaterial', 'DpcDepth', 'FasciaHeight', 'AirBricks', 'BuildingRegs', 'PlanningPerms', 'SapCalcs', 'Budget', 'AccessDifficult', 'AccessWidth', 'WallObstacles', 'DesignerNotes', 'MiscNotes'];
        
        fields.forEach(key => {
            const inputEl = document.getElementById(key.charAt(0).toLowerCase() + key.slice(1));
            const textEl = document.getElementById(`pdf${key}`);
            if (inputEl && textEl) textEl.innerText = inputEl.value;
        });
        
        document.querySelectorAll('.bind-name').forEach(el => el.innerText = data.clientName);
        document.querySelectorAll('.bind-num').forEach(el => el.innerText = data.clientNum);
        document.querySelectorAll('.bind-address').forEach(el => el.innerText = data.address);
        document.querySelectorAll('.bind-date').forEach(el => el.innerText = data.date);
    }

    document.getElementById('generateInternalPdfBtn')?.addEventListener('click', async function() {
        const data = getSurveyData();
        const template = document.getElementById('pdfTemplateInternal');
        
        // Ensure template is visible to html2canvas
        template.style.display = 'block';
        await renderPdfFields(data);
        
        // Execute generation
        await executeSecurePDFGeneration('pdfTemplateInternal', `${data.clientName}_Survey.pdf`, this, data);
        template.style.display = 'none';
    });

    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async function() {
        const data = getSurveyData();
        const template = document.getElementById('pdfTemplateCustomer');
        
        template.style.display = 'block';
        // Populate customer-specific greeting logic
        document.getElementById('lp-greeting').innerText = `Hi ${data.clientName.split(' ')[0]}, thank you for your time today...`;
        
        await executeSecurePDFGeneration('pdfTemplateCustomer', `${data.clientName}_Design.pdf`, this, data);
        template.style.display = 'none';
    });

    // ... (Keep your existing Canvas, Profile, and Dictation logic here) ...
});
