import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiTarget = env.VITE_DEV_API_TARGET || "http://127.0.0.1:8002";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": { target: apiTarget, changeOrigin: false },
        "/media": { target: apiTarget, changeOrigin: false },
        "/shootings": { target: apiTarget, changeOrigin: false },
        "/assistant": { target: apiTarget, changeOrigin: false },
        "/ratings": { target: apiTarget, changeOrigin: false },
      },
    },
  };
});
