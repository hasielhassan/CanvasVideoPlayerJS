import { Icons } from './components/Icons.js';
import { injectStyles } from './utils/styleInjector.js';
import { DirectSourceHandler, MSESourceHandler, HLSSourceHandler } from './utils/VideoSourceHandler.js';

/**
 * CanvasVideoPlayer
 * A secure, watermarked video player.
 */
export class CanvasVideoPlayer {
    /**
     * @param {HTMLElement} container - The DOM element to build the player inside.
     * @param {object} options - Configuration options.
     * @param {string} options.videoUrl - The URL of the video to load.
     * @param {string} [options.watermarkText] - Optional watermark text.
     * @param {string} [options.strategy] - 'direct' or 'mse'. Default 'direct'.
     * @param {object} [options.styleConfig] - Custom class names for styling.
     */
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            strategy: 'direct',
            watermarkText: '',
            styleConfig: {},
            controlsLayout: 'overlay', // 'overlay' or 'outside'
            ...options
        };

        // Inject base styles
        injectStyles();

        // Internal state
        this.videoSource = null; // The hidden video element
        this.sourceHandler = null;
        this.canvas = null;
        this.ctx = null;
        this.animationFrameId = null;
        this.isMuted = false;
        this.isPlaying = false;

        // Bindings
        this._drawFrame = this._drawFrame.bind(this);
        this._handleResize = this._handleResize.bind(this);

        this._buildUI();
        this._initSourceHandler();
        this._addListeners();

        if (this.options.videoUrl) {
            this.load(this.options.videoUrl);
        }
    }

    _initSourceHandler() {
        // Simple factory logic
        if (this.options.strategy === 'mse' || (this.options.videoUrl && this.options.videoUrl.endsWith('.m3u8'))) {
            this.sourceHandler = new HLSSourceHandler(this.videoSource);
        } else {
            this.sourceHandler = new DirectSourceHandler(this.videoSource);
        }
    }

    _buildUI() {
        this.container.innerHTML = '';
        this.container.classList.add('cvp-container');

        // Wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = `cvp-wrapper ${this.options.styleConfig.wrapper || ''}`;

        // Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = `cvp-canvas ${this.options.styleConfig.canvas || ''}`;
        this.ctx = this.canvas.getContext('2d');

        // Hidden Video
        this.videoSource = document.createElement('video');
        this.videoSource.style.display = 'none';
        this.videoSource.playsInline = true;
        this.videoSource.crossOrigin = 'anonymous';

        // Controls Container
        this.controlsContainer = document.createElement('div');
        if (this.options.controlsLayout === 'outside') {
            this.controlsContainer.className = `cvp-controls-outside ${this.options.styleConfig.controls || ''}`;
        } else {
            this.controlsContainer.className = `cvp-controls-overlay ${this.options.styleConfig.controls || ''}`;
        }

        // Single Controls Row
        const controlsRow = document.createElement('div');
        controlsRow.className = 'cvp-controls-row';

        this.playBtn = this._createBtn(Icons.play(), 'Play');
        this.pauseBtn = this._createBtn(Icons.pause(), 'Pause');
        this.pauseBtn.classList.add('cvp-hidden');
        this.stopBtn = this._createBtn(Icons.stop(), 'Stop');

        this.timeDisplay = document.createElement('div');
        this.timeDisplay.className = 'cvp-time';
        this.timeDisplay.textContent = '0:00 / 0:00';

        this.timeline = document.createElement('input');
        this.timeline.type = 'range';
        this.timeline.className = 'cvp-slider';
        this.timeline.style.flexGrow = '1';
        this.timeline.min = 0;
        this.timeline.value = 0;
        this.timeline.step = 0.1;

        this.muteBtn = this._createBtn(Icons.volume(), 'Mute');
        this.unmuteBtn = this._createBtn(Icons.volumeMute(), 'Unmute');
        this.unmuteBtn.classList.add('cvp-hidden');

        this.volumeSlider = document.createElement('input');
        this.volumeSlider.type = 'range';
        this.volumeSlider.className = 'cvp-slider';
        this.volumeSlider.style.width = '80px';
        this.volumeSlider.min = 0;
        this.volumeSlider.max = 1;
        this.volumeSlider.step = 0.1;
        this.volumeSlider.value = 1;

        this.fsBtn = this._createBtn(Icons.fullscreen(), 'Fullscreen');
        this.fsExitBtn = this._createBtn(Icons.fullscreenExit(), 'Exit Fullscreen');
        this.fsExitBtn.classList.add('cvp-hidden');

        // Append all to single row
        controlsRow.append(
            this.playBtn,
            this.pauseBtn,
            this.stopBtn,
            this.timeDisplay,
            this.timeline,
            this.muteBtn,
            this.unmuteBtn,
            this.volumeSlider,
            this.fsBtn,
            this.fsExitBtn
        );

        this.controlsContainer.append(controlsRow);

        // Append to wrapper or container based on layout? 
        // Actually, for 'outside', it might be better to append to container, 
        // but wrapper has overflow:hidden which might clip it if inside.
        // Let's append to wrapper for overlay, and container for outside?
        // Base CSS says wrapper has relative positioning.

        if (this.options.controlsLayout === 'outside') {
            this.wrapper.append(this.canvas, this.videoSource);
            this.container.append(this.wrapper, this.controlsContainer);
        } else {
            this.wrapper.append(this.canvas, this.controlsContainer, this.videoSource);
            this.container.append(this.wrapper);
        }
    }

    _createBtn(svg, label) {
        const btn = document.createElement('button');
        btn.className = `cvp-btn ${this.options.styleConfig.button || ''}`;
        btn.ariaLabel = label;
        btn.appendChild(svg);
        return btn;
    }

    _addListeners() {
        // Playback
        this.playBtn.onclick = () => this.play();
        this.pauseBtn.onclick = () => this.pause();
        this.stopBtn.onclick = () => this.stop();
        this.videoSource.onplay = () => this._updatePlayState(true);
        this.videoSource.onpause = () => this._updatePlayState(false);
        this.videoSource.onended = () => this._updatePlayState(false);

        // Time
        this.videoSource.ontimeupdate = () => {
            if (!this.isDraggingTimeline) {
                this.timeline.value = this.videoSource.currentTime;
                this._updateTimeDisplay();
            }
        };
        this.videoSource.onloadedmetadata = () => {
            this.timeline.max = this.videoSource.duration;
            this._updateTimeDisplay();
            this._resizeCanvas(); // Ensure canvas matches video aspect ratio
        };

        // Timeline
        this.timeline.oninput = () => {
            this.isDraggingTimeline = true;
            this._updateTimeDisplay(this.timeline.value);
        };
        this.timeline.onchange = () => {
            this.isDraggingTimeline = false;
            this.videoSource.currentTime = this.timeline.value;
        };

        // Volume
        this.muteBtn.onclick = () => this.toggleMute();
        this.unmuteBtn.onclick = () => this.toggleMute();
        this.volumeSlider.oninput = () => {
            this.videoSource.volume = this.volumeSlider.value;
            this.videoSource.muted = this.volumeSlider.value === '0';
            this._updateVolumeState();
        };

        // Fullscreen
        this.fsBtn.onclick = () => this.toggleFullscreen();
        this.fsExitBtn.onclick = () => this.toggleFullscreen();

        // Resize
        window.addEventListener('resize', this._handleResize);

        // Disable Context Menu (Right-click)
        this.wrapper.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
    }

    async load(url) {
        this.pause();
        try {
            await this.sourceHandler.load(url);
            // Once loaded, we can draw the first frame
            requestAnimationFrame(() => this._drawFrame(true));
        } catch (e) {
            console.error('Error loading video:', e);
            // Draw error state on canvas
        }
    }

    play() {
        this.videoSource.play().catch(e => console.error("Play failed", e));
    }

    pause() {
        this.videoSource.pause();
    }

    stop() {
        this.pause();
        this.videoSource.currentTime = 0;
        this.timeline.value = 0;
        this._updateTimeDisplay(0);
        this._drawFrame(true);
    }

    toggleMute() {
        this.videoSource.muted = !this.videoSource.muted;
        this._updateVolumeState();
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.wrapper.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    setWatermark(text) {
        this.options.watermarkText = text;
        if (!this.isPlaying) {
            this._drawFrame(true);
        }
    }

    destroy() {
        this.pause();
        this.sourceHandler.destroy();
        window.removeEventListener('resize', this._handleResize);
        this.container.innerHTML = '';
    }

    // --- Internal Helpers ---

    _updatePlayState(isPlaying) {
        this.isPlaying = isPlaying;
        this.wrapper.classList.toggle('cvp-paused', !isPlaying);

        if (isPlaying) {
            this.playBtn.classList.add('cvp-hidden');
            this.pauseBtn.classList.remove('cvp-hidden');
            this._startLoop();
        } else {
            this.playBtn.classList.remove('cvp-hidden');
            this.pauseBtn.classList.add('cvp-hidden');
            this._stopLoop();
        }
    }

    _updateVolumeState() {
        const isMuted = this.videoSource.muted || this.videoSource.volume === 0;
        if (isMuted) {
            this.muteBtn.classList.add('cvp-hidden');
            this.unmuteBtn.classList.remove('cvp-hidden');
        } else {
            this.muteBtn.classList.remove('cvp-hidden');
            this.unmuteBtn.classList.add('cvp-hidden');
        }
    }

    _updateTimeDisplay(overrideTime) {
        const current = overrideTime !== undefined ? overrideTime : this.videoSource.currentTime;
        const total = this.videoSource.duration || 0;
        this.timeDisplay.textContent = `${this._formatTime(current)} / ${this._formatTime(total)}`;
    }

    _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    _handleResize() {
        this._resizeCanvas();
        if (!this.isPlaying) {
            this._drawFrame(true);
        }
    }

    _resizeCanvas() {
        const rect = this.wrapper.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        // Maintain aspect ratio if video is loaded
        if (this.videoSource.videoWidth) {
            // Logic to fit video within canvas (contain)
            // For now, we just stretch to fill or let CSS handle it.
            // Better: calculate draw dimensions to preserve aspect ratio.
        }
    }

    _startLoop() {
        if (!this.animationFrameId) {
            this._drawFrame();
        }
    }

    _stopLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    _drawFrame(once = false) {
        if (!this.ctx) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        // Draw Video
        if (this.videoSource.readyState >= 2) {
            // Draw video to fill canvas (stretch) - or implement 'contain' logic here
            this.ctx.drawImage(this.videoSource, 0, 0, w, h);
        } else {
            // Loading/Black background
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(0, 0, w, h);
        }

        // Draw Watermark
        if (this.options.watermarkText) {
            this._drawWatermark(w, h);
        }

        if (!once && this.isPlaying) {
            this.animationFrameId = requestAnimationFrame(() => this._drawFrame(false));
        } else {
            this.animationFrameId = null;
        }
    }

    _drawWatermark(w, h) {
        const text = this.options.watermarkText;
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Simple scaling font
        const fontSize = Math.min(w, h) * 0.1;
        this.ctx.font = `bold ${fontSize}px Inter, sans-serif`;

        // Draw in center
        this.ctx.fillText(text, w / 2, h / 2);

        // Optional: Tiled pattern could go here
        this.ctx.restore();
    }
}
