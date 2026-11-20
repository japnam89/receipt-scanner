# Receipt Scanner Refactoring Changes

This document summarizes the major refactoring decisions made for the receipt-scanner project.

## Overview

The codebase has been modernized to use **proper async/await patterns** throughout, making the application more maintainable and easier to debug. Key architectural changes include:

### 1. ES Module Migration

All files now use ES module syntax (`import`/`export`) instead of CommonJS (`require`/`module.exports`). This enables better tooling support and modern JavaScript practices.

**Benefits:**
- Cleaner separation of concerns
- Better error reporting and debugging
- Modern ECMAScript standard compliance
- Improved IDE autocomplete and type inference

### 2. Module Split

The monolithic `server.js` has been split into separate route modules:

| File | Purpose | Exports |
|------|---------|---------|
| `config.js` | Centralized configuration | Config object with all settings |
| `auth-routes.js` | Google OAuth & sign-in routes | Router, auth-routes-path |
| `api-routes.js` | REST CRUD operations | Router, api-routes-path |
| `db-routes.js` | Database operations | insert, listAll, getById, update, delete, scanAll |
| `ocr-routes.js` | OCR text extraction | extractTotal, detectDocumentType, ocrBuffer |
| `server.js` | Main Express app entry point | Default server instance |

### 3. Configuration Centralization

Magic strings and numbers have been extracted to a centralized `config.js`:

```javascript
export const config = {
  db: {
    path: process.env.DB_PATH || "./receipts.db",
    pragma: "journal_mode = WAL",
  },
  oauth: {
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  },
  session: {
    cookieName: "receipt_auth",
    maxAgeSeconds: 7 * 24 * 60 * 60,
  },
  ocr: {
    maxTextLength: 20000,
  },
};
```

### 4. Asynchronous Operations

All database and OCR operations now use async/await instead of callbacks or Promise chaining:

- `db-routes.js`: SQL queries return Promises that resolve with results
- `ocr-routes.js`: Tesseract/PDF parsing returns Promises with text content
- Error handling is centralized through try/catch blocks

### 5. File Structure

```
receipt-scanner/
├── src/
│   ├── config.js          # Central configuration
│   ├── auth-routes.js     # OAuth & sign-in routes
│   ├── api-routes.js      # REST CRUD operations
│   ├── db-routes.js       # Database operations
│   ├── ocr-routes.js      # OCR text extraction
│   └── server.js          # Main Express app entry point
├── public/                # Static assets (templates, styles)
└── package.json           # With "type": "module"
```

## Migration Notes

### Breaking Changes

1. **Require → Import**: All `require()` calls replaced with `import` statements
2. **exports**: Changed from `module.exports = {}` to ES module `export` syntax
3. **Path resolution**: Use `path.join(__dirname, "..")` for correct path resolution in ES modules

### Recommended Migrations

If you need to add new functionality:

```javascript
// Before (CommonJS)
const { config } = require("./src/config");
```

```javascript
// After (ES Module)
import config from "./src/config.js";
```

## Testing Recommendations

1. Run `npm test` to verify all routes work
2. Add Jest/Vitest for unit tests in `src/__tests__/`
3. Test async operations with promise-based assertions
4. Verify error handling with try/catch blocks

## Performance Considerations

The async/await approach may introduce slight performance overhead compared to callbacks due to Promise wrappers, but:
- The impact is negligible for I/O-bound operations like OCR and database queries
- Better debugging experience offsets minor performance trade-offs
- Future optimizations can target specific bottlenecks once profiling identifies them

## Backward Compatibility

All routes maintain the same HTTP methods and paths as before:
- GET/POST /api/receipts/* - CRUD operations unchanged
- POST /api/scan - Drive scan endpoint unchanged
- /auth/* - OAuth flow endpoints unchanged
