document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = "https://color-identifier-django.onrender.com";

    // --- View and Element References ---
    const allViews = document.querySelectorAll('.view');
    const selectImageBtn = document.getElementById('select-image-btn');
    const selectCameraBtn = document.getElementById('select-camera-btn');
    const backButtons = document.querySelectorAll('.back-button');
    
    // --- Image View Elements ---
    const imageInput = document.getElementById('image-input');
    const captureImageBtn = document.getElementById('capture-image-btn');
    const imageUrlInput = document.getElementById('image-url-input');
    const loadUrlBtn = document.getElementById('load-url-btn');
    const imageCanvas = document.getElementById('image-canvas');
    const imageCtx = imageCanvas.getContext('2d', { willReadFrequently: true });
    const selectionRect = document.getElementById('selection-rect');
    const toolAnalyzeBtn = document.getElementById('tool-analyze');
    const toolResetBtn = document.getElementById('tool-reset');
    const resultsContainer = document.getElementById('analysis-results-container');
    let originalImage = null;
    let selection = { startX: 0, startY: 0, endX: 0, endY: 0 };
    let isSelecting = false;

    // --- Camera View Elements ---
    const startButton = document.getElementById('start-camera');
    const switchButton = document.getElementById('switch-camera');
    const flashBtn = document.getElementById('flash-btn');
    const zoomControlContainer = document.getElementById('zoom-control-container');
    const zoomSlider = document.getElementById('zoom-slider');
    const video = document.getElementById('video');
    const cameraOverlay = document.getElementById('camera-overlay');
    const liveColorLabel = document.getElementById('live-color-label');
    const hiddenCanvas = document.createElement('canvas');
    const hiddenCtx = hiddenCanvas.getContext('2d');
    
    let currentStream;
    let currentFacingMode = 'user';
    let analysisInterval;
    let torchOn = false;

    // --- View Navigation ---
    function showView(viewId) {
        allViews.forEach(view => view.style.display = 'none');
        document.getElementById(viewId).style.display = 'block';
    }
    selectImageBtn.addEventListener('click', () => showView('image-view'));
    selectCameraBtn.addEventListener('click', () => showView('camera-view'));
    backButtons.forEach(button => button.addEventListener('click', () => {
        if (currentStream) stopCamera();
        showView('selection-view');
        resetImageState();
    }));

    // --- Image Loading Logic ---
    imageInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    
    loadUrlBtn.addEventListener('click', () => {
        const url = imageUrlInput.value;
        if (!url) {
            alert('Please enter an image URL.');
            return;
        }
        // Note: Loading from URL may fail due to CORS policy on the remote server.
        // A backend proxy would be needed for a fully robust solution.
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Attempt to load cross-origin
        img.onload = () => {
            originalImage = img;
            resetImageState();
        };
        img.onerror = () => {
            alert('Could not load image from this URL. The server may be blocking it (CORS policy).');
        };
        img.src = url;
    });

    captureImageBtn.addEventListener('click', () => {
        // Temporarily use the camera view to capture a photo
        showView('camera-view');
        startCamera(true); // true indicates we are in capture mode
    });

    function handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            originalImage = new Image();
            originalImage.onload = resetImageState;
            originalImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function drawImageToCanvas(img) {
        const displayWidth = imageCanvas.parentElement.clientWidth;
        const scale = displayWidth / img.width;
        imageCanvas.width = displayWidth;
        imageCanvas.height = img.height * scale;
        imageCtx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
    }

    function resetImageState() {
        if (originalImage) drawImageToCanvas(originalImage);
        selectionRect.style.display = 'none';
        resultsContainer.innerHTML = '';
        selection = { startX: 0, startY: 0, endX: 0, endY: 0 };
    }

    // --- Image Selection and Analysis ---
    toolAnalyzeBtn.addEventListener('click', async () => {
        // ... (This logic remains the same as previous version)
    });
    toolResetBtn.addEventListener('click', resetImageState);

    // ... (Pointer event listeners for selection remain the same)

    // --- Live Camera Logic ---
    startButton.addEventListener('click', () => currentStream ? stopCamera() : startCamera(false));
    switchButton.addEventListener('click', () => {
        currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
        startCamera(false);
    });

    flashBtn.addEventListener('click', () => {
        if (!currentStream) return;
        const track = currentStream.getVideoTracks()[0];
        torchOn = !torchOn;
        track.applyConstraints({ advanced: [{ torch: torchOn }] });
        flashBtn.style.backgroundColor = torchOn ? '#005a9a' : '#0072BB';
    });

    zoomSlider.addEventListener('input', () => {
        if (!currentStream) return;
        const track = currentStream.getVideoTracks()[0];
        track.applyConstraints({ advanced: [{ zoom: zoomSlider.value }] });
    });

    async function startCamera(isCaptureMode = false) {
        if (currentStream) stopCamera();
        
        const constraints = { video: { facingMode: currentFacingMode } };
        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = currentStream;
            video.hidden = false;
            
            if (isCaptureMode) {
                // In capture mode, show a capture button instead of live analysis
                startButton.textContent = "Take Picture";
                startButton.onclick = () => {
                    hiddenCtx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
                    const dataUrl = hiddenCanvas.toDataURL('image/png');
                    originalImage = new Image();
                    originalImage.onload = resetImageState;
                    originalImage.src = dataUrl;
                    stopCamera();
                    showView('image-view');
                };
            } else {
                // In live analysis mode
                cameraOverlay.hidden = false;
                switchButton.hidden = false;
                startButton.textContent = "Stop Camera";
                startButton.onclick = () => stopCamera();
                analysisInterval = setInterval(analyzeLiveFrame, 500);
            }

            // Check for advanced capabilities (flash, zoom)
            const track = currentStream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            
            if (capabilities.torch) {
                flashBtn.hidden = false;
            }
            if (capabilities.zoom) {
                zoomControlContainer.hidden = false;
                zoomSlider.min = capabilities.zoom.min;
                zoomSlider.max = capabilities.zoom.max;
                zoomSlider.step = capabilities.zoom.step;
            }

            video.onloadedmetadata = () => {
                hiddenCanvas.width = video.videoWidth;
                hiddenCanvas.height = video.videoHeight;
            };
        } catch (err) {
            liveColorLabel.textContent = `Error: ${err.name}`;
            console.error("Camera access error:", err);
        }
    }

    function stopCamera() {
        if (currentStream) currentStream.getTracks().forEach(track => track.stop());
        clearInterval(analysisInterval);
        currentStream = null;
        video.srcObject = null;
        video.hidden = true;
        cameraOverlay.hidden = true;
        switchButton.hidden = true;
        flashBtn.hidden = true;
        zoomControlContainer.hidden = true;
        startButton.textContent = "Start Camera";
        startButton.onclick = () => startCamera(false);
        liveColorLabel.textContent = '';
    }

    async function analyzeLiveFrame() {
        if (!currentStream) return;
        const centerX = hiddenCanvas.width / 2;
        const centerY = hiddenCanvas.height / 2;
        hiddenCtx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        const pixel = hiddenCtx.getImageData(centerX, centerY, 1, 1).data;
        const [r, g, b] = pixel;

        try {
            const response = await fetch(`${API_BASE_URL}/api/identify-rgb/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ r, g, b }),
            });
            if (!response.ok) return;
            const data = await response.json();
            liveColorLabel.textContent = `${data.name} (${data.hex})`;
            liveColorLabel.style.backgroundColor = data.hex;

            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            liveColorLabel.style.color = brightness > 125 ? 'black' : 'white';
        } catch (error) {
            console.error("Live analysis error:", error);
        }
    }
});
