import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, onSnapshot, updateDoc, increment, serverTimestamp, collection, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 1. FIREBASE INITIALIZATION
const appConfig = { 
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0", 
    authDomain: "cohi-survey-engine.firebaseapp.com", 
    projectId: "cohi-survey-engine" 
};
const app = initializeApp(appConfig);
const db = getFirestore(app);

// 2. CONTEXT & DOM BINDING
// This reads ?id=PROJ-123 from the URL to load the correct customer
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id') || 'PROJ-88492A'; 
const docRef = doc(db, "surveys", projectId);

const elClientName = document.getElementById('clientName');
const elQuoteValue = document.getElementById('quoteValue');
const elPadlock = document.getElementById('vault-padlock');
const elTimeSince = document.getElementById('timeSince');
const elRagStatus = document.getElementById('ragStatus');
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const btnSign = document.getElementById('btnSign');

let renderEngineActive = false;

// 3. ADVANCED TELEMETRY & HEAT-MAPPING
async function initTelemetry() {
    // Log the page open immediately
    await updateDoc(docRef, {
        "vaultTelemetry.totalOpens": increment(1),
        "vaultTelemetry.lastViewed": serverTimestamp()
    });

    // Track active engagement time (ping database every 60 seconds)
    setInterval(() => {
        updateDoc(docRef, { "vaultTelemetry.timeSpentMinutes": increment(1) });
    }, 60000);

    // Hover Telemetry: Track what the customer is looking at to gauge buying intent
    document.querySelectorAll('.glass').forEach(el => {
        el.addEventListener('mouseenter', () => {
            const sectionName = el.querySelector('h3') ? el.querySelector('h3').innerText : '3D UDesign Viewer';
            updateDoc(docRef, { "vaultTelemetry.lastHovered": sectionName });
        });
    });
}

// 4. REAL-TIME VAULT SYNC (The UI Engine)
onSnapshot(docRef, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();

    // Populate Master Header
    elClientName.innerText = data.customerProfile?.leadName || "Client Profile";
    
    // Calculate Behavioral RAG Status
    updateRAGStatus(data);

    // Inject Quote & Check Padlock Status
    if (data.uDesignBridge) {
        elQuoteValue.innerText = data.uDesignBridge.totalQuoteValue ? 
            new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(data.uDesignBridge.totalQuoteValue) : 
            "Awaiting Calculation...";

        // Theatrical Unlock Logic
        if (data.vaultTelemetry?.isUnlocked) {
            elPadlock.style.display = 'none'; // Drops the padlock
            if (data.uDesignBridge.render3DUrl && !renderEngineActive) {
                launchUDesignRender(data.uDesignBridge.render3DUrl); // Ignites the 3D Engine
            }
        } else {
            elPadlock.style.display = 'flex';
        }
    }
});

// 5. DYNAMIC RAG SCORING ALGORITHM
function updateRAGStatus(data) {
    const lastContact = data.timestamps?.updatedAt?.toDate() || new Date();
    const now = new Date();
    const diffHours = Math.abs(now - lastContact) / 36e5;
    const opens = data.vaultTelemetry?.totalOpens || 0;

    // Calculate Digital Stopwatch (Time since last designer contact)
    const diffDays = Math.floor(diffHours / 24);
    const remHours = Math.floor(diffHours % 24);
    elTimeSince.innerText = `${diffDays}d ${remHours}h`;

    // Base Status
    let status = "AMBER (Reviewing)";
    let color = "text-yellow-400";
    
    // Logic: If they open the vault 5+ times in 48 hours, they are red hot.
    if (opens >= 5 && diffHours < 48) {
        status = "HOT (High Buying Intent)";
        color = "text-emerald-400";
    } 
    // Logic: If we haven't touched the file in over a week, flag it to save the sale.
    else if (diffHours > 168) { 
        status = "RED (At Risk - Requires Contact)";
        color = "text-red-500";
    }

    elRagStatus.className = `text-sm font-bold mt-1 ${color}`;
    elRagStatus.innerText = `RAG STATUS: ${status}`;
}

// 6. THE UDESIGN 3D THEATER (THREE.JS)
function launchUDesignRender(url) {
    if (renderEngineActive) return;
    const container = document.getElementById('3d-viewport');
    
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Studio Lighting Array (Makes bricks and glass look premium)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Physical Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2; // Stops them from looking under the floor

    // Ingest the UDesign .dae format
    const loader = new THREE.ColladaLoader();
    loader.load(url, (collada) => {
        const houseModel = collada.scene;
        
        // Auto-Center Math
        const box = new THREE.Box3().setFromObject(houseModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2)) * 1.5;
        
        camera.position.set(center.x, center.y + (size.y / 2), cameraZ);
        controls.target.set(center.x, center.y, center.z);
        
        scene.add(houseModel);
        renderEngineActive = true;
    }, undefined, (err) => console.error('UDesign Pipeline Error:', err));

    // 60FPS Render Loop
    function animate() {
        if (!renderEngineActive) return;
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Auto-scale on device rotate
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// 7. SECURE DIRECT-TO-DESIGNER CHAT
const messagesRef = collection(db, `surveys/${projectId}/messages`);
const qMessages = query(messagesRef, orderBy("timestamp", "asc"));

onSnapshot(qMessages, (snapshot) => {
    chatWindow.innerHTML = '';
    snapshot.forEach(doc => {
        const msg = doc.data();
        const isCustomer = msg.sender === 'Customer';
        
        // Dynamic UI Formatting
        const align = isCustomer ? 'text-right' : 'text-left';
        const bg = isCustomer ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-gray-200';
        const name = isCustomer ? 'You' : 'Tom (Designer)';

        chatWindow.innerHTML += `
            <div class="mb-4 ${align}">
                <span class="text-xs text-gray-500 mb-1 inline-block">${name}</span>
                <div class="inline-block p-3 rounded-lg ${bg} max-w-[80%] text-sm shadow-lg">
                    ${msg.text}
                </div>
            </div>
        `;
    });
    chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll to bottom
});

// Push new message to database
chatInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
        const text = chatInput.value.trim();
        chatInput.value = '';
        
        await addDoc(messagesRef, {
            sender: 'Customer',
            text: text,
            timestamp: serverTimestamp()
        });
        
        // Reset the RAG timer because the customer just initiated contact
        await updateDoc(docRef, { "timestamps.updatedAt": serverTimestamp() });
    }
});

// Execute
initTelemetry();
