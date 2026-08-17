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

// Base path this app is mounted under when behind a reverse proxy
// (e.g. Traefik strips /receipt and sets BASE_PATH=/receipt).
// Used only for building in-dashboard links.
const BASE_PATH = process.env.BASE_PATH || "";

// Lightweight liveness probe — no DB/Google dependency, so the container
// reports healthy as soon as it's listening (helps `docker ps` + Traefik
// detect a dead scanner instead of silently falling through to the portfolio).
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ---------- OAuth (one-time setup) ----------
app.get("/auth", (req, res) => {
  try {
    res.redirect(authUrl());
  } catch (e) {
    res.status(500).send(`<h1>Auth not configured</h1><p>${e.message}</p>`);
  }
});

app.get("/oauth2callback", async (req, res) => {
  try {
    await exchangeCode(req.query.code);
    res.send("<h1>✅ Google Drive connected.</h1><p>You can close this tab and run POST /api/scan.</p>");
  } catch (e) {
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
app.get("/", (req, res) => {
  const html = fs
    .readFileSync(path.join(__dirname, "public", "index.html"), "utf8")
    .replace("/*BASE_PATH*/", JSON.stringify(BASE_PATH));
  res.type("html").send(html);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`receipt-scanner on http://localhost:${PORT}`);
  console.log(`OAuth setup:        http://localhost:${PORT}/auth`);
  console.log(`Trigger scan:       POST http://localhost:${PORT}/api/scan`);
});
