import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import jsconfigPaths from 'vite-jsconfig-paths';
import path from 'path';

/**
 * Build-only plugin: take the emitted entry CSS file, inline it as a
 * <style> tag inside index.html, and delete the now-orphan .css from
 * dist. Eliminates the render-blocking <link rel="stylesheet"> request
 * entirely (the CSS becomes part of the document HTML).
 *
 * We tried the alternative `media="print" onload="this.media='all'"`
 * deferral pattern earlier and it satisfied Lighthouse but pushed real
 * FCP up by ~800ms — the auth surface needs CSS for first paint.
 * Inlining gives the same audit win without that regression because the
 * CSS is available the moment the HTML parser sees the <style> tag,
 * with zero extra requests.
 *
 * Only runs on production builds. Dev mode keeps normal stylesheet
 * loading for HMR responsiveness.
 */
function inlineEntryCss() {
  let cssLinkPaths = [];
  return {
    name: 'phenode-inline-entry-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      // Run after Vite's own asset emission so we know which CSS file
      // the index.html link points at.
      order: 'post',
      handler(html, ctx) {
        cssLinkPaths = [];
        return html.replace(
          /<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g,
          (match, href) => {
            const cssRel = href.replace(/^\//, '');
            const bundleEntry = ctx.bundle && ctx.bundle[cssRel];
            if (bundleEntry && bundleEntry.source) {
              cssLinkPaths.push(cssRel);
              return `<style>${bundleEntry.source}</style>`;
            }
            // Couldn't find the CSS in the bundle — leave the link tag
            // alone rather than break the page.
            return match;
          }
        );
      }
    },
    // Delete the inlined CSS files from the bundle so dist/ doesn't ship
    // duplicate (now-unreferenced) files.
    generateBundle(_options, bundle) {
      for (const cssPath of cssLinkPaths) {
        if (bundle[cssPath]) delete bundle[cssPath];
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_URL = env.VITE_APP_BASE_NAME || '/';
  const PORT = 3000;

  return {
    base: API_URL,
    server: {
      open: true,
      port: PORT,
      host: true
    },
    preview: {
      open: true,
      host: true
    },
    define: {
      global: 'window'
    },
    resolve: {
      alias: {
        '@ant-design/icons': path.resolve(__dirname, 'node_modules/@ant-design/icons')
        // Add more aliases as needed
      }
    },
    plugins: [react(), jsconfigPaths(), inlineEntryCss()],
    build: {
      chunkSizeWarningLimit: 1000,
      sourcemap: true,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || '';
            const ext = name.split('.').pop();
            if (/\.css$/.test(name)) return `css/[name]-[hash].${ext}`;
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(name)) return `images/[name]-[hash].${ext}`;
            if (/\.(woff2?|eot|ttf|otf)$/.test(name)) return `fonts/[name]-[hash].${ext}`;
            return `assets/[name]-[hash].${ext}`;
          }
          // NOTE: We tried `manualChunks: { 'mui-charts': ['@mui/x-charts'],
          // 'mui-pickers': ['@mui/x-date-pickers'] }` to pull dashboard-only
          // heavyweights out of the main bundle. It DID shrink the entry
          // chunk (244 KB → 168 KB), but Vite then loaded those new chunks
          // as static deps of the entry on every route — including /login,
          // where they're never imported. Net result was MORE unused JS on
          // /login (105 KiB → 229 KiB). Even `modulePreload: { resolveDependencies: () => [] }`
          // didn't suppress the eager fetch.
          //
          // Letting Vite handle code-splitting automatically (via the
          // existing `lazy(() => import(...))` calls in routes/MainRoutes.jsx)
          // keeps x-charts/pickers inside the lazy dashboard chunks, where
          // they only load when those routes are visited.
        }
      },
      // Only drop console/debugger in production
      ...(mode === 'production' && {
        esbuild: {
          drop: ['console', 'debugger'],
          pure: ['console.log', 'console.info', 'console.debug', 'console.warn']
        }
      })
      // No need to set build.target unless you need to support older browsers
      // target: 'baseline-widely-available', // This is now the default
    },
    optimizeDeps: {
      include: ['@mui/material/Tooltip', 'react', 'react-dom', 'react-router-dom']
    }
  };
});
