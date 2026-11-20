/**
 * Configuration for Receipt Scanner application.
 * Centralized configuration to avoid magic numbers and strings throughout the codebase.
 */

import path from "path";

export const config = {
  // Database
  db: {
    path: process.env.DB_PATH || path.join(__dirname, "..", "receipts.db"),
    pragma: "journal_mode = WAL",
  },
  
  // Google OAuth
  oauth: {
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    redirectUri: process.env.OAUTH_REDIRECT_URI || `http://localhost:${process.env.PORT || 4000}/oauth2callback`,
    googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  },
  
  // Session management
  session: {
    cookieName: "receipt_auth",
    oauthStateCookieName: "receipt_oauth_state",
    maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
    oauthStateMaxAgeSeconds: 10 * 60, // 10 minutes
  },
  
  // OCR settings
  ocr: {
    tesseractOptions: {
      langPath: path.join(__dirname, ".."),
      gzip: false,
    },
    maxTextLength: 20000,
    fallbackMode: true,
  },
  
  // File upload limits
  uploads: {
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ["application/pdf"],
  },
  
  // OCR providers
  ocrProviders: {
    foundryLocalEndpoint: process.env.FOUNDRY_LOCAL_ENDPOINT || null,
    foundryLocalModel: process.env.FOUNDRY_LOCAL_MODEL || null,
  },
  
  // API routes
  api: {
    basePath: process.env.BASE_PATH || "",
  },
};
