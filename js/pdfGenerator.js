import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./app.js";

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
            img.onerror = () => resolve(null);
            img.src = url;
        });
    },

    async uploadPdfToCloudinary(pdfBlob) {
        const formData = new FormData(); 
        formData.append('file', pdfBlob, 'COHI_Survey.pdf'); 
        formData.append('upload_preset', 'crm_document_uploads');
        const res = await fetch(`https://api.cloudinary.com/v1_1/dqk1hz0f8/auto/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) return data.secure_url; 
        throw new Error("Cloudinary API Rejection");
    },

    async generate(surveyState, roofType) {
        if (!window.activeVaultSurveyId) {
            alert("Please click 'Copy to CRM' to sync the profile before exporting the PDF.");
            return;
        }

        const btn = document.getElementById('btn-generate-pdf');
        const originalText = btn.innerHTML;
        btn.innerHTML = "Rendering Math...";
        
        try {
            if (!surveyState.imageIntrinsicWidth) throw new Error("No survey image loaded.");

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [surveyState.imageIntrinsicWidth, surveyState.imageIntrinsicHeight] });
            
            const photo = document.getElementById('active-survey-photo');
            const canvas = document.createElement('canvas');
            canvas.width = surveyState.imageIntrinsicWidth; canvas.height = surveyState.imageIntrinsicHeight;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
            const vectorCanvas = document.getElementById('vector-drawing-layer');
            ctx.drawImage(vectorCanvas, 0, 0);

            const finalImage = canvas.toDataURL('image/jpeg', 0.85);
            doc.addImage(finalImage, 'JPEG', 0, 0, canvas.width, canvas.height);
            
            btn.innerHTML = "Stitching Pamphlets...";
            const pagesToAppend = ['./pamphlet/who-we-are.jpg', './pamphlet/protecting-home.jpg', './pamphlet/journey.jpg'];
            if (roofType === 'Ultra380') pagesToAppend.push('./pamphlet/tailored.jpg');
            if (roofType === 'LivinRoof') pagesToAppend.push('./pamphlet/sap-calcs.jpg');
            if (roofType === 'Edwardian roof') pagesToAppend.push('./pamphlet/cavity.jpg');

            const pdfFullWidth = surveyState.imageIntrinsicWidth; const pdfFullHeight = surveyState.imageIntrinsicHeight;
            for (const filename of pagesToAppend) {
                const img = await this.loadPamphletImage(filename);
                if (img) { doc.addPage(); doc.addImage(img, 'JPEG', 0, 0, pdfFullWidth, pdfFullHeight); }
            }
            
            // Generate Blob and Upload to Cloud
            btn.innerHTML = "Uploading to Vault...";
            const pdfBlob = doc.output('blob');
            const secureUrl = await this.uploadPdfToCloudinary(pdfBlob);

            // Attach to the V3 Database
            await addDoc(collection(db, `surveys/${window.activeVaultSurveyId}/documents`), { 
                name: `Master Survey - ${roofType}`, 
                url: secureUrl, 
                category: "Survey Report", 
                uploadedAt: serverTimestamp() 
            });

            // Fallback Local Save
            doc.save(`COHI_Survey_Master_${Date.now()}.pdf`);

        } catch (error) {
            console.error("RENDER FAILED:", error);
            alert("Export Failed: " + error.message);
        } finally {
            btn.innerHTML = `Export PDF`;
        }
    }
};
