// Express server: REST CRUD over receipts + Google OAuth + /scan trigger.
require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { stmt } = require("./src/db");
const { authUrl, exchangeCode, getProfile } = require("./src/drive");
const { scan } = require("./src/scan");
const { extract, detectDocumentType, getOcrInfo } = require("./src/ocr");

const app = express();
app.use(express.json());

// Base path this app is mounted under when behind a reverse proxy.
// Leave blank for local development; only set /receipt when the app is routed
// behind a proxy prefix. The browser page also derives its base from the actual
// URL to avoid broken local root requests.
const BASE_PATH = process.env.BASE_PATH || "";
const uploadPdfFiles = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 10 * 1024 * 1024, parts: 5 },
}).array("files", 5);

function hasSavedToken() {
  const tokenPath = path.join(__dirname, "token.json");
  if (!fs.existsSync(tokenPath)) return false;
  try {
    const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    return Boolean(token && token.access_token);
  } catch {
    return false;
  }
}

function noCache(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
}

function requestBasePath(req) {
  if (BASE_PATH) return BASE_PATH;
  return req.path === "/receipt" || req.path.startsWith("/receipt/") ? "/receipt" : "";
}

function authErrorPage(title, message, basePath) {
  const signInPath = `${basePath}/auth`;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} | Receipt Scanner</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e2e8f0;font:16px system-ui,sans-serif}.panel{width:min(420px,calc(100% - 40px));text-align:center}.mark{font-size:32px}h1{font-size:26px;margin:14px 0 8px}.muted{color:#94a3b8;line-height:1.5}.button{margin:24px auto 0;display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;border:0;border-radius:6px;background:#2563eb;color:white;font-size:15px;font-weight:600;text-decoration:none}</style></head>
<body><main class="panel"><div class="mark" aria-hidden="true">&#128221;</div><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(message)}</p><a class="button" href="${escapeHtml(signInPath)}">Back to sign in</a></main></body></html>`;
}

// Lightweight liveness probe — no DB/Google dependency, so the container
// reports healthy as soon as it's listening (helps `docker ps` + Traefik
// detect a dead scanner instead of silently falling through to the portfolio).
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

const i18nRoutePaths = [...new Set(["/i18n.js", "/receipt/i18n.js", ...(BASE_PATH ? [`${BASE_PATH.replace(/\/+$/, "")}/i18n.js`] : [])])];
app.get(i18nRoutePaths, (_req, res) => {
  res.type("application/javascript").sendFile(path.join(__dirname, "public", "i18n.js"));
});

// ---------- OAuth (one-time setup) ----------
app.get(["/auth", "/receipt/auth"], (req, res) => {
  try {
    noCache(res);
    const basePath = requestBasePath(req);
    if (hasSavedToken()) return res.redirect(`${basePath}/`);
    const startPath = `${basePath}/auth/start`;
    const i18nPath = `${basePath.replace(/\/+$/, "")}/i18n.js`;
    res.type("html").send(`<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title data-i18n="signIn">Sign in | Receipt Scanner</title>
  <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e2e8f0;font:16px system-ui,sans-serif}.panel{width:min(420px,calc(100% - 40px));text-align:center}.mark{font-size:32px}h1{font-size:26px;margin:14px 0 8px}.muted{color:#94a3b8;line-height:1.5}.language-control{display:flex;justify-content:center;align-items:center;gap:8px;margin:18px auto;color:#cbd5e1;font-size:14px}select{min-height:40px;padding:8px 10px;border:1px solid #475569;border-radius:6px;background:#1e293b;color:#e2e8f0;font-size:14px}.button{margin:24px auto 0;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:48px;border:0;border-radius:6px;background:#2563eb;color:white;font-size:15px;font-weight:600;cursor:pointer}.button:disabled{opacity:.75;cursor:wait}.spinner{width:16px;height:16px;border:2px solid #475569;border-top-color:#60a5fa;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}[hidden]{display:none!important}</style><script src="${i18nPath}" defer></script></head>
  <body><main class="panel"><div class="mark" aria-hidden="true">&#128221;</div><label class="language-control" for="language-select"><span data-i18n="language">Language</span><select id="language-select" data-i18n-aria-label="language"><option value="en">English</option><option value="hi">हिन्दी</option><option value="pa">ਪੰਜਾਬੀ</option></select></label><h1 data-i18n="signInTitle">Sign in to Receipt Scanner</h1><p class="muted" data-i18n="connectGoogle">Connect your Google account to view and scan receipts in Drive.</p><button class="button" id="login" aria-busy="false"><span class="spinner" id="login-spinner" aria-hidden="true" hidden></span><span data-i18n="continueGoogle">Continue with Google</span></button><p class="muted" id="loading" role="status" aria-live="polite" hidden><span class="spinner" aria-hidden="true" style="display:inline-block;vertical-align:middle;margin-right:8px"></span><span data-i18n="connectingGoogle">Connecting to Google...</span></p></main>
<script>document.getElementById("login").addEventListener("click",function(){this.disabled=true;this.setAttribute("aria-busy","true");document.getElementById("login-spinner").hidden=false;document.getElementById("loading").hidden=false;window.location.assign(${JSON.stringify(startPath)});});</script></body></html>`);
  } catch (e) {
    noCache(res);
    res.status(500).type("html").send(authErrorPage("Sign-in unavailable", e.message, requestBasePath(req)));
  }
});

app.get(["/auth/start", "/receipt/auth/start"], (req, res) => {
  try {
    noCache(res);
    res.redirect(authUrl());
  } catch (e) {
    noCache(res);
    res.status(500).type("html").send(authErrorPage("Sign-in unavailable", e.message, requestBasePath(req)));
  }
});

app.post(["/auth/logout", "/receipt/auth/logout"], (req, res) => {
  noCache(res);
  const tokenPath = path.join(__dirname, "token.json");
  if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
  res.status(204).end();
});

app.get(["/oauth2callback", "/receipt/oauth2callback"], async (req, res) => {
  try {
    noCache(res);
    await exchangeCode(req.query.code);
    const basePath = requestBasePath(req);
    const redirectTarget = `${basePath}/?afterAuth=1`;
    return res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Cache-Control" content="no-store"><title>Authenticated | Receipt Scanner</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e2e8f0;font:16px system-ui,sans-serif}.panel{text-align:center;padding:24px}.spinner{width:24px;height:24px;margin:0 auto 18px;border:3px solid #475569;border-top-color:#60a5fa;border-radius:50%;animation:spin .8s linear infinite}h1{font-size:24px;margin:0 0 8px}.muted{color:#94a3b8}@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><main class="panel"><div class="spinner" role="status" aria-label="Redirecting"></div><h1>You are authenticated.</h1><p class="muted">Redirecting to Receipt Scanner...</p></main>
<script>window.setTimeout(function(){window.location.replace(${JSON.stringify(redirectTarget)});},1200);</script></body></html>`);
  } catch (e) {
    noCache(res);
    res.status(500).type("html").send(authErrorPage("Google sign-in failed", e.message, requestBasePath(req)));
  }
});

// ---------- REST CRUD ----------
const api = express.Router();

api.get("/ocr-info", (_req, res) => {
  res.json(getOcrInfo());
});

api.get("/profile", async (_req, res) => {
  if (!hasSavedToken()) return res.status(401).json({ error: "Not authenticated" });
  try {
    res.json(await getProfile());
  } catch {
    res.status(502).json({ error: "Could not load Google account details." });
  }
});

api.post("/uploads", (req, res, next) => {
  if (!hasSavedToken()) return res.status(401).json({ error: "Sign in with Google before uploading receipts." });
  uploadPdfFiles(req, res, (error) => {
    if (!error) return next();
    const tooManyFiles = error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE";
    const status = error.code === "LIMIT_FILE_SIZE" || tooManyFiles ? 413 : 400;
    res.status(status).json({ error: tooManyFiles ? "Upload up to five PDFs at a time." : error.message });
  });
}, async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: "Choose at least one PDF to upload." });
  const results = [];

  for (const file of req.files) {
    const name = path.basename(file.originalname || "upload.pdf");
    if (!name.toLowerCase().endsWith(".pdf") || file.mimetype !== "application/pdf" || file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      results.push({ name, error: "This file is not a valid PDF." });
      continue;
    }

    try {
      const fields = await extract(file.buffer, "application/pdf", name);
      if (!fields.raw_text.trim()) throw new Error("No readable text found in this PDF.");
      const info = stmt.insert.run({
        drive_file_id: null,
        name,
        mime_type: "application/pdf",
        web_view_link: null,
        thumbnail_link: null,
        created_time: new Date().toISOString(),
        raw_text: fields.raw_text,
        merchant: fields.merchant,
        total: fields.total,
        currency: fields.currency,
        receipt_date: fields.receipt_date,
      });
      results.push({ id: Number(info.lastInsertRowid), name, merchant: fields.merchant, document_type: fields.document_type, total: fields.total, currency: fields.currency, receipt_date: fields.receipt_date });
    } catch (error) {
      results.push({ name, error: error.message || "Could not process this PDF." });
    }
  }

  res.status(200).json({ results });
});

api.get("/receipts", (req, res) => {
  res.json(stmt.list.all().map((receipt) => ({
    ...receipt,
    document_type: detectDocumentType(receipt.raw_text, receipt.name),
  })));
});

api.get("/receipts/:id", (req, res) => {
  const r = stmt.get.get(req.params.id);
  if (!r) return res.status(404).json({ error: "not found" });
  res.json(r);
});

api.post("/receipts", (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: "name is required" });
  const info = stmt.insert.run({
    drive_file_id: b.drive_file_id ?? null,
    name: b.name,
    mime_type: b.mime_type ?? null,
    web_view_link: b.web_view_link ?? null,
    thumbnail_link: b.thumbnail_link ?? null,
    created_time: b.created_time ?? null,
    raw_text: b.raw_text ?? null,
    merchant: b.merchant ?? null,
    total: b.total ?? null,
    currency: b.currency ?? null,
    receipt_date: b.receipt_date ?? null,
  });
  res.status(201).json(stmt.get.get(info.lastInsertRowid));
});

api.put("/receipts/:id", (req, res) => {
  const existing = stmt.get.get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  const b = req.body || {};
  stmt.update.run({
    id: existing.id,
    name: b.name ?? existing.name,
    merchant: b.merchant ?? existing.merchant,
    total: b.total ?? existing.total,
    currency: b.currency ?? existing.currency,
    receipt_date: b.receipt_date ?? existing.receipt_date,
    category: b.category ?? existing.category,
    notes: b.notes ?? existing.notes,
  });
  res.json(stmt.get.get(existing.id));
});

api.delete("/receipts/:id", (req, res) => {
  const info = stmt.delete.run(req.params.id);
  res.status(204).end();
});

// Scan Google Drive for receipts, OCR, and upsert.
api.post("/scan", async (req, res) => {
  try {
    const result = await scan();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use("/api", api);

app.get(["/upload", "/receipt/upload"], (req, res) => {
  noCache(res);
  const basePath = requestBasePath(req);
  if (!hasSavedToken()) return res.redirect(`${basePath}/auth`);
  const html = fs.readFileSync(path.join(__dirname, "public", "upload.html"), "utf8")
    .replace('/*BASE_PATH*/ ""', JSON.stringify(basePath))
    .replace("/*I18N_SCRIPT*/", `${basePath.replace(/\/+$/, "")}/i18n.js`);
  res.type("html").send(html);
});

// Tiny dashboard so you can trigger a scan + see results in a browser.
// BASE_PATH is injected so links work behind a proxy prefix (e.g. /receipt).
app.get(["/", "/receipt", "/receipt/"], (req, res) => {
  noCache(res);

  const basePath = requestBasePath(req);
  if (!hasSavedToken()) return res.redirect(`${basePath}/auth`);

  const injectedBase = basePath;
  const shouldAutoScan = req.query.afterAuth === "1";
  const html = fs
    .readFileSync(path.join(__dirname, "public", "index.html"), "utf8")
    .replace('/*BASE_PATH*/ ""', JSON.stringify(injectedBase))
    .replace("/*I18N_SCRIPT*/", `${injectedBase.replace(/\/+$/, "")}/i18n.js`)
    .replace("/*AUTO_SCAN*/ false", String(shouldAutoScan));
  res.type("html").send(html);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`receipt-scanner on http://localhost:${PORT}`);
  console.log(`OAuth setup:        http://localhost:${PORT}/auth`);
  console.log(`Trigger scan:       POST http://localhost:${PORT}/api/scan`);
});
