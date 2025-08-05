document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = "https://color-identifier-django.onrender.com";

    // --- View and Element References ---
    const allViews = document.querySelectorAll('.view');
    const selectImageBtn = document.getElementById('select-image-btn');
    const selectCameraBtn = document.getElementById('select-camera-btn');
    const backButtons = document.querySelectorAll('.back-button');
    
    // --- Image View Elements ---
    const imageInput = document.getElementById('image-input');
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
    const video = document.getElementById('video');
    const cameraOverlay = document.getElementById('camera-overlay');
    const liveColorLabel = document.getElementById('live-color-label');
    const hiddenCanvas = document.createElement('canvas');
    const hiddenCtx = hiddenCanvas.getContext('2d');
    
    let currentStream;
    let currentFacingMode = 'user';
    let analysisInterval;

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

    // --- Image Analysis Logic ---
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            originalImage = new Image();
            originalImage.onload = () => {
                resetImageState();
            };
            originalImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    function drawImageToCanvas(img) {
        const displayWidth = imageCanvas.parentElement.clientWidth;
        const scale = displayWidth / img.width;
        imageCanvas.width = displayWidth;
        imageCanvas.height = img.height * scale;
        imageCtx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
    }

    function resetImageState() {
        if (originalImage) {
            drawImageToCanvas(originalImage);
        }
        selectionRect.style.display = 'none';
        resultsContainer.innerHTML = '';
        selection = { startX: 0, startY: 0, endX: 0, endY: 0 };
    }

    toolAnalyzeBtn.addEventListener('click', async () => {
        const rectWidth = Math.abs(selection.endX - selection.startX);
        const rectHeight = Math.abs(selection.endY - selection.startY);

        if (!originalImage || rectWidth < 5 || rectHeight < 5) {
            // Use a more user-friendly notification instead of alert()
            resultsContainer.innerHTML = `<p style="color: #dc3545;">Please select a region on the image first by dragging your mouse or finger.</p>`;
            return;
        }

        resultsContainer.innerHTML = "Analyzing...";

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = rectWidth;
        tempCanvas.height = rectHeight;
        
        const imageData = imageCtx.getImageData(
            Math.min(selection.startX, selection.endX),
            Math.min(selection.startY, selection.endY),
            rectWidth,
            rectHeight
        );
        tempCtx.putImageData(imageData, 0, 0);

        tempCanvas.toBlob(async (blob) => {
            const formData = new FormData();
            formData.append('image', blob, 'selection.png');

            try {
                const response = await fetch(`${API_BASE_URL}/api/identify-image/`, {
                    method: 'POST',
                    body: formData,
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Analysis failed');
                displayAnalysisResults(data.colors);
            } catch (error) {
                resultsContainer.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
            }
        }, 'image/png');
    });

    toolResetBtn.addEventListener('click', resetImageState);

    function getEventCoords(e) {
        const rect = imageCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    imageCanvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        isSelecting = true;
        const { x, y } = getEventCoords(e);
        selection.startX = x;
        selection.startY = y;
        selectionRect.style.left = `${x}px`;
        selectionRect.style.top = `${y}px`;
        selectionRect.style.width = '0px';
        selectionRect.style.height = '0px';
        selectionRect.style.display = 'block';
    });

    imageCanvas.addEventListener('pointermove', (e) => {
        if (!isSelecting) return;
        e.preventDefault();
        const { x, y } = getEventCoords(e);
        selection.endX = x;
        selection.endY = y;
        selectionRect.style.width = `${Math.abs(x - selection.startX)}px`;
        selectionRect.style.height = `${Math.abs(y - selection.startY)}px`;
        selectionRect.style.left = `${Math.min(selection.startX, x)}px`;
        selectionRect.style.top = `${Math.min(selection.startY, y)}px`;
    });

    imageCanvas.addEventListener('pointerup', (e) => {
        isSelecting = false;
    });
    
    function displayAnalysisResults(colors) {
        resultsContainer.innerHTML = '';
        if (!colors || colors.length === 0) {
            resultsContainer.innerHTML = '<p>No dominant colors found in the selection.</p>';
            return;
        }
        colors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-box';
            colorDiv.style.backgroundColor = color.hex;
            const rgb = color.rgb;
            const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
            colorDiv.style.color = brightness > 125 ? 'black' : 'white';
            colorDiv.style.textShadow = brightness > 125 ? 'none' : '1px 1px 2px rgba(0,0,0,0.7)';
            colorDiv.innerHTML = `<span>${color.name}</span><span>${color.hex}</span>`;
            resultsContainer.appendChild(colorDiv);
        });
    }

    // --- Live Camera Logic ---
    startButton.addEventListener('click', () => currentStream ? stopCamera() : startCamera());
    switchButton.addEventListener('click', () => {
        currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
        startCamera();
    });

    async function startCamera() {
        if (currentStream) stopCamera();
        try {
            currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } });
            video.srcObject = currentStream;
            video.hidden = false;
            cameraOverlay.hidden = false;
            switchButton.hidden = false;
            startButton.textContent = "Stop Camera";
            video.onloadedmetadata = () => {
                hiddenCanvas.width = video.videoWidth;
                hiddenCanvas.height = video.videoHeight;
                analysisInterval = setInterval(analyzeLiveFrame, 500);
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
        startButton.textContent = "Start Camera";
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
