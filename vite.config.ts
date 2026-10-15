import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localApi } from "./server/local-api";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), localApi(env.VITE_BACKEND !== "supabase")],
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
    preview: { host: "127.0.0.1", port: 4173 },
    test: {
      include: ["tests/**/*.test.ts"],
      testTimeout: 30000,
      hookTimeout: 30000,
    },
  };
});
