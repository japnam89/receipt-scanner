// Express server: REST CRUD over receipts + Google OAuth + /scan trigger.
require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { stmt } = require("./src/db");
const { authUrl, exchangeCode } = require("./src/drive");
const { scan } = require("./src/scan");

const app = express();
app.use(express.json());

// Base path this app is mounted under when behind a reverse proxy.
// Leave blank for local development; only set /receipt when the app is routed
// behind a proxy prefix. The browser page also derives its base from the actual
// URL to avoid broken local root requests.
const BASE_PATH = process.env.BASE_PATH || "";

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

// Lightweight liveness probe — no DB/Google dependency, so the container
// reports healthy as soon as it's listening (helps `docker ps` + Traefik
// detect a dead scanner instead of silently falling through to the portfolio).
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ---------- OAuth (one-time setup) ----------
app.get(["/auth", "/receipt/auth"], (req, res) => {
  try {
    noCache(res);
    if (hasSavedToken()) return res.redirect("/");
    res.redirect(authUrl());
  } catch (e) {
    noCache(res);
    res.status(500).send(`<h1>Auth not configured</h1><p>${e.message}</p>`);
  }
});

app.get(["/oauth2callback", "/receipt/oauth2callback"], async (req, res) => {
  try {
    noCache(res);
    await exchangeCode(req.query.code);
    const redirectTarget = BASE_PATH ? `${BASE_PATH}/?afterAuth=1` : "/?afterAuth=1";
    return res.redirect(redirectTarget);
  } catch (e) {
    noCache(res);
    res.status(500).send(`<h1>Auth failed</h1><p>${e.message}</p>`);
  }
});

// ---------- REST CRUD ----------
const api = express.Router();

api.get("/receipts", (req, res) => {
  res.json(stmt.list.all());
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

// Tiny dashboard so you can trigger a scan + see results in a browser.
// BASE_PATH is injected so links work behind a proxy prefix (e.g. /receipt).
app.get(["/", "/receipt", "/receipt/"], (req, res) => {
  noCache(res);

  if (!hasSavedToken()) return res.redirect("/auth");

  const injectedBase = req.originalUrl.startsWith("/receipt") ? BASE_PATH || "/receipt" : "";
  const shouldAutoScan = req.query.afterAuth === "1";
  const html = fs
    .readFileSync(path.join(__dirname, "public", "index.html"), "utf8")
    .replace("/*BASE_PATH*/", JSON.stringify(injectedBase))
    .replace("/*AUTO_SCAN*/", String(shouldAutoScan));
  res.type("html").send(html);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`receipt-scanner on http://localhost:${PORT}`);
  console.log(`OAuth setup:        http://localhost:${PORT}/auth`);
  console.log(`Trigger scan:       POST http://localhost:${PORT}/api/scan`);
});
