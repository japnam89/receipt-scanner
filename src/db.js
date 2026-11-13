// SQLite store for receipts (better-sqlite3 — synchronous, zero-config file DB).
const path = require("path");
const Database = require("better-sqlite3");
const { firstMoney } = require("./ocr");

const db = new Database(process.env.DB_PATH || path.join(__dirname, "..", "receipts.db"));
db.pragma("journal_mode = WAL");

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

const repairLegacyEncoreTotals = db.transaction(() => {
  const migration = "repair-encore-invoice-totals-v1";
  if (db.prepare("SELECT 1 FROM receipt_data_migrations WHERE name = ?").get(migration)) return;

  const rows = db.prepare(`
    SELECT id, total, raw_text
    FROM receipts
    WHERE raw_text LIKE '%Encore Auctions%'
      AND raw_text LIKE '%Total Quantity:%'
      AND raw_text LIKE '%Invoice Total:%'
  `).all();
  const updateTotal = db.prepare("UPDATE receipts SET total = ?, updated_at = datetime('now') WHERE id = ?");

  for (const row of rows) {
    const quantityMatch = row.raw_text.match(/(?:^|\n)\s*(\d+(?:\.\d+)?)\s*Total Quantity\s*:/i);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : null;
    if (quantity === null || Number(row.total) !== quantity) continue;

    const correctedTotal = firstMoney(row.raw_text);
    if (correctedTotal !== null && correctedTotal !== row.total) updateTotal.run(correctedTotal, row.id);
  }

  db.prepare("INSERT INTO receipt_data_migrations (name) VALUES (?)").run(migration);
});
repairLegacyEncoreTotals();

const stmt = {
  insert: db.prepare(`
    INSERT INTO receipts
      (drive_file_id, name, mime_type, web_view_link, thumbnail_link, created_time, raw_text, merchant, total, currency, receipt_date)
    VALUES (@drive_file_id, @name, @mime_type, @web_view_link, @thumbnail_link, @created_time, @raw_text, @merchant, @total, @currency, @receipt_date)
    ON CONFLICT(drive_file_id) DO UPDATE SET
      name=excluded.name,
      mime_type=excluded.mime_type,
      web_view_link=excluded.web_view_link,
      thumbnail_link=excluded.thumbnail_link,
      created_time=excluded.created_time,
      raw_text=excluded.raw_text,
      merchant=excluded.merchant,
      total=excluded.total,
      currency=excluded.currency,
      receipt_date=excluded.receipt_date,
      updated_at=datetime('now')
  `),
  list: db.prepare(`SELECT * FROM receipts ORDER BY created_time DESC, id DESC`),
  get: db.prepare(`SELECT * FROM receipts WHERE id = ?`),
  update: db.prepare(`
    UPDATE receipts SET
      name=@name, merchant=@merchant, total=@total, currency=@currency,
      receipt_date=@receipt_date, category=@category, notes=@notes,
      updated_at=datetime('now')
    WHERE id=@id
  `),
  delete: db.prepare(`DELETE FROM receipts WHERE id = ?`),
  getByDriveId: db.prepare(`SELECT * FROM receipts WHERE drive_file_id = ?`),
};

function upsertFromDrive(rec) {
  // Only auto-fill fields that Drive/OCR produced; never clobber manual edits
  // to merchant/total/date unless the new value is present.
  const existing = rec.drive_file_id ? stmt.getByDriveId.get(rec.drive_file_id) : null;
  stmt.insert.run({
    drive_file_id: rec.drive_file_id ?? null,
    name: rec.name,
    mime_type: rec.mime_type ?? null,
    web_view_link: rec.web_view_link ?? null,
    thumbnail_link: rec.thumbnail_link ?? null,
    created_time: rec.created_time ?? null,
    raw_text: rec.raw_text ?? null,
    merchant: rec.merchant ?? existing?.merchant ?? null,
    total: rec.total ?? existing?.total ?? null,
    currency: rec.currency ?? existing?.currency ?? null,
    receipt_date: rec.receipt_date ?? existing?.receipt_date ?? null,
  });
  return rec.drive_file_id ? stmt.getByDriveId.get(rec.drive_file_id) : null;
}

module.exports = { db, stmt, upsertFromDrive };
