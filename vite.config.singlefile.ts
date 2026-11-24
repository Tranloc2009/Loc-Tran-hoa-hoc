import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const STANDALONE_FILENAME = 'Hoa_Hoc_12_Phong_Thi_Nghiem_3D.html';

function standaloneOfflineHtmlPlugin(): Plugin {
  return {
    name: 'standalone-offline-html-export',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          // Remove external Google Fonts links so opening via file:// offline produces zero network errors
          .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/gi, '')
          .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>\s*/gi, '')
          // Remove crossorigin attribute from inlined script/style tags for clean file:// execution
          .replace(/(<script\b[^>]*?)\s+crossorigin(?:="[^"]*")?/gi, '$1');
      },
    },
    closeBundle(error?: Error) {
      if (error) return;
      const rootDir = import.meta.dirname;
      const outDir = path.resolve(rootDir, 'dist-standalone');
      const indexFile = path.join(outDir, 'index.html');
      const targetFile = path.join(outDir, STANDALONE_FILENAME);

      if (fs.existsSync(indexFile)) {
        fs.renameSync(indexFile, targetFile);
      }

      // Remove any stray files inside dist-standalone so only the single HTML artifact remains
      if (fs.existsSync(outDir)) {
        for (const entry of fs.readdirSync(outDir)) {
          if (entry !== STANDALONE_FILENAME) {
            fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
          }
        }
      }

      // Mirror a copy to public/ so the student can download it directly from the web app
      const publicDir = path.resolve(rootDir, 'public');
      if (fs.existsSync(targetFile) && fs.existsSync(publicDir)) {
        fs.copyFileSync(targetFile, path.join(publicDir, STANDALONE_FILENAME));
      }
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile({
      removeViteModuleLoader: true,
    }),
    standaloneOfflineHtmlPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  build: {
    outDir: 'dist-standalone',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    sourcemap: false,
    target: 'es2020',
    minify: 'esbuild',
  },
});
