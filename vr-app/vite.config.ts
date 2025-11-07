import { optimizeGLTF } from "@iwsdk/vite-plugin-gltf-optimizer";
import { injectIWER } from "@iwsdk/vite-plugin-iwer";
import { compileUIKit } from "@iwsdk/vite-plugin-uikitml";
import { defineConfig, loadEnv } from "vite";
import path from "path";
// --- REMOVE mkcert ---
import mkcert from "vite-plugin-mkcert";

// Configure Vite to load env files from the repository root.
// Your project stores the `.env` in the parent directory of `vr-app`, so
// set `envDir` to the parent dir so `import.meta.env.VITE_API_ENDPOINT` is available.
export default defineConfig(({ mode }) => {
  // Load env from the envDir (set above) so we can read LOCAL_IP if present
  // load env from parent directory (the repo root) because envDir will point there
  const envDir = path.resolve(process.cwd(), '..');
  const env = loadEnv(mode, envDir, '');
  const localIp = env.LOCAL_IP || process.env.LOCAL_IP || 'localhost';

  return {
    envDir: '..',
    plugins: [
      mkcert(),
      injectIWER({
        device: "metaQuest3",
        activation: "localhost", // This is correct, leave it as is.
        verbose: true,
        sem: {
          defaultScene: "living_room",
        },
      }),
      compileUIKit({ 
        sourceDir: "ui", 
        outputDir: "public/ui", 
        verbose: true 
      }),
      optimizeGLTF({
        level: "medium",
      }),
  ],
    server: {
      host: "0.0.0.0",
      port: 8081,
      open: false,
      // Enable HTTPS for the dev server and let vite-plugin-mkcert provide a cert.
  // cast to any to avoid strict typing differences in this Vite version;
  // runtime value is a boolean and vite-plugin-mkcert will provide the cert.
  https: true as any,
      // HMR over wss and expose the host so remote devices can receive updates.
      hmr: {
        protocol: 'wss',
        host: localIp,
      },
    // --- The proxy is still needed for your API calls ---
    proxy: {
      '/generate': {
        target: 'http://api:8080',
        changeOrigin: true,
      },
    } 
    },
    // ... (rest of config)
  };
});