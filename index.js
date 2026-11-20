/**
 * Receipt Scanner - Main Entry Point
 */

import { Server } from "express";

// Export the default server entry point
export { app, defaultPort } from "./src/server.js";

// Re-export only specific route modules (avoid wildcard re-exports)
export { router as authRoutesRouter } from "./src/auth-routes.js";
export { router as apiRoutesRouter } from "./src/api-routes.js";
