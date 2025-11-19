import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),
      name: 'CanvasVideoPlayer',
      fileName: (format) => `canvas-video-player.${format}.js`
    },
    rollupOptions: {
      // Ensure external dependencies are not bundled into your library
      external: [],
      output: {
        globals: {}
      }
    }
  }
});
