document.addEventListener('DOMContentLoaded', function() {
    console.log("[Blueprint Enterprise] Luxury OS Boot Sequence Initiated. (Restoring Stable PDF Engine)");

    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js').catch(err => console.log('Service Worker Error', err)); }

    setTimeout(() => { const splash = document.getElementById('splashScreen'); if(splash) { splash.style.opacity = '0'; setTimeout(() => splash.style.display = 'none', 600); } }, 1800); 

    const { jsPDF } = window.jspdf;

    window.addEventListener('scroll', () => { const header = document.getElementById('mainHeader'); if(window.scrollY > 20) header.classList.add('shrunk'); else header.classList.remove('shrunk'); });

    function evaluateConditionals() {
        document.querySelectorAll('.conditional-field').forEach(field => {
            const conditionId = field.getAttribute('data-condition'); const selectEl = document.getElementById(conditionId);
            if(selectEl) { if(selectEl.value === 'Yes') field.classList.add('visible'); else field.classList.remove('visible'); }
        });
    }
    document.querySelectorAll('select').forEach(sel => sel.addEventListener('change', evaluateConditionals));

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
                if(rec.running) { 
                    rec.stop(); 
                    dictateBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px; vertical-align:middle;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg> Dictate';
                } else { 
                    rec.start(); 
                    dictateBtn.innerHTML = '🛑 Stop'; 
                }
                rec.running = !rec.running;
            };
        } else {
            dictateBtn.style.display = 'none'; 
        }
    }

    // --- 4. INTERACTIVE FABRIC VECTOR IMPLEMENTATION (STABLE) ---
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

        let activeTool = 'locked'; 
        let isDrawingLine = false;
        let activeLineObj = null;
        let startX = 0; let startY = 0;

        const lockBtn = group.querySelector('.lock-btn');
        const freehandBtn = group.querySelector('.freehand-btn');
        const highlightBtn = group.querySelector('.highlight-btn');
        const lineBtn = group.querySelector('.line-btn');
        const dimLineBtn = group.querySelector('.dim-line-btn');
        const textBtn = group.querySelector('.text-btn');
        const calibrateBtn = group.querySelector('.calibrate-btn');
        const undoBtn = group.querySelector('.undo-btn');
        const maximizeBtn = group.querySelector('.maximize-btn');
        const clearBtn = group.querySelector('.clear-btn');
        const fileInput = group.querySelector('.camera-input');
        const canvasContainer = group.querySelector('.canvas-container');

        let isPinching = false; let lastPinchDist = 0; let isPanning = false; let lastPanX = 0; let lastPanY = 0;

        fCanvas.on('mouse:wheel', function(opt) {
            let delta = opt.e.deltaY;
            let zoom = fCanvas.getZoom();
            zoom *= 0.999 ** delta;
            if (zoom > 10) zoom = 10;
            if (zoom < 0.5) zoom = 0.5;
            fCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
            opt.e.preventDefault();
            opt.e.stopPropagation();
        });

        fCanvas.on('mouse:down', function(opt) {
            if (activeTool === 'locked' && !isPinching) {
                isPanning = true;
                lastPanX = opt.e.clientX || (opt.e.touches && opt.e.touches[0].clientX);
                lastPanY = opt.e.clientY || (opt.e.touches && opt.e.touches[0].clientY);
            }
        });

        fCanvas.on('mouse:move', function(opt) {
            if (isPanning && activeTool === 'locked') {
                let e = opt.e;
                let currentX = e.clientX || (e.touches && e.touches[0].clientX);
                let currentY = e.clientY || (e.touches && e.touches[0].clientY);
                if (currentX && currentY && lastPanX && lastPanY) {
                    let vpt = fCanvas.viewportTransform;
                    vpt[4] += currentX - lastPanX; 
                    vpt[5] += currentY - lastPanY; 
                    fCanvas.requestRenderAll();
                    lastPanX = currentX;
                    lastPanY = currentY;
                }
            }
        });

        fCanvas.on('mouse:up', function() {
            isPanning = false;
            fCanvas.setViewportTransform(fCanvas.viewportTransform); 
        });

        canvasContainer.addEventListener('touchstart', function(e) {
            if (e.touches.length === 2) {
                isPinching = true; isPanning = false; fCanvas.isDrawingMode = false; 
                lastPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            }
        }, { passive: false });

        canvasContainer.addEventListener('touchmove', function(e) {
            if (isPinching && e.touches.length === 2) {
                e.preventDefault(); 
                let currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                let zoom = fCanvas.getZoom(); zoom *= (currentDist / lastPinchDist); 
                if (zoom > 10) zoom = 10; if (zoom < 0.5) zoom = 0.5;
                let rect = canvasContainer.getBoundingClientRect();
                let pinchCenterX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
                let pinchCenterY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
                fCanvas.zoomToPoint({ x: pinchCenterX, y: pinchCenterY }, zoom);
                lastPinchDist = currentDist;
            }
        }, { passive: false });

        canvasContainer.addEventListener('touchend', function(e) {
            if (isPinching && e.touches.length < 2) {
                isPinching = false;
                if (activeTool === 'freehand' || activeTool === 'highlight') fCanvas.isDrawingMode = true; 
            }
        });

        function setButtonState(tool) {
            activeTool = tool;
            const currentZoom = fCanvas.getZoom();

            lockBtn?.classList.toggle('canvas-locked', tool === 'locked');
            if (lockBtn) lockBtn.innerHTML = (tool === 'locked') ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';
            
            freehandBtn?.classList.toggle('active', tool === 'freehand');
            highlightBtn?.classList.toggle('active', tool === 'highlight');
            lineBtn?.classList.toggle('active', tool === 'line');
            dimLineBtn?.classList.toggle('active', tool === 'dim-line');
            textBtn?.classList.toggle('active', tool === 'text');
            calibrateBtn?.classList.toggle('active', tool === 'calibrate');

            fCanvas.isDrawingMode = (tool === 'freehand' || tool === 'highlight');
            
            if (tool === 'freehand') {
                fCanvas.freeDrawingBrush.color = '#00E5FF';
                fCanvas.freeDrawingBrush.width = 4 / currentZoom;
            } else if (tool === 'highlight') {
                fCanvas.freeDrawingBrush.color = 'rgba(255, 255, 0, 0.4)';
                fCanvas.freeDrawingBrush.width = 25 / currentZoom;
            }

            fCanvas.selection = (tool === 'text' || tool === 'locked'); 
            fCanvas.allowTouchScrolling = (tool === 'locked' || tool === 'text');

            fCanvas.getObjects().forEach(obj => {
                obj.selectable = (tool === 'text');
                obj.editable = (tool === 'text');
            });

            fCanvas.discardActiveObject();
            
            if (tool === 'line') bindLineTool();
            else if (tool === 'dim-line') bindDimLineTool();
            else if (tool === 'text') bindTextTool();

            fCanvas.calcOffset();
            fCanvas.renderAll();
        }

        function bindLineTool() {
            fCanvas.off('mouse:down'); fCanvas.off('mouse:move'); fCanvas.off('mouse:up');
            fCanvas.on('mouse:down', function(o) {
                if (activeTool !== 'line') return;
                isDrawingLine = true;
                const pointer = fCanvas.getPointer(o.e);
                startX = pointer.x; startY = pointer.y;
                const z = fCanvas.getZoom();

                activeLineObj = new fabric.Line([startX, startY, startX, startY], {
                    strokeWidth: 4 / z, stroke: '#FF3B30', originX: 'center', originY: 'center', selectable: false, hasControls: false
                });
                fCanvas.add(activeLineObj);
            });

            fCanvas.on('mouse:move', function(o) {
                if (!isDrawingLine || activeTool !== 'line') return;
                const pointer = fCanvas.getPointer(o.e);
                activeLineObj.set({ x2: pointer.x, y2: pointer.y });
                fCanvas.renderAll();
            });

            fCanvas.on('mouse:up', function() {
                if (activeTool !== 'line') return;
                isDrawingLine = false;
                if (activeLineObj) activeLineObj.setCoords();
                fCanvas.renderAll(); saveCanvasState();
            });
        }

        function bindDimLineTool() {
            fCanvas.off('mouse:down'); fCanvas.off('mouse:move'); fCanvas.off('mouse:up');
            fCanvas.on('mouse:down', function(o) {
                if (activeTool !== 'dim-line') return;
                isDrawingLine = true;
                const pointer = fCanvas.getPointer(o.e);
                startX = pointer.x; startY = pointer.y;
                const z = fCanvas.getZoom();

                activeLineObj = new fabric.Line([startX, startY, startX, startY], {
                    strokeWidth: 3 / z, stroke: '#00E5FF', strokeDashArray: [5 / z, 5 / z], originX: 'center', originY: 'center', selectable: false, hasControls: false
                });
                fCanvas.add(activeLineObj);
            });

            fCanvas.on('mouse:move', function(o) {
                if (!isDrawingLine || activeTool !== 'dim-line') return;
                const pointer = fCanvas.getPointer(o.e);
                activeLineObj.set({ x2: pointer.x, y2: pointer.y });
                fCanvas.renderAll();
            });

            fCanvas.on('mouse:up', function() {
                if (activeTool !== 'dim-line') return;
                isDrawingLine = false;
                if (activeLineObj) {
                    activeLineObj.setCoords();
                    const x1 = activeLineObj.x1, y1 = activeLineObj.y1, x2 = activeLineObj.x2, y2 = activeLineObj.y2;
                    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                    const z = fCanvas.getZoom();
                    const arrowSize = 12 / z;

                    const arrow1 = new fabric.Triangle({ width: arrowSize, height: arrowSize, fill: '#00E5FF', left: x1, top: y1, originX: 'center', originY: 'center', angle: angle - 90, selectable: false });
                    const arrow2 = new fabric.Triangle({ width: arrowSize, height: arrowSize, fill: '#00E5FF', left: x2, top: y2, originX: 'center', originY: 'center', angle: angle + 90, selectable: false });
                    
                    fCanvas.add(arrow1, arrow2);
                }
                fCanvas.renderAll(); saveCanvasState();
            });
        }

        function bindTextTool() {
            fCanvas.off('mouse:down'); fCanvas.off('mouse:move'); fCanvas.off('mouse:up');
            fCanvas.on('mouse:down', function(o) {
                if (activeTool !== 'text') return;
                const target = fCanvas.findTarget(o.e);
                if (target && (target.type === 'i-text' || target.type === 'text' || target.type === 'group')) return;

                const pointer = fCanvas.getPointer(o.e);
                const z = fCanvas.getZoom();
                const mmText = new fabric.IText('Text', {
                    left: pointer.x, top: pointer.y, fontFamily: 'Inter', fontSize: 20 / z,
                    fill: '#00E5FF', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 6 / z, cornerSize: 8 / z, transparentCorners: false, hasControls: true
                });
                fCanvas.add(mmText);
                fCanvas.setActiveObject(mmText);
                fCanvas.renderAll(); saveCanvasState();
            });
        }

        lockBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('locked'); });
        freehandBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('freehand'); });
        highlightBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('highlight'); });
        lineBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('line'); });
        dimLineBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('dim-line'); });
        textBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('text'); });
        calibrateBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('locked'); });

        undoBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            const objects = fCanvas.getObjects();
            if (objects.length > 0) {
                const lastObj = objects[objects.length - 1];
                if (lastObj.type === 'triangle') {
                    fCanvas.remove(objects[objects.length - 1]); 
                    fCanvas.remove(objects[objects.length - 2]); 
                    fCanvas.remove(objects[objects.length - 3]); 
                } else {
                    fCanvas.remove(lastObj);
                }
                fCanvas.renderAll(); saveCanvasState();
            }
        });

        clearBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            fCanvas.clear();
            fCanvas.setBackgroundImage(null, fCanvas.renderAll.bind(fCanvas));
            fCanvas.setViewportTransform([1,0,0,1,0,0]); 
            if (fileInput) fileInput.value = '';
            setButtonState('locked'); saveCanvasState();
        });

        maximizeBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            const isFull = group.classList.toggle('fullscreen-mode');
            fCanvas.setViewportTransform([1,0,0,1,0,0]); 

            if (isFull) {
                maximizeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
                fCanvas.setDimensions({ width: window.innerWidth - 40, height: window.innerHeight - 140 });
            } else {
                maximizeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
                const currentBg = fCanvas.backgroundImage;
                if (currentBg) {
                    const imgRatio = currentBg.height / currentBg.width;
                    const maxWidth = group.querySelector('.canvas-container').clientWidth || 600;
                    const dynamicHeight = maxWidth * imgRatio;
                    fCanvas.setDimensions({ width: maxWidth, height: dynamicHeight });
                } else {
                    fCanvas.setDimensions({ width: 600, height: 400 });
                }
            }
            setTimeout(() => { fCanvas.calcOffset(); fCanvas.renderAll(); }, 100);
        });

        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                if (!e.target.files || e.target.files.length === 0) return;
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = function(f) {
                    const nativeImg = new Image();
                    nativeImg.onload = function() {
                        fCanvas.setViewportTransform([1,0,0,1,0,0]); 
                        const imgRatio = nativeImg.height / nativeImg.width;
                        const maxWidth = group.querySelector('.canvas-container').clientWidth || 600;
                        const dynamicHeight = maxWidth * imgRatio;

                        fCanvas.setDimensions({ width: maxWidth, height: dynamicHeight });
                        const fabricImg = new fabric.Image(nativeImg);
                        const scale = Math.min(fCanvas.width / fabricImg.width, fCanvas.height / fabricImg.height);

                        fabricImg.set({ 
                            originX: 'center', originY: 'center', 
                            scaleX: scale, scaleY: scale, 
                            left: fCanvas.width / 2, top: fCanvas.height / 2, 
                            selectable: false
                        });

                        fCanvas.setBackgroundImage(fabricImg, () => {
                            fCanvas.calcOffset();
                            fCanvas.renderAll();
                            saveCanvasState();
                        });
                    };
                    nativeImg.src = f.target.result;
                };
                reader.readAsDataURL(file);
            });
        }
    });

    // --- SECURE LOGO CONVERTER ---
    async function applySafeLogo(template, logoUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
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
                    template.querySelectorAll('.brand-logo-img').forEach(el => el.style.display = 'none');
                    resolve();
                }
            };
            img.onerror = function() {
                template.querySelectorAll('.brand-logo-img').forEach(el => el.style.display = 'none');
                resolve();
            };
            img.src = logoUrl;
        });
    }

    // --- JPEG PAMPHLET INJECTOR ---
    async function loadPamphletImage(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = () => { resolve(null); };
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
                img.style.border = '1px solid #dee2e6';
                img.style.borderRadius = '4px';
                grid.appendChild(img);
            }
        }
    }

    // --- UI LOADING SCREEN ---
    function showPdfLoader(text) {
        let loader = document.getElementById('pdfLoadingOverlay');
        if(!loader) {
            loader = document.createElement('div'); loader.id = 'pdfLoadingOverlay';
            loader.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(5,11,20,0.98);z-index:99999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#00E5FF;font-family:Inter,sans-serif;';
            loader.innerHTML = '<div class="loader-bar" style="width:200px;margin-bottom:20px;"><div class="loader-fill"></div></div><h2 id="pdfLoaderText" style="font-weight:600;letter-spacing:1px;text-align:center;"></h2>';
            document.body.appendChild(loader);
        }
        document.getElementById('pdfLoaderText').innerText = text; loader.style.display = 'flex';
    }
    function hidePdfLoader() { const loader = document.getElementById('pdfLoadingOverlay'); if(loader) loader.style.display = 'none'; }

    // --- EXACT PDF GENERATOR FROM STABLE, ADAPTED TO CURRENT CSS ---
    async function executeSecurePDFGeneration(templateId, fileName, data) {
        showPdfLoader("Processing Document...");

        const template = document.getElementById(templateId);
        const mainApp = document.querySelector('main') || document.body.firstElementChild; 

        template.style.display = 'block';
        template.style.position = 'absolute';
        template.style.top = '0'; template.style.left = '0'; template.style.width = '800px';
        template.style.zIndex = '999999'; template.style.backgroundColor = '#ffffff';
        mainApp.style.display = 'none'; // Critical for iOS rendering
        window.scrollTo(0, 0);

        try {
            await new Promise(r => setTimeout(r, 800)); // Paint delay
            
            const doc = new jsPDF('p', 'mm', 'a4');
            const margin = 10;
            const pdfPrintWidth = doc.internal.pageSize.getWidth() - (margin * 2);
            const pdfFullWidth = doc.internal.pageSize.getWidth();
            const pdfFullHeight = doc.internal.pageSize.getHeight();

            if (templateId === 'pdfTemplateInternal') {
                let pages = Array.from(template.querySelectorAll('.pdf-page')).filter(el => window.getComputedStyle(el).display !== 'none');

                for(let i = 0; i < pages.length; i++) {
                    showPdfLoader(`Printing Page ${i+1}/${pages.length}...`);
                    const canvas = await html2canvas(pages[i], {
                        scale: 1.5, useCORS: true, allowTaint: false, windowWidth: 800, logging: false, backgroundColor: '#ffffff'
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const ratio = canvas.height / canvas.width;
                    if (i > 0) doc.addPage();
                    doc.addImage(imgData, 'JPEG', margin, margin, pdfPrintWidth, pdfPrintWidth * ratio);
                    canvas.width = 0; canvas.height = 0; 
                }
                
            } else if (templateId === 'pdfTemplateCustomer') {
                showPdfLoader(`Printing Cover Letter...`);
                
                let pages = Array.from(template.querySelectorAll('.pdf-page')).filter(el => window.getComputedStyle(el).display !== 'none');
                const canvas = await html2canvas(pages[0], {
                    scale: 1.5, useCORS: true, allowTaint: false, windowWidth: 800, logging: false, backgroundColor: '#ffffff'
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const ratio = canvas.height / canvas.width;
                doc.addImage(imgData, 'JPEG', margin, margin, pdfPrintWidth, pdfPrintWidth * ratio);

                showPdfLoader("Stitching Pamphlets...");
                
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
            console.error("CAPTURE FAILED:", error);
            alert("Capture Failed: " + error.message);
        } finally {
            template.style.display = 'none'; template.style.position = ''; mainApp.style.display = 'block';
            hidePdfLoader();
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
        const btn = this; const originalText = btn.innerText; btn.disabled = true;
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
        } catch (e) {}

        const surname = data.clientName.trim().split(' ').pop() || 'Customer';
        await executeSecurePDFGeneration('pdfTemplateInternal', `${surname}_Internal_Survey.pdf`, data);
        btn.innerText = originalText; btn.disabled = false;
    });

    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async function() {
        const btn = this; const originalText = btn.innerText; btn.disabled = true;
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
                    sizeEl.innerText = `We didn't quite pinpoint the exact dimensions of your build just yet, which is absolutely fine.`;
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

        } catch (e) {}

        const surname = data.clientName.trim().split(' ').pop() || 'Customer';
        await executeSecurePDFGeneration('pdfTemplateCustomer', `${surname}_Design_Consultation.pdf`, data);
        btn.innerText = originalText; btn.disabled = false;
    });
});
