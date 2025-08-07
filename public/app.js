document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = "https://color-identifier-django.onrender.com";

    // --- Centralized State Management ---
    const appState = {
        currentStream: null,
        currentFacingMode: 'user',
        analysisInterval: null,
        torchOn: false,
        originalImage: null,
        selection: { startX: 0, startY: 0, endX: 0, endY: 0 },
        isSelecting: false,
    };

    // --- DOM Element References ---
    const elements = {
        views: document.querySelectorAll('.view'),
        selectImageBtn: document.getElementById('select-image-btn'),
        selectCameraBtn: document.getElementById('select-camera-btn'),
        backButtons: document.querySelectorAll('.back-button'),
        imageInput: document.getElementById('image-input'),
        imageUrlInput: document.getElementById('image-url-input'),
        loadUrlBtn: document.getElementById('load-url-btn'),
        imageCanvas: document.getElementById('image-canvas'),
        imageCtx: document.getElementById('image-canvas').getContext('2d', { willReadFrequently: true }),
        selectionRect: document.getElementById('selection-rect'),
        toolAnalyzeBtn: document.getElementById('tool-analyze'),
        toolResetBtn: document.getElementById('tool-reset'),
        resultsContainer: document.getElementById('analysis-results-container'),
        startButton: document.getElementById('start-camera'),
        switchButton: document.getElementById('switch-camera'),
        flashBtn: document.getElementById('flash-btn'),
        zoomControlContainer: document.getElementById('zoom-control-container'),
        zoomSlider: document.getElementById('zoom-slider'),
        video: document.getElementById('video'),
        cameraOverlay: document.getElementById('camera-overlay'),
        liveColorLabel: document.getElementById('live-color-label'),
        cameraToolbar: document.getElementById('camera-toolbar'),
        captureBtn: document.getElementById('capture-btn'),
        cameraResultsContainer: document.getElementById('camera-results-container'),
        hiddenCanvas: document.createElement('canvas'),
    };
    elements.hiddenCtx = elements.hiddenCanvas.getContext('2d');

    // --- API Helper ---
    async function fetchDominantColors(blob, n_colors = 5) {
        const formData = new FormData();
        formData.append('image', blob, 'selection.png');
        const response = await fetch(`${API_BASE_URL}/api/identify-image/`, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Analysis failed');
        return data.colors;
    }

    async function fetchColorNameForRGB(r, g, b) {
        const response = await fetch(`${API_BASE_URL}/api/identify-rgb/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ r, g, b }),
        });
        if (!response.ok) return null;
        return await response.json();
    }

    // --- UI Update Helpers ---
    function showView(viewId) {
        elements.views.forEach(view => view.style.display = 'none');
        document.getElementById(viewId).style.display = 'block';
    }

    function displayAnalysisResults(colors, container) {
        container.innerHTML = '';
        if (!colors || colors.length === 0) {
            container.innerHTML = '<p>No dominant colors found.</p>';
            return;
        }
        colors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-box';
            colorDiv.style.backgroundColor = color.hex;
            const brightness = (color.rgb[0] * 299 + color.rgb[1] * 587 + color.rgb[2] * 114) / 1000;
            colorDiv.style.color = brightness > 125 ? 'black' : 'white';
            colorDiv.style.textShadow = brightness > 125 ? 'none' : '1px 1px 2px rgba(0,0,0,0.7)';
            colorDiv.innerHTML = `<span>${color.name}</span><span>${color.hex}</span>`;
            container.appendChild(colorDiv);
        });
    }

    // --- Image Analysis Logic ---
    function drawImageToCanvas(img) {
        const displayWidth = elements.imageCanvas.parentElement.clientWidth;
        const scale = displayWidth / img.width;
        elements.imageCanvas.width = displayWidth;
        elements.imageCanvas.height = img.height * scale;
        elements.imageCtx.drawImage(img, 0, 0, elements.imageCanvas.width, elements.imageCanvas.height);
    }

    function resetImageState() {
        if (appState.originalImage) drawImageToCanvas(appState.originalImage);
        elements.selectionRect.style.display = 'none';
        elements.resultsContainer.innerHTML = '';
        appState.selection = { startX: 0, startY: 0, endX: 0, endY: 0 };
        elements.imageInput.value = '';
    }

    async function analyzeSelection() {
        const { startX, startY, endX, endY } = appState.selection;
        const rectWidth = Math.abs(endX - startX);
        const rectHeight = Math.abs(endY - startY);

        if (!appState.originalImage || rectWidth < 5 || rectHeight < 5) {
            elements.resultsContainer.innerHTML = `<p style="color: #dc3545;">Please select a region on the image first by dragging.</p>`;
            return;
        }

        elements.resultsContainer.innerHTML = "Analyzing...";

        const imageData = elements.imageCtx.getImageData(Math.min(startX, endX), Math.min(startY, endY), rectWidth, rectHeight);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = rectWidth;
        tempCanvas.height = rectHeight;
        tempCanvas.getContext('2d').putImageData(imageData, 0, 0);

        tempCanvas.toBlob(async (blob) => {
            try {
                const colors = await fetchDominantColors(blob, 5);
                displayAnalysisResults(colors, elements.resultsContainer);
            } catch (error) {
                elements.resultsContainer.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
            }
        }, 'image/png');
    }

    // --- Camera Logic ---
    async function captureAndAnalyze() {
        if (!appState.currentStream) return;

        elements.cameraResultsContainer.innerHTML = 'Capturing...';
        const { videoWidth, videoHeight } = elements.video;
        elements.hiddenCanvas.width = videoWidth;
        elements.hiddenCanvas.height = videoHeight;
        elements.hiddenCtx.drawImage(elements.video, 0, 0, videoWidth, videoHeight);

        elements.hiddenCanvas.toBlob(async (blob) => {
            try {
                elements.cameraResultsContainer.innerHTML = 'Analyzing...';
                const colors = await fetchDominantColors(blob, 12);
                displayAnalysisResults(colors, elements.cameraResultsContainer);
            } catch (error) {
                elements.cameraResultsContainer.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
            }
        }, 'image/png');
    }

    async function startCamera() {
        if (appState.currentStream) await stopCamera();
        
        const constraints = { video: { facingMode: appState.currentFacingMode } };
        try {
            appState.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            elements.video.srcObject = appState.currentStream;
            elements.video.hidden = false;
            await elements.video.play();

            const track = appState.currentStream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            
            elements.cameraOverlay.hidden = false;
            elements.switchButton.hidden = false;
            elements.cameraToolbar.hidden = false;
            elements.startButton.textContent = "Stop Camera";
            appState.analysisInterval = setInterval(analyzeLiveFrame, 500);

            if (capabilities && capabilities.torch) elements.flashBtn.hidden = false;
            if (capabilities && capabilities.zoom) {
                elements.zoomControlContainer.hidden = false;
                elements.zoomSlider.min = capabilities.zoom.min;
                elements.zoomSlider.max = capabilities.zoom.max;
                elements.zoomSlider.step = capabilities.zoom.step;
                elements.zoomSlider.value = track.getSettings().zoom || 1;
            }
        } catch (err) {
            elements.liveColorLabel.textContent = `Error: ${err.name}`;
            console.error("Camera access error:", err);
        }
    }

    function stopCamera() {
        return new Promise(resolve => {
            if (appState.currentStream) {
                appState.currentStream.getTracks().forEach(track => track.stop());
            }
            clearInterval(appState.analysisInterval);
            appState.currentStream = null;
            elements.video.srcObject = null;
            elements.video.hidden = true;
            elements.cameraOverlay.hidden = true;
            elements.switchButton.hidden = true;
            elements.flashBtn.hidden = true;
            elements.zoomControlContainer.hidden = true;
            elements.cameraToolbar.hidden = true;
            elements.cameraResultsContainer.innerHTML = '';
            elements.startButton.textContent = "Start Camera";
            elements.liveColorLabel.textContent = '';
            appState.torchOn = false;
            elements.flashBtn.style.backgroundColor = '#0072BB';
            resolve();
        });
    }

    async function analyzeLiveFrame() {
        if (!appState.currentStream) return;
        const { videoWidth, videoHeight } = elements.video;
        if (videoWidth === 0) return;
        elements.hiddenCanvas.width = videoWidth;
        elements.hiddenCanvas.height = videoHeight;
        elements.hiddenCtx.drawImage(elements.video, 0, 0, videoWidth, videoHeight);
        const [r, g, b] = elements.hiddenCtx.getImageData(videoWidth / 2, videoHeight / 2, 1, 1).data;

        try {
            const data = await fetchColorNameForRGB(r, g, b);
            if (data) {
                elements.liveColorLabel.textContent = `${data.name} (${data.hex})`;
                elements.liveColorLabel.style.backgroundColor = data.hex;
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                elements.liveColorLabel.style.color = brightness > 125 ? 'black' : 'white';
            }
        } catch (error) {
            console.error("Live analysis error:", error);
        }
    }

    // --- Event Listeners ---
    elements.selectImageBtn.addEventListener('click', () => showView('image-view'));
    elements.selectCameraBtn.addEventListener('click', () => {
        showView('camera-view');
        startCamera();
    });
    elements.backButtons.forEach(button => button.addEventListener('click', () => {
        stopCamera().then(() => {
            showView('selection-view');
            resetImageState();
        });
    }));

    elements.imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            appState.originalImage = new Image();
            appState.originalImage.onload = resetImageState;
            appState.originalImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    elements.loadUrlBtn.addEventListener('click', () => {
        const url = elements.imageUrlInput.value;
        if (!url) return alert('Please enter an image URL.');
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => { appState.originalImage = img; resetImageState(); };
        img.onerror = () => alert('Could not load image from this URL (CORS policy).');
        img.src = url;
    });

    elements.toolAnalyzeBtn.addEventListener('click', analyzeSelection);
    elements.toolResetBtn.addEventListener('click', resetImageState);
    elements.captureBtn.addEventListener('click', captureAndAnalyze);

    elements.imageCanvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        appState.isSelecting = true;
        const { x, y } = getEventCoords(e);
        appState.selection.startX = x;
        appState.selection.startY = y;
        Object.assign(elements.selectionRect.style, { left: `${x}px`, top: `${y}px`, width: '0px', height: '0px', display: 'block' });
    });

    elements.imageCanvas.addEventListener('pointermove', (e) => {
        if (!appState.isSelecting) return;
        e.preventDefault();
        const { x, y } = getEventCoords(e);
        appState.selection.endX = x;
        appState.selection.endY = y;
        Object.assign(elements.selectionRect.style, {
            left: `${Math.min(appState.selection.startX, x)}px`,
            top: `${Math.min(appState.selection.startY, y)}px`,
            width: `${Math.abs(x - appState.selection.startX)}px`,
            height: `${Math.abs(y - appState.selection.startY)}px`,
        });
    });

    elements.imageCanvas.addEventListener('pointerup', () => appState.isSelecting = false);

    elements.startButton.addEventListener('click', () => {
        if (appState.currentStream) {
            stopCamera();
        } else {
            startCamera();
        }
    });
    
    elements.switchButton.addEventListener('click', () => {
        appState.currentFacingMode = (appState.currentFacingMode === 'user') ? 'environment' : 'user';
        startCamera();
    });

    elements.flashBtn.addEventListener('click', () => {
        if (!appState.currentStream) return;
        const track = appState.currentStream.getVideoTracks()[0];
        if (!track.getCapabilities().torch) return console.log("Torch not supported.");
        appState.torchOn = !appState.torchOn;
        track.applyConstraints({ advanced: [{ torch: appState.torchOn }] })
            .catch(err => console.error('Torch constraint failed:', err));
        elements.flashBtn.style.backgroundColor = appState.torchOn ? '#005a9a' : '#0072BB';
    });

    elements.zoomSlider.addEventListener('input', () => {
        if (!appState.currentStream) return;
        const track = appState.currentStream.getVideoTracks()[0];
        if (!track.getCapabilities().zoom) return console.log("Zoom not supported.");
        track.applyConstraints({ advanced: [{ zoom: elements.zoomSlider.value }] })
            .catch(err => console.error('Zoom constraint failed:', err));
    });

    function getEventCoords(e) {
        const rect = elements.imageCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }
});
