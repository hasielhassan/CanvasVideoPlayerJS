import Hls from 'hls.js';

/**
 * Base class for handling video sources.
 */
export class VideoSourceHandler {
    constructor(videoElement) {
        this.videoElement = videoElement;
    }

    /**
     * Loads a video source.
     * @param {string|object} source - The source URL or config object.
     * @returns {Promise<void>}
     */
    async load(source) {
        throw new Error('Method not implemented');
    }

    destroy() {
        // Cleanup
    }
}

/**
 * Handles standard video URLs (mp4, webm, etc).
 * Uses the browser's native streaming capabilities.
 */
export class DirectSourceHandler extends VideoSourceHandler {
    async load(url) {
        return new Promise((resolve, reject) => {
            this.videoElement.src = url;
            this.videoElement.load();

            const onLoaded = () => {
                cleanup();
                resolve();
            };

            const onError = (e) => {
                cleanup();
                reject(new Error('Failed to load video source'));
            };

            const cleanup = () => {
                this.videoElement.removeEventListener('loadeddata', onLoaded);
                this.videoElement.removeEventListener('error', onError);
            };

            this.videoElement.addEventListener('loadeddata', onLoaded);
            this.videoElement.addEventListener('error', onError);
        });
    }

    destroy() {
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
    }
}

/**
 * Skeleton for Media Source Extensions handler.
 * Allows for chunked loading or custom buffer management.
 */
export class MSESourceHandler extends VideoSourceHandler {
    constructor(videoElement) {
        super(videoElement);
        this.mediaSource = null;
        this.sourceBuffer = null;
    }

    async load(chunksOrUrl) {
        // TODO: Implement full MSE logic
        console.warn('MSE Strategy is currently a skeleton implementation.');

        if (typeof chunksOrUrl === 'string') {
            // If it's just a URL, fallback to direct for now or implement fetch-and-feed
            console.log('MSE Handler received URL, falling back to direct fetch logic (not implemented yet)');
        }

        return Promise.resolve();
    }

    destroy() {
        if (this.mediaSource && this.mediaSource.readyState === 'open') {
            this.mediaSource.endOfStream();
        }
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
    }
}

/**
 * Handler for HLS streams using hls.js
 */
export class HLSSourceHandler extends VideoSourceHandler {
    constructor(videoElement) {
        super(videoElement);
        this.hls = null;
    }

    async load(url) {
        return new Promise((resolve, reject) => {
            if (Hls.isSupported()) {
                this.hls = new Hls();
                this.hls.loadSource(url);
                this.hls.attachMedia(this.videoElement);
                this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    resolve();
                });
                this.hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        reject(new Error(`HLS Error: ${data.type}`));
                    }
                });
            } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS support (Safari)
                this.videoElement.src = url;
                this.videoElement.addEventListener('loadedmetadata', () => {
                    resolve();
                }, { once: true });
                this.videoElement.addEventListener('error', (e) => {
                    reject(new Error('Native HLS load failed'));
                }, { once: true });
            } else {
                reject(new Error('HLS not supported in this browser'));
            }
        });
    }

    destroy() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
    }
}

