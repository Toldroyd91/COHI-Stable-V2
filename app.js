document.addEventListener('DOMContentLoaded', function() {
    console.log("[Diagnostics] Blueprint Enterprise Engine Loaded (Offline/Stable v3).");
    const { jsPDF } = window.jspdf;

    // --- SHRINKING HEADER ---
    window.addEventListener('scroll', () => {
        const header = document.getElementById('mainHeader');
        if(window.scrollY > 50) header.classList.add('shrunk');
        else header.classList.remove('shrunk');
    });

    // --- CONDITIONAL VISIBILITY LOGIC ---
    function evaluateConditionals() {
        document.querySelectorAll('.conditional-field').forEach(field => {
            const conditionId = field.getAttribute('data-condition');
            const selectEl = document.getElementById(conditionId);
            if(selectEl) {
                if(selectEl.value === 'Yes') field.classList.add('visible');
                else field.classList.remove('visible');
            }
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

    // --- 2. AUTOSAVE ENGINE (Inputs) ---
    document.querySelectorAll('input:not([type="file"]), select, textarea').forEach(input => {
        const saved = JSON.parse(localStorage.getItem('surveyAppData')) || {};
        if (saved[input.id]) input.value = saved[input.id];
        input.addEventListener('input', () => {
            const data = JSON.parse(localStorage.getItem('surveyAppData')) || {};
            data[input.id] = input.value;
            localStorage.setItem('surveyAppData', JSON.stringify(data));
        });
    });
    evaluateConditionals(); 

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

    // --- LOUPE ELEMENT SETUP ---
    const loupeEl = document.getElementById('precisionLoupe');
    const lCtx = loupeEl.getContext('2d');

    // --- 4. INTERACTIVE FABRIC VECTOR IMPLEMENTATION ---
    window.appCanvases = {};
    document.querySelectorAll('.canvas-group').forEach(group => {
        const id = group.getAttribute('data-id');
        const canvasEl = group.querySelector('canvas');
        if (!canvasEl) return;

        const fCanvas = new fabric.Canvas(canvasEl.id, { 
            isDrawingMode: false, allowTouchScrolling: true, selection: false
        });
        fCanvas.freeDrawingBrush.color = '#FF0000';
        fCanvas.freeDrawingBrush.width = 4;
        window.appCanvases[id] = fCanvas;

        const savedData = JSON.parse(localStorage.getItem('surveyAppData')) || {};
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
        fCanvas.on('object:removed', saveCanvasState);

        let activeTool = 'locked'; 
        let isDrawingLine = false;
        let activeLineObj = null;

        // TWO-STEP PRECISION ENGINE VARIABLES
        let lineStep = 0; 
        let tempStartX = 0, tempStartY = 0;
        let tempMarker = null;
        let crosshairObj = null;
        let lastCrossX = 0, lastCrossY = 0;
        let scaleRatio = null; 

        const lockBtn = group.querySelector('.lock-btn');
        const calibrateBtn = group.querySelector('.calibrate-btn');
        const freehandBtn = group.querySelector('.freehand-btn');
        const highlightBtn = group.querySelector('.highlight-btn');
        const lineBtn = group.querySelector('.line-btn');
        const dimLineBtn = group.querySelector('.dim-line-btn');
        const textBtn = group.querySelector('.text-btn');
        const undoBtn = group.querySelector('.undo-btn');
        const maximizeBtn = group.querySelector('.maximize-btn');
        const clearBtn = group.querySelector('.clear-btn');
        const fileInput = group.querySelector('.camera-input');
        const canvasContainer = group.querySelector('.canvas-container');

        let isPinching = false; let lastPinchDist = 0;
        let isPanning = false; let lastPanX = 0; let lastPanY = 0;

        function updateCrosshair(x, y, z) {
            if (!crosshairObj) {
                const size = 15 / z;
                const h = new fabric.Line([-size, 0, size, 0], { stroke: '#0D6EFD', strokeWidth: 2/z });
                const v = new fabric.Line([0, -size, 0, size], { stroke: '#0D6EFD', strokeWidth: 2/z });
                crosshairObj = new fabric.Group([h, v], { selectable: false, evented: false, originX: 'center', originY: 'center' });
                fCanvas.add(crosshairObj);
            }
            crosshairObj.set({ left: x, top: y });
            fCanvas.bringToFront(crosshairObj);
        }

        function updateLoupe(e, crossX, crossY) {
            const isTouch = e.touches && e.touches.length > 0;
            const clientX = isTouch ? e.touches[0].clientX : e.clientX;
            const clientY = isTouch ? e.touches[0].clientY : e.clientY;
            
            loupeEl.style.left = (clientX - 60) + 'px';
            loupeEl.style.top = (clientY - 140) + 'px';
            loupeEl.style.display = 'block';

            lCtx.clearRect(0, 0, 120, 120);
            
            const vpt = fCanvas.viewportTransform;
            const screenX = crossX * vpt[0] + vpt[4];
            const screenY = crossY * vpt[3] + vpt[5];

            const sWidth = 60; const sHeight = 60; 

            try {
                lCtx.drawImage(fCanvas.lowerCanvasEl, screenX - sWidth/2, screenY - sHeight/2, sWidth, sHeight, 0, 0, 120, 120);
                lCtx.drawImage(fCanvas.upperCanvasEl, screenX - sWidth/2, screenY - sHeight/2, sWidth, sHeight, 0, 0, 120, 120);
            } catch(err) {} 

            lCtx.strokeStyle = '#0D6EFD'; lCtx.lineWidth = 2;
            lCtx.beginPath(); lCtx.moveTo(60, 45); lCtx.lineTo(60, 75); lCtx.moveTo(45, 60); lCtx.lineTo(75, 60); lCtx.stroke();
        }

        fCanvas.on('mouse:wheel', function(opt) {
            let delta = opt.e.deltaY;
            let zoom = fCanvas.getZoom();
            zoom *= 0.999 ** delta;
            if (zoom > 10) zoom = 10;
            if (zoom < 0.5) zoom = 0.5;
            fCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
            opt.e.preventDefault(); opt.e.stopPropagation();
        });

        // --- THE TWO-STEP PRECISION ENGINE CORE ---
        fCanvas.on('mouse:down', function(opt) {
            if (activeTool === 'locked' && !isPinching) {
                isPanning = true;
                lastPanX = opt.e.clientX || (opt.e.touches && opt.e.touches[0].clientX);
                lastPanY = opt.e.clientY || (opt.e.touches && opt.e.touches[0].clientY);
                return;
            }
            
            if (['calibrate', 'line', 'dim-line'].includes(activeTool)) {
                isDrawingLine = true;
                const z = fCanvas.getZoom();
                const isTouch = opt.e.touches && opt.e.touches.length > 0;
                const offsetY = isTouch ? (60 / z) : 0; // The vital offset
                const pointer = fCanvas.getPointer(opt.e);
                lastCrossX = pointer.x; lastCrossY = pointer.y - offsetY;

                updateCrosshair(lastCrossX, lastCrossY, z);

                if (lineStep === 1) {
                    let strokeCol = activeTool === 'calibrate' ? '#6f42c1' : (activeTool === 'line' ? '#FF0000' : '#0D6EFD');
                    let strokeW = activeTool === 'dim-line' ? 3/z : 4/z;
                    let dash = activeTool === 'dim-line' ? [5/z, 5/z] : null;

                    activeLineObj = new fabric.Line([tempStartX, tempStartY, lastCrossX, lastCrossY], {
                        strokeWidth: strokeW, stroke: strokeCol, strokeDashArray: dash, 
                        originX: 'center', originY: 'center', selectable: false, evented: false
                    });
                    fCanvas.add(activeLineObj);
                }
                updateLoupe(opt.e, lastCrossX, lastCrossY);
            }
            
            if (activeTool === 'text') {
                const target = fCanvas.findTarget(opt.e);
                if (target && (target.type === 'i-text' || target.type === 'text' || target.type === 'group')) return;

                const pointer = fCanvas.getPointer(opt.e);
                const z = fCanvas.getZoom();
                const mmText = new fabric.IText('Text', {
                    left: pointer.x, top: pointer.y, fontFamily: 'system-ui', fontSize: 20 / z,
                    fill: '#FFFF00', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.65)',
                    padding: 6 / z, cornerSize: 8 / z, transparentCorners: false, hasControls: true
                });
                fCanvas.add(mmText); fCanvas.setActiveObject(mmText); fCanvas.renderAll(); saveCanvasState();
            }
        });

        fCanvas.on('mouse:move', function(opt) {
            if (isPanning && activeTool === 'locked') {
                let e = opt.e;
                let currentX = e.clientX || (e.touches && e.touches[0].clientX);
                let currentY = e.clientY || (e.touches && e.touches[0].clientY);
                if (currentX && currentY && lastPanX && lastPanY) {
                    let vpt = fCanvas.viewportTransform;
                    vpt[4] += currentX - lastPanX; vpt[5] += currentY - lastPanY; 
                    fCanvas.requestRenderAll();
                    lastPanX = currentX; lastPanY = currentY;
                }
                return;
            }
            
            if (isDrawingLine && ['calibrate', 'line', 'dim-line'].includes(activeTool)) {
                const z = fCanvas.getZoom();
                const isTouch = opt.e.touches && opt.e.touches.length > 0;
                const offsetY = isTouch ? (60 / z) : 0;
                const pointer = fCanvas.getPointer(opt.e);
                lastCrossX = pointer.x; lastCrossY = pointer.y - offsetY;

                updateCrosshair(lastCrossX, lastCrossY, z);
                
                if (lineStep === 1 && activeLineObj) {
                    activeLineObj.set({ x2: lastCrossX, y2: lastCrossY });
                }
                fCanvas.renderAll();
                updateLoupe(opt.e, lastCrossX, lastCrossY);
            }
        });

        fCanvas.on('mouse:up', function(opt) {
            if (isPanning) {
                isPanning = false; fCanvas.setViewportTransform(fCanvas.viewportTransform);
                return;
            }

            if (isDrawingLine && ['calibrate', 'line', 'dim-line'].includes(activeTool)) {
                isDrawingLine = false; loupeEl.style.display = 'none';
                if (crosshairObj) { fCanvas.remove(crosshairObj); crosshairObj = null; }
                const z = fCanvas.getZoom();

                // Stage 1: Dropping Point A
                if (lineStep === 0) {
                    tempStartX = lastCrossX; tempStartY = lastCrossY; lineStep = 1;
                    tempMarker = new fabric.Circle({ radius: 4/z, fill: '#0D6EFD', left: tempStartX, top: tempStartY, originX: 'center', originY: 'center', selectable: false, evented: false });
                    fCanvas.add(tempMarker); fCanvas.renderAll();
                } 
                // Stage 2: Dropping Point B
                else if (lineStep === 1) {
                    lineStep = 0;
                    if (tempMarker) { fCanvas.remove(tempMarker); tempMarker = null; }
                    if (activeLineObj) {
                        activeLineObj.set({ x2: lastCrossX, y2: lastCrossY });
                        activeLineObj.setCoords();

                        if (activeTool === 'dim-line') {
                            const x1 = tempStartX, y1 = tempStartY, x2 = lastCrossX, y2 = lastCrossY;
                            const dx = x2 - x1; const dy = y2 - y1;
                            const pixelLength = Math.sqrt(dx * dx + dy * dy);
                            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                            const arrowSize = 12 / z;

                            const arrow1 = new fabric.Triangle({ width: arrowSize, height: arrowSize, fill: '#0D6EFD', left: x1, top: y1, originX: 'center', originY: 'center', angle: angle - 90, selectable: false });
                            const arrow2 = new fabric.Triangle({ width: arrowSize, height: arrowSize, fill: '#0D6EFD', left: x2, top: y2, originX: 'center', originY: 'center', angle: angle + 90, selectable: false });
                            fCanvas.add(arrow1, arrow2);

                            if (scaleRatio) {
                                const calculatedMm = Math.round(pixelLength * scaleRatio);
                                const midX = (x1 + x2) / 2; const midY = (y1 + y2) / 2;
                                const textObj = new fabric.IText(calculatedMm + ' mm', {
                                    left: midX, top: midY, fontFamily: 'system-ui', fontSize: 20 / z, fill: '#FFFF00', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.65)', padding: 6 / z, cornerSize: 8 / z, originX: 'center', originY: 'center', transparentCorners: false, hasControls: true
                                });
                                fCanvas.add(textObj);
                            }
                        } else if (activeTool === 'calibrate') {
                            const dx = lastCrossX - tempStartX; const dy = lastCrossY - tempStartY;
                            const pixelLength = Math.sqrt(dx * dx + dy * dy);
                            fCanvas.remove(activeLineObj);
                            if (pixelLength > 10) {
                                const actualSize = prompt("Enter real-world size in mm (e.g. 215):");
                                if (actualSize && !isNaN(actualSize) && actualSize > 0) {
                                    scaleRatio = parseFloat(actualSize) / pixelLength;
                                    alert("Scale set! Dimension lines will now auto-calculate.");
                                }
                            }
                            setButtonState('locked');
                        }
                    }
                    activeLineObj = null; fCanvas.renderAll(); saveCanvasState();
                }
            }
        });

        // --- TOUCH GESTURE HANDLING ---
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
                let zoom = fCanvas.getZoom();
                zoom *= (currentDist / lastPinchDist); 
                if (zoom > 10) zoom = 10;
                if (zoom < 0.5) zoom = 0.5;

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
            // Cancel any mid-step line drawing if the user switches tools
            lineStep = 0;
            if (tempMarker) { fCanvas.remove(tempMarker); tempMarker = null; }
            if (activeLineObj) { fCanvas.remove(activeLineObj); activeLineObj = null; }
            if (crosshairObj) { fCanvas.remove(crosshairObj); crosshairObj = null; }

            activeTool = tool;
            const currentZoom = fCanvas.getZoom();

            lockBtn?.classList.toggle('canvas-locked', tool === 'locked');
            if (lockBtn) lockBtn.textContent = (tool === 'locked') ? '🔒 Locked for Scroll & Pan' : '🔓 Canvas Active';

            calibrateBtn?.classList.toggle('active', tool === 'calibrate');
            freehandBtn?.classList.toggle('active', tool === 'freehand');
            highlightBtn?.classList.toggle('active', tool === 'highlight');
            lineBtn?.classList.toggle('active', tool === 'line');
            dimLineBtn?.classList.toggle('active', tool === 'dim-line');
            textBtn?.classList.toggle('active', tool === 'text');

            fCanvas.isDrawingMode = (tool === 'freehand' || tool === 'highlight');
            
            if (tool === 'freehand') { fCanvas.freeDrawingBrush.color = '#FF0000'; fCanvas.freeDrawingBrush.width = 4 / currentZoom; } 
            else if (tool === 'highlight') { fCanvas.freeDrawingBrush.color = 'rgba(255, 255, 0, 0.4)'; fCanvas.freeDrawingBrush.width = 25 / currentZoom; }

            fCanvas.selection = (tool === 'text' || tool === 'locked'); 
            fCanvas.allowTouchScrolling = (tool === 'locked' || tool === 'text');

            fCanvas.getObjects().forEach(obj => { obj.selectable = (tool === 'text'); obj.editable = (tool === 'text'); });
            fCanvas.discardActiveObject(); fCanvas.calcOffset(); fCanvas.renderAll();
        }

        lockBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('locked'); });
        calibrateBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('calibrate'); });
        freehandBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('freehand'); });
        highlightBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('highlight'); });
        lineBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('line'); });
        dimLineBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('dim-line'); });
        textBtn?.addEventListener('click', (e) => { e.preventDefault(); setButtonState('text'); });

        undoBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            const objects = fCanvas.getObjects();
            if (objects.length > 0) {
                const lastObj = objects[objects.length - 1];
                let itemsToRemove = 1;
                
                if (lastObj.type === 'i-text' && objects.length >= 4) {
                    const obj4 = objects[objects.length - 4];
                    if (obj4 && obj4.type === 'line') itemsToRemove = 4;
                } else if (lastObj.type === 'triangle' && objects.length >= 3) {
                    itemsToRemove = 3; 
                }
                for(let i=0; i<itemsToRemove; i++) { fCanvas.remove(objects[objects.length - 1 - i]); }
                fCanvas.renderAll(); saveCanvasState();
            }
        });

        clearBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            fCanvas.clear(); fCanvas.setBackgroundImage(null, fCanvas.renderAll.bind(fCanvas));
            fCanvas.setViewportTransform([1,0,0,1,0,0]); scaleRatio = null;
            if (fileInput) fileInput.value = '';
            setButtonState('locked'); saveCanvasState();
        });

        maximizeBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            const isFull = group.classList.toggle('fullscreen-mode');
            fCanvas.setViewportTransform([1,0,0,1,0,0]); 

            if (isFull) {
                maximizeBtn.textContent = '📉 Close Screen';
                fCanvas.setDimensions({ width: window.innerWidth - 40, height: window.innerHeight - 140 });
            } else {
                maximizeBtn.textContent = '🔍 Max Screen';
                const currentBg = fCanvas.backgroundImage;
                if (currentBg) {
                    const imgRatio = currentBg.height / currentBg.width;
                    const maxWidth = group.querySelector('.canvas-container').clientWidth || 600;
                    const dynamicHeight = maxWidth * imgRatio;
                    fCanvas.setDimensions({ width: maxWidth, height: dynamicHeight });
                } else { fCanvas.setDimensions({ width: 600, height: 400 }); }
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
                        const MAX_WIDTH = 1200; 
                        let width = nativeImg.width; let height = nativeImg.height;
                        if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }

                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = width; tempCanvas.height = height;
                        const ctx = tempCanvas.getContext('2d');
                        ctx.drawImage(nativeImg, 0, 0, width, height);
                        
                        const safeDataUrl = tempCanvas.toDataURL('image/jpeg', 0.8);
                        fCanvas.setViewportTransform([1,0,0,1,0,0]); 
                        
                        fabric.Image.fromURL(safeDataUrl, function(fabricImg) {
                            const imgRatio = fabricImg.height / fabricImg.width;
                            const maxWidth = group.querySelector('.canvas-container').clientWidth || 600;
                            const dynamicHeight = maxWidth * imgRatio;
                            fCanvas.setDimensions({ width: maxWidth, height: dynamicHeight });
                            const scale = Math.min(fCanvas.width / fabricImg.width, fCanvas.height / fabricImg.height);
                            fabricImg.set({ originX: 'center', originY: 'center', scaleX: scale, scaleY: scale, left: fCanvas.width / 2, top: fCanvas.height / 2, selectable: false });
                            fCanvas.setBackgroundImage(fabricImg, () => { fCanvas.calcOffset(); fCanvas.renderAll(); saveCanvasState(); });
                        });
                    };
                    nativeImg.src = f.target.result;
                };
                reader.readAsDataURL(file);
            });
        }
    });

    // --- PDF GENERATION ENGINE DOWN HERE ---
    async function applySafeLogo(template, logoUrl) {
        return new Promise((resolve) => {
            const img = new Image(); img.crossOrigin = "Anonymous";
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; canvas.getContext('2d').drawImage(img, 0, 0); const b64 = canvas.toDataURL('image/png');
                    template.querySelectorAll('.brand-logo-img').forEach(el => { el.src = b64; el.style.display = 'inline-block'; }); resolve();
                } catch(e) { template.querySelectorAll('.brand-logo-img').forEach(el => el.style.display = 'none'); resolve(); }
            };
            img.onerror = function() { template.querySelectorAll('.brand-logo-img').forEach(el => el.style.display = 'none'); resolve(); };
            img.src = logoUrl;
        });
    }

    async function loadPamphletImage(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() { const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; canvas.getContext('2d').drawImage(img, 0, 0); resolve(canvas.toDataURL('image/jpeg', 0.9)); };
            img.onerror = () => { console.warn(`Pamphlet missing: ${url}. Skipping...`); resolve(null); }; img.src = url;
        });
    }

    async function populatePdfImageGrid(inputId, gridId) {
        const input = document.getElementById(inputId); const grid = document.getElementById(gridId); if (!grid) return; grid.innerHTML = ''; 
        if (input && input.files && input.files.length > 0) {
            for (let i = 0; i < input.files.length; i++) {
                const file = input.files[i];
                const dataUrl = await new Promise(res => { const reader = new FileReader(); reader.onload = e => res(e.target.result); reader.readAsDataURL(file); });
                const img = document.createElement('img'); img.src = dataUrl; img.style.width = '100%'; img.style.maxHeight = '250px'; img.style.objectFit = 'contain'; img.style.border = '1px solid #dee2e6'; img.style.borderRadius = '4px'; grid.appendChild(img);
            }
        }
    }

    async function executeSecurePDFGeneration(templateId, fileName, btn, data) {
        btn.disabled = true; const originalText = btn.innerText; btn.innerText = "Processing...";
        const template = document.getElementById(templateId); const mainApp = document.querySelector('main') || document.body.firstElementChild;
        template.style.display = 'block'; template.style.position = 'absolute'; template.style.top = '0'; template.style.left = '0'; template.style.width = '800px'; template.style.zIndex = '999999'; template.style.backgroundColor = '#ffffff'; mainApp.style.display = 'none'; window.scrollTo(0, 0);

        try {
            await new Promise(r => setTimeout(r, 800)); 
            const doc = new jsPDF('p', 'mm', 'a4'); const margin = 10; const pdfPrintWidth = doc.internal.pageSize.getWidth() - (margin * 2); const pdfFullWidth = doc.internal.pageSize.getWidth(); const pdfFullHeight = doc.internal.pageSize.getHeight();

            if (templateId === 'pdfTemplateInternal') {
                let pages = Array.from(template.querySelectorAll('.pdf-page')).filter(el => window.getComputedStyle(el).display !== 'none');
                for(let i = 0; i < pages.length; i++) {
                    btn.innerText = `Printing Page ${i+1}/${pages.length}...`;
                    const canvas = await html2canvas(pages[i], { scale: 1.5, useCORS: true, allowTaint: false, windowWidth: 800, logging: false, backgroundColor: '#ffffff' });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95); const ratio = canvas.height / canvas.width;
                    if (i > 0) doc.addPage(); doc.addImage(imgData, 'JPEG', margin, margin, pdfPrintWidth, pdfPrintWidth * ratio); canvas.width = 0; canvas.height = 0; 
                }
            } else if (templateId === 'pdfTemplateCustomer') {
                btn.innerText = `Printing Cover Letter...`;
                let pages = Array.from(template.querySelectorAll('.pdf-page')).filter(el => window.getComputedStyle(el).display !== 'none');
                const canvas = await html2canvas(pages[0], { scale: 1.5, useCORS: true, allowTaint: false, windowWidth: 800, logging: false, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/jpeg', 0.95); const ratio = canvas.height / canvas.width; doc.addImage(imgData, 'JPEG', margin, margin, pdfPrintWidth, pdfPrintWidth * ratio);
                btn.innerText = "Stitching Pamphlets...";
                const pagesToAppend = ['pamphlet-who-we-are.jpg', 'pamphlet-why-choose-us.jpg', 'pamphlet-journey.jpg', 'pamphlet-tailored.jpg', 'pamphlet-piling.jpg'];
                if (data.weepVents === 'Yes') pagesToAppend.push('pamphlet-protecting-home.jpg'); if (data.roofType === 'Ultra380') pagesToAppend.push('pamphlet-ultra380.jpg'); if (data.roofType === 'LivinRoof') pagesToAppend.push('pamphlet-livinroof.jpg'); if (data.roofType === 'Glass Roof') pagesToAppend.push('pamphlet-glass-roof.jpg'); if (data.roofType === 'Flat Roof') pagesToAppend.push('pamphlet-flat-roof.jpg'); if (data.sapCalcs === 'Yes') pagesToAppend.push('pamphlet-sap-calcs.jpg'); if (data.planningPerms === 'Full Planning' || data.planningPerms === 'Pre Approved Planning') pagesToAppend.push('pamphlet-planning.jpg');
                for (const filename of pagesToAppend) { const img = await loadPamphletImage(filename); if (img) { doc.addPage(); doc.addImage(img, 'JPEG', 0, 0, pdfFullWidth, pdfFullHeight); } }
            }
            doc.save(fileName);
        } catch (error) { alert("Capture Failed: " + error.message); } finally { template.style.display = 'none'; template.style.position = ''; mainApp.style.display = 'block'; btn.innerText = originalText; btn.disabled = false; }
    }

    function getSurveyData() {
        const dName = document.getElementById('designerSelect')?.value || "Surveyor"; const selectedBrand = document.getElementById('brandSelect')?.value || "CO Home Improvements";
        const profiles = window.designerProfiles || {}; const logos = window.brandLogos || {}; const profile = profiles[dName] || { phone: "", email: "" };
        return {
            clientName: document.getElementById('clientName')?.value || 'Customer', clientNum: document.getElementById('clientNum')?.value || '', address: document.getElementById('postCode')?.value || '', date: document.getElementById('apptDate')?.value ? new Date(document.getElementById('apptDate').value).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'), revisitDate: document.getElementById('revisitDate')?.value ? new Date(document.getElementById('revisitDate').value).toLocaleDateString('en-GB') : '', revisitLocation: document.getElementById('revisitLocation')?.value || '', buildType: document.getElementById('buildType')?.value || '', roofType: document.getElementById('roofType')?.value || '', proposedSize: document.getElementById('proposedSize')?.value || '', frameColour: document.getElementById('frameColour')?.value || '', newBuildMaterial: document.getElementById('newBuildMaterial')?.value || '', planningPerms: document.getElementById('planningPerms')?.value || '', buildingRegs: document.getElementById('buildingRegs')?.value || '', sapCalcs: document.getElementById('sapCalcs')?.value || '', weepVents: document.getElementById('weepventsExist')?.value || '', designerName: dName, designerPhone: profile.phone, designerEmail: profile.email, logoSource: logos[selectedBrand] || "logo.jpg"
        };
    }

    document.getElementById('generateInternalPdfBtn')?.addEventListener('click', async function() {
        const data = getSurveyData(); const template = document.getElementById('pdfTemplateInternal');
        try {
            await applySafeLogo(template, data.logoSource);
            template.querySelectorAll('.bind-name').forEach(el => el.innerText = data.clientName); template.querySelectorAll('.bind-num').forEach(el => el.innerText = data.clientNum); template.querySelectorAll('.bind-address').forEach(el => el.innerText = data.address); template.querySelectorAll('.bind-date').forEach(el => el.innerText = data.date);
            const designerEl = document.getElementById('pdfPrintDesigner'); if (designerEl) designerEl.innerText = data.designerName;
            ['BuildType', 'RoofType', 'ProposedSize', 'FrameColour', 'HouseMaterial', 'DpcDepth', 'FasciaHeight', 'AirBricks', 'BuildingRegs', 'PlanningPerms', 'SapCalcs', 'Budget', 'AccessDifficult', 'AccessWidth', 'WallObstacles', 'DesignerNotes', 'MiscNotes'].forEach(key => { const inputEl = document.getElementById(key.charAt(0).toLowerCase() + key.slice(1)); const textEl = document.getElementById(`pdf${key}`); if (inputEl && textEl) textEl.innerText = inputEl.value; });
            await populatePdfImageGrid('accessPhotos', 'pdfAccessPhotosGrid'); await populatePdfImageGrid('miscPhotos', 'pdfMiscPhotosGrid');
            ['frontelevation', 'sideelevation', 'rearelevation', 'housematerialphoto', 'manhole', 'weepvents', 'rwpsvp', 'treelocations', 'designersketch'].forEach(id => { const fCanvas = window.appCanvases[id]; const imgTag = document.getElementById(`pdfImgInternal-${id}`); if (fCanvas && imgTag) { fCanvas.setViewportTransform([1,0,0,1,0,0]); fCanvas.discardActiveObject(); fCanvas.renderAll(); imgTag.src = fCanvas.toDataURL({ format: 'jpeg', quality: 0.9 }); } });
        } catch (e) { }
        const surname = data.clientName.trim().split(' ').pop() || 'Customer'; await executeSecurePDFGeneration('pdfTemplateInternal', `${surname}_Internal_Survey.pdf`, this, data);
        if (typeof gtag === 'function') { gtag('event', 'generate_pdf', { 'pdf_type': 'Internal Survey', 'designer': data.designerName }); }
    });

    document.getElementById('generateCustomerPdfBtn')?.addEventListener('click', async function() {
        const data = getSurveyData(); const template = document.getElementById('pdfTemplateCustomer');
        try {
            await applySafeLogo(template, data.logoSource);
            const firstName = data.clientName.split(' ')[0] || 'Customer'; const greetingEl = document.getElementById('lp-greeting');
            if (greetingEl) greetingEl.innerHTML = `Hi ${firstName},<br><br>I want to say a massive thank you for inviting me into your home today. I've put together this summary document outlining the major talking points from our appointment so we both know we are on exactly the right lines. If there is anything you'd like to adjust, please don't hesitate to get in touch.`;
            const sizeEl = document.getElementById('lp-size');
            if (sizeEl) { if (data.buildType && data.proposedSize) sizeEl.innerText = `As discussed, we are proposing a beautiful new ${data.buildType} measuring approximately ${data.proposedSize}mm. We have plenty of flexibility to adjust this as we develop the final design.`; else if (data.buildType) sizeEl.innerText = `As discussed, we are proposing a beautiful new ${data.buildType}. We didn't quite pinpoint the exact dimensions just yet, which is absolutely fine. We have plenty of flexibility to work towards the perfect size as we develop the design.`; else sizeEl.innerText = `We didn't quite pinpoint the exact dimensions of your build just yet, which is absolutely fine. We have plenty of flexibility to work towards the perfect size as we develop the design.`; }
            const roofEl = document.getElementById('lp-roof');
            if (roofEl) { if (data.roofType) roofEl.innerText = `To perfectly complement the build, we discussed incorporating a premium ${data.roofType} system. I will prepare a few different 3D options featuring this so you can see exactly how it looks.`; else roofEl.innerText = `We have yet to decide on the final roof style, but I will prepare a few different options for you to review so we can find the perfect match for your home.`; }
            const frameEl = document.getElementById('lp-frame');
            if (frameEl) { if (data.frameColour) frameEl.innerText = `We agreed that the window and door frames will look fantastic finished in an elegant ${data.frameColour} colourway to match your property.`; else frameEl.innerText = `We haven't narrowed down the final frame colour or build materials just yet, but we have an incredible range to choose from. Just let me know when you are ready to explore them.`; }
            const complianceEl = document.getElementById('lp-compliance');
            if (complianceEl) {
                const needsPlanning = (data.planningPerms === 'Full Planning' || data.planningPerms === 'Pre Approved Planning'); const needsRegs = (data.buildingRegs === 'Yes'); const needsSap = (data.sapCalcs === 'Yes');
                if (!needsPlanning && !needsRegs && !needsSap) complianceEl.innerText = `Based on your choices, it looks like we do not need Planning Permission, we do not need Building Regulations, and we do not need SAP calculations. Please don't worry about the technicalities of these—I have included a brief explanation of what they mean later in this pack, and our team will handle all of it for you.`;
                else { let reqs = []; if (needsPlanning) reqs.push(data.planningPerms); if (needsRegs) reqs.push("Building Regulations"); if (needsSap) reqs.push("SAP Calculations"); const reqString = reqs.join(', ').replace(/, ([^,]*)$/, ' and $1'); complianceEl.innerText = `Regarding compliance, based on our discussion your project will require ${reqString}. Please don't worry about the technicalities of these—I have included a brief explanation of what they mean later in this pack, and our dedicated team will handle all of it for you.`; }
            }
            const revisitEl = document.getElementById('lp-revisit');
            if (revisitEl) { if (data.revisitDate) revisitEl.innerText = `I look forward to our next catch-up scheduled for ${data.revisitDate}${data.revisitLocation ? ` at ${data.revisitLocation}` : ''}. We will go through your custom 3D designs together then. If you need anything before I next get in touch, please contact me on the details below.`; else revisitEl.innerText = `We haven't booked in a date for our next catch-up just yet, but as soon as we work out a time, we will get you scheduled in. If you need anything before I next get in touch, please contact me on the details below.`; }
            const nameEl = document.getElementById('lp-designer-name'); if(nameEl) nameEl.innerText = data.designerName; const contactEl = document.getElementById('lp-designer-contact'); if(contactEl) contactEl.innerText = `${data.designerPhone} | ${data.designerEmail}`;
        } catch (e) { }
        const surname = data.clientName.trim().split(' ').pop() || 'Customer'; await executeSecurePDFGeneration('pdfTemplateCustomer', `${surname}_Design_Consultation.pdf`, this, data);
        if (typeof gtag === 'function') { gtag('event', 'generate_pdf', { 'pdf_type': 'Customer Pack', 'designer': data.designerName }); }
    });
});
