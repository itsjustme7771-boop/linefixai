import { serve } from "hono/bun";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { Hono } from "hono";

const app = new Hono();

// CORS for API calls to Supabase
app.use("*", cors());

// Serve static assets from dist/assets
app.get("/assets/*", serveStatic({ root: "./dist/", rewriteRoot: "/assets" }));

// SPA fallback - all routes go to index.html
app.get("/*", serveStatic({ root: "./dist/", rewriteRoot: "/index.html", fallthrough: true }));

console.log("LineFixAI static server running on port", process.env.PORT);
serve(app);
