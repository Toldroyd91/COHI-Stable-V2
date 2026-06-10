// js/pdfGenerator.js
window.PDFEngine = {
    async applySafeLogo(template, logoUrl) {
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
                    resolve(b64); // Return base64 for PDF watermark
                } catch(e) { resolve(null); }
            };
            img.onerror = () => resolve(null);
            img.src = logoUrl;
        });
    },

    async loadPamphletImage(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    },

    async populatePdfImageGrid(inputId, gridId) {
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
    },

    async executeSecurePDFGeneration(templateId, fileName, btn, data) {
        btn.disabled = true;
        const originalText = btn.innerText;
        btn.innerText = "Processing...";

        const template = document.getElementById(templateId);
        const mainApp = document.querySelector('main') || document.body.firstElementChild;

        template.style.display = 'block';
        template.style.position = 'absolute';
        template.style.top = '0'; template.style.left = '0'; template.style.width = '800px';
        template.style.zIndex = '999999'; template.style.backgroundColor = '#ffffff';
        mainApp.style.display = 'none';
        window.scrollTo(0, 0);

        try {
            await new Promise(r => setTimeout(r, 800)); 
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const margin = 10;
            const pdfPrintWidth = doc.internal.pageSize.getWidth() - (margin * 2);
            const pdfFullWidth = doc.internal.pageSize.getWidth();
            const pdfFullHeight = doc.internal.pageSize.getHeight();

            // Fetch logo for Watermarking
            const base64Logo = await this.applySafeLogo(template, data.logoSource);

            // Watermark Injector Function
            const applyWatermark = (pdfDoc) => {
                if(base64Logo) {
                    pdfDoc.setGState(new pdfDoc.GState({opacity: 0.1})); // 10% Opacity
                    pdfDoc.addImage(base64Logo, 'PNG', 50, 100, 110, 110); // Centered roughly
                    pdfDoc.setGState(new pdfDoc.GState({opacity: 1.0})); // Reset
                }
            };

            let pages = Array.from(template.querySelectorAll('.pdf-page')).filter(el => window.getComputedStyle(el).display !== 'none');

            for(let i = 0; i < pages.length; i++) {
                btn.innerText = `Printing Page ${i+1}/${pages.length}...`;
                const canvas = await html2canvas(pages[i], {
                    scale: 1.5, useCORS: true, allowTaint: false, windowWidth: 800, logging: false, backgroundColor: '#ffffff'
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const ratio = canvas.height / canvas.width;
                if (i > 0) doc.addPage();
                
                applyWatermark(doc); // Stamp Watermark
                doc.addImage(imgData, 'JPEG', margin, margin, pdfPrintWidth, pdfPrintWidth * ratio);
                canvas.width = 0; canvas.height = 0; 
            }

            // Pamphlet Stitching for Customer Pack ONLY
            if (templateId === 'pdfTemplateCustomer') {
                btn.innerText = "Stitching Pamphlets...";
                const pagesToAppend = ['pamphlet-who-we-are.jpg', 'pamphlet-why-choose-us.jpg', 'pamphlet-journey.jpg'];
                
                if (data.roofType === 'Ultra380') pagesToAppend.push('pamphlet-ultra380.jpg');
                if (data.roofType === 'LivinRoof') pagesToAppend.push('pamphlet-livinroof.jpg');

                for (const filename of pagesToAppend) {
                    const img = await this.loadPamphletImage(filename);
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
            btn.innerText = originalText; btn.disabled = false;
        }
    }
};
