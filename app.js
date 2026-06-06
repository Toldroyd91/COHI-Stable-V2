document.addEventListener('DOMContentLoaded', function() {
    console.log("[Blueprint Enterprise] Diagnostic Engine Loaded. (Failsafe PDF Mode)");
    const { jsPDF } = window.jspdf;

    // --- 1. PROFILE MANAGER ---
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

    // --- 2. AUTOSAVE ENGINE ---
    document.querySelectorAll('input:not([type="file"]), select, textarea').forEach(input => {
        const saved = JSON.parse(localStorage.getItem('surveyAppData')) || {};
        if (saved[input.id]) input.value = saved[input.id];
        input.addEventListener('input', () => {
            const data = JSON.parse(localStorage.getItem('surveyAppData')) || {};
            data[input.id] = input.value;
            localStorage.setItem('surveyAppData', JSON.stringify(data));
        });
    });

    document.getElementById('resetFormBtn')?.addEventListener('click', () => {
        if(confirm("Are you sure you want to clear the entire form for a new appointment?")) {
            localStorage.removeItem('surveyAppData');
            location.reload();
        }
    });

    // --- 3. VOICE DICTATION ---
    const notesArea = document.getElementById('designerNotes');
    const dictateBtn = document.getElementById('dictateBtn');
    if (dictateBtn) {
        if ('webkitSpeechRecognition' in window) {
            const rec = new webkitSpeechRecognition();
            rec.continuous = true; rec.interimResults = true;
            rec.onresult = (e) => {
                for (let i = e.resultIndex; i < e.results.length; ++i) {
                    if (e.results[i].isFinal) notesArea.value += e.results[i][0].transcript + '. ';
                }
                const data = JSON.parse(localStorage.getItem('surveyAppData')) || {};
                data['designerNotes'] = notesArea.value;
                localStorage.setItem('surveyAppData', JSON.stringify(data));
            };
            dictateBtn.onclick = () => {
                if(rec.running) { rec.stop(); dictateBtn.innerHTML = '🎙️ Dictate Notes'; }
                else { rec.start(); dictateBtn.innerHTML = '🛑 Stop Dictating'; }
                rec.running = !rec.running;
            };
        } else {
            dictateBtn.style.display = 'none'; 
        }
    }

    // --- 4. INTERACTIVE FABRIC VECTOR IMPLEMENTATION ---
    window.appCanvases = {};
    document.querySelectorAll('.canvas-group').forEach(group => {
        const id = group.getAttribute('data-id');
        const canvasEl = group.querySelector('canvas');
        if (!canvasEl) return;

        const fCanvas = new fabric.Canvas(canvasEl.id, { 
            isDrawingMode: false,
            allowTouchScrolling: true,
            selection: false
        });
        fCanvas.freeDrawingBrush.color = '#00E5FF';
        fCanvas.freeDrawingBrush.width = 4;
        window.appCanvases[id] = fCanvas;

        const savedData = JSON.parse(localStorage.getItem('surveyAppData')) || {}; 
        if(savedData['canvas_' + id]) fCanvas.loadFromJSON(savedData['canvas_' + id], fCanvas.renderAll.bind(fCanvas));
        
        const saveCanvasState = () => { const data = JSON.parse(localStorage.getItem('surveyAppData')) || {}; data['canvas_' + id] = JSON.stringify(fCanvas.toJSON()); localStorage.setItem('surveyAppData', JSON.stringify(data)); }; 
        fCanvas.on('object:added', saveCanvasState); fCanvas.on('object:modified', saveCanvasState); fCanvas.on('object:removed', saveCanvasState);
    });

    // --- SECURE LOGO & IMAGE CONVERTERS WITH CORS PROTECTION ---
    async function applySafeLogo(template, logoUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Crucial for iOS Safari
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width; canvas.height = img.height;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    const b64 = canvas.toDataURL('image/png');
                    template.querySelectorAll('.brand-logo-img').forEach(el => {
                        el.src = b64; el.style.display = 'inline-block';
                    });
                    resolve();
                } catch(e) {
                    console.error("Logo taint error:", e);
                    template.querySelectorAll('.brand-logo-img').forEach(el => el.style.display = 'none');
                    resolve();
                }
            };
            img.onerror = function() { resolve(); };
            img.src = logoUrl;
        });
    }

    async function loadPamphletImage(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Added strictly to prevent silent failures
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width; canvas.height = img.height;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                } catch(e) {
                    alert("CORS Error on Pamphlet: " + url + "\n" + e.message);
                    resolve(null);
                }
            };
            img.onerror = () => {
                alert("Missing Pamphlet File: " + url);
                resolve(null);
            };
            img.src = url;
        });
    }

    // --- PHOTO POPULATION ENGINE ---
    async function populatePdfImageGrid(inputId, gridId) {
        const input = document.getElementById(inputId);
        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.innerHTML = ''; 
        if (input && input.files && input.files.length > 0) {
            for (let i = 0; i < input.files.length; i++) {
                const file = input.files[i];
                const dataUrl = await new Promise(res => {
                    const reader = new FileReader();
                    reader.onload = e => res(e.target.result);
                    reader.readAsDataURL(file);
                });
                const img = document.createElement('img');
                img.src = dataUrl;
                img.style.width = '100%';
                img.style.maxHeight = '250px';
                img.style.objectFit = 'contain';
                grid.appendChild(img);
            }
        }
    }

    // --- DIAGNOSTIC PDF GENERATOR ENGINE ---
    async function executeSecurePDFGeneration(templateId, fileName, btn, data) {
        btn.disabled = true;
        const originalText = btn.innerText;
        btn.innerText = "Processing...";

        const template = document.getElementById(templateId);
        
        // FAILSAFE HIDING: Instead of assuming 'main', we hide all major siblings manually
        // to prevent accidentally hiding the template wrapper itself.
        const siblingsToHide = Array.from(document.body.children).filter(child => 
            child.tagName !== 'SCRIPT' && child.id !== templateId && child.id !== 'pdfLoadingOverlay'
        );
        
        const originalDisplays = new Map();
        siblingsToHide.forEach(child => {
            originalDisplays.set(child, child.style.display);
            child.style.display = 'none';
        });

        // The "Preview" effect
        template.style.display = 'block';
        template.style.position = 'absolute';
        template.style.top = '0'; 
        template.style.left = '0'; 
        template.style.width = '800px';
        template.style.zIndex = '999999'; 
        template.style.backgroundColor = '#ffffff';
        window.scrollTo(0, 0);

        try {
            await new Promise(r => setTimeout(r, 800)); // Allow DOM to repaint
            
            const doc = new jsPDF('p', 'mm', 'a4');
            const margin = 10;
            const pdfPrintWidth = doc.internal.pageSize.getWidth() - (margin * 2);
            const pdfFullWidth = doc.internal.pageSize.getWidth();
            const pdfFullHeight = doc.internal.pageSize.getHeight();

            if (templateId === 'pdfTemplateInternal') {
                let pages = Array.from(template.querySelectorAll('.pdf-page')).filter(el => window.getComputedStyle(el).display !== 'none');

                if(pages.length === 0) throw new Error("No PDF pages found in DOM. Check your HTML IDs.");

                for(let i = 0; i < pages.length; i++) {
                    btn.innerText = `Printing Page ${i+1}/${pages.length}...`;
                    try {
                        const canvas = await html2canvas(pages[i], {
                            scale: 1.5, useCORS: true, allowTaint: false, windowWidth: 800, logging: true, backgroundColor: '#ffffff'
                        });
                        const imgData = canvas.toDataURL('image/jpeg', 0.95);
                        const ratio = canvas.height / canvas.width;
                        if (i > 0) doc.addPage();
                        doc.addImage(imgData, 'JPEG', margin, margin, pdfPrintWidth, pdfPrintWidth * ratio);
                    } catch (canvasErr) {
                        throw new Error(`Failed capturing page ${i+1}: ${canvasErr.message}`);
                    }
                }
                
            } else if (templateId === 'pdfTemplateCustomer') {
                btn.innerText = `Printing Cover Letter...`;
                
                let pages = Array.from(template.querySelectorAll('.pdf-page')).filter(el => window.getComputedStyle(el).display !== 'none');
                
                if(pages.length === 0) throw new Error("No PDF pages found in DOM.");

                try {
                    const canvas = await html2canvas(pages[0], {
                        scale: 1.5, useCORS: true, allowTaint: false, windowWidth: 800, logging: true, backgroundColor: '#ffffff'
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const ratio = canvas.height / canvas.width;
                    doc.addImage(imgData, 'JPEG', margin, margin, pdfPrintWidth, pdfPrintWidth * ratio);
                } catch (canvasErr) {
                    throw new Error(`Failed capturing Customer Cover Letter: ${canvasErr.message}`);
                }

                btn.innerText = "Stitching Pamphlets...";
                
                const pagesToAppend = [
                    'pamphlet-who-we-are.jpg',
                    'pamphlet-why-choose-us.jpg',
                    'pamphlet-journey.jpg',
                    'pamphlet-tailored.jpg',
                    'pamphlet-piling.jpg'
                ];

                if (data.weepVents === 'Yes') pagesToAppend.push('pamphlet-protecting-home.jpg');
                if (data.roofType === 'Ultra380') pagesToAppend.push('pamphlet-ultra380.jpg');
                if (data.roofType === 'LivinRoof') pagesToAppend.push('pamphlet-livinroof.jpg');
                if (data.roofType === 'Glass Roof') pagesToAppend.push('pamphlet-glass-roof.jpg');
                if (data.roofType === 'Flat Roof') pagesToAppend.push('pamphlet-flat-roof.jpg');
                if (data.sapCalcs === 'Yes') pagesToAppend.push('pamphlet-sap-calcs.jpg');
                if (data.planningPerms === 'Full Planning' || data.planningPerms === 'Pre Approved Planning') {
                    pagesToAppend.push('pamphlet-planning.jpg');
                }

                for (const filename of pagesToAppend) {
                    const img = await loadPamphletImage(filename);
                    if (img) { 
                        doc.addPage(); 
                        doc.addImage(img, 'JPEG', 0, 0, pdfFullWidth, pdfFullHeight); 
                    }
                }
            }
            
            doc.save(fileName);

        } catch (error) {
            console.error("FATAL CAPTURE ERROR:", error);
            alert("⚠️ SYSTEM CRASH: \n\n" + error.message + "\n\nPlease take a screenshot of this error message.");
        } finally {
            // Restore exact original state
            template.style.display = 'none'; 
            template.style.position = ''; 
            siblingsToHide.forEach(child => {
                child.style.display = originalDisplays.get(child) || '';
            });
            btn.innerText = originalText; 
            btn.disabled = false;
        }
    }

    // --- DATA BINDING ---
    function getSurveyData() {
        const dName = document.getElementById('designerSelect')?.value || "Surveyor";
        const selectedBrand = document.getElementById('brandSelect')?.value || "CO Home Improvements";
        const profiles = window.designerProfiles || {};
        const logos = window.brandLogos || {};
        const profile = profiles[dName] || { phone: "", email: "" };

        return {
            clientName: document.getElementById('clientName')?.value || 'Customer',
            clientNum: document.getElementById('clientNum')?.value || '',
            address: document.getElementById('postCode')?.value || '',
            date: document.getElementById('apptDate')?.value ? new Date(document.getElementById('apptDate').value).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
            revisitDate: document.getElementById('revisitDate')?.value ? new Date(document.getElementById('revisitDate').value).toLocaleDateString('en-GB') : '',
            revisitLocation: document.getElementById('revisitLocation')?.value || '',
            buildType: document.getElementById('buildType')?.value || '',
            roofType: document.getElementById('roofType')?.value || '',
            proposedSize: document.getElementById('proposedSize')?.value || '',
            frameColour: document.getElementById('frameColour')?.value || '',
            newBuildMaterial: document.getElementById('newBuildMaterial')?.value || '',
            planningPerms: document.getElementById('planningPerms')?.value || '',
            buildingRegs: document.getElementById('buildingRegs')?.value || '',
            sapCalcs: document.getElementById('sapCalcs')?.value || '',
            weepVents: document.getElementById('weepventsExist')?.value || '',
            designerName: dName, 
            designerPhone: profile.phone, 
            designerEmail: profile.email,
            logoSource: logos[selectedBrand] || "logo.jpg"
        };
    }

    document.getElementById('generateInternalPdfBtn')?.addEventListener('click', async function() {
        const data = getSurveyData();
        const template = document.getElementById('pdfTemplateInternal');

        try {
            await applySafeLogo(template, data.logoSource);

            template.querySelectorAll('.bind-name').forEach(el => el.innerText = data.clientName);
            template.querySelectorAll('.bind-num').forEach(el => el.innerText = data.clientNum);
            template.querySelectorAll('.bind-address').forEach(el => el.innerText = data.address);
            template.querySelectorAll('.bind-date').forEach(el => el.innerText = data.date);

            const designerEl = document.getElementById('pdfPrintDesigner');
            if (designerEl) designerEl.innerText = data.designerName;

            ['BuildType', 'RoofType', 'ProposedSize', 'FrameColour', 'HouseMaterial', 'DpcDepth', 'FasciaHeight', 'AirBricks', 'BuildingRegs', 'PlanningPerms', 'SapCalcs', 'Budget', 'AccessDifficult', 'AccessWidth', 'WallObstacles', 'DesignerNotes', 'MiscNotes'].forEach(key => {
                const inputEl = document.getElementById(key.charAt(0).toLowerCase() + key.slice(1));
                const textEl = document.getElementById(`pdf${key}`);
                if (inputEl && textEl) textEl.innerText = inputEl.value;
            });

            await populatePdfImageGrid('accessPhotos', 'pdfAccessPhotosGrid');
            await populatePdfImageGrid('miscPhotos', 'pdfMiscPhotosGrid');

            ['frontelevation', 'sideelevation', 'rearelevation', 'housematerialphoto', 'manhole', 'weepvents', 'rwpsvp', 'treelocations', 'designersketch'].forEach(id => {
                const fCanvas = window.appCanvases[id];
                const imgTag = document.getElementById(`pdfImgInternal-${id}`);
                if (fCanvas && imgTag) { 
                    fCanvas.setViewportTransform([1,0,0,1,0,0]); 
                    fCanvas.discardActiveObject(); 
                    fCanvas.renderAll(); 
                    imgTag.src = fCanvas.toDataURL({ format: 'jpeg', quality: 0.9 }); 
                }
            });
        } catch (e) { console.warn("Binding bypass:", e); }

        const surname = data.clientName.trim().split(' ').pop() || 'Customer';
        await executeSecurePDFGeneration('pdfTemplateInternal', `${surname}_Internal_Survey.pdf`, this, data);
    });

    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async function() {
        const data = getSurveyData();
        const template = document.getElementById('pdfTemplateCustomer');

        try {
            await applySafeLogo(template, data.logoSource);

            const firstName = data.clientName.split(' ')[0] || 'Customer';
            const greetingEl = document.getElementById('lp-greeting');
            if (greetingEl) {
                greetingEl.innerHTML = `Hi ${firstName},<br><br>I want to say a massive thank you for inviting me into your home today. I've put together this summary document outlining the major talking points from our appointment.`;
            }

            const sizeEl = document.getElementById('lp-size');
            if (sizeEl) {
                if (data.buildType && data.proposedSize) {
                    sizeEl.innerText = `As discussed, we are proposing a beautiful new ${data.buildType} measuring approximately ${data.proposedSize}mm.`;
                } else if (data.buildType) {
                    sizeEl.innerText = `As discussed, we are proposing a beautiful new ${data.buildType}.`;
                } else {
                    sizeEl.innerText = `We didn't quite pinpoint the exact dimensions of your build just yet.`;
                }
            }

            const roofEl = document.getElementById('lp-roof');
            if (roofEl) {
                if (data.roofType) {
                    roofEl.innerText = `To perfectly complement the build, we discussed incorporating a premium ${data.roofType} system.`;
                } else {
                    roofEl.innerText = `We have yet to decide on the final roof style.`;
                }
            }

            const frameEl = document.getElementById('lp-frame');
            if (frameEl) {
                if (data.frameColour) {
                    frameEl.innerText = `We agreed that the window and door frames will look fantastic finished in an elegant ${data.frameColour} colourway.`;
                } else {
                    frameEl.innerText = `We haven't narrowed down the final frame colour just yet.`;
                }
            }

            const complianceEl = document.getElementById('lp-compliance');
            if (complianceEl) {
                const needsPlanning = (data.planningPerms === 'Full Planning' || data.planningPerms === 'Pre Approved Planning');
                const needsRegs = (data.buildingRegs === 'Yes');
                const needsSap = (data.sapCalcs === 'Yes');

                if (!needsPlanning && !needsRegs && !needsSap) {
                    complianceEl.innerText = `Based on your choices, it looks like we do not need Planning Permission, we do not need Building Regulations, and we do not need SAP calculations.`;
                } else {
                    let reqs = [];
                    if (needsPlanning) reqs.push(data.planningPerms);
                    if (needsRegs) reqs.push("Building Regulations");
                    if (needsSap) reqs.push("SAP Calculations");

                    const reqString = reqs.join(', ').replace(/, ([^,]*)$/, ' and $1');
                    complianceEl.innerText = `Regarding compliance, based on our discussion your project will require ${reqString}.`;
                }
            }

            const revisitEl = document.getElementById('lp-revisit');
            if (revisitEl) {
                if (data.revisitDate) {
                    revisitEl.innerText = `I look forward to our next catch-up scheduled for ${data.revisitDate}.`;
                } else {
                    revisitEl.innerText = `We haven't booked in a date for our next catch-up just yet.`;
                }
            }

            const nameEl = document.getElementById('lp-designer-name'); if(nameEl) nameEl.innerText = data.designerName;
            const contactEl = document.getElementById('lp-designer-contact'); if(contactEl) contactEl.innerText = `${data.designerPhone} | ${data.designerEmail}`;

        } catch (e) { console.warn("Binding bypass:", e); }

        const surname = data.clientName.trim().split(' ').pop() || 'Customer';
        await executeSecurePDFGeneration('pdfTemplateCustomer', `${surname}_Design_Consultation.pdf`, this, data);
    });
});
