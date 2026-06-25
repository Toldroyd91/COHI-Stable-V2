// vault-3d.js
export const inject3DHotspots = (containerElement, renderUrl) => {
    // 1. Set up the container relative positioning
    containerElement.style.position = 'relative';
    containerElement.style.overflow = 'hidden';

    // 2. Inject the 3D image/model
    const img = document.createElement('img');
    img.src = renderUrl;
    img.className = "w-full h-full object-cover rounded-xl border border-slate-700";
    containerElement.appendChild(img);

    // 3. Create the Hotspot Builder
    const createHotspot = (xPercent, yPercent, title, description) => {
        const spot = document.createElement('div');
        spot.className = "absolute w-6 h-6 bg-[#0dcaf0] rounded-full cursor-pointer shadow-[0_0_15px_#0dcaf0] animate-pulse flex items-center justify-center hover:bg-white transition-colors z-10";
        spot.style.left = `${xPercent}%`;
        spot.style.top = `${yPercent}%`;
        spot.style.transform = "translate(-50%, -50%)";

        const card = document.createElement('div');
        card.className = "absolute top-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-[#0dcaf0] p-4 rounded-lg w-48 opacity-0 pointer-events-none transition-opacity z-20 shadow-2xl";
        card.innerHTML = `<h4 class="text-[#0dcaf0] font-bold text-sm mb-1">${title}</h4><p class="text-xs text-gray-300 leading-tight">${description}</p>`;
        
        spot.appendChild(card);

        // Interaction
        spot.addEventListener('mouseenter', () => card.classList.replace('opacity-0', 'opacity-100'));
        spot.addEventListener('mouseleave', () => card.classList.replace('opacity-100', 'opacity-0'));
        
        containerElement.appendChild(spot);
    };

    // 4. Deploy Strategic Sales Hotspots
    // (Coordinates are percentages: X, Y)
    createHotspot(50, 20, "Thermal Glazing", "Argon-filled units retain 40% more heat during winter, dropping your energy bills.");
    createHotspot(30, 60, "Seamless Brick Match", "Sourced locally to guarantee a flawless transition from your existing property.");
    createHotspot(70, 75, "Micro-Bifold Tracks", "Flush-floor tracks create a zero-trip hazard flow straight into the garden.");
};
