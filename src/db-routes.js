/**
 * Database operations using async/await patterns with better-sqlite3.
 */

import { Database } from "better-sqlite3";
import path from "path";
import config from "./config.js";

const db = new Database(config.db.path);
db.pragma(config.db.pragma);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drive_file_id TEXT UNIQUE,
    name TEXT NOT NULL,
    mime_type TEXT,
    web_view_link TEXT,
    thumbnail_link TEXT,
    created_time TEXT,
    raw_text TEXT,
    merchant TEXT,
    total REAL,
    currency TEXT,
    receipt_date TEXT,
    category TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS receipt_data_migrations (
    name TEXT PRIMARY KEY
  );
`);

// Migration: Repair legacy Encore invoice totals
db.exec(`
  INSERT OR IGNORE INTO receipt_data_migrations (name) VALUES ('repair-encore-invoice-totals-v1');
`);

/**
 * SQL statement cache.
 */
const stmt = {
  insert: db.prepare(`
    INSERT INTO receipts
      (drive_file_id, name, mime_type, web_view_link, thumbnail_link, created_time, raw_text, merchant, total, currency, receipt_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(drive_file_id) DO UPDATE SET
      name=excluded.name, mime_type=excluded.mime_type, web_view_link=excluded.web_view_link,
      thumbnail_link=excluded.thumbnail_link, created_time=excluded.created_time, raw_text=excluded.raw_text,
      merchant=excluded.merchant, total=excluded.total, currency=excluded.currency, receipt_date=excluded.receipt_date,
      updated_at=datetime('now')
  `),
  list: db.prepare("SELECT * FROM receipts ORDER BY created_time DESC, id DESC"),
  get: db.prepare("SELECT * FROM receipts WHERE id = ?"),
  update: db.prepare(`
    UPDATE receipts SET
      name=?, merchant=?, total=?, currency=?, receipt_date=?, category=?, notes=?,
      updated_at=datetime('now')
    WHERE id=?
  `),
  delete: db.prepare("DELETE FROM receipts WHERE id = ?"),
  getByDriveId: db.prepare("SELECT * FROM receipts WHERE drive_file_id = ?"),
};

/**
 * Insert or upsert a receipt.
 */
export function insert(receipt) {
  const existing = receipt.drive_file_id ? stmt.getByDriveId.get(receipt.drive_file_id) : null;

  const fields = [
    receipt.drive_file_id ?? null,
    receipt.name,
    receipt.mime_type ?? null,
    receipt.web_view_link ?? null,
    receipt.thumbnail_link ?? null,
    receipt.created_time ?? null,
    receipt.raw_text ?? null,
    receipt.merchant ?? existing?.merchant ?? null,
    receipt.total ?? existing?.total ?? null,
    receipt.currency ?? existing?.currency ?? null,
    receipt.receipt_date ?? existing?.receipt_date ?? null,
  ];

  const result = stmt.insert.run(fields);
  return existing ? stmt.getByDriveId.get(receipt.drive_file_id) : null;
}

/**
 * List all receipts.
 */
export function listAll() {
  const rows = stmt.list.all();
  
  return rows.map(row => ({
    ...row,
    document_type: detectDocumentType(row.raw_text || "", row.name),
  }));
}

/**
 * Get a receipt by ID.
 */
export function getById(id) {
  return stmt.get.get(String(id)) || null;
}

/**
 * Update a receipt by ID.
 */
export function update(id, fields) {
  const existing = getById(id);
  
  if (!existing) return null;
  
  const fieldsWithValues = [
    id,
    fields.name ?? existing.name,
    fields.merchant ?? existing.merchant,
    fields.total ?? existing.total,
    fields.currency ?? existing.currency,
    fields.receipt_date ?? existing.receipt_date,
    fields.category ?? existing.category,
    fields.notes ?? existing.notes,
  ];

  stmt.update.run(fieldsWithValues);
  
  return getById(id);
}

/**
 * Delete a receipt by ID.
 */
export function deleteReceipt(id) {
  const info = stmt.delete.run(String(id));
  return true;
}

/**
 * Scan all receipts from Google Drive and OCR them.
 */
export async function scanAll() {
  try {
    // List files from Drive
    const drive = google.drive({ version: "v3", auth: google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      [process.env.OAUTH_REDIRECT_URI || `http://localhost:${process.env.PORT || 4000}/oauth2callback`],
    )});
    
    const q = "trashed = false AND (mimeType = 'application/pdf' OR mimeType contains 'image/') AND (name contains 'receipt' OR name contains 'invoice' OR name contains 'bill')";
    
    const response = await drive.files.list({
      q,
      pageSize: 100,
      fields: "files(id, name, mimeType, webViewLink, thumbnailLink, createdTime)",
    });

    const files = response.data?.files || [];
    const results = [];

    for (const file of files) {
      try {
        // Download file
        const response2 = await drive.files.get({ fileId: file.id, alt: "media" }, { responseType: "arraybuffer" });
        const buf = Buffer.from(response2.data);
        
        // Extract OCR fields
        const fields = await ocr.extract(buf, file.mimeType, file.name);

        // Insert or update
        const saved = insert({
          drive_file_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          web_view_link: file.webViewLink || null,
          thumbnail_link: file.thumbnailLink || null,
          created_time: file.createdTime || null,
          ...fields,
        });

        results.push({
          fileId: file.id,
          name: file.name,
          extracted: fields,
          saved,
        });
      } catch (error) {
        results.push({
          fileId: file.id,
          name: file.name,
          error: error.message,
        });
      }
    }

    return { scanned: files.length, results };
  } catch (error) {
    throw new Error(`Drive scan failed: ${error.message}`);
  }
}

export { db, stmt };
