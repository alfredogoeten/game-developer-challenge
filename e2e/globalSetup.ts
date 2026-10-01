import { createServer } from "vite";

const url = "http://127.0.0.1:4173";

export default async function globalSetup() {
  if (!process.env.CI) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return () => {};
    } catch { /* No existing test server. */ }
  }
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4173, strictPort: true },
  });
  await server.listen();
  return async () => { await server.close(); };
}
