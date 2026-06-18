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
        const originalText = document.getElementById('generateCustomerPdfBtn').innerText;
        document.getElementById('generateCustomerPdfBtn').innerText = "Rendering Blueprint...";
        
        try {
            if (!surveyState.imageIntrinsicWidth) throw new Error("No survey image loaded in the drafting stage.");

            // 1. Initialize Decoupled jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ 
                orientation: "landscape", 
                unit: "px", 
                format: [surveyState.imageIntrinsicWidth, surveyState.imageIntrinsicHeight] 
            });
            
            // 2. Mathematical Canvas Stamping (Bypassing Fabric & Viewport limitations)
            const photo = document.getElementById('active-survey-photo');
            const canvas = document.createElement('canvas');
            canvas.width = surveyState.imageIntrinsicWidth;
            canvas.height = surveyState.imageIntrinsicHeight;
            const ctx = canvas.getContext('2d');
            
            // Draw original high-res base photo
            ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
            
            // Draw vector math overlay directly from the invisible canvas
            const vectorCanvas = document.getElementById('vector-drawing-layer');
            ctx.drawImage(vectorCanvas, 0, 0);

            const finalImage = canvas.toDataURL('image/jpeg', 0.85);
            doc.addImage(finalImage, 'JPEG', 0, 0, canvas.width, canvas.height);
            
            // 3. Automated Pamphlet Stitching
            document.getElementById('generateCustomerPdfBtn').innerText = "Stitching Pamphlets...";
            
            // Base company pages
            const pagesToAppend = [
                './pamphlet/who-we-are.jpg', 
                './pamphlet/protecting-home.jpg', 
                './pamphlet/journey.jpg'
            ];
            
            // Appending logic for specific roof types
            if (roofType === 'Ultra380') pagesToAppend.push('./pamphlet/tailored.jpg');
            if (roofType === 'LivinRoof') pagesToAppend.push('./pamphlet/sap-calcs.jpg');
            if (roofType === 'Edwardian roof') pagesToAppend.push('./pamphlet/cavity.jpg');

            const pdfFullWidth = surveyState.imageIntrinsicWidth;
            const pdfFullHeight = surveyState.imageIntrinsicHeight;

            for (const filename of pagesToAppend) {
                const img = await this.loadPamphletImage(filename);
                if (img) { 
                    doc.addPage(); 
                    doc.addImage(img, 'JPEG', 0, 0, pdfFullWidth, pdfFullHeight); 
                }
            }
            
            // 4. Save Output
            doc.save(`COHI_Survey_Master_${Date.now()}.pdf`);
            window.showToast("PDF Export Complete!", true);

        } catch (error) {
            console.error("CAPTURE FAILED:", error);
            window.showToast("Export Failed: " + error.message, false);
        } finally {
            document.getElementById('generateCustomerPdfBtn').innerText = originalText;
        }
    }
};
