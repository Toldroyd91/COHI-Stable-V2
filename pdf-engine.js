export const generateSurveyPDF = async (docTitle) => {
    if (!window.jspdf || !window.html2canvas) {
        alert("PDF Engines loading. Please try again in 2 seconds.");
        return;
    }

    const jsPDF = window.jspdf.jsPDF || window.jspdf;
    
    // CRITICAL: Forces viewport to top to prevent html2canvas blank-out bug
    window.scrollTo(0, 0);

    const template = document.getElementById('pdfTemplateInternal');
    if (!template) return alert("PDF template missing from HTML!");

    try {
        template.style.display = 'block';
        template.style.position = 'absolute';
        template.style.top = '0px';
        template.style.left = '0px';
        template.style.width = '794px'; 
        template.style.background = '#ffffff';
        template.style.zIndex = '-999'; 

        // Allow images to paint
        await new Promise(r => setTimeout(r, 600));

        const pdf = new jsPDF('p', 'pt', 'a4');
        const pages = template.querySelectorAll('.pdf-page');

        for (let i = 0; i < pages.length; i++) {
            const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 794, scrollY: 0 });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage();
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }

        pdf.save(`${docTitle || 'Customer'}_Survey.pdf`);
    } catch (err) {
        console.error("PDF Engine Error:", err);
        alert("Render failed. Check console.");
    } finally {
        template.style.display = 'none';
    }
};
