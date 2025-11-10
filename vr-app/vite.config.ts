import { optimizeGLTF } from "@iwsdk/vite-plugin-gltf-optimizer";
import { injectIWER } from "@iwsdk/vite-plugin-iwer";
import { compileUIKit } from "@iwsdk/vite-plugin-uikitml";
import { defineConfig, loadEnv } from "vite";
import path from "path";
import mkcert from "vite-plugin-mkcert";

export default defineConfig(({ mode }) => {

  const envDir = path.resolve(process.cwd(), '..');
  const env = loadEnv(mode, envDir, '');
  const localIp = env.LOCAL_IP || process.env.LOCAL_IP || 'localhost';

  return {
    envDir: '..',
    plugins: [
      // Ensure the mkcert plugin includes the local IP in the certificate SANs
      // so the dev server's TLS works when accessing the machine by IP.
      mkcert({ hosts: [localIp, 'localhost'] }),
      injectIWER({
        device: "metaQuest3",
        activation: "localhost", 
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
      https: true as any,
      // HMR over wss and expose the host so remote devices can receive updates.
      hmr: {
        protocol: 'wss',
        host: localIp,
      },
    // proxy: {
    //   '/generate': {
    //     target: 'http://api:8080',
    //     changeOrigin: true,
    //   },
    // } 
    },
  };
});