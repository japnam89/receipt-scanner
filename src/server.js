/**
 * Main server entry point for Receipt Scanner.
 * Orchestrates all route modules and sets up Express app with middleware.
 */

import { Server } from "express";
import config from "./config.js";
import authRoutes from "./auth-routes.js";
import apiRoutes from "./api-routes.js";

const app = Server();

/**
 * Apply express.json() middleware.
 */
app.use(express.json());

// Base path for proxy prefix handling
const BASE_PATH = config.api.basePath || "";

// Health check endpoint (for container health checks)
app.get("/healthz", (_req, res) => {
  res.json({ 
    ok: true,
    ts: Date.now(),
    version: "1.0.2"
  });
});

/**
 * Serve static files from public directory.
 */
const PUBLIC_DIR = path.join(__dirname, "..", "public");
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(BASE_PATH + "/static", express.static(PUBLIC_DIR));
}

/**
 * Serve JavaScript files for i18n.
 */
function serveI18n(req, res) {
  const basePath = BASE_PATH.replace(/\/+$/, "");
  const filePath = path.join(__dirname, "..", "public", "i18n.js");
  
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  res.type("application/javascript").send(`console.error('i18n.js not found');`);
}
app.get("/*", serveI18n);

/**
 * Mount auth routes.
 */
app.use(authRoutes.authRoutesPath, authRoutes.router);

/**
 * Mount API routes (only accessible after authentication).
 */
app.use("/api", apiRoutes.router);

/**
 * Serve dashboard page for authenticated users.
 */
const DASHBOARD_PATH = path.join(__dirname, "..", "public", "index.html");

if (fs.existsSync(DASHBOARD_PATH)) {
  app.get("/", (req, res) => {
    noCache(res);
    
    let html = fs.readFileSync(DASHBOARD_PATH, "utf8");
    html = html.replace('/*BASE_PATH*/ ""', JSON.stringify(BASE_PATH));
    html = html.replace("/*I18N_SCRIPT*/", `${BASE_PATH.replace(/\/+$/, "")}/i18n.js`);
    html = html.replace("/*AUTO_SCAN*/ false", String(req.query.afterAuth === "1"));
    
    res.type("text/html").send(html);
  });
}

// Default catch-all for unmatched routes
app.use("*", (req, res) => {
  noCache(res);
  
  if (req.path.startsWith("/api")) {
    const authErr = { error: "Sign in required" };
    return res.status(401).json(authErr);
  }

  // Return 404 page if dashboard doesn't exist
  if (!fs.existsSync(DASHBOARD_PATH)) {
    return res.status(404).send({
      ok: true,
      message: "Page not found",
      status: "redirect to /auth first"
    });
  }

  // Serve index.html with path injection
  let html = fs.readFileSync(DASHBOARD_PATH, "utf8");
  html = html.replace('/*BASE_PATH*/ ""', JSON.stringify(BASE_PATH));
  html = html.replace("/*I18N_SCRIPT*/", `${BASE_PATH.replace(/\/+$/, "")}/i18n.js`);
  
  res.type("text/html").send(html);
});

/**
 * Start the server.
 */
const PORT = parseInt(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`Receipt Scanner started on http://localhost:${PORT}`);
  console.log(`OAuth sign-in:      /auth`);
  console.log(`OCR info endpoint:   /api/ocr-info`);
  console.log(`Trigger scan:         POST /api/scan`);
  console.log(`CRUD API:            /api/receipts/*`);
});

export default app;
