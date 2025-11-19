import { CanvasVideoPlayer } from './CanvasVideoPlayer.js';

// Export the class
export default CanvasVideoPlayer;

// Auto-expose to window if using script tag (UMD-like behavior for dev)
if (typeof window !== 'undefined') {
    window.CanvasVideoPlayer = CanvasVideoPlayer;
}
