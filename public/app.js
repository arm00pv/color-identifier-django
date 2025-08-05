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
    let isCaptureMode = false;

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
        const img = new Image();
        img.crossOrigin = "Anonymous";
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
        isCaptureMode = true; // Set a flag for capture mode
        showView('camera-view');
        startCamera();
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
        imageInput.value = '';
    }

    // --- Image Selection and Analysis ---
    toolAnalyzeBtn.addEventListener('click', async () => {
        const rectWidth = Math.abs(selection.endX - selection.startX);
        const rectHeight = Math.abs(selection.endY - selection.startY);

        if (!originalImage || rectWidth < 5 || rectHeight < 5) {
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
    startButton.addEventListener('click', () => {
        if (currentStream) {
            if (isCaptureMode) {
                hiddenCanvas.width = video.videoWidth;
                hiddenCanvas.height = video.videoHeight;
                hiddenCtx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
                const dataUrl = hiddenCanvas.toDataURL('image/png');
                originalImage = new Image();
                originalImage.onload = () => {
                    stopCamera(); // Stop the camera first
                    showView('image-view'); // Then switch views
                    resetImageState(); // Finally, draw the new image
                };
                originalImage.src = dataUrl;
            } else {
                stopCamera();
            }
        } else {
            startCamera();
        }
    });
    
    switchButton.addEventListener('click', () => {
        currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
        startCamera();
    });

    flashBtn.addEventListener('click', () => {
        if (!currentStream) return;
        const track = currentStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if (!capabilities.torch) {
            console.log("Torch/Flash not supported on this device.");
            return;
        }
        torchOn = !torchOn;
        track.applyConstraints({ advanced: [{ torch: torchOn }] })
            .catch(err => console.error('Torch constraint failed:', err));
        flashBtn.style.backgroundColor = torchOn ? '#005a9a' : '#0072BB';
    });

    zoomSlider.addEventListener('input', () => {
        if (!currentStream) return;
        const track = currentStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if (!capabilities.zoom) {
            console.log("Zoom not supported on this device.");
            return;
        }
        track.applyConstraints({ advanced: [{ zoom: zoomSlider.value }] })
            .catch(err => console.error('Zoom constraint failed:', err));
    });

    async function startCamera() {
        if (currentStream) await stopCamera(true); // FIX: Pass true to keep capture mode
        
        const constraints = { video: { facingMode: currentFacingMode } };
        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = currentStream;
            video.hidden = false;
            
            await video.play();

            const track = currentStream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            
            if (isCaptureMode) {
                startButton.textContent = "Take Picture";
                switchButton.hidden = false;
            } else {
                cameraOverlay.hidden = false;
                switchButton.hidden = false;
                startButton.textContent = "Stop Camera";
                analysisInterval = setInterval(analyzeLiveFrame, 500);

                if (capabilities.torch) {
                    flashBtn.hidden = false;
                }
                if (capabilities.zoom) {
                    zoomControlContainer.hidden = false;
                    zoomSlider.min = capabilities.zoom.min;
                    zoomSlider.max = capabilities.zoom.max;
                    zoomSlider.step = capabilities.zoom.step;
                    zoomSlider.value = track.getSettings().zoom || 1;
                }
            }
        } catch (err) {
            liveColorLabel.textContent = `Error: ${err.name}`;
            console.error("Camera access error:", err);
        }
    }

    async function stopCamera(keepCaptureMode = false) { // FIX: Add parameter
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        clearInterval(analysisInterval);
        currentStream = null;
        video.srcObject = null;
        video.hidden = true;
        cameraOverlay.hidden = true;
        switchButton.hidden = true;
        flashBtn.hidden = true;
        zoomControlContainer.hidden = true;
        startButton.textContent = "Start Camera";
        liveColorLabel.textContent = '';
        torchOn = false;
        flashBtn.style.backgroundColor = '#0072BB';
        
        if (!keepCaptureMode) { // FIX: Only reset if we are not just switching cameras
            isCaptureMode = false;
        }
    }

    async function analyzeLiveFrame() {
        if (!currentStream) return;
        hiddenCanvas.width = video.videoWidth;
        hiddenCanvas.height = video.videoHeight;
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
