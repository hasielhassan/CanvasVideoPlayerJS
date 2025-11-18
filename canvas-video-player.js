/**
 * CanvasVideoPlayer
 * A class to load an MP4 video, draw it to a canvas with an optional
 * watermark, and provide custom, secure playback controls.
 */
class CanvasVideoPlayer {
    /**
     * @param {HTMLElement} container - The DOM element to build the player inside.
     * @param {object} options - Configuration options.
     * @param {string} options.videoUrl - The URL of the video to load.
     * @param {string} [options.watermarkText] - Optional watermark text.
     */
    constructor(container, options = {}) {
        this.container = container;
        this.videoUrl = options.videoUrl;
        this.watermarkText = options.watermarkText || '';

        // Internal state
        this.videoSource = null;
        this.audioSource = null;
        this.canvas = null;
        this.ctx = null;
        this.animationFrameId = null;
        this.isMuted = false;
        this.blobUrl = null; // <-- Add this to store the blob URL

        // --- DOM Elements ---
        this.playerWrapper = null;
        this.playPauseBtn = null;
        this.playIcon = null;
        this.pauseIcon = null;
        this.muteBtn = null;
        this.volumeIcon = null;
        this.volumeMuteIcon = null;
        this.timelineSlider = null;
        this.currentTimeEl = null;
        this.totalTimeEl = null;
        this.volumeSlider = null;

        // Bind 'this' for event handlers
        this._drawFrame = this._drawFrame.bind(this);

        this._buildUI();
        this._addListeners();

        if (this.videoUrl) {
            this.load(this.videoUrl);
        }
    }

    /**
     * Creates the player's DOM structure inside the container.
     * @private
     */
    _buildUI() {
        this.container.innerHTML = ''; // Clear container

        this.playerWrapper = document.createElement('div');
        this.playerWrapper.className = 'bg-gray-900 rounded-lg overflow-hidden border border-gray-700';

        // 1. Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'w-full h-auto aspect-video bg-black';
        this.ctx = this.canvas.getContext('2d');

        // 2. Hidden Media Elements
        this.videoSource = document.createElement('video');
        this.videoSource.id = 'video-source';
        this.videoSource.crossOrigin = 'anonymous';
        this.videoSource.muted = true;
        this.videoSource.playsInline = true;
        this.videoSource.style.display = 'none';

        this.audioSource = document.createElement('audio');
        this.audioSource.id = 'audio-source';
        this.audioSource.style.display = 'none';

        // 3. Custom Controls Wrapper
        const controlsWrapper = document.createElement('div');
        controlsWrapper.className = 'p-4 bg-gray-800/50';

        const controls = document.createElement('div');
        controls.className = 'player-controls';

        // 3a. Play/Pause Button
        this.playPauseBtn = document.createElement('button');
        this.playPauseBtn.className = 'control-button';
        this.playIcon = this._createSvg('play');
        this.pauseIcon = this._createSvg('pause');
        this.pauseIcon.classList.add('hidden');
        this.playPauseBtn.append(this.playIcon, this.pauseIcon);

        // 3b. Timeline
        this.timelineSlider = document.createElement('input');
        this.timelineSlider.type = 'range';
        this.timelineSlider.className = 'slider flex-grow';
        this.timelineSlider.min = 0;
        this.timelineSlider.value = 0;
        this.timelineSlider.step = 0.1;

        // 3c. Time Display
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'time-display';
        this.currentTimeEl = document.createElement('span');
        this.currentTimeEl.textContent = '0:00';
        this.totalTimeEl = document.createElement('span');
        this.totalTimeEl.textContent = '0:00';
        timeDisplay.append(this.currentTimeEl, ' / ', this.totalTimeEl);

        // 3d. Volume Controls
        const volumeControls = document.createElement('div');
        volumeControls.className = 'volume-controls';

        this.muteBtn = document.createElement('button');
        this.muteBtn.className = 'control-button';
        this.volumeIcon = this._createSvg('volume');
        this.volumeMuteIcon = this._createSvg('volumeMute');
        this.volumeMuteIcon.classList.add('hidden');
        this.muteBtn.append(this.volumeIcon, this.volumeMuteIcon);

        this.volumeSlider = document.createElement('input');
        this.volumeSlider.type = 'range';
        this.volumeSlider.className = 'slider';
        this.volumeSlider.min = 0;
        this.volumeSlider.max = 1;
        this.volumeSlider.value = 1;
        this.volumeSlider.step = 0.01;
        
        volumeControls.append(this.muteBtn, this.volumeSlider);

        // Assemble controls
        controls.append(this.playPauseBtn, this.timelineSlider, timeDisplay, volumeControls);
        controlsWrapper.append(controls);

        // Assemble player
        this.playerWrapper.append(this.canvas, controlsWrapper);
        this.container.append(this.playerWrapper, this.videoSource, this.audioSource);
    }

    /**
     * Creates SVG icons for the player controls.
     * @param {string} iconName - Name of the icon to create.
     * @private
     */
    _createSvg(iconName) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svg.setAttribute('fill', 'currentColor');

        switch (iconName) {
            case 'play':
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('width', '24');
                svg.setAttribute('height', '24');
                path.setAttribute('d', 'M8 5v14l11-7z');
                break;
            case 'pause':
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('width', '24');
                svg.setAttribute('height', '24');
                path.setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
                break;
            case 'volume':
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('width', '20');
                svg.setAttribute('height', '20');
                path.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');
                break;
            case 'volumeMute':
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('width', '20');
                svg.setAttribute('height', '20');
                path.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z');
                break;
        }
        svg.appendChild(path);
        return svg;
    }

    /**
     * Attaches all necessary event listeners.
     * @private
     */
    _addListeners() {
        // Video/Audio Element Listeners
        this.videoSource.addEventListener('loadeddata', this._handleLoadedData.bind(this));
        this.videoSource.addEventListener('error', this._handleMediaError.bind(this));
        
        this.audioSource.addEventListener('loadedmetadata', this._handleLoadedMetadata.bind(this));
        this.audioSource.addEventListener('timeupdate', this._handleTimeUpdate.bind(this));
        this.audioSource.addEventListener('play', this._handlePlay.bind(this));
        this.audioSource.addEventListener('pause', this._handlePause.bind(this));
        this.audioSource.addEventListener('ended', this._handleEnded.bind(this));
        this.audioSource.addEventListener('volumechange', this._handleVolumeChange.bind(this));

        // Custom Controls Listeners
        this.playPauseBtn.addEventListener('click', this._togglePlay.bind(this));
        this.muteBtn.addEventListener('click', this._toggleMute.bind(this));
        
        this.timelineSlider.addEventListener('input', this._handleTimelineInput.bind(this));
        this.timelineSlider.addEventListener('change', this._handleTimelineChange.bind(this));
        
        this.volumeSlider.addEventListener('input', this._handleVolumeInput.bind(this));
    }

    // --- Public API Methods ---

    /**
     * Loads a new video into the player.
     * @param {string} videoUrl - The URL of the video to load.
     */
    async load(videoUrl) { // <-- Make this function async
        if (!videoUrl) return;

        this.videoUrl = videoUrl;
        
        // Stop any current playback
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.videoSource.pause();
        this.audioSource.pause();

        // --- New Blob Loading Logic ---
        try {
            // Let the user know we're buffering/downloading
            this._handleLoadingStarted(); 

            // Fetch the video data as a blob
            const response = await fetch(videoUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const videoBlob = await response.blob();

            // Clean up any old blob URL to prevent memory leaks
            if (this.blobUrl) {
                URL.revokeObjectURL(this.blobUrl);
            }

            // Create a new blob URL
            this.blobUrl = URL.createObjectURL(videoBlob);

            // Set the src of our media elements to the blob URL
            this.videoSource.src = this.blobUrl;
            this.audioSource.src = this.blobUrl;
            
            // We can remove the "loading" message logic from here,
            // as 'loadeddata' will handle it.

        } catch (error) {
            console.error('Error fetching or loading video:', error);
            this._handleMediaError();
        }
    }

    /**
     * Updates the watermark text.
     * @param {string} text - The new watermark text.
     */
    setWatermark(text) {
        this.watermarkText = text || '';
        if (this.videoSource.paused && this.videoSource.src) {
            this._drawFrameWithWatermark();
        }
    }

    /**
     * Cleans up the player, removes listeners and DOM elements.
     */
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.videoSource.pause();
        this.audioSource.pause();

        // --- Add Blob Cleanup ---
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
        }

        // Remove all listeners (simplified example; for robust cleanup, remove each one)
        this.container.innerHTML = '';
        
        // Nullify references
        this.videoSource = null;
        this.audioSource = null;
        this.canvas = null;
        this.ctx = null;
    }

    // --- Drawing Methods ---

    /**
     * The main animation loop.
     * @private
     */
    _drawFrame() {
        if (!this.videoSource || this.videoSource.paused || this.videoSource.ended) {
            this.animationFrameId = null;
            return;
        }
        this._drawFrameWithWatermark();
        this.animationFrameId = requestAnimationFrame(this._drawFrame);
    }

    /**
     * Draws the current video frame and the watermark (if any).
     * @private
     */
    _drawFrameWithWatermark() {
        if (!this.ctx || !this.canvas.width || !this.canvas.height) return;

        // 1. Draw the video frame
        this.ctx.globalAlpha = 1.0;
        this.ctx.drawImage(this.videoSource, 0, 0, this.canvas.width, this.canvas.height);

        // 2. Get watermark text
        const watermarkText = this.watermarkText.trim();
        if (!watermarkText) return;

        // 3. Set initial watermark styles
        const fontSize = this.canvas.height * 0.15; // 15% of video height
        this.ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // 4. --- Watermark Scaling Logic ---
        const maxWidth = this.canvas.width * 0.9; // Max 90% of canvas width
        const textMetrics = this.ctx.measureText(watermarkText);
        
        if (textMetrics.width > maxWidth) {
            // Text is too wide, scale it down
            const scaleFactor = maxWidth / textMetrics.width;
            const scaledFontSize = fontSize * scaleFactor;
            this.ctx.font = `bold ${scaledFontSize}px 'Inter', sans-serif`;
        }
        // --- End Scaling Logic ---

        // 5. Draw the watermark
        this.ctx.globalAlpha = 0.25; // 75% transparent
        this.ctx.fillText(watermarkText, this.canvas.width / 2, this.canvas.height / 2);

        // 6. Reset alpha
        this.ctx.globalAlpha = 1.0;
    }

    // --- Internal Event Handlers ---

    _handleLoadedData() {
        this.canvas.width = this.videoSource.videoWidth;
        this.canvas.height = this.videoSource.videoHeight;
        // The 'loadeddata' event now fires *after* the blob is loaded
        // You might want a status message here
        console.log("Video data loaded and ready.");
        setTimeout(() => this._drawFrameWithWatermark(), 50);
    }

    _handleLoadingStarted() {
        // You can add a loading spinner or message here
        // For now, just log it.
        console.log("Fetching video...");
        // Clear the canvas
        if (this.ctx) {
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Loading video...', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    _handleMediaError(e) {
        console.error('Video Error:', this.videoSource ? this.videoSource.error : 'Unknown error');
        // Display error on canvas
        if (this.ctx) {
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'red';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Error loading video.', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    _handleLoadedMetadata() {
        this.timelineSlider.max = this.audioSource.duration;
        this.totalTimeEl.textContent = this._formatTime(this.audioSource.duration);
    }

    _handleTimeUpdate() {
        this.currentTimeEl.textContent = this._formatTime(this.audioSource.currentTime);
        this.timelineSlider.value = this.audioSource.currentTime;
    }

    _handlePlay() {
        this.playIcon.classList.add('hidden');
        this.pauseIcon.classList.remove('hidden');
        this.videoSource.currentTime = this.audioSource.currentTime;
        this.videoSource.play();
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this._drawFrame);
        }
    }

    _handlePause() {
        this.playIcon.classList.remove('hidden');
        this.pauseIcon.classList.add('hidden');
        this.videoSource.pause();
    }

    _handleEnded() {
        this.playIcon.classList.remove('hidden');
        this.pauseIcon.classList.add('hidden');
    }

    _handleVolumeChange() {
        this.volumeSlider.value = this.audioSource.volume;
        this.isMuted = this.audioSource.muted || this.audioSource.volume === 0;
        this.volumeIcon.classList.toggle('hidden', this.isMuted);
        this.volumeMuteIcon.classList.toggle('hidden', !this.isMuted);
    }

    _togglePlay() {
        if (this.audioSource.paused) {
            this.audioSource.play();
        } else {
            this.audioSource.pause();
        }
    }

    _toggleMute() {
        this.audioSource.muted = !this.audioSource.muted;
    }

    _handleTimelineInput() {
        this.currentTimeEl.textContent = this._formatTime(this.timelineSlider.value);
        this.audioSource.currentTime = this.timelineSlider.value;
        this.videoSource.currentTime = this.timelineSlider.value;
    }

    _handleTimelineChange() {
        setTimeout(() => {
            if (this.videoSource.paused) {
                this._drawFrameWithWatermark();
            }
        }, 50);
    }

    _handleVolumeInput() {
        this.audioSource.volume = this.volumeSlider.value;
        this.audioSource.muted = this.volumeSlider.value == 0;
    }

    _formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }
}