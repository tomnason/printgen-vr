import { optimizeGLTF } from "@iwsdk/vite-plugin-gltf-optimizer";
import { injectIWER } from "@iwsdk/vite-plugin-iwer";
import { compileUIKit } from "@iwsdk/vite-plugin-uikitml";
import { defineConfig } from "vite";
// --- REMOVE mkcert ---
// import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  plugins: [
    // --- REMOVE mkcert() from the plugins array ---
    injectIWER({
      device: "metaQuest3",
      activation: "localhost", // This is correct, leave it as is.
      verbose: true,
      sem: {
        defaultScene: "living_room",
      },
    }),
    compileUIKit({ sourceDir: "ui", outputDir: "public/ui", verbose: true }),
    optimizeGLTF({
      level: "medium",
    }),
  ],
  server: { 
    host: "0.0.0.0", 
    port: 8081, 
    open: false,
    // --- The proxy is still needed for your API calls ---
    proxy: {
      '/generate': {
        target: 'http://api:8080',
        changeOrigin: true,
      },
    } 
  },
  // ... (rest of config)
});