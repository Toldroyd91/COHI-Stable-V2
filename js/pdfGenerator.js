// pdfGenerator.js
window.PDFEngine = {
    async loadPamphletImage(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = () => { console.warn("Failed to load pamphlet:", url); resolve(null); };
            img.src = url;
        });
    },

    async generate(surveyState, roofType) {
        const btn = document.getElementById('btn-generate-pdf');
        const originalText = btn.innerHTML;
        btn.innerHTML = "Rendering Math...";
        
        try {
            if (!surveyState.imageIntrinsicWidth) throw new Error("No survey image loaded.");

            // 1. Initialize jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ 
                orientation: "landscape", 
                unit: "px", 
                format: [surveyState.imageIntrinsicWidth, surveyState.imageIntrinsicHeight] 
            });
            
            // 2. Mathematical Canvas Stamping (No Viewport Dependencies)
            const photo = document.getElementById('active-survey-photo');
            const canvas = document.createElement('canvas');
            canvas.width = surveyState.imageIntrinsicWidth;
            canvas.height = surveyState.imageIntrinsicHeight;
            const ctx = canvas.getContext('2d');
            
            // Draw original high-res base photo
            ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
            // Draw vector math on top
            const vectorCanvas = document.getElementById('vector-drawing-layer');
            ctx.drawImage(vectorCanvas, 0, 0);

            const finalImage = canvas.toDataURL('image/jpeg', 0.85);
            doc.addImage(finalImage, 'JPEG', 0, 0, canvas.width, canvas.height);
            
            // 3. Automated Pamphlet Stitching (Preserving your original uploaded logic)
            btn.innerHTML = "Stitching Pamphlets...";
            
            // Standard Pages from your Pamphlet folder
            const pagesToAppend = [
                './pamphlet/who-we-are.jpg', 
                './pamphlet/protecting-home.jpg', 
                './pamphlet/journey.jpg'
            ];
            
            // Conditional Roof Types
            if (roofType === 'Ultra380') pagesToAppend.push('./pamphlet/tailored.jpg');
            if (roofType === 'LivinRoof') pagesToAppend.push('./pamphlet/sap-calcs.jpg');
            if (roofType === 'Edwardian roof') pagesToAppend.push('./pamphlet/cavity.jpg');

            const pdfFullWidth = surveyState.imageIntrinsicWidth;
            const pdfFullHeight = surveyState.imageIntrinsicHeight;

            // Loop and stitch full-bleed pages
            for (const filename of pagesToAppend) {
                const img = await this.loadPamphletImage(filename);
                if (img) { 
                    doc.addPage(); 
                    doc.addImage(img, 'JPEG', 0, 0, pdfFullWidth, pdfFullHeight); 
                }
            }
            
            // Save final clean report
            doc.save(`COHI_Survey_Master_${Date.now()}.pdf`);

        } catch (error) {
            console.error("CAPTURE FAILED:", error);
            alert("Export Failed: " + error.message);
        } finally {
            btn.innerHTML = `Export PDF`;
        }
    }
};
